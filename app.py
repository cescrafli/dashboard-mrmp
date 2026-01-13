from flask import Flask, render_template, jsonify, request
import requests
import os
from dotenv import load_dotenv

# 1. Memuat konfigurasi dari file .env (agar API Key terbaca)
load_dotenv()

app = Flask(__name__)

# 2. Mengambil API Key dari environment variable
API_KEY = os.getenv('TMDB_API_KEY')
BASE_URL = "https://api.themoviedb.org/3"

@app.route('/')
def home():
    return render_template('index.html')

# 3. Rute API yang diperbarui (Menangani Populer & Pencarian)
@app.route('/api/movies')
def get_movies():
    # Cek apakah API Key sudah ada
    if not API_KEY:
        return jsonify({"error": "API Key tidak ditemukan. Pastikan file .env sudah dibuat."}), 500

    # Ambil parameter pencarian dari URL (dikirim oleh JavaScript)
    search_query = request.args.get('query')

    try:
        if search_query:
            # --- LOGIKA PENCARIAN ---
            # Jika user mengetik sesuatu, kita pakai endpoint 'search/movie'
            url = f"{BASE_URL}/search/movie"
            params = {
                'api_key': API_KEY,
                'query': search_query,
                'language': 'en-US',
                'page': 1
            }
        else:
            # --- LOGIKA POPULER ---
            # Jika kosong, tampilkan film populer biasa
            url = f"{BASE_URL}/movie/popular"
            params = {
                'api_key': API_KEY,
                'language': 'en-US',
                'page': 1
            }

        # Lakukan request ke TMDB
        response = requests.get(url, params=params)
        response.raise_for_status()
        
        return jsonify(response.json())

    except requests.exceptions.RequestException as err:
        print(f"Error: {err}") # Tampilkan error di terminal agar mudah dicek
        return jsonify({"error": "Gagal mengambil data dari TMDB"}), 500

if __name__ == '__main__':
    app.run(debug=True)