# crm-platformからlist-toolへのデータインポート

## 概要

crm-platformの`master_leads`テーブルから直接データを取得して、list-toolのデータベースにインポートするスクリプトです。

## 差分の原因

- **list-tool**: 7,298件（バックアップファイルからインポート）
- **crm-platform**: 7,554件（実際のデータベース）
- **差分**: 256件

crm-platformのデータベースには、バックアップファイル作成後に追加されたデータが存在する可能性があります。

## 使用方法

### 1. データベースURLの取得

crm-platformの`.env.local`ファイルから`DATABASE_URL`を確認するか、環境変数として設定してください。

```bash
# 環境変数として設定
export DATABASE_URL="postgresql://user:password@localhost:5432/dbname"
```

### 2. スクリプトの実行

```bash
cd /Users/a/CallSenderApp/list-tool
source venv/bin/activate

# 方法1: 環境変数からDATABASE_URLを取得
python import_from_crm_master_leads.py --config local

# 方法2: 直接DATABASE_URLを指定
python import_from_crm_master_leads.py --config local --db-url "postgresql://user:password@localhost:5432/dbname"
```

## 処理内容

1. **既存データの削除**: list-toolの`stores`テーブルと`delivery_services`テーブルの既存データをすべて削除
2. **データ取得**: crm-platformの`master_leads`テーブルから全データを取得
3. **データ変換**: `master_leads`のデータを`Store`モデル形式に変換
4. **データ挿入**: 変換したデータをlist-toolのデータベースに一括挿入

## 注意事項

- **既存データはすべて削除されます**。実行前にバックアップを取ることを推奨します。
- crm-platformのデータベースに接続するため、`psycopg2-binary`が必要です（既にインストール済み）。
- データベースURLには適切な権限が必要です。

## トラブルシューティング

### データベース接続エラー

```
❌ データベースURLが指定されていません。
```

解決方法:
- `DATABASE_URL`環境変数を設定する
- `--db-url`オプションで直接指定する
- `../crm-platform/.env.local`ファイルに`DATABASE_URL`が設定されているか確認する

### psycopg2エラー

```
ModuleNotFoundError: No module named 'psycopg2'
```

解決方法:
```bash
source venv/bin/activate
pip install psycopg2-binary
```
