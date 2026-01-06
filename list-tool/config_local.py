"""ローカル開発用設定"""
import os
from pathlib import Path
from dotenv import load_dotenv

env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path)


class LocalConfig:
    """ローカル開発用設定クラス（SQLite3使用）"""
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-local-do-not-use-in-production')
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL', 'sqlite:///restaurants_local.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {'pool_pre_ping': True}
    
    REDIS_HOST = os.getenv('REDIS_HOST', 'localhost')
    REDIS_PORT = os.getenv('REDIS_PORT', '6379')
    REDIS_DB = os.getenv('REDIS_DB', '0')
    REDIS_URL = os.getenv('REDIS_URL', f'redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}')
    
    CELERY_BROKER_URL = REDIS_URL
    CELERY_RESULT_BACKEND = REDIS_URL
    CELERY_ACCEPT_CONTENT = ['json']
    CELERY_TASK_SERIALIZER = 'json'
    CELERY_RESULT_SERIALIZER = 'json'
    CELERY_TIMEZONE = 'Asia/Tokyo'
    
    GOOGLE_PLACES_API_KEY = os.getenv('GOOGLE_PLACES_API_KEY', '')
    BRIGHTDATA_USERNAME = os.getenv('BRIGHTDATA_USERNAME', '')
    BRIGHTDATA_PASSWORD = os.getenv('BRIGHTDATA_PASSWORD', '')
    BRIGHTDATA_ENDPOINT = os.getenv('BRIGHTDATA_ENDPOINT', 'zproxy.lum-superproxy.io:22225')
    SLACK_WEBHOOK_URL = os.getenv('SLACK_WEBHOOK_URL', '')
    UBER_EATS_BASE_URL = os.getenv('UBER_EATS_BASE_URL', 'https://www.ubereats.com/jp')
    OUTPUT_DIR = os.getenv('OUTPUT_DIR', 'out')
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
    LOG_FILE = os.getenv('LOG_FILE', 'logs/app.log')
    
    DEBUG = True
    TESTING = False
