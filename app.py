from flask import Flask, render_template, jsonify, request, Response, stream_with_context
import requests
import os
from dotenv import load_dotenv
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import nltk
from nltk.sentiment.vader import SentimentIntensityAnalyzer
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
from collections import Counter
import string
import json
from flask_caching import Cache
from groq import Groq  # <-- TAMBAHAN: Import Groq
from sentence_transformers import SentenceTransformer # <-- TAMBAHAN: Import Sentence Transformer
from transformers import pipeline

# Setup /tmp directory for serverless environments (like Vercel)
import tempfile
temp_dir = tempfile.gettempdir()
os.environ['HF_HOME'] = temp_dir
os.environ['NLTK_DATA'] = temp_dir
nltk.data.path.append(temp_dir)

# Ensure VADER lexicon and stopwords are downloaded
nltk.download('vader_lexicon', download_dir=temp_dir, quiet=True)
nltk.download('stopwords', download_dir=temp_dir, quiet=True)
nltk.download('punkt', download_dir=temp_dir, quiet=True)
nltk.download('punkt_tab', download_dir=temp_dir, quiet=True)

# Load environment variables from .env file
load_dotenv()

# Baris ini SANGAT PENTING dan harus ada sebelum @app.route
app = Flask(__name__)
redis_url = os.getenv('REDIS_URL')
if redis_url:
    cache = Cache(app, config={'CACHE_TYPE': 'RedisCache', 'CACHE_REDIS_URL': redis_url, 'CACHE_DEFAULT_TIMEOUT': 600})
else:
    # Fallback ke SimpleCache jika REDIS_URL tidak ada (untuk local development)
    cache = Cache(app, config={'CACHE_TYPE': 'SimpleCache', 'CACHE_DEFAULT_TIMEOUT': 600})

# TMDB API Credentials
API_KEY = os.getenv("TMDB_API_KEY")
READ_ACCESS_TOKEN = os.getenv("TMDB_READ_ACCESS_TOKEN")
GROQ_API_KEY = os.getenv("GROQ_API_KEY") # <-- TAMBAHAN: Kunci API Groq

# Header autentikasi menggunakan Read Access Token (lebih aman)
HEADERS = {
    "accept": "application/json",
    "Authorization": f"Bearer {READ_ACCESS_TOKEN}"
}

# ==========================================
# FASE 1 & FASE 2: GLOBAL MODEL INITIALIZATION
# ==========================================
print("Loading Models...")
sentence_model = SentenceTransformer('all-MiniLM-L6-v2')
sentiment_pipeline = pipeline("sentiment-analysis", model="distilbert-base-uncased-finetuned-sst-2-english")
print("Models Loaded.")

# Rute untuk halaman utama
@app.route('/')
def home():
    return render_template('index.html')

# Rute API untuk mengambil data film
@app.route('/api/data')
@cache.cached(timeout=600, query_string=True)
def get_movie_data():
    page = request.args.get('page', 1, type=int)
    try:
        url = f"https://api.themoviedb.org/3/movie/popular?language=en-US&page={page}"
        response = requests.get(url, headers=HEADERS)
        response.raise_for_status()
        return jsonify(response.json())
    except requests.exceptions.RequestException as err:
        return jsonify({"error": str(err)}), 500

@app.route('/api/search')
def search_movies():
    query = request.args.get('q', '')
    page = request.args.get('page', 1, type=int)
    if not query:
        return jsonify({"results": []})
    try:
        url = f"https://api.themoviedb.org/3/search/movie?query={query}&language=en-US&page={page}"
        response = requests.get(url, headers=HEADERS)
        response.raise_for_status()
        return jsonify(response.json())
    except requests.exceptions.RequestException as err:
        return jsonify({"error": str(err)}), 500

@app.route('/api/chart/ratings')
def chart_ratings():
    try:
        url = "https://api.themoviedb.org/3/movie/popular?language=en-US&page=1"
        response = requests.get(url, headers=HEADERS)
        response.raise_for_status()
        data = response.json().get('results', [])
        
        if not data:
            return "No data", 404

        # Prepare data for frontend Chart.js
        movies_data = [{'title': movie['title'][:15] + ('...' if len(movie['title']) > 15 else ''), 'rating': movie['vote_average']} for movie in data[:10]]
        
        return jsonify({"results": movies_data})
        
    except requests.exceptions.RequestException as err:
        return jsonify({"error": str(err)}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/trailer/<int:movie_id>')
@cache.cached(timeout=600)
def get_movie_trailer(movie_id):
    try:
        url = f"https://api.themoviedb.org/3/movie/{movie_id}/videos?language=en-US"
        response = requests.get(url, headers=HEADERS)
        response.raise_for_status()
        results = response.json().get('results', [])
        
        # Cari video YouTube yang bermuatan tipe 'Trailer'
        trailer_key = None
        for video in results:
            if video.get('site') == 'YouTube' and video.get('type') == 'Trailer':
                trailer_key = video.get('key')
                break
        
        return jsonify({"trailer_key": trailer_key})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/recommendations/<int:movie_id>')
@cache.cached(timeout=600)
def movie_recommendations(movie_id):
    try:
        # First, query the target movie to get its details
        target_url = f"https://api.themoviedb.org/3/movie/{movie_id}?language=en-US"
        target_res = requests.get(target_url, headers=HEADERS)
        target_res.raise_for_status()
        target_movie = target_res.json()
        
        # Fetch similar movies from TMDb endpoint
        similar_url = f"https://api.themoviedb.org/3/movie/{movie_id}/similar?language=en-US&page=1"
        similar_res = requests.get(similar_url, headers=HEADERS)
        similar_movies = similar_res.json().get('results', []) if similar_res.status_code == 200 else []
                
        # Fetch genre mappings
        genre_url = "https://api.themoviedb.org/3/genre/movie/list?language=en-US"
        genre_res = requests.get(genre_url, headers=HEADERS)
        genre_map = {g['id']: g['name'] for g in genre_res.json().get('genres', [])} if genre_res.status_code == 200 else {}
        
        # Ensure the target movie is in our list
        # Create a list without the target movie to avoid matching with itself
        movies_dataset = [m for m in similar_movies if m['id'] != movie_id]
        movies_dataset.insert(0, target_movie)  # Put target movie at index 0
        
        # Calculate min & max for Min-Max Scaling (Vote Average and Popularity)
        vote_averages = [m.get('vote_average', 0) for m in movies_dataset]
        popularities = [m.get('popularity', 0) for m in movies_dataset]
        
        # Handle cases where all values are the same (max == min) to prevent division by zero
        min_v, max_v = min(vote_averages), max(vote_averages)
        min_p, max_p = min(popularities), max(popularities)
        
        v_range = max_v - min_v if max_v > min_v else 1
        p_range = max_p - min_p if max_p > min_p else 1
        
        # Extract overviews and append genres for robust semantic search
        overviews = []
        for m in movies_dataset:
            text = m.get('overview', '') or ''
            # Get genre names
            if 'genres' in m:
                g_names = [g['name'] for g in m['genres']]
            else:
                g_names = [genre_map.get(gid, '') for gid in m.get('genre_ids', []) if gid in genre_map]
            
            g_str = ", ".join(g_names)
            overviews.append(f"{text} Genres: {g_str}")
        
        # Use global model for better performance
        embeddings = sentence_model.encode(overviews)
        
        # Calculate cosine similarity of target movie (index 0) against all others
        cosine_sim = cosine_similarity([embeddings[0]], embeddings)
        
        # Calculate Hybrid Score = 0.5*Cosine + 0.3*Vote_Avg_Norm + 0.2*Pop_Norm
        # Skip index 0 which is the movie itself
        hybrid_scores = []
        for idx, sim in enumerate(cosine_sim[0]):
            if idx == 0:
                continue
                
            norm_vote = (movies_dataset[idx].get('vote_average', 0) - min_v) / v_range
            norm_pop = (movies_dataset[idx].get('popularity', 0) - min_p) / p_range
            
            hybrid_score = (0.5 * sim) + (0.3 * norm_vote) + (0.2 * norm_pop)
            hybrid_scores.append((idx, hybrid_score))
            
        # Get indices of top 5 based on hybrid score
        hybrid_scores = sorted(hybrid_scores, key=lambda x: x[1], reverse=True)
        top_indices = [i[0] for i in hybrid_scores[:5] if i[0] < len(movies_dataset)]
        
        # Extract recommended movies
        recommendations = [movies_dataset[i] for i in top_indices]
        
        return jsonify({"results": recommendations})
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/reviews/<int:movie_id>')
@cache.cached(timeout=600)
def movie_reviews(movie_id):
    try:
        url = f"https://api.themoviedb.org/3/movie/{movie_id}/reviews?language=en-US&page=1"
        response = requests.get(url, headers=HEADERS)
        response.raise_for_status()
        reviews = response.json().get('results', [])
        
        if not reviews:
            return jsonify({
                "total": 0,
                "positive_percentage": 0,
                "negative_percentage": 0,
                "reviews": []
            })
            
        processed_reviews = []
        positive_count = 0
        negative_count = 0
        
        for review in reviews:
            content = review.get('content', '')
            try:
                # Perform Sentiment Analysis using Transformers Pipeline
                truncated_content = content[:1500] 
                result = sentiment_pipeline(truncated_content)[0]
                label = result['label']
                score = result['score']
                
                if label == 'POSITIVE':
                    sentiment_label = 'Positive'
                    polarity = score # Approximation
                    positive_count += 1
                else:
                    sentiment_label = 'Negative'
                    polarity = -score
                    negative_count += 1
            except Exception as e:
                sentiment_label = 'Neutral'
                polarity = 0
                
            processed_reviews.append({
                "author": review.get('author'),
                "content": content,
                "sentiment": sentiment_label,
                "polarity": round(polarity, 2)
            })
            
        # Extract Keywords using TF-IDF
        stop_words = set(stopwords.words('english'))
        custom_stopwords = {'movie', 'film', 'one', 'like', 'just', 'get', 'would', 'could', 'even', 'make', 'see', 'really', 'much', 'good', 'bad', 'the', 'and', 'it', 'is', 'in'}
        stop_words.update(custom_stopwords)
        
        pos_texts = [r["content"] for r in processed_reviews if r["sentiment"] == 'Positive']
        neg_texts = [r["content"] for r in processed_reviews if r["sentiment"] == 'Negative']
        
        def extract_top_keywords(texts, top_k=5):
            if not texts:
                return []
            try:
                vectorizer = TfidfVectorizer(stop_words=list(stop_words), max_features=100)
                tfidf_matrix = vectorizer.fit_transform(texts)
                scores = zip(vectorizer.get_feature_names_out(), tfidf_matrix.sum(axis=0).tolist()[0])
                sorted_scores = sorted(scores, key=lambda x: x[1], reverse=True)
                return [word for word, score in sorted_scores[:top_k]]
            except:
                return []
                
        top_pos = extract_top_keywords(pos_texts)
        top_neg = extract_top_keywords(neg_texts)
            
        total_rated = positive_count + negative_count
        pos_pct = round((positive_count / total_rated) * 100) if total_rated > 0 else 0
        neg_pct = round((negative_count / total_rated) * 100) if total_rated > 0 else 0
        
        # ==========================================
        # TAMBAHAN: GENERATIVE AI SUMMARY (GROQ) JSON
        # ==========================================
        ai_summary = {"ringkasan": "Ringkasan AI belum tersedia.", "kelebihan": [], "kekurangan": []}
        if GROQ_API_KEY and processed_reviews:
            try:
                # Gabungkan ulasan untuk AI
                all_reviews_text = "\n\n".join([r['content'] for r in processed_reviews[:10]])
                
                client = Groq(api_key=GROQ_API_KEY)
                prompt = f"""Anda adalah analis film profesional dan ahli data. Baca kumpulan ulasan penonton berbahasa Inggris berikut, lalu kembalikan respons MURNI dalam format JSON. 

Instruksi Ekstraksi:
1. 'ringkasan': Buat 1 paragraf pendek (maksimal 4 kalimat) dalam bahasa Indonesia yang merangkum sentimen mayoritas penonton.
2. 'kelebihan': Array of strings berisi maksimal 3 poin positif utama yang paling sering dipuji (dalam bahasa Indonesia).
3. 'kekurangan': Array of strings berisi maksimal 3 poin negatif utama yang paling sering dikritik (dalam bahasa Indonesia).

Batasan: JANGAN menambahkan teks apa pun di luar JSON. Pastikan format JSON valid.

Format yang diwajibkan:
{{"ringkasan": "...", "kelebihan": ["..."], "kekurangan": ["..."]}}

Kumpulan Ulasan:
{all_reviews_text}
"""                
                chat_completion = client.chat.completions.create(
                    messages=[{"role": "user", "content": prompt}],
                    model="llama-3.3-70b-versatile",
                    temperature=0.5,
                    response_format={"type": "json_object"}
                )
                
                ai_data = json.loads(chat_completion.choices[0].message.content)
                ai_summary = {
                    "ringkasan": ai_data.get("ringkasan", ""),
                    "kelebihan": ai_data.get("kelebihan", []),
                    "kekurangan": ai_data.get("kekurangan", [])
                }
            except Exception as e:
                ai_summary["ringkasan"] = f"Maaf, AI gagal memproses ringkasan. Error: {str(e)}"
        
        # Potong konten setelah ekstraksi keyword agar rapi di UI
        for r in processed_reviews:
            if len(r["content"]) > 200:
                r["content"] = r["content"][:200] + "..."
        
        return jsonify({
            "total": len(reviews),
            "positive_percentage": pos_pct,
            "negative_percentage": neg_pct,
            "top_positive_keywords": top_pos,
            "top_negative_keywords": top_neg,
            "ai_summary": ai_summary, # <-- TAMBAHAN: Mengirim ringkasan ke frontend
            "reviews": processed_reviews[:5] # Return top 5 reviews
        })
        
    except requests.exceptions.RequestException as err:
        return jsonify({"error": str(err)}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/qa/<int:movie_id>', methods=['POST'])
def movie_qa(movie_id):
    if not GROQ_API_KEY:
        return jsonify({"error": "GROQ_API_KEY tidak tersambung."}), 500
        
    data = request.json
    user_question = data.get('question', '')
    if not user_question:
        return jsonify({"error": "Pertanyaan wajib diisi."}), 400
        
    try:
        # Mengambil ulasan lagi untuk konteks AI
        url = f"https://api.themoviedb.org/3/movie/{movie_id}/reviews?language=en-US&page=1"
        response = requests.get(url, headers=HEADERS)
        response.raise_for_status()
        reviews = response.json().get('results', [])
        
        if not reviews:
            return jsonify({"answer": "Maaf, belum ada ulasan murni (konteks) yang bisa dimanfaatkan untuk menjawab pertanyaan ini."})
            
        all_reviews_text_list = [r.get('content', '') for r in reviews]
        
        # RAG Logic: Lakukan perhitungan similarity teks menggukan Sentence Transformer
        embeddings = sentence_model.encode([user_question] + all_reviews_text_list)
        qa_cosine_sim = cosine_similarity([embeddings[0]], embeddings[1:])[0]
        
        # Urutkan index berdasarkan similarity terbesar, ambil top 3
        top_indices = sorted(range(len(qa_cosine_sim)), key=lambda i: qa_cosine_sim[i], reverse=True)[:3]
        
        # Extract 3 review paling mirip
        top_3_reviews = [all_reviews_text_list[i] for i in top_indices]
        
        combined_context = "\n\n---\n\n".join(top_3_reviews)
        
        client = Groq(api_key=GROQ_API_KEY)
        prompt = f"""Anda adalah MRMP-Bot, asisten cerdas yang ramah untuk mengeksplorasi film. Tugas Anda adalah menjawab pertanyaan pengguna HANYA berdasarkan konteks ulasan penonton yang diberikan di bawah ini.

Aturan ketat:
1. Jika informasi untuk menjawab TIDAK ADA di dalam konteks ulasan, katakan: "Maaf, saya tidak menemukan informasi tersebut dari ulasan penonton yang tersedia."
2. JANGAN PERNAH mengarang informasi (halusinasi) dari luar teks ulasan ini.
3. HARUS sertakan kutipan langsung pendek yang diapit tanda kutip ("...") dari ulasan untuk mendukung jawaban Anda.
4. Jawablah menggunakan bahasa Indonesia yang santai dan profesional.

Konteks Ulasan (Top 3 Paling Relevan):
{combined_context}

Pertanyaan Pengguna: {user_question}
"""        
        def generate():
            try:
                stream = client.chat.completions.create(
                    messages=[{"role": "user", "content": prompt}],
                    model="llama-3.3-70b-versatile",
                    temperature=0.3,
                    stream=True
                )
                for chunk in stream:
                    if chunk.choices[0].delta.content is not None:
                        yield f"data: {json.dumps({'text': chunk.choices[0].delta.content})}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
                
        return Response(stream_with_context(generate()), mimetype='text/event-stream')
        
    except requests.exceptions.RequestException as err:
        return jsonify({"error": str(err)}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Menjalankan aplikasi
if __name__ == '__main__':
    app.run(debug=True)