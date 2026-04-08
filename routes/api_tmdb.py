import requests
from flask import Blueprint, jsonify, request
from core.extensions import cache
from core.config import Config

tmdb_bp = Blueprint('api_tmdb', __name__, url_prefix='/api')

@tmdb_bp.route('/data')
@cache.cached(timeout=600, query_string=True)
def get_movie_data():
    page = request.args.get('page', 1, type=int)
    try:
        url = f"https://api.themoviedb.org/3/movie/popular?language=en-US&page={page}"
        response = requests.get(url, headers=Config.TMDB_HEADERS)
        response.raise_for_status()
        return jsonify(response.json())
    except requests.exceptions.RequestException as err:
        return jsonify({"error": str(err)}), 500

@tmdb_bp.route('/search')
def search_movies():
    query = request.args.get('q', '')
    page = request.args.get('page', 1, type=int)
    if not query:
        return jsonify({"results": []})
    try:
        url = f"https://api.themoviedb.org/3/search/movie?query={query}&language=en-US&page={page}"
        response = requests.get(url, headers=Config.TMDB_HEADERS)
        response.raise_for_status()
        return jsonify(response.json())
    except requests.exceptions.RequestException as err:
        return jsonify({"error": str(err)}), 500

@tmdb_bp.route('/chart/ratings')
def chart_ratings():
    try:
        url = "https://api.themoviedb.org/3/movie/popular?language=en-US&page=1"
        response = requests.get(url, headers=Config.TMDB_HEADERS)
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

@tmdb_bp.route('/trailer/<int:movie_id>')
@cache.cached(timeout=600)
def get_movie_trailer(movie_id):
    try:
        url = f"https://api.themoviedb.org/3/movie/{movie_id}/videos?language=en-US"
        response = requests.get(url, headers=Config.TMDB_HEADERS)
        response.raise_for_status()
        results = response.json().get('results', [])
        
        trailer_key = None
        for video in results:
            if video.get('site') == 'YouTube' and video.get('type') == 'Trailer':
                trailer_key = video.get('key')
                break
        
        return jsonify({"trailer_key": trailer_key})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
