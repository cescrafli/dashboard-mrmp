import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    TMDB_API_KEY = os.getenv("TMDB_API_KEY")
    TMDB_READ_ACCESS_TOKEN = os.getenv("TMDB_READ_ACCESS_TOKEN")
    GROQ_API_KEY = os.getenv("GROQ_API_KEY")
    REDIS_URL = os.getenv("REDIS_URL")
    
    TMDB_HEADERS = {
        "accept": "application/json",
        "Authorization": f"Bearer {TMDB_READ_ACCESS_TOKEN}"
    } if TMDB_READ_ACCESS_TOKEN else {}
