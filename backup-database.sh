#!/bin/bash
# PostgreSQLデータベースのバックアップスクリプト
# 
# 使用方法:
#   ./backup-database.sh
# 
# または、特定の名前を指定:
#   ./backup-database.sh my_backup

set -e

# プロジェクトディレクトリに移動
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/crm-platform"

# 環境変数を読み込み
if [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | xargs)
fi

# DATABASE_URLの確認
if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL環境変数が設定されていません"
  echo "   .env.localファイルにDATABASE_URLを設定してください"
  exit 1
fi

# バックアップディレクトリの作成
BACKUP_DIR="$SCRIPT_DIR/backups/database"
mkdir -p "$BACKUP_DIR"

# バックアップファイル名
if [ -n "$1" ]; then
  BACKUP_NAME="$1"
else
  BACKUP_NAME="backup_$(date +%Y%m%d_%H%M%S)"
fi

BACKUP_FILE="$BACKUP_DIR/${BACKUP_NAME}.sql"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 PostgreSQLデータベースバックアップ"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 設定:"
echo "   データベース: $DATABASE_URL"
echo "   バックアップ先: $BACKUP_FILE"
echo ""

# pg_dumpの実行（Dockerコンテナ内で実行）
echo "🔄 バックアップを実行中..."

# DATABASE_URLから接続情報を抽出
# postgresql://postgres:postgres@localhost:5432/crm_platform
DB_USER=$(echo "$DATABASE_URL" | sed -n 's|.*://\([^:]*\):.*|\1|p')
DB_PASS=$(echo "$DATABASE_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:]*\):.*|\1|p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')

# Dockerコンテナ名を確認
CONTAINER_NAME=$(docker-compose ps -q postgres 2>/dev/null | head -1)

if [ -z "$CONTAINER_NAME" ]; then
  echo "❌ PostgreSQLコンテナが見つかりません"
  echo "   Dockerコンテナが起動しているか確認してください"
  exit 1
fi

# Dockerコンテナ内でpg_dumpを実行
if docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" -d "$DB_NAME" > "$BACKUP_FILE" 2>&1; then
  # ファイルサイズを取得
  FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  
  echo ""
  echo "✅ バックアップが完了しました！"
  echo "   📁 ファイル: $BACKUP_FILE"
  echo "   💾 サイズ: $FILE_SIZE"
  echo ""
  
  # バックアップファイル一覧を表示
  echo "📋 最近のバックアップファイル:"
  ls -lht "$BACKUP_DIR"/*.sql 2>/dev/null | head -5 | awk '{printf "   %s %s %s\n", $6, $7, $8, $9}'
else
  echo ""
  echo "❌ バックアップに失敗しました"
  exit 1
fi
