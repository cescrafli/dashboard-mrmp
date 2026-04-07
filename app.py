from flask import Flask, render_template, jsonify
import requests
import os
from dotenv import load_dotenv
import pandas as pd
import matplotlib
import matplotlib.pyplot as plt
import io
import base64
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from textblob import TextBlob

# Use non-interactive backend for matplotlib
matplotlib.use('Agg')

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

        # Prepare data for pandas
        movies = [{'title': movie['title'][:15] + ('...' if len(movie['title']) > 15 else ''), 'rating': movie['vote_average']} for movie in data[:10]]
        df = pd.DataFrame(movies)
        
        # Create chart
        plt.figure(figsize=(10, 6))
        
        # Define visually pleasing colors - gradient-like bar chart
        colors = plt.cm.viridis(df['rating'] / 10.0)
        
        bars = plt.bar(df['title'], df['rating'], color=colors)
        
        # Chart styling
        plt.title('Top 10 Popular Movies Rating (TMDb)', fontsize=16, fontweight='bold', color='#ffffff')
        plt.xlabel('Movie Title', fontsize=12, color='#b3b3b3')
        plt.ylabel('Average Rating', fontsize=12, color='#b3b3b3')
        plt.xticks(rotation=45, ha='right', color='#b3b3b3')
        plt.yticks(color='#b3b3b3')
        plt.ylim(0, 10.5)
        plt.grid(axis='y', linestyle='--', alpha=0.3, color='#b3b3b3')
        
        # Transparent background for the chart to blend with dark mode
        plt.gcf().patch.set_facecolor('#14181c')
        plt.gca().set_facecolor('#282828')
        
        # Add values on top of bars
        for bar in bars:
            yval = bar.get_height()
            plt.text(bar.get_x() + bar.get_width()/2, yval + 0.1, round(yval, 1), ha='center', va='bottom', color='white', fontweight='bold')
            
        plt.tight_layout()

        # Save to buffer
        buf = io.BytesIO()
        plt.savefig(buf, format='png', facecolor=plt.gcf().get_facecolor(), transparent=True)
        buf.seek(0)
        
        # Close plot to free memory
        plt.close()
        
        # Encode to base64
        image_base64 = base64.b64encode(buf.getvalue()).decode('utf-8')
        return jsonify({"image": f"data:image/png;base64,{image_base64}"})
        
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
        
        # Fetch some popular movies to compare against (e.g. page 1 and 2)
        all_movies = []
        for page in range(1, 3):
            pop_url = f"https://api.themoviedb.org/3/movie/popular?language=en-US&page={page}"
            pop_res = requests.get(pop_url, headers=HEADERS)
            if pop_res.status_code == 200:
                all_movies.extend(pop_res.json().get('results', []))
                
        # Ensure the target movie is in our list
        # Create a list without the target movie to avoid matching with itself
        movies_dataset = [m for m in all_movies if m['id'] != movie_id]
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
        
        for review in reviews:
            content = review.get('content', '')
            # Perform Sentiment Analysis using TextBlob
            analysis = TextBlob(content)
            polarity = analysis.sentiment.polarity
            
            sentiment_label = 'Neutral'
            if polarity > 0.1:
                sentiment_label = 'Positive'
                positive_count += 1
            elif polarity < -0.1:
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