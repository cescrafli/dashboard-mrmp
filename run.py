from flask import Flask
from core.extensions import cache
from core.config import Config

from routes.web import web_bp
from routes.api_tmdb import tmdb_bp
from routes.api_advanced import advanced_bp

def create_app():
    app = Flask(__name__)
    
    # Konfigurasi Cache
    if Config.REDIS_URL:
        app.config['CACHE_TYPE'] = 'RedisCache'
        app.config['CACHE_REDIS_URL'] = Config.REDIS_URL
        app.config['CACHE_DEFAULT_TIMEOUT'] = 600
    else:
        app.config['CACHE_TYPE'] = 'SimpleCache'
        app.config['CACHE_DEFAULT_TIMEOUT'] = 600
        
    cache.init_app(app)
    
    # Register Blueprints
    app.register_blueprint(web_bp)
    app.register_blueprint(tmdb_bp)
    app.register_blueprint(advanced_bp)
    
    return app

app = create_app()

if __name__ == '__main__':
    app.run(debug=True)
