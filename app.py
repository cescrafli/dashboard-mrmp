from flask import Flask, render_template, jsonify
import requests

# Baris ini SANGAT PENTING dan harus ada sebelum @app.route
app = Flask(__name__)

# TMDB API Credentials
API_KEY = "9f7d7f6801156ddd89232dfb88aaa32d"
READ_ACCESS_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI5ZjdkN2Y2ODAxMTU2ZGRkODkyMzJkZmI4OGFhYTMyZCIsIm5iZiI6MTc1ODk1MjYwMC4xMjUsInN1YiI6IjY4ZDc3Yzk4NTNmNmY0MTNhOGM3NTg3ZiIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.zka1MRsbcw5Zy4dje3nDNfG4_eXh3pPjRRkmtkauMyU"

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

# Menjalankan aplikasi
if __name__ == '__main__':
    app.run(debug=True)