#!/bin/bash
# グルナビリード収集をバックグラウンドで実行するスクリプト

cd "$(dirname "$0")/.."

# ログファイルのパス
LOG_DIR="./logs"
LOG_FILE="${LOG_DIR}/gnavi-collection-$(date +%Y%m%d-%H%M%S).log"
mkdir -p "${LOG_DIR}"

echo "🚀 グルナビリード収集をバックグラウンドで開始します..."
echo "📝 ログファイル: $LOG_FILE"
echo ""

# nohupでバックグラウンド実行
# デフォルトでテイクアウト可 + ニューオープンの両方を収集
nohup npx tsx scripts/collect-gnavi-leads.ts > "$LOG_FILE" 2>&1 &

PID=$!
echo "✅ プロセスID: $PID"
echo "📊 ログを確認: tail -f $LOG_FILE"
echo "🛑 停止: kill $PID"
echo ""

# PIDをファイルに保存
echo $PID > "${LOG_DIR}/gnavi-collection.pid"

echo "📋 実行中のプロセス:"
ps aux | grep "collect-gnavi-leads" | grep -v grep || echo "   プロセスが見つかりません"
