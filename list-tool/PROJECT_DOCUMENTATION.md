# プロジェクト構成ドキュメント

## 📋 目次

1. [プロジェクト概要](#プロジェクト概要)
2. [ディレクトリ構造](#ディレクトリ構造)
3. [技術スタック](#技術スタック)
4. [データベース構造](#データベース構造)
5. [APIエンドポイント](#apiエンドポイント)
6. [主要ファイル説明](#主要ファイル説明)
7. [起動方法](#起動方法)
8. [データフロー](#データフロー)

---

## プロジェクト概要

**プロジェクト名**: レストランリスト収集・管理システム

**目的**: 
- 複数のデリバリーサービス（Ubereats、Wolt、出前館など）とレストラン情報サイト（食べログ、ぐるなび）から店舗情報を収集
- 収集したデータの補完（電話番号、営業時間、交通アクセスなど）
- パートナー向けの店舗リスト管理とエクスポート機能

**アーキテクチャ**: 
- バックエンド: Flask (Python)
- データベース: SQLite3 (ローカル) / PostgreSQL (本番)
- フロントエンド: HTML + JavaScript + Tailwind CSS
- タスクキュー: Celery + Redis (オプション)

---

## ディレクトリ構造

```
/Users/a/名称未設定フォルダ/
├── app.py                    # Flaskアプリケーションファクトリとルート定義
├── extensions.py             # Flask拡張機能（db, migrate）の初期化
├── models.py                 # SQLAlchemyモデル定義
├── config.py                 # 本番環境用設定（PostgreSQL）
├── config_local.py           # ローカル開発用設定（SQLite3）
├── tasks.py                  # Celeryタスク定義
├── run.py                    # アプリケーション起動スクリプト
├── run_local.py              # ローカル起動スクリプト
│
├── import_old_data.py        # 古いデータベースからのインポートスクリプト
├── enrich_tabelog_details.py # 食べログからのデータ補完スクリプト
├── enrich_stores.py           # 店舗データ補完スクリプト（基本版）
│
├── list-tool.html            # リスト収集ツール（メインUI）
├── admin-dashboard.html      # 管理者ダッシュボード
├── products.html             # その他商材ページ
├── account-management.html   # アカウント管理ページ
├── login.html                # ログインページ
├── dashboard.html            # ダッシュボード
│
├── docker-compose.yml        # Docker Compose設定
├── Dockerfile                # Flaskアプリ用Dockerfile
├── Dockerfile.worker         # Celery Worker用Dockerfile
├── .dockerignore             # Dockerビルド除外ファイル
│
├── requirements.txt          # Python依存関係
├── .env                      # 環境変数（要作成）
├── .env.example              # 環境変数テンプレート
│
├── instance/                 # データベースファイル保存先
│   └── restaurants_local.db  # SQLite3データベース
│
├── venv/                     # Python仮想環境
│
└── ドキュメント/
    ├── PROJECT_DOCUMENTATION.md    # 本ドキュメント
    ├── DATA_LOCATION.md             # データ保存場所
    ├── IMPORT_COMPLETE.md          # データインポート完了レポート
    ├── RECOVER_DATA.md              # データ復旧ガイド
    └── SERVER_STATUS.md             # サーバー起動状況
```

---

## 技術スタック

### バックエンド
- **Python**: 3.13
- **Flask**: 3.1.2 - Webフレームワーク
- **Flask-SQLAlchemy**: 3.1.1 - ORM
- **Flask-Migrate**: 4.1.0 - データベースマイグレーション
- **SQLAlchemy**: 2.0.45 - ORMライブラリ
- **psycopg2-binary**: PostgreSQLドライバー（本番環境用）

### データベース
- **SQLite3**: ローカル開発用
- **PostgreSQL 16**: 本番環境用（PostGIS対応）

### フロントエンド
- **Tailwind CSS**: UIフレームワーク
- **Chart.js**: グラフ表示
- **Google Maps API**: 地図表示
- **Vanilla JavaScript**: フロントエンドロジック

### タスクキュー（オプション）
- **Celery**: 非同期タスク処理
- **Redis**: メッセージブローカー

### その他
- **BeautifulSoup4**: HTMLパース（スクレイピング）
- **requests**: HTTPリクエスト
- **python-dotenv**: 環境変数管理

---

## データベース構造

### テーブル一覧

#### 1. `stores` - 店舗情報テーブル

| カラム名 | 型 | 説明 |
|---------|-----|------|
| store_id | VARCHAR(255) | 主キー（UUID） |
| name | VARCHAR(500) | 店舗名 |
| phone | VARCHAR(50) | 電話番号 |
| website | TEXT | ウェブサイトURL |
| address | TEXT | 住所 |
| category | VARCHAR(200) | カテゴリ |
| rating | FLOAT | 評価 |
| city | VARCHAR(100) | 都市名 |
| place_id | VARCHAR(255) | Google Places ID |
| url | TEXT | 元のURL（食べログなど） |
| location | TEXT/Geometry | 位置情報（緯度・経度） |
| opening_date | VARCHAR(50) | 開店日 |
| closed_day | VARCHAR(100) | 定休日 |
| transport | TEXT | 交通アクセス |
| business_hours | TEXT | 営業時間 |
| official_account | TEXT | 公式アカウント |
| data_source | VARCHAR(50) | データソース（ubereats, tabelog等） |
| collected_at | DATETIME | 収集日時 |
| updated_at | DATETIME | 更新日時 |

**インデックス**:
- `idx_store_data_source` (data_source)
- `idx_store_city` (city)
- `idx_store_category` (category)

#### 2. `users` - ユーザー管理テーブル

| カラム名 | 型 | 説明 |
|---------|-----|------|
| user_id | UUID | 主キー |
| partner_code | VARCHAR(50) | パートナーコード（ユニーク） |
| password_hash | VARCHAR(255) | パスワードハッシュ |
| name | VARCHAR(200) | ユーザー名 |
| email | VARCHAR(255) | メールアドレス |
| phone | VARCHAR(50) | 電話番号 |
| organization | VARCHAR(200) | 組織名 |
| user_type | VARCHAR(20) | ユーザータイプ（admin, partner） |
| is_agency | BOOLEAN | 代理店フラグ |
| is_active | BOOLEAN | 有効フラグ |
| created_at | DATETIME | 作成日時 |
| updated_at | DATETIME | 更新日時 |
| last_login_at | DATETIME | 最終ログイン日時 |
| created_by | VARCHAR(255) | 作成者 |
| notes | TEXT | 備考 |

#### 3. `delivery_services` - デリバリーサービス情報テーブル

| カラム名 | 型 | 説明 |
|---------|-----|------|
| id | INTEGER | 主キー（AUTO_INCREMENT） |
| store_id | VARCHAR(255) | 店舗ID（外部キー） |
| service_name | VARCHAR(100) | サービス名 |
| is_active | BOOLEAN | 有効フラグ |
| url | TEXT | サービスURL |

#### 4. `store_statuses` - 店舗ステータス管理テーブル

| カラム名 | 型 | 説明 |
|---------|-----|------|
| rep_id | VARCHAR(255) | パートナーID（主キー） |
| store_id | VARCHAR(255) | 店舗ID（主キー） |
| status | VARCHAR(50) | ステータス |
| updated_at | DATETIME | 更新日時 |

---

## APIエンドポイント

### Webルート

| パス | メソッド | 説明 | ファイル |
|------|---------|------|----------|
| `/` | GET | ルート（list-tool.htmlにリダイレクト） | list-tool.html |
| `/list-tool` | GET | リスト収集ツール | list-tool.html |
| `/login` | GET | ログインページ | login.html |
| `/dashboard` | GET | ダッシュボード | dashboard.html |
| `/admin-dashboard` | GET | 管理者ダッシュボード | admin-dashboard.html |
| `/products` | GET | その他商材ページ | products.html |
| `/account-management` | GET | アカウント管理ページ | account-management.html |

### APIルート

#### ヘルスチェック
- **GET `/api/health`** - サーバー状態確認
  - レスポンス: `{"status": "ok"}`

#### 統計情報
- **GET `/api/stats`** - 統計情報取得
  - レスポンス:
    ```json
    {
      "total_stores": 7298,
      "total_with_opening": 7298,
      "remaining": 7117,
      "completed": 181,
      "completion_rate": 2.5,
      "with_phone": 454,
      "with_website": 0,
      "fully_completed": 181
    }
    ```

#### フィルター用データ
- **GET `/api/areas`** - エリアリスト取得
  - レスポンス: `{"areas": [...], "area_prefectures": {...}}`

- **GET `/api/prefectures`** - 都道府県リスト取得
  - レスポンス: `{"prefectures": [...]}`

- **GET `/api/categories`** - カテゴリリスト取得
  - レスポンス: `{"categories": [...], "category_groups": {...}}`

#### 店舗データ
- **GET `/api/stores`** - 店舗データ一覧取得
  - クエリパラメータ:
    - `page` (int): ページ番号（デフォルト: 1）
    - `per_page` (int): 1ページあたりの件数（デフォルト: 100）
    - `search` (string): 検索キーワード（店舗名、住所、カテゴリ）
  - レスポンス:
    ```json
    {
      "stores": [...],
      "total": 7298,
      "page": 1,
      "per_page": 100,
      "total_pages": 73
    }
    ```

#### エクスポート
- **GET `/api/export/csv`** - CSVエクスポート
  - レスポンス: CSVファイル（ダウンロード）

#### 管理者API
- **GET `/api/admin/users`** - ユーザー一覧取得
  - クエリパラメータ:
    - `user_type` (string): ユーザータイプフィルター
    - `is_active` (string): 有効フラグフィルター（"true"/"false"）
  - レスポンス: `{"users": [...]}`

- **POST `/api/admin/users`** - ユーザー作成
  - リクエストボディ:
    ```json
    {
      "partner_code": "PARTNER001",
      "password": "password123",
      "name": "パートナー名",
      "user_type": "partner",
      "email": "email@example.com",
      "phone": "03-1234-5678",
      "organization": "組織名",
      "is_agency": false,
      "is_active": true
    }
    ```
  - レスポンス: `{"success": true, "user": {...}}`

- **PUT `/api/admin/users/<user_id>`** - ユーザー更新
  - リクエストボディ: 更新したいフィールドのみ
  - レスポンス: `{"success": true, "user": {...}}`

- **DELETE `/api/admin/users/<user_id>`** - ユーザー削除（論理削除）
  - レスポンス: `{"success": true, "message": "ユーザーを無効化しました"}`

#### パートナーAPI
- **GET `/api/partner/saved-lists`** - 保存済みリスト取得（ダミー）
  - レスポンス: `{"lists": []}`

---

## 主要ファイル説明

### `app.py` - Flaskアプリケーション

**役割**: アプリケーションのエントリーポイントとルート定義

**主要関数**:
- `create_app(config_name='default')`: アプリケーションファクトリ
  - 設定の読み込み
  - データベース初期化
  - ルート登録
  - Celery初期化（オプション）

- `register_routes(app)`: ルート登録
  - Webルート（HTMLページ）
  - APIルート（JSON API）

**コード構造**:
```python
def create_app(config_name='default'):
    app = Flask(__name__)
    app.config.from_object(config_dict[config_name])
    db.init_app(app)
    migrate.init_app(app, db)
    register_routes(app)
    return app
```

### `models.py` - データベースモデル

**役割**: SQLAlchemyモデル定義

**主要クラス**:
- `Store`: 店舗情報モデル
- `User`: ユーザーモデル
- `DeliveryService`: デリバリーサービスモデル
- `StoreStatus`: 店舗ステータスモデル

**特徴**:
- PostGIS対応（本番環境）とSQLite3フォールバック（ローカル環境）
- `to_dict()`メソッドでJSONシリアライズ対応

### `config.py` - 本番環境設定

**役割**: PostgreSQL + Redis + Celery設定

**主要設定**:
- `SQLALCHEMY_DATABASE_URI`: PostgreSQL接続文字列
- `CELERY_BROKER_URL`: Redis接続URL
- `SECRET_KEY`: 環境変数から必須読み込み

### `config_local.py` - ローカル開発設定

**役割**: SQLite3 + ローカル開発用設定

**主要設定**:
- `SQLALCHEMY_DATABASE_URI`: `sqlite:///restaurants_local.db`
- `DEBUG = True`
- `SECRET_KEY`: デフォルト値許可

### `run.py` - アプリケーション起動

**役割**: アプリケーション起動スクリプト

**コード**:
```python
from app import create_app
import config_local
import config

config.config['local'] = config_local.LocalConfig
app = create_app('local')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
```

### `extensions.py` - Flask拡張機能

**役割**: 循環参照を避けるための拡張機能初期化

**内容**:
```python
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate

db = SQLAlchemy()
migrate = Migrate()
```

### `tasks.py` - Celeryタスク

**役割**: 非同期タスク定義（現在は最小実装）

**主要関数**:
- `make_celery(app)`: Celeryアプリケーション作成
- `register_tasks(celery_app)`: スクレイピングタスク登録
- `register_enrichment_tasks(celery_app)`: データ補完タスク登録

### `enrich_tabelog_details.py` - データ補完スクリプト

**役割**: 食べログから店舗詳細情報を補完

**主要機能**:
- 食べログURLからHTMLを取得
- BeautifulSoupで情報を抽出
- 電話番号、定休日、営業時間、交通アクセス、公式アカウントを補完

**使用方法**:
```bash
python enrich_tabelog_details.py --limit 50 --delay 2.0 --max-rounds 5
```

### `import_old_data.py` - データインポートスクリプト

**役割**: 古いデータベースから新しいデータベースにデータを移行

**機能**:
- 古いデータベースから店舗データを読み込み
- 共通カラムのみを抽出
- 新しいデータベースにインポート

---

## 起動方法

### ローカル開発環境

1. **仮想環境のアクティベート**
   ```bash
   source venv/bin/activate
   export PYTHONPATH=.
   ```

2. **アプリケーション起動**
   ```bash
   python run.py
   ```

   または

   ```bash
   ./start_server.sh
   ```

3. **アクセス**
   - http://localhost:5000

### Docker環境（本番用）

1. **環境変数設定**
   ```bash
   cp .env.example .env
   # .envファイルを編集
   ```

2. **Docker Compose起動**
   ```bash
   docker-compose up --build
   ```

3. **データベースマイグレーション**
   ```bash
   docker-compose exec flask_app flask db init
   docker-compose exec flask_app flask db migrate -m "Initial migration"
   docker-compose exec flask_app flask db upgrade
   ```

---

## データフロー

### 1. データ収集フロー

```
スクレイピングスクリプト
    ↓
Ubereats / Wolt / 食べログ など
    ↓
データ抽出・整形
    ↓
stores テーブルに保存
```

### 2. データ補完フロー

```
補完が必要な店舗を検索
    ↓
食べログURLから詳細情報を取得
    ↓
電話番号、営業時間、交通アクセスなどを抽出
    ↓
stores テーブルを更新
```

### 3. データ表示フロー

```
フロントエンド（list-tool.html）
    ↓
APIリクエスト（/api/stores）
    ↓
データベースクエリ
    ↓
JSONレスポンス
    ↓
テーブル表示
```

### 4. エクスポートフロー

```
フロントエンド（CSVエクスポートボタン）
    ↓
APIリクエスト（/api/export/csv）
    ↓
データベースから全店舗データ取得
    ↓
CSV形式に変換
    ↓
ファイルダウンロード
```

---

## 現在のデータ状況

- **全店舗数**: 7,298件
- **開店日あり**: 7,298件 (100%)
- **電話番号あり**: 454件 (6.2%)
- **補完必要**: 7,117件 (97.5%)
- **補完完了**: 181件 (2.5%)

---

## 補完作業の実行

### 手動実行

```bash
# 食べログから補完（推奨）
python enrich_tabelog_details.py --limit 50 --delay 2.0 --max-rounds 5

# 基本補完スクリプト
python enrich_stores.py --limit 100 --delay 1.0
```

### パラメータ説明

- `--limit`: 1回あたりの処理件数
- `--delay`: 処理間隔（秒）
- `--max-rounds`: 最大ラウンド数（Noneの場合は全件処理）

---

## セキュリティ設定

### 開発環境
- ログインチェック無効化
- デフォルトパートナーID: `ADMIN`
- SQLite3使用

### 本番環境
- `SECRET_KEY`は環境変数から必須読み込み
- PostgreSQL使用
- 適切な認証・認可実装が必要

---

## トラブルシューティング

### よくある問題

1. **ModuleNotFoundError**
   - 解決: `source venv/bin/activate` と `export PYTHONPATH=.` を実行

2. **データベーステーブルが存在しない**
   - 解決: サーバー起動時に自動的に作成されます

3. **Celeryエラー**
   - 解決: Redisが利用できない場合は警告のみで動作します

4. **ログインページにリダイレクトされる**
   - 解決: 開発環境ではログインチェックが無効化されています

---

## 今後の拡張予定

- [ ] 認証・認可機能の実装
- [ ] スクレイピングタスクのCelery実装
- [ ] バッチ処理の自動化
- [ ] ログ機能の強化
- [ ] エラーハンドリングの改善
- [ ] テストコードの追加

---

## 更新履歴

- 2025-12-19: プロジェクト構成ドキュメント作成
- 2025-12-19: データインポート完了（7,298件）
- 2025-12-19: 補完スクリプト実装
- 2025-12-19: 3つのページ（admin-dashboard, products, account-management）追加

---

## 連絡先・サポート

問題が発生した場合は、ログファイル（`logs/app.log`）を確認してください。

