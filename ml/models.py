import os
import tempfile
import nltk
from sentence_transformers import SentenceTransformer
from transformers import pipeline

# Setup /tmp directory for serverless environments (like Vercel)
temp_dir = tempfile.gettempdir()
os.environ['HF_HOME'] = temp_dir
os.environ['NLTK_DATA'] = temp_dir
nltk.data.path.append(temp_dir)

# Ensure VADER lexicon (if still needed) and stopwords are downloaded
nltk.download('vader_lexicon', download_dir=temp_dir, quiet=True)
nltk.download('stopwords', download_dir=temp_dir, quiet=True)
nltk.download('punkt', download_dir=temp_dir, quiet=True)
nltk.download('punkt_tab', download_dir=temp_dir, quiet=True)

print("Loading ML Models globally...")
# Sentence Transformer for Semantic Search & RAG
sentence_model = SentenceTransformer('all-MiniLM-L6-v2')
# Hugging Face Pipeline for Sentiment Analysis
sentiment_pipeline = pipeline("sentiment-analysis", model="distilbert-base-uncased-finetuned-sst-2-english")
print("ML Models loaded successfully.")
