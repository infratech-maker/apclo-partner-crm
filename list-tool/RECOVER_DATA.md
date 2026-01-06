# データ復旧ガイド

## ✅ データが見つかりました！

デスクトップの別フォルダ（`~/Desktop/名称未設定フォルダ`）に以前のデータが見つかりました。

## 📁 見つかったデータ

### データベースファイル
- `out/restaurants.db` - メインデータベース
- `out/databases/master.db` - マスターデータベース
- `out/databases/sources/ubereats.db` - Ubereatsデータ
- `out/databases/sources/wolt.db` - Woltデータ
- `out/databases/sources/demaecan.db` - 出前館データ
- `out/databases/sources/tabelog.db` - 食べログデータ
- `out/databases/sources/gnavi.db` - ぐるなびデータ
- `out/databases/sources/google_places.db` - Google Placesデータ

### バックアップファイル
- `out/backups/restaurants_20251128_100642.db`
- `out/backups/restaurants_20251128_100338.db`
- `out/backups/restaurants_20251128_100303.db`

### CSVファイル
- `out/営業リスト.csv`

### JSONファイル
- `out/tabelog_*.json` - 各都道府県の食べログデータ

## 🔄 データのインポート方法

現在のプロジェクト（`/Users/a/名称未設定フォルダ`）にデータをインポートするには、以下の手順を実行してください。

### 方法1: データベースファイルを直接コピー

```bash
# バックアップを取る
cp instance/restaurants_local.db instance/restaurants_local.db.backup

# 古いデータベースからデータをインポート
# （スクリプトを作成して実行）
```

### 方法2: SQLite3を使用してデータを移行

```bash
# 古いデータベースから新しいデータベースにデータをコピー
sqlite3 ~/Desktop/名称未設定フォルダ/out/restaurants.db ".dump stores" | sqlite3 instance/restaurants_local.db
```

### 方法3: Pythonスクリプトでインポート

データインポートスクリプトを作成して実行します。

## ⚠️ 注意事項

1. **データベース構造の違い**: 古いデータベースと新しいデータベースで構造が異なる可能性があります
2. **バックアップ**: インポート前に必ず現在のデータベースをバックアップしてください
3. **データの整合性**: インポート後、データが正しく読み込まれているか確認してください

## 🚀 次のステップ

データインポートスクリプトを作成して、古いデータを新しいデータベースに移行しますか？

