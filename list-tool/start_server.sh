#!/bin/bash
# サーバー起動スクリプト

set -e

cd "$(dirname "$0")"

echo "=========================================="
echo "Flaskサーバー起動"
echo "=========================================="

# 仮想環境をアクティベート
if [ ! -d "venv" ]; then
    echo "❌ 仮想環境が見つかりません。先に ./setup_local.sh を実行してください。"
    exit 1
fi

source venv/bin/activate

# PYTHONPATHを設定
export PYTHONPATH=.

# データベースを初期化（初回のみ）
if [ ! -f "restaurants_local.db" ]; then
    echo "📊 データベースを初期化中..."
    python3 -c "
from app import create_app
from extensions import db
import config_local
import config
config.config['local'] = config_local.LocalConfig
app = create_app('local')
with app.app_context():
    db.create_all()
    print('✅ データベースを初期化しました')
" || echo "⚠️  データベース初期化をスキップしました"
fi

echo ""
echo "🚀 サーバーを起動しています..."
echo "アクセス: http://localhost:8000"
echo "停止: Ctrl+C"
echo ""

# サーバーを起動
python run.py
