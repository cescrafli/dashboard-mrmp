from flask import Flask, render_template, jsonify
import requests
import os

# Baris ini SANGAT PENTING dan harus ada sebelum @app.route
app = Flask(__name__)

# Langsung masukkan API Key Anda sebagai string
API_KEY = os.environ.get('TMDB_API_KEY')

# Rute untuk halaman utama
@app.route('/')
def home():
    return render_template('index.html')

# Rute API untuk mengambil data film
@app.route('/api/data')
def get_movie_data():
    if not API_KEY:
        return jsonify({"error": "TMDB API Key not set"}), 500
    
    try:
        url = f"https://api.themoviedb.org/3/movie/popular?api_key={API_KEY}&language=en-US&page=1"
        response = requests.get(url)
        response.raise_for_status() # Akan memunculkan error jika request gagal
        return response.json()
    except requests.exceptions.RequestException as err:
        return jsonify({"error": str(err)}), 500

# Menjalankan aplikasi
if __name__ == '__main__':
    app.run(debug=True)