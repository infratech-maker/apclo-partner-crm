#!/bin/bash
# 停止したプロセスを再開するスクリプト

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🚀 停止したプロセスを再開します..."
echo ""

# 進捗状況を確認
if [ -f "$PROJECT_DIR/logs/last-collected-page.txt" ]; then
  LAST_PAGE=$(cat "$PROJECT_DIR/logs/last-collected-page.txt")
  echo "📋 新規リスト収集: ページ $LAST_PAGE から再開します"
else
  echo "📋 新規リスト収集: 最初から開始します"
fi

echo ""
echo "📞 電話番号収集: 電話番号が不足しているリードから自動的に再開します"
echo ""

read -p "プロセスを再開しますか？ (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ キャンセルしました"
  exit 1
fi

# 新規リスト収集を再開
echo ""
echo "📋 新規リスト収集をバックグラウンドで開始します..."
cd "$PROJECT_DIR"
npx tsx scripts/import-new-open.ts > logs/new-open-collection.log 2>&1 &
NEW_OPEN_PID=$!
echo "   プロセスID: $NEW_OPEN_PID"
echo "   ログ: logs/new-open-collection.log"

# 電話番号収集を再開
echo ""
echo "📞 電話番号収集をバックグラウンドで開始します..."
cd "$PROJECT_DIR"
npx tsx scripts/collect-missing-phones.ts ff424270-d1ee-4a72-9f57-984066600402 7f79c785-1f85-4ec1-88bb-67aff9d119fc > logs/phone-collection.log 2>&1 &
PHONE_PID=$!
echo "   プロセスID: $PHONE_PID"
echo "   ログ: logs/phone-collection.log"

echo ""
echo "✅ プロセスを再開しました"
echo ""
echo "📊 実行中のプロセス:"
ps aux | grep -E "(collect-missing-phones|import-new-open)" | grep -v grep | head -5

