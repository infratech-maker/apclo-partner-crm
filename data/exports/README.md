# 店舗データエクスポート

このディレクトリには、list-toolからエクスポートされた最新の店舗データが保存されています。

## 最新のエクスポート

- **ファイル**: `stores_export_20260109.json`
- **総店舗数**: 7,554件
- **エクスポート日時**: 2026-01-09
- **ファイルサイズ**: 6.8MB

## データ形式

JSON形式で、以下の構造になっています：

```json
{
  "export_date": "2026-01-09T18:21:11.512721",
  "total_stores": 7554,
  "stores": [
    {
      "store_id": "11052461",
      "name": "店舗名",
      "phone": "電話番号",
      "website": "ウェブサイトURL",
      "address": "住所",
      "category": "カテゴリ",
      "rating": 評価,
      "city": "都市名",
      "url": "店舗URL",
      "data_source": "データソース",
      ...
    }
  ]
}
```

## ダウンロード方法

### 方法1: Web経由でダウンロード（推奨）

以下のURLにアクセスすると、最新のデータをJSON形式でダウンロードできます：

```
https://alica-perfumeless-ilse.ngrok-free.dev/api/export/json
```

このエンドポイントは、常に最新のデータベースから全店舗データを取得します。

### 方法2: ローカルファイルから取得

最新のエクスポートファイルは以下の場所に保存されています：

- **JSON形式**: `/Users/a/CallSenderApp/list-tool/stores_export_latest.json` (6.8MB)
- **圧縮版**: `/Users/a/CallSenderApp/data/exports/stores_export_20260109.json.gz` (622KB)

### 方法3: エクスポートスクリプトを使用

```bash
cd /Users/a/CallSenderApp/list-tool
source venv/bin/activate
python export_all_stores_json.py --output stores_export.json --config local
```

## 更新履歴

- 2026-01-09: 7,554件の店舗データをエクスポート
