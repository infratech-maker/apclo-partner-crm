# データベース構成ドキュメント

最終更新: 2026-01-06

## 📊 概要

このシステムは**マルチテナント対応**のCRMプラットフォームで、PostgreSQLデータベースを使用しています。

### データベース情報
- **DBMS**: PostgreSQL
- **ORM**: Prisma + Drizzle ORM（併用）
- **テーブル数**: 21テーブル

---

## 📋 テーブル一覧とレコード数

| テーブル名 | 説明 | レコード数 |
|-----------|------|-----------|
| `tenants` | テナント（企業単位） | 2件 |
| `users` | ユーザー | 3件 |
| `organizations` | 組織（階層構造） | 4件 |
| `leads` | リード（見込み客） | **7,298件** |
| `customers` | 顧客 | 0件 |
| `scraping_jobs` | スクレイピングジョブ | 0件 |
| `activity_logs` | 活動ログ | 0件 |
| `deals` | 商談 | 0件 |
| `products` | 商材 | 0件 |
| `kpi_records` | KPI記録 | 0件 |
| `pl_records` | PL記録 | 0件 |
| `simulations` | シミュレーション | 0件 |
| `user_organizations` | ユーザー-組織関連 | - |
| `user_roles` | ユーザー-ロール関連 | - |
| `role_permissions` | ロール-権限関連 | - |
| `permissions` | 権限マスタ | - |
| `roles` | ロールマスタ | - |
| `invitations` | 招待 | - |
| `organization_closure` | 組織階層（Closure Table） | - |
| `product_field_definitions` | 商材フィールド定義 | - |
| `customer_field_values` | 顧客フィールド値 | - |

---

## 🏗️ 主要テーブル構造

### 1. コアテーブル（マルチテナント基盤）

#### `tenants` - テナント
```sql
- id (UUID, PK)
- name (TEXT)
- slug (TEXT, UNIQUE) -- URL用スラッグ
- is_active (BOOLEAN)
- created_at, updated_at
```

#### `users` - ユーザー
```sql
- id (UUID, PK)
- tenant_id (UUID, FK → tenants.id)
- email (TEXT, UNIQUE per tenant)
- password_hash (TEXT)
- name (TEXT)
- phone_number (TEXT, nullable)
- avatar_url (TEXT, nullable)
- is_active (BOOLEAN)
- manager_id (UUID, FK → users.id) -- 上司
- last_login_at (TIMESTAMP, nullable)
- created_at, updated_at
```

#### `organizations` - 組織（階層構造）
```sql
- id (UUID, PK)
- tenant_id (UUID, FK → tenants.id)
- name (TEXT)
- code (TEXT, nullable, UNIQUE per tenant)
- type (ENUM: DIRECT, PARTNER_1ST, PARTNER_2ND, UNIT, INDIVIDUAL)
- parent_id (UUID, FK → organizations.id, nullable)
- path (TEXT, nullable) -- 階層パス
- level (INTEGER) -- 階層レベル
- is_active (BOOLEAN)
- created_at, updated_at
```

**階層構造**: Closure Tableパターンで実装（`organization_closure`テーブル）

---

### 2. リード・顧客管理

#### `leads` - リード（見込み客）
```sql
- id (UUID, PK)
- tenant_id (UUID, FK → tenants.id)
- scraping_job_id (UUID, FK → scraping_jobs.id, nullable)
- source (TEXT) -- データソース（例: "tabelog.com"）
- data (JSONB) -- リードデータ（店舗名、電話番号、住所など）
- status (TEXT, default: "new")
- notes (TEXT, nullable)
- organization_id (UUID, FK → organizations.id, nullable)
- created_by, updated_by (UUID, FK → users.id, nullable)
- created_at, updated_at
```

**重要**: `data`カラムはJSONB形式で、以下のような構造：
```json
{
  "name": "店舗名",
  "店舗名": "店舗名（日本語）",
  "phone": "電話番号",
  "電話番号": "電話番号（日本語）",
  "address": "住所",
  "住所": "住所（日本語）",
  "category": "カテゴリ",
  "url": "URL",
  "opening_date": "オープン日",
  "delivery_status": "デリバリー導入",
  "regular_holiday": "定休日",
  "transport": "交通手段",
  "business_hours": "営業時間",
  "website": "公式アカウント（HPURL）"
}
```

#### `customers` - 顧客
```sql
- id (UUID, PK)
- tenant_id (UUID, FK → tenants.id)
- phone_number (TEXT, nullable, UNIQUE per tenant)
- email (TEXT, nullable)
- name (TEXT, nullable)
- product_id (UUID, FK → products.id, nullable)
- organization_id (UUID, FK → organizations.id, nullable)
- status (ENUM: LEAD, CONTACTED, QUALIFIED, PROPOSAL, NEGOTIATION, WON, LOST, CLOSED)
- source (TEXT, nullable)
- notes (TEXT, nullable)
- tags (JSONB, nullable) -- string[]
- is_active (BOOLEAN)
- created_by, updated_by (UUID, FK → users.id, nullable)
- created_at, updated_at
```

#### `activity_logs` - 活動ログ
```sql
- id (TEXT, PK, CUID)
- lead_id (UUID, FK → leads.id)
- type (ENUM: CALL, VISIT, EMAIL, CHAT, OTHER)
- status (TEXT) -- 活動時点でのステータス
- note (TEXT, nullable)
- tenant_id (UUID)
- organization_id (UUID, nullable)
- user_id (UUID, FK → users.id)
- created_at
```

---

### 3. スクレイピング管理

#### `scraping_jobs` - スクレイピングジョブ
```sql
- id (UUID, PK)
- tenant_id (UUID, FK → tenants.id)
- url (TEXT) -- スクレイピング対象URL
- status (ENUM: PENDING, RUNNING, COMPLETED, FAILED, CANCELLED)
- bullmq_job_id (TEXT, nullable) -- BullMQのジョブID
- result (JSONB, nullable) -- スクレイピング結果
- error (TEXT, nullable) -- エラーメッセージ
- started_at, completed_at (TIMESTAMP, nullable)
- created_by (UUID, FK → users.id, nullable)
- created_at, updated_at
```

**注意**: データベースのカラム名は**キャメルケース**（`tenantId`, `bullmqJobId`, `startedAt`など）

---

### 4. 商談・KPI・PL管理

#### `deals` - 商談
```sql
- id (UUID, PK)
- tenant_id (UUID, FK → tenants.id)
- customer_id (UUID, FK → customers.id)
- product_id (UUID, FK → products.id, nullable)
- organization_id (UUID, FK → organizations.id, nullable)
- name (TEXT)
- status (ENUM: PROSPECTING, QUALIFICATION, PROPOSAL, NEGOTIATION, CLOSED_WON, CLOSED_LOST)
- amount (DECIMAL(15,2), nullable)
- expected_close_date, actual_close_date (DATE, nullable)
- probability (DECIMAL(5,2), nullable) -- 0-100 (%)
- notes (TEXT, nullable)
- created_by, updated_by (UUID, FK → users.id, nullable)
- created_at, updated_at
```

#### `kpi_records` - KPI記録
```sql
- id (UUID, PK)
- tenant_id (UUID, FK → tenants.id)
- organization_id (UUID, FK → organizations.id, nullable)
- product_id (UUID, FK → products.id, nullable)
- customer_id (UUID, FK → customers.id, nullable)
- kpi_type (ENUM: TOSS_COUNT, TOSS_RATE, PRE_CONFIRMED, POST_CONFIRMED, ET_COUNT, ACTIVATION_SAME_DAY, ACTIVATION_NEXT_DAY, CONVERSION_RATE)
- value (DECIMAL(15,4))
- record_date (DATE)
- period_type (TEXT)
- notes (TEXT, nullable)
- created_by (UUID, FK → users.id, nullable)
- created_at, updated_at
```

#### `pl_records` - PL記録
```sql
- id (UUID, PK)
- tenant_id (UUID, FK → tenants.id)
- organization_id (UUID, FK → organizations.id, nullable)
- product_id (UUID, FK → products.id, nullable)
- customer_id (UUID, FK → customers.id, nullable)
- item_type (ENUM: REVENUE, GROSS_PROFIT, OPERATING_PROFIT, COST_OF_SALES, SGA, AGENCY_PAYMENT, OTHER_INCOME, OTHER_EXPENSE)
- amount (DECIMAL(15,2))
- record_date (DATE)
- period_type (TEXT)
- is_actual (TEXT, default: "actual") -- "actual" | "forecast" | "simulation"
- simulation_id (UUID, FK → simulations.id, nullable)
- description (TEXT, nullable)
- created_by (UUID, FK → users.id, nullable)
- created_at, updated_at
```

---

### 5. 権限管理

#### `roles` - ロール
```sql
- id (UUID, PK)
- tenant_id (UUID, FK → tenants.id)
- name (TEXT, UNIQUE per tenant)
- description (TEXT, nullable)
- is_system_role (BOOLEAN)
- is_active (BOOLEAN)
- created_at, updated_at
```

#### `permissions` - 権限
```sql
- id (UUID, PK)
- tenant_id (UUID, FK → tenants.id)
- resource (TEXT) -- リソース名
- action (TEXT) -- アクション名
- description (TEXT, nullable)
- is_system_permission (BOOLEAN)
- created_at, updated_at
UNIQUE(tenant_id, resource, action)
```

#### `user_roles` - ユーザー-ロール関連
```sql
- id (UUID, PK)
- user_id (UUID, FK → users.id)
- role_id (UUID, FK → roles.id)
- tenant_id (UUID, FK → tenants.id)
- assigned_by (UUID, FK → users.id, nullable)
- expires_at (TIMESTAMP, nullable)
- created_at, updated_at
UNIQUE(user_id, role_id)
```

#### `role_permissions` - ロール-権限関連
```sql
- id (UUID, PK)
- role_id (UUID, FK → roles.id)
- permission_id (UUID, FK → permissions.id)
- tenant_id (UUID, FK → tenants.id)
- created_at
UNIQUE(role_id, permission_id)
```

---

### 6. その他

#### `invitations` - 招待
```sql
- id (UUID, PK)
- email (TEXT)
- token (TEXT, UNIQUE)
- tenant_id (UUID, FK → tenants.id)
- organization_id (UUID, FK → organizations.id, nullable)
- role_id (UUID, FK → roles.id, nullable)
- expires_at (TIMESTAMP)
- status (ENUM: PENDING, ACCEPTED, EXPIRED)
- invited_by (UUID, FK → users.id)
- created_at, updated_at
```

#### `organization_closure` - 組織階層（Closure Table）
```sql
- tenant_id (UUID, FK → tenants.id)
- ancestor_id (UUID, FK → organizations.id)
- descendant_id (UUID, FK → organizations.id)
- depth (INTEGER)
PRIMARY KEY(ancestor_id, descendant_id)
```

---

## 🔗 主要リレーション

### マルチテナント構造
```
Tenant (1) ──→ (N) User
Tenant (1) ──→ (N) Organization
Tenant (1) ──→ (N) Lead
Tenant (1) ──→ (N) Customer
Tenant (1) ──→ (N) ScrapingJob
```

### 組織階層
```
Organization (1) ──→ (N) Organization (parent-child)
Organization (1) ──→ (N) OrganizationClosure (ancestor-descendant)
```

### リード・顧客フロー
```
ScrapingJob (1) ──→ (N) Lead
Lead (N) ──→ (1) Organization (optional)
Lead (N) ──→ (1) ActivityLog
Lead (N) ──→ (1) Customer (conversion)
```

### 商談・KPI・PL
```
Customer (1) ──→ (N) Deal
Customer (1) ──→ (N) KpiRecord
Customer (1) ──→ (N) PlRecord
Product (1) ──→ (N) Deal
Product (1) ──→ (N) KpiRecord
Product (1) ──→ (N) PlRecord
```

---

## 📊 現在のデータ状況

### アクティブなデータ
- **Leads**: 7,298件（スクレイピングで収集されたリードデータ）
  - 主なソース: Tabelog
  - データ形式: JSONB（`data`カラム）

### 未使用テーブル
以下のテーブルは現在データが0件：
- `customers` - 顧客（リードから変換されていない）
- `scraping_jobs` - スクレイピングジョブ（新規リスト収集中）
- `activity_logs` - 活動ログ
- `deals` - 商談
- `products` - 商材
- `kpi_records` - KPI記録
- `pl_records` - PL記録

---

## 🔍 インデックス戦略

### 主要インデックス
- **テナント分離**: ほぼすべてのテーブルに`tenant_id`インデックス
- **組織フィルタ**: `tenant_id + organization_id`の複合インデックス
- **ステータス検索**: `tenant_id + status`の複合インデックス
- **日付範囲検索**: `record_date`、`created_at`などのインデックス

### ユニーク制約
- `users`: `(tenant_id, email)`
- `organizations`: `(tenant_id, code)`
- `customers`: `(tenant_id, phone_number)`
- `products`: `(tenant_id, code)`

---

## 🛠️ 技術的な注意事項

### ORMの併用
- **Prisma**: 主にアプリケーション層で使用
- **Drizzle ORM**: スクレイピングスクリプトなどで使用
- **注意**: `scraping_jobs`テーブルのカラム名は**キャメルケース**（`tenantId`, `bullmqJobId`など）

### JSONBデータ
- `leads.data`: リードの詳細情報をJSONB形式で保存
- 英語と日本語の両方のフィールド名を保持（例: `name`と`店舗名`）

### マルチテナント分離
- すべてのテーブルに`tenant_id`カラム
- Row Level Security (RLS) の準備済み（将来的に有効化予定）

---

## 📝 バックアップ

- **バックアップスクリプト**: `scripts/backup-leads.ts`
- **自動実行**: 毎日午前2時（cron設定済み）
- **保存場所**: `backups/leads/`
- **保存形式**: JSON
- **保存世代**: 2世代（最新と1世代前）




