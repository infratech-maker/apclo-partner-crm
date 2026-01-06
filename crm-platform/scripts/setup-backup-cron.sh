#!/bin/bash
# Leadsデータのデイリーバックアップをcronに設定するスクリプト
#
# 使用方法:
#   chmod +x scripts/setup-backup-cron.sh
#   ./scripts/setup-backup-cron.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CRON_JOB="0 2 * * * cd $PROJECT_DIR && npm run backup:leads >> logs/backup-leads.log 2>&1"

echo "📋 Leadsデータのデイリーバックアップをcronに設定します"
echo ""
echo "実行時間: 毎日 午前2時"
echo "プロジェクトディレクトリ: $PROJECT_DIR"
echo ""

# 既存のcronジョブを確認
if crontab -l 2>/dev/null | grep -q "backup:leads"; then
  echo "⚠️  既存のバックアップcronジョブが見つかりました"
  read -p "上書きしますか？ (y/N): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ キャンセルしました"
    exit 1
  fi
  # 既存のジョブを削除
  crontab -l 2>/dev/null | grep -v "backup:leads" | crontab -
fi

# 新しいcronジョブを追加
(crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -

echo "✅ cronジョブを設定しました"
echo ""
echo "設定内容を確認:"
crontab -l | grep "backup:leads"
echo ""
echo "📝 ログファイル: $PROJECT_DIR/logs/backup-leads.log"
echo ""
echo "💡 cronジョブを削除する場合:"
echo "   crontab -e"
echo "   または"
echo "   crontab -l | grep -v 'backup:leads' | crontab -"

