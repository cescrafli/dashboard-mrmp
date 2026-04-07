from flask import Flask, render_template, jsonify, request
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
from flask_caching import Cache
from groq import Groq  # <-- TAMBAHAN: Import Groq

# Ensure VADER lexicon and stopwords are downloaded
nltk.download('vader_lexicon', quiet=True)
nltk.download('stopwords', quiet=True)
nltk.download('punkt', quiet=True)
nltk.download('punkt_tab', quiet=True)

# Load environment variables from .env file
load_dotenv()

# Baris ini SANGAT PENTING dan harus ada sebelum @app.route
app = Flask(__name__)
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

# Rute untuk halaman utama
@app.route('/')
def home():
    return render_template('index.html')

# Rute API untuk mengambil data film
@app.route('/api/data')
@cache.cached(timeout=600)
def get_movie_data():
    try:
        url = "https://api.themoviedb.org/3/movie/popular?language=en-US&page=1"
        response = requests.get(url, headers=HEADERS)
        response.raise_for_status()
        return jsonify(response.json())
    except requests.exceptions.RequestException as err:
        return jsonify({"error": str(err)}), 500

@app.route('/api/search')
def search_movies():
    from flask import request
    query = request.args.get('q', '')
    if not query:
        return jsonify({"results": []})
    try:
        url = f"https://api.themoviedb.org/3/search/movie?query={query}&language=en-US&page=1"
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
                
        # Ensure the target movie is in our list
        # Create a list without the target movie to avoid matching with itself
        movies_dataset = [m for m in similar_movies if m['id'] != movie_id]
        movies_dataset.insert(0, target_movie) # Put target movie at index 0
        
        # Extract overviews for TF-IDF
        # Replace None with empty string
        overviews = [m.get('overview', '') or '' for m in movies_dataset]
        
        # Calculate TF-IDF and Cosine Similarity
        vectorizer = TfidfVectorizer(stop_words='english')
        tfidf_matrix = vectorizer.fit_transform(overviews)
        
        # Calculate cosine similarity of target movie (index 0) against all others
        cosine_sim = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix)
        
        # Calculate Hybrid Score = Cosine Similarity * Vote Average
        # Skip index 0 which is the movie itself
        hybrid_scores = []
        for idx, sim in enumerate(cosine_sim[0]):
            if idx == 0:
                continue
            # Fallback to 0 if 'vote_average' is missing
            vote_avg = movies_dataset[idx].get('vote_average', 0)
            hybrid_score = sim * vote_avg
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
        
        analyzer = SentimentIntensityAnalyzer()
        
        for review in reviews:
            content = review.get('content', '')
            # Perform Sentiment Analysis using NLTK VADER
            scores = analyzer.polarity_scores(content)
            polarity = scores['compound']
            
            sentiment_label = 'Neutral'
            if polarity >= 0.05:
                sentiment_label = 'Positive'
                positive_count += 1
            elif polarity <= -0.05:
                sentiment_label = 'Negative'
                negative_count += 1
                
            processed_reviews.append({
                "author": review.get('author'),
                "content": content,
                "sentiment": sentiment_label,
                "polarity": round(polarity, 2)
            })
            
        # Extract Keywords
        stop_words = set(stopwords.words('english'))
        # Menambahkan stopwords tambahan yang sering muncul tapi tak bermakna dalam review
        custom_stopwords = {'movie', 'film', 'one', 'like', 'just', 'get', 'would', 'could', 'even', 'make', 'see', 'really', 'much', 'good', 'bad'}
        stop_words.update(custom_stopwords)
        
        pos_words = []
        neg_words = []
        
        for r in processed_reviews:
            text = r["content"].lower()
            # Bersihkan tanda baca
            text = text.translate(str.maketrans('', '', string.punctuation))
            tokens = word_tokenize(text)
            filtered_tokens = [w for w in tokens if w.isalpha() and w not in stop_words and len(w) > 2]
            
            if r["sentiment"] == 'Positive':
                pos_words.extend(filtered_tokens)
            elif r["sentiment"] == 'Negative':
                neg_words.extend(filtered_tokens)
                
        # Hitung frekuensi dan ambil top 5
        top_pos = [word for word, count in Counter(pos_words).most_common(5)]
        top_neg = [word for word, count in Counter(neg_words).most_common(5)]
            
        total_rated = positive_count + negative_count
        pos_pct = round((positive_count / total_rated) * 100) if total_rated > 0 else 0
        neg_pct = round((negative_count / total_rated) * 100) if total_rated > 0 else 0
        
        # ==========================================
        # TAMBAHAN: GENERATIVE AI SUMMARY (GROQ)
        # ==========================================
        ai_summary = "Ringkasan AI belum tersedia."
        if GROQ_API_KEY and processed_reviews:
            try:
                # Gabungkan ulasan untuk AI
                all_reviews_text = "\n\n".join([r['content'] for r in processed_reviews[:10]])
                
                client = Groq(api_key=GROQ_API_KEY)
                prompt = f"Bertindaklah sebagai kritikus film profesional. Baca kumpulan ulasan penonton berbahasa Inggris berikut, lalu buatkan 1 paragraf pendek (maksimal 3 kalimat) ringkasan eksekutif dalam bahasa Indonesia yang menjelaskan apa yang penonton suka dan tidak suka dari film ini.\n\nUlasan:\n{all_reviews_text}"
                
                chat_completion = client.chat.completions.create(
                    messages=[{"role": "user", "content": prompt}],
                    model="llama3-8b-8192",
                    temperature=0.5,
                )
                
                ai_summary = chat_completion.choices[0].message.content
            except Exception as e:
                ai_summary = f"Maaf, AI gagal memproses ringkasan. Error: {str(e)}"
        
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

# Menjalankan aplikasi
if __name__ == '__main__':
    app.run(debug=True)