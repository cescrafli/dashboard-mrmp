import json
import requests
from flask import Blueprint, jsonify, request, Response, stream_with_context
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.feature_extraction.text import TfidfVectorizer
from nltk.corpus import stopwords
from groq import Groq
from core.extensions import cache
from core.config import Config
from ml.models import hf_get_embeddings, hf_get_sentiment

advanced_bp = Blueprint('api_advanced', __name__, url_prefix='/api')

@advanced_bp.route('/recommendations/<int:movie_id>')
@cache.cached(timeout=600)
def movie_recommendations(movie_id):
    try:
        target_url = f"https://api.themoviedb.org/3/movie/{movie_id}?language=en-US"
        target_res = requests.get(target_url, headers=Config.TMDB_HEADERS)
        target_res.raise_for_status()
        target_movie = target_res.json()
        
        similar_url = f"https://api.themoviedb.org/3/movie/{movie_id}/similar?language=en-US&page=1"
        similar_res = requests.get(similar_url, headers=Config.TMDB_HEADERS)
        similar_movies = similar_res.json().get('results', []) if similar_res.status_code == 200 else []
                
        genre_url = "https://api.themoviedb.org/3/genre/movie/list?language=en-US"
        genre_res = requests.get(genre_url, headers=Config.TMDB_HEADERS)
        genre_map = {g['id']: g['name'] for g in genre_res.json().get('genres', [])} if genre_res.status_code == 200 else {}
        
        movies_dataset = [m for m in similar_movies if m['id'] != movie_id]
        movies_dataset.insert(0, target_movie)  
        
        vote_averages = [m.get('vote_average', 0) for m in movies_dataset]
        popularities = [m.get('popularity', 0) for m in movies_dataset]
        
        min_v, max_v = min(vote_averages), max(vote_averages)
        min_p, max_p = min(popularities), max(popularities)
        
        v_range = max_v - min_v if max_v > min_v else 1
        p_range = max_p - min_p if max_p > min_p else 1
        
        overviews = []
        for m in movies_dataset:
            text = m.get('overview', '') or ''
            if 'genres' in m:
                g_names = [g['name'] for g in m['genres']]
            else:
                g_names = [genre_map.get(gid, '') for gid in m.get('genre_ids', []) if gid in genre_map]
            
            g_str = ", ".join(g_names)
            overviews.append(f"{text} Genres: {g_str}")
        
        # Call Hugging Face API instead of local model
        embeddings = hf_get_embeddings(overviews)
        
        cosine_sim = cosine_similarity([embeddings[0]], embeddings)
        
        hybrid_scores = []
        for idx, sim in enumerate(cosine_sim[0]):
            if idx == 0:
                continue
                
            norm_vote = (movies_dataset[idx].get('vote_average', 0) - min_v) / v_range
            norm_pop = (movies_dataset[idx].get('popularity', 0) - min_p) / p_range
            
            hybrid_score = (0.5 * sim) + (0.3 * norm_vote) + (0.2 * norm_pop)
            hybrid_scores.append((idx, hybrid_score))
            
        hybrid_scores = sorted(hybrid_scores, key=lambda x: x[1], reverse=True)
        top_indices = [i[0] for i in hybrid_scores[:5] if i[0] < len(movies_dataset)]
        
        recommendations = [movies_dataset[i] for i in top_indices]
        
        return jsonify({"results": recommendations})
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@advanced_bp.route('/reviews/<int:movie_id>')
@cache.cached(timeout=600)
def movie_reviews(movie_id):
    try:
        url = f"https://api.themoviedb.org/3/movie/{movie_id}/reviews?language=en-US&page=1"
        response = requests.get(url, headers=Config.TMDB_HEADERS)
        response.raise_for_status()
        reviews = response.json().get('results', [])
        
        if not reviews:
            return jsonify({
                "total": 0,
                "positive_percentage": 0,
                "negative_percentage": 0,
                "reviews": []
            })
            
        positive_count = 0
        negative_count = 0
        processed_reviews = []
        
        # Batasi ke 10 target review untuk menjaga rate limit HF Free Tier
        target_reviews = reviews[:10]
        valid_contents = [r.get('content', '')[:1500] for r in target_reviews]
        
        sentiments_res = None
        try:
            if valid_contents:
                # Call Hugging Face API
                sentiments_res = hf_get_sentiment(valid_contents)
        except Exception as e:
            print("HF Sentiment Error:", e)

        for i, review in enumerate(target_reviews):
            content = valid_contents[i]
            author = review.get('author')
            sentiment_label = 'Neutral'
            polarity = 0
            
            if sentiments_res and i < len(sentiments_res):
                res_item = sentiments_res[i]
                if isinstance(res_item, list) and len(res_item) > 0:
                    res_obj = res_item[0]
                else:
                    res_obj = res_item
                try:
                    label = res_obj.get('label', '')
                    score = res_obj.get('score', 0)
                    if label == 'POSITIVE':
                        sentiment_label = 'Positive'
                        polarity = score
                        positive_count += 1
                    elif label == 'NEGATIVE':
                        sentiment_label = 'Negative'
                        polarity = -score
                        negative_count += 1
                except:
                    pass
            
            processed_reviews.append({
                "author": author,
                "content": review.get('content', ''), 
                "sentiment": sentiment_label,
                "polarity": round(polarity, 2)
            })
            
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
        
        ai_summary = {"ringkasan": "Ringkasan AI belum tersedia.", "kelebihan": [], "kekurangan": []}
        if Config.GROQ_API_KEY and processed_reviews:
            try:
                all_reviews_text = "\n\n".join([r['content'] for r in processed_reviews[:10]])
                
                client = Groq(api_key=Config.GROQ_API_KEY)
                prompt = f"""You are a professional film analyst and data expert. Read the following collection of English audience reviews, then return a PURE response in JSON format. 

Extraction Instructions:
1. 'ringkasan': Create 1 short paragraph (maximum 4 sentences) in Indonesian that summarizes the majority audience sentiment.
2. 'kelebihan': Array of strings containing a maximum of 3 main positive points that are most frequently praised (in Indonesian).
3. 'kekurangan': Array of strings containing a maximum of 3 main negative points that are most frequently criticized (in Indonesian).

Limitation: DO NOT add any text outside the JSON. Ensure the JSON format is valid.

Required format:
{{"ringkasan": "...", "kelebihan": ["..."], "kekurangan": ["..."]}}

Review Collection:
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
                ai_summary["ringkasan"] = f"Sorry, AI failed to process the summary. Error: {str(e)}"
        
        for r in processed_reviews:
            if len(r["content"]) > 200:
                r["content"] = r["content"][:200] + "..."
        
        return jsonify({
            "total": len(reviews),
            "positive_percentage": pos_pct,
            "negative_percentage": neg_pct,
            "top_positive_keywords": top_pos,
            "top_negative_keywords": top_neg,
            "ai_summary": ai_summary,
            "reviews": processed_reviews[:5] 
        })
        
    except requests.exceptions.RequestException as err:
        return jsonify({"error": str(err)}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@advanced_bp.route('/qa/<int:movie_id>', methods=['POST'])
def movie_qa(movie_id):
    if not Config.GROQ_API_KEY:
        return jsonify({"error": "GROQ_API_KEY not connected."}), 500
        
    data = request.json
    user_question = data.get('question', '')
    if not user_question:
        return jsonify({"error": "Required question."}), 400
        
    try:
        url = f"https://api.themoviedb.org/3/movie/{movie_id}/reviews?language=en-US&page=1"
        response = requests.get(url, headers=Config.TMDB_HEADERS)
        response.raise_for_status()
        reviews = response.json().get('results', [])
        
        if not reviews:
            return jsonify({"answer": "Sorry, there are no pure reviews (context) available that can be used to answer this question."})            
        all_reviews_text_list = [r.get('content', '') for r in reviews[:10]] # Limit to 10
        
        # Call Hugging Face API instead of local SentenceTransformer
        embeddings = hf_get_embeddings([user_question] + all_reviews_text_list)
        qa_cosine_sim = cosine_similarity([embeddings[0]], embeddings[1:])[0]
        
        top_indices = sorted(range(len(qa_cosine_sim)), key=lambda i: qa_cosine_sim[i], reverse=True)[:3]
        top_3_reviews = [all_reviews_text_list[i] for i in top_indices]
        combined_context = "\n\n---\n\n".join(top_3_reviews)
        
        client = Groq(api_key=Config.GROQ_API_KEY)
        prompt = f"""You are MRMP-Bot, a friendly smart assistant for exploring movies. Your task is to answer user questions ONLY based on the context of the viewer reviews provided below.

Strict rules:
1. If the information to answer is NOT present in the review context, say: "Sorry, I could not find that information from the available audience reviews."
2. NEVER make up information (hallucinate) from outside this review text.
3. MUST include short direct quotes in quotation marks ("...") from the reviews to support your answer.
4. Answer using casual and professional Indonesian language.

Review Context (Top 3 Most Relevant):
{combined_context}

User Question: {user_question}
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
