import os
import tempfile
import nltk
import requests
from core.config import Config

# Setup /tmp directory for serverless environments (like Vercel/Azure)
temp_dir = tempfile.gettempdir()
os.environ['NLTK_DATA'] = temp_dir
nltk.data.path.append(temp_dir)

# Ensure stopwords and punkt are downloaded
nltk.download('stopwords', download_dir=temp_dir, quiet=True)
nltk.download('punkt', download_dir=temp_dir, quiet=True)
nltk.download('punkt_tab', download_dir=temp_dir, quiet=True)

# Hugging Face Inference API Endpoints
HF_EMBEDDING_API_URL = "https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2"
HF_SENTIMENT_API_URL = "https://api-inference.huggingface.co/models/distilbert-base-uncased-finetuned-sst-2-english"

# Headers for Hugging Face API
def get_hf_headers():
    return {"Authorization": f"Bearer {Config.HF_API_KEY}"}

def hf_get_embeddings(texts):
    """Fetch embeddings from Hugging Face Inference API."""
    if not Config.HF_API_KEY:
        raise ValueError("HF_API_KEY is missing. Cannot fetch embeddings.")
    
    response = requests.post(HF_EMBEDDING_API_URL, headers=get_hf_headers(), json={"inputs": texts})
    
    if response.status_code == 200:
        return response.json()
    else:
        raise Exception(f"HF API Error (Embeddings): {response.status_code} - {response.text}")

def hf_get_sentiment(texts):
    """Fetch sentiment analysis from Hugging Face Inference API. Supports string or list of strings."""
    if not Config.HF_API_KEY:
        raise ValueError("HF_API_KEY is missing. Cannot fetch sentiment.")
    
    response = requests.post(HF_SENTIMENT_API_URL, headers=get_hf_headers(), json={"inputs": texts})
    
    if response.status_code == 200:
        return response.json()
    else:
        raise Exception(f"HF API Error (Sentiment): {response.status_code} - {response.text}")
