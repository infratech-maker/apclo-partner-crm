"""Flask拡張機能の初期化"""
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate

# 循環参照を避けるため、extensions.pyでdbインスタンスを初期化
db = SQLAlchemy()
migrate = Migrate()
