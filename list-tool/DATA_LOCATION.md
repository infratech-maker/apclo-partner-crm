# 収集データの保存場所

## 📊 データベース

### 現在のデータベースファイル
- **場所**: `instance/restaurants_local.db`
- **形式**: SQLite3
- **設定**: `config_local.py`で定義

### データベースURI
```
sqlite:///restaurants_local.db
```

### データベースの確認方法

```bash
# データベースファイルの場所を確認
ls -lah instance/restaurants_local.db

# データベースの内容を確認（Python）
python3 -c "
from app import create_app
from extensions import db
from models import Store
import config_local
import config
config.config['local'] = config_local.LocalConfig
app = create_app('local')
with app.app_context():
    count = db.session.query(Store).count()
    print(f'店舗データ件数: {count}')
"
```

## 📁 その他のデータ保存場所

### 1. 出力ディレクトリ（設定）
- **環境変数**: `OUTPUT_DIR`
- **デフォルト**: `out` ディレクトリ
- **設定ファイル**: `config_local.py` の `OUTPUT_DIR`

### 2. ログファイル
- **場所**: `logs/app.log`
- **設定**: `config_local.py` の `LOG_FILE`

## 🔍 データの確認方法

### Web UIから確認
1. ブラウザで `http://localhost:5000/list-tool` にアクセス
2. 店舗一覧テーブルでデータを確認
3. CSVエクスポート機能を使用してデータをダウンロード

### APIから確認
```bash
# 統計情報を取得
curl http://localhost:5000/api/stats

# 店舗データを取得
curl http://localhost:5000/api/stores?page=1&per_page=10
```

### データベースから直接確認
```bash
# SQLite3コマンドラインツールを使用
sqlite3 instance/restaurants_local.db

# SQLite内で実行
.tables                    # テーブル一覧
SELECT COUNT(*) FROM stores;  # 店舗数
SELECT * FROM stores LIMIT 10;  # サンプルデータ
```

## 📝 現在の状況

現在、データベースには**データが0件**です。

データを収集するには：
1. スクレイピングスクリプトを実行
2. Celeryタスクを使用してバックグラウンドで収集
3. APIエンドポイント経由でデータを追加

## 🚀 データ収集方法

データ収集スクリプトが存在する場合は、以下のコマンドで実行できます：

```bash
# スクレイピングスクリプトを実行（例）
python scraper.py
```

または、Celeryタスクを使用：

```bash
# Celeryワーカーを起動
celery -A tasks worker --loglevel=info

# タスクを実行
python -c "from tasks import collect_stores_task; collect_stores_task.delay()"
```

