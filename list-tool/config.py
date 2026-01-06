"""設定管理クラス"""
import os
from pathlib import Path
from dotenv import load_dotenv

env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path)


class Config:
    """ベース設定クラス"""
    # 開発環境ではデフォルト値を許可、本番環境では環境変数必須
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
    
    DATABASE_URL_ENV = os.getenv('DATABASE_URL')
    if DATABASE_URL_ENV:
        SQLALCHEMY_DATABASE_URI = DATABASE_URL_ENV
    else:
        POSTGRES_USER = os.getenv('POSTGRES_USER', 'postgres')
        POSTGRES_PASSWORD = os.getenv('POSTGRES_PASSWORD', 'postgres')
        POSTGRES_HOST = os.getenv('POSTGRES_HOST', 'localhost')
        POSTGRES_PORT = os.getenv('POSTGRES_PORT', '5432')
        POSTGRES_DB = os.getenv('POSTGRES_DB', 'restaurants_db')
        SQLALCHEMY_DATABASE_URI = (
            f'postgresql+psycopg2://{POSTGRES_USER}:{POSTGRES_PASSWORD}'
            f'@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}'
        )
    
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_size': 10,
        'pool_recycle': 3600,
        'pool_pre_ping': True,
    }
    
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


class DevelopmentConfig(Config):
    DEBUG = True
    TESTING = False


class ProductionConfig(Config):
    DEBUG = False
    TESTING = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_size': 20,
        'pool_recycle': 3600,
        'pool_pre_ping': True,
        'max_overflow': 10,
    }


class TestingConfig(Config):
    DEBUG = True
    TESTING = True
    SECRET_KEY = os.getenv('SECRET_KEY', 'test-secret-key-for-testing-only')
    TEST_DATABASE_URL = os.getenv('TEST_DATABASE_URL')
    if TEST_DATABASE_URL:
        SQLALCHEMY_DATABASE_URI = TEST_DATABASE_URL
    else:
        SQLALCHEMY_DATABASE_URI = 'postgresql+psycopg2://test_user:test_pass@localhost:5432/test_db'


config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}
