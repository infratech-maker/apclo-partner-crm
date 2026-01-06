# リストDB情報まとめ

**更新日時**: 2026年1月5日

## 📊 データベース概要

### 基本情報
- **データベースタイプ**: SQLite3
- **データベースファイル**: `instance/restaurants_local.db`
- **ファイルサイズ**: 4.5MB
- **データベースエンジン**: SQLAlchemy (Flask-SQLAlchemy)
- **環境**: ローカル開発環境（`FLASK_ENV=local`）

### 接続情報
- **ローカル環境**: `sqlite:///restaurants_local.db`
- **本番環境**: PostgreSQL（`postgresql+psycopg2://...`）
- **設定ファイル**: `config_local.py` (ローカル) / `config.py` (本番)

---

## 📈 データ統計

### 総件数
- **総店舗数**: 7,298件
- **ユーザー数**: 2件
- **店舗ステータス**: 0件
- **デリバリーサービス情報**: 0件

### データソース
| データソース | 件数 |
|------------|------|
| tabelog | 7,298件 |

### データ補完状況
- **電話番号あり**: 481件 (6.6%)
- **ウェブサイトあり**: 0件 (0%)
- **住所あり**: 7,298件 (100%)
- **都市情報あり**: 8都市

### フランチャイズ情報
- **フランチャイズ店舗**: 2,487件 (34.1%)

---

## 🗂️ テーブル構造

### 1. `stores` - 店舗情報テーブル

**主キー**: `store_id` (VARCHAR(255))

| カラム名 | 型 | NULL許可 | インデックス | 説明 |
|---------|-----|---------|------------|------|
| store_id | VARCHAR(255) | NO | PRIMARY KEY | 店舗ID（UUID） |
| name | VARCHAR(500) | NO | ✅ | 店舗名 |
| phone | VARCHAR(50) | YES | ✅ | 電話番号 |
| website | TEXT | YES | - | ウェブサイトURL |
| address | TEXT | YES | ✅ | 住所 |
| category | VARCHAR(200) | YES | ✅ | カテゴリ |
| rating | FLOAT | YES | - | 評価 |
| city | VARCHAR(100) | YES | ✅ | 都市名 |
| place_id | VARCHAR(255) | YES | ✅ | Google Places ID |
| url | TEXT | YES | - | 元のURL（食べログなど） |
| location | TEXT | YES | - | 位置情報（緯度・経度、JSON形式） |
| opening_date | VARCHAR(50) | YES | - | 開店日 |
| closed_day | VARCHAR(100) | YES | - | 定休日 |
| transport | TEXT | YES | - | 交通アクセス |
| business_hours | TEXT | YES | - | 営業時間 |
| official_account | TEXT | YES | - | 公式アカウント |
| data_source | VARCHAR(50) | YES | ✅ | データソース（tabelog等） |
| collected_at | DATETIME | YES | - | 収集日時 |
| updated_at | DATETIME | YES | - | 更新日時 |
| is_franchise | BOOLEAN | YES | ✅ | フランチャイズフラグ（デフォルト: 0） |

**インデックス**:
- `idx_store_data_source` (data_source)
- `idx_store_city` (city)
- `idx_store_category` (category)
- `idx_store_name` (name)
- `idx_store_phone` (phone)
- `idx_store_place_id` (place_id)
- `idx_store_is_franchise` (is_franchise)

### 2. `users` - ユーザー管理テーブル

**主キー**: `user_id` (UUID)

| カラム名 | 型 | NULL許可 | インデックス | 説明 |
|---------|-----|---------|------------|------|
| user_id | UUID | NO | PRIMARY KEY | ユーザーID |
| partner_code | VARCHAR(50) | NO | ✅ UNIQUE | パートナーコード |
| password_hash | VARCHAR(255) | NO | - | パスワードハッシュ |
| name | VARCHAR(200) | NO | - | ユーザー名 |
| email | VARCHAR(255) | YES | ✅ | メールアドレス |
| phone | VARCHAR(50) | YES | - | 電話番号 |
| organization | VARCHAR(200) | YES | - | 組織名 |
| user_type | VARCHAR(20) | NO | ✅ | ユーザータイプ（admin, partner） |
| is_agency | BOOLEAN | YES | ✅ | 代理店フラグ |
| is_active | BOOLEAN | YES | ✅ | 有効フラグ |
| created_at | DATETIME | YES | - | 作成日時 |
| updated_at | DATETIME | YES | - | 更新日時 |
| last_login_at | DATETIME | YES | - | 最終ログイン日時 |
| created_by | VARCHAR(255) | YES | - | 作成者 |
| notes | TEXT | YES | - | 備考 |

**現在のユーザー数**: 2件

### 3. `delivery_services` - デリバリーサービス情報テーブル

**主キー**: `id` (UUID)

| カラム名 | 型 | NULL許可 | インデックス | 説明 |
|---------|-----|---------|------------|------|
| id | UUID | NO | PRIMARY KEY | ID |
| store_id | VARCHAR(255) | NO | ✅ | 店舗ID（外部キー） |
| service_name | VARCHAR(100) | NO | - | サービス名 |
| is_active | BOOLEAN | YES | ✅ | 有効フラグ |
| created_at | DATETIME | YES | - | 作成日時 |
| updated_at | DATETIME | YES | - | 更新日時 |

**制約**:
- `uq_store_service` (store_id, service_name) - ユニーク制約

**現在のレコード数**: 0件

### 4. `store_statuses` - 店舗ステータス管理テーブル

**複合主キー**: `rep_id` + `store_id`

| カラム名 | 型 | NULL許可 | インデックス | 説明 |
|---------|-----|---------|------------|------|
| rep_id | VARCHAR(255) | NO | PRIMARY KEY | パートナーID |
| store_id | VARCHAR(255) | NO | PRIMARY KEY, ✅ | 店舗ID（外部キー） |
| status | VARCHAR(50) | NO | - | ステータス |
| updated_at | DATETIME | YES | - | 更新日時 |

**現在のレコード数**: 0件

---

## 📍 地域別分布（上位10都市）

| 都市 | 店舗数 |
|------|--------|
| 東京 | 1,228件 |
| 神奈川 | 1,211件 |
| 大阪 | 1,208件 |
| 神戸 | 1,203件 |
| 千葉 | 1,118件 |
| 埼玉 | 994件 |
| 愛媛 | 294件 |
| 高知 | 42件 |

**合計都市数**: 8都市

---

## 🍽️ カテゴリ別分布（上位10カテゴリ）

| カテゴリ | 店舗数 |
|---------|--------|
| ラーメン | 52件 |
| カフェ | 43件 |
| 居酒屋 | 35件 |
| 松山市 / 居酒屋 | 25件 |
| パン | 18件 |
| 松山市 / カフェ | 18件 |
| スイーツ | 17件 |
| 食堂 | 13件 |
| うどん | 12件 |
| 洋菓子 | 12件 |

---

## 🔗 リレーション

### Store → DeliveryService
- **関係**: 1対多
- **外部キー**: `delivery_services.store_id` → `stores.store_id`
- **カスケード**: DELETE

### Store → StoreStatus
- **関係**: 1対多
- **外部キー**: `store_statuses.store_id` → `stores.store_id`
- **カスケード**: DELETE

---

## 📝 データ品質

### 補完率
- **電話番号取得率**: 6.6% (481/7,298)
- **ウェブサイト取得率**: 0% (0/7,298)
- **住所取得率**: 100% (7,298/7,298)
- **都市情報取得率**: 100% (7,298/7,298)

### 改善が必要な項目
1. **電話番号**: 93.4%が未取得
2. **ウェブサイト**: 100%が未取得
3. **営業時間**: データなし
4. **交通アクセス**: データなし

---

## 🛠️ データベース操作

### 接続方法

#### SQLite3コマンドライン
```bash
cd /Users/a/名称未設定フォルダ
sqlite3 instance/restaurants_local.db
```

#### Python経由
```python
from app import create_app
from extensions import db
from models import Store

app = create_app('local')
with app.app_context():
    stores = Store.query.all()
```

### バックアップ
```bash
# SQLite3データベースのバックアップ
cp instance/restaurants_local.db instance/restaurants_local.db.backup
```

### マイグレーション
```bash
# Flask-Migrateを使用
flask db migrate -m "description"
flask db upgrade
```

---

## 📌 注意事項

1. **データベースファイルの場所**: `instance/restaurants_local.db`
2. **環境変数**: `.env`ファイルで`DATABASE_URL`を設定可能
3. **本番環境**: PostgreSQLを使用する場合は`config.py`の設定を使用
4. **PostGIS対応**: 本番環境ではPostGISを使用可能（`geoalchemy2`が必要）

---

## 🔄 データフロー

1. **データ収集**: スクレイピングスクリプト（`collect_new_stores.py`など）
2. **データ補完**: 補完スクリプト（`enrich_tabelog_details.py`など）
3. **データ保存**: SQLAlchemy経由で`stores`テーブルに保存
4. **データ表示**: Flaskアプリ（`app.py`）経由でAPI提供
5. **フロントエンド**: `list-tool.html`でデータ表示・検索

---

## 📚 関連ドキュメント

- `PROJECT_DOCUMENTATION.md` - プロジェクト全体のドキュメント
- `DATA_LOCATION.md` - データ保存場所の詳細
- `models.py` - SQLAlchemyモデル定義
- `config_local.py` - ローカル環境設定


