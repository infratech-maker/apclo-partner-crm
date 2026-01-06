#!/bin/bash
# UberEatsスクレイピングをバックグラウンドで実行するスクリプト

cd "$(dirname "$0")/.."

# ログファイルのパス
LOG_FILE="./logs/scraper-$(date +%Y%m%d-%H%M%S).log"
mkdir -p ./logs

echo "🚀 スクレイピングをバックグラウンドで開始します..."
echo "📝 ログファイル: $LOG_FILE"

# nohupでバックグラウンド実行
# 注意: headless: false の場合は、X11転送が必要な場合があります
nohup npx tsx scripts/process-pending-jobs.ts > "$LOG_FILE" 2>&1 &

PID=$!
echo "✅ プロセスID: $PID"
echo "📊 ログを確認: tail -f $LOG_FILE"
echo "🛑 停止: kill $PID"

# PIDをファイルに保存
echo $PID > ./logs/scraper.pid



