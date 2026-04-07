from flask import Flask, render_template, jsonify
import requests
import os
from dotenv import load_dotenv
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import nltk
from nltk.sentiment.vader import SentimentIntensityAnalyzer

# Ensure VADER lexicon is downloaded
nltk.download('vader_lexicon', quiet=True)

# Load environment variables from .env file
load_dotenv()

# Baris ini SANGAT PENTING dan harus ada sebelum @app.route
app = Flask(__name__)

# TMDB API Credentials
API_KEY = os.getenv("TMDB_API_KEY")
READ_ACCESS_TOKEN = os.getenv("TMDB_READ_ACCESS_TOKEN")

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
        
        # Get indices of top 5 most similar movies (skipping index 0 which is the movie itself)
        sim_scores = list(enumerate(cosine_sim[0]))
        sim_scores = sorted(sim_scores, key=lambda x: x[1], reverse=True)
        top_indices = [i[0] for i in sim_scores[1:6] if i[0] < len(movies_dataset)]
        
        # Extract recommended movies
        recommendations = [movies_dataset[i] for i in top_indices]
        
        return jsonify({"results": recommendations})
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/reviews/<int:movie_id>')
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
                "content": content[:200] + "..." if len(content) > 200 else content,
                "sentiment": sentiment_label,
                "polarity": round(polarity, 2)
            })
            
        total_rated = positive_count + negative_count
        pos_pct = round((positive_count / total_rated) * 100) if total_rated > 0 else 0
        neg_pct = round((negative_count / total_rated) * 100) if total_rated > 0 else 0
        
        return jsonify({
            "total": len(reviews),
            "positive_percentage": pos_pct,
            "negative_percentage": neg_pct,
            "reviews": processed_reviews[:5] # Return top 5 reviews
        })
        
    except requests.exceptions.RequestException as err:
        return jsonify({"error": str(err)}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Menjalankan aplikasi
if __name__ == '__main__':
    app.run(debug=True)