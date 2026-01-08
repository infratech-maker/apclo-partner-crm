# データベース情報

## 📊 データベース接続情報

### 基本情報
- **データベースタイプ**: PostgreSQL
- **ORM**: Drizzle ORM
- **接続文字列**: `postgresql://postgres:postgres@localhost:5432/crm_platform`
- **環境変数**: `DATABASE_URL` (`.env.local`に設定)

### 接続設定
```typescript
// src/lib/db/index.ts
const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/crm_platform";
const client = postgres(connectionString, { prepare: false });
export const db = drizzle(client, { schema });
```

## 📋 リードデータ保存先テーブル

### `leads` テーブル

スクレイピングで収集したリードデータは `leads` テーブルに保存されます。

#### テーブル構造

| カラム名 | 型 | 説明 |
|---------|-----|------|
| `id` | UUID | プライマリキー（自動生成） |
| `tenant_id` | UUID | テナントID（マルチテナント対応） |
| `scraping_job_id` | UUID | スクレイピングジョブID（外部キー） |
| `source` | TEXT | 取得元URL（例: `https://www.ubereats.com/jp/store/...`） |
| `data` | JSONB | スクレイピングで取得したデータ（JSON形式） |
| `status` | TEXT | ステータス（`new`, `contacted`, `qualified`, `converted`, `rejected`） |
| `notes` | TEXT | メモ |
| `created_at` | TIMESTAMP | 作成日時 |
| `updated_at` | TIMESTAMP | 更新日時 |

#### `data` (JSONB) カラムの構造

UberEatsのリードデータの場合、以下のような構造で保存されます：

```json
{
  "name": "店舗名",
  "address": "住所",
  "category": "カテゴリ",
  "phone": "電話番号",
  "budget": "予算",
  "business_hours": "営業時間",
  "transport": null,
  "related_stores": "関連店舗",
  "latitude": 35.xxxx,
  "longitude": 139.xxxx,
  "rating": 4.5,
  "rating_count": 100,
  "ubereats": {
    "name": "店舗名",
    "url": "URL",
    "address": "住所",
    "latitude": 35.xxxx,
    "longitude": 139.xxxx,
    "rating": 4.5,
    "review_count": 100,
    "price_range": "￥1,000〜",
    "categories": "カテゴリ",
    "brand_name": "ブランド名",
    "transport": null,
    "business_hours": "営業時間"
  }
}
```

### `scraping_jobs` テーブル

スクレイピングジョブの実行履歴を管理します。

#### テーブル構造

| カラム名 | 型 | 説明 |
|---------|-----|------|
| `id` | UUID | プライマリキー（自動生成） |
| `tenant_id` | UUID | テナントID |
| `url` | TEXT | スクレイピング対象URL |
| `status` | ENUM | ステータス（`pending`, `running`, `completed`, `failed`, `cancelled`） |
| `bullmq_job_id` | TEXT | BullMQのジョブID |
| `result` | JSONB | スクレイピング結果 |
| `error` | TEXT | エラーメッセージ |
| `started_at` | TIMESTAMP | 開始日時 |
| `completed_at` | TIMESTAMP | 完了日時 |
| `created_at` | TIMESTAMP | 作成日時 |
| `updated_at` | TIMESTAMP | 更新日時 |

## 🔍 データアクセス方法

### SQLクエリ例

```sql
-- 全リードを取得
SELECT * FROM leads WHERE tenant_id = '<tenant_id>';

-- UberEatsリードを取得
SELECT * FROM leads 
WHERE tenant_id = '<tenant_id>' 
AND source LIKE '%ubereats.com%';

-- リードの詳細データを取得（JSONB）
SELECT 
  id,
  source,
  data->>'name' as name,
  data->>'address' as address,
  data->'ubereats'->>'rating' as rating,
  created_at
FROM leads
WHERE tenant_id = '<tenant_id>'
AND source LIKE '%ubereats.com%';
```

### Drizzle ORMでのアクセス

```typescript
import { db } from './src/lib/db';
import { leads } from './src/lib/db/schema';
import { eq, like, and } from 'drizzle-orm';

// UberEatsリードを取得
const ubereatsLeads = await db
  .select()
  .from(leads)
  .where(
    and(
      eq(leads.tenantId, tenantId),
      like(leads.source, '%ubereats.com%')
    )
  );
```

## 📊 データ統計の確認

```bash
# データベース統計を確認
cd /Users/a/CallSenderApp/crm-platform
npx tsx -e "
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
import { db } from './src/lib/db';
import { leads } from './src/lib/db/schema';
import { withTenant } from './src/lib/db/tenant-helper';
import { eq, sql } from 'drizzle-orm';

withTenant(async (tenantId) => {
  const stats = await db
    .select({ count: sql\`count(*)\` })
    .from(leads)
    .where(eq(leads.tenantId, tenantId));
  
  console.log(\`総リード数: \${stats[0]?.count || 0}件\`);
}).then(() => process.exit(0));
"
```

## 🔐 マルチテナント対応

- すべてのテーブルに `tenant_id` カラムが存在
- テナント間のデータは完全に分離
- `withTenant()` ヘルパー関数を使用してテナントIDを自動設定

## 📝 注意事項

1. **データアクセス**: 必ず `tenant_id` でフィルタリングしてください
2. **JSONBデータ**: `data` カラムは柔軟な構造をサポートしていますが、スキーマの整合性はアプリケーション層で管理
3. **外部キー**: `scraping_job_id` は `scraping_jobs` テーブルへの参照






