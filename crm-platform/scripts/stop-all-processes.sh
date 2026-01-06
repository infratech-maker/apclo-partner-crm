#!/bin/bash
# 実行中のスクレイピングプロセスを停止するスクリプト

echo "🛑 実行中のスクレイピングプロセスを停止します..."

# 電話番号収集プロセスを停止
PHONE_PIDS=$(ps aux | grep "collect-missing-phones" | grep -v grep | awk '{print $2}')
if [ -n "$PHONE_PIDS" ]; then
  echo "📞 電話番号収集プロセスを停止中..."
  echo "$PHONE_PIDS" | xargs kill -TERM
  sleep 2
  # 強制終了が必要な場合
  REMAINING=$(ps aux | grep "collect-missing-phones" | grep -v grep | awk '{print $2}')
  if [ -n "$REMAINING" ]; then
    echo "   強制終了中..."
    echo "$REMAINING" | xargs kill -9
  fi
  echo "   ✅ 停止完了"
else
  echo "📞 電話番号収集プロセスは実行されていません"
fi

# 新規リスト収集プロセスを停止
NEW_OPEN_PIDS=$(ps aux | grep "import-new-open" | grep -v grep | awk '{print $2}')
if [ -n "$NEW_OPEN_PIDS" ]; then
  echo "📋 新規リスト収集プロセスを停止中..."
  echo "$NEW_OPEN_PIDS" | xargs kill -TERM
  sleep 2
  # 強制終了が必要な場合
  REMAINING=$(ps aux | grep "import-new-open" | grep -v grep | awk '{print $2}')
  if [ -n "$REMAINING" ]; then
    echo "   強制終了中..."
    echo "$REMAINING" | xargs kill -9
  fi
  echo "   ✅ 停止完了"
else
  echo "📋 新規リスト収集プロセスは実行されていません"
fi

echo ""
echo "✅ すべてのプロセスを停止しました"
echo ""
echo "📊 残存プロセスの確認:"
ps aux | grep -E "(collect-missing-phones|import-new-open)" | grep -v grep || echo "   実行中のプロセスはありません"

