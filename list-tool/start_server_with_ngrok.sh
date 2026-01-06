#!/bin/bash
# ngrok経由でサーバー起動スクリプト

set -e

cd "$(dirname "$0")"

echo "=========================================="
echo "Flaskサーバー + ngrok 起動"
echo "=========================================="

# ngrokがインストールされているか確認
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrokがインストールされていません。"
    echo ""
    echo "インストール方法:"
    echo "  macOS: brew install ngrok/ngrok/ngrok"
    echo "  または: https://ngrok.com/download からダウンロード"
    echo ""
    exit 1
fi

# 仮想環境をアクティベート
if [ ! -d "venv" ]; then
    echo "❌ 仮想環境が見つかりません。先に ./setup_local.sh を実行してください。"
    exit 1
fi

source venv/bin/activate

# PYTHONPATHを設定
export PYTHONPATH=.

# データベースを初期化（初回のみ）
if [ ! -f "instance/restaurants_local.db" ] && [ ! -f "restaurants_local.db" ]; then
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
echo ""

# バックグラウンドでFlaskサーバーを起動
python run.py &
FLASK_PID=$!

# サーバーが起動するまで少し待つ
sleep 3

# ngrokを起動
echo "🌐 ngrokを起動しています..."
echo ""

# 既存のngrokプロセスがあれば終了
pkill -f "ngrok http 8000" 2>/dev/null || true
sleep 1

# ngrokをバックグラウンドで起動
ngrok http 8000 > /tmp/ngrok.log 2>&1 &
NGROK_PID=$!

# ngrokのURLを取得するまで待つ
sleep 5

# ngrokのURLを取得
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"https://[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$NGROK_URL" ]; then
    echo "⚠️  ngrokのURLを取得できませんでした。"
    echo "   手動で http://localhost:4040 にアクセスしてURLを確認してください。"
    NGROK_URL="http://localhost:4040"
else
    echo "✅ ngrok URL: $NGROK_URL"
    echo "   barius.html: $NGROK_URL/barius.html"
fi

echo ""
echo "=========================================="
echo "サーバー情報"
echo "=========================================="
echo "ローカル: http://localhost:8000"
echo "ngrok:   $NGROK_URL"
echo "barius:  $NGROK_URL/barius.html"
echo ""
echo "ngrok管理画面: http://localhost:4040"
echo ""
echo "停止: Ctrl+C を押してください"
echo "=========================================="
echo ""

# クリーンアップ関数
cleanup() {
    echo ""
    echo "🛑 サーバーを停止しています..."
    kill $FLASK_PID 2>/dev/null || true
    kill $NGROK_PID 2>/dev/null || true
    pkill -f "ngrok http 8000" 2>/dev/null || true
    echo "✅ 停止しました"
    exit 0
}

# シグナルハンドラーを設定
trap cleanup SIGINT SIGTERM

# プロセスが終了するまで待つ
wait $FLASK_PID



