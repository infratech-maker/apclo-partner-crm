# リード検索機能の最適化ガイド

## 現在の実装状況

### ✅ 実装済み
- データベース側でのフィルタリング（全件取得後のJavaScriptフィルタリングから改善）
- PostgreSQLのJSONB演算子を使用した検索
- SQLインジェクション対策（Prismaのテンプレートリテラル使用）
- ステータスフィルター（IN句）

### ⚠️ 推奨される改善事項

## 1. コアフィールドの昇格（重要）

### 現状
現在、店舗名、電話番号、住所などの情報は`data`（JSONB）フィールドに格納されています。

### 問題点
- JSONBフィールドの検索は通常のカラムより遅い
- インデックスの効率が低い
- Prismaの型安全性の恩恵を受けにくい
- クエリが複雑になる

### 推奨される改善
以下のフィールドをJSONBから通常のカラムに昇格させることを強く推奨します：

```prisma
model Lead {
  id            String   @id @default(uuid())
  tenantId      String
  organizationId String?
  
  // コアフィールド（JSONBから昇格）
  name          String?  // 店舗名
  phoneNumber   String?  // 電話番号
  address       String?  // 住所
  
  // その他の情報は引き続きJSONBに保存
  data          Json     // その他の詳細情報
  
  status        String   @default("new")
  source        String
  notes         String?
  
  // ... その他のフィールド
}
```

### 移行手順
1. スキーマに新カラムを追加（nullable）
2. 既存データを移行（マイグレーションスクリプト）
3. アプリケーションコードを更新
4. 新カラムを必須に変更（オプション）

## 2. SQLインジェクション対策

### ✅ 現在の実装（正しい）
```typescript
const searchPattern = `%${searchQuery}%`;
const sqlWhere = Prisma.sql`
  (
    (data->>'name')::text ILIKE ${searchPattern}
    OR (data->>'store_name')::text ILIKE ${searchPattern}
    // ...
  )
`;
```

**重要**: Prismaのテンプレートリテラル（バッククォート）を使用しているため、SQLインジェクション対策は正しく実装されています。

### ❌ 避けるべき実装（危険）
```typescript
// 文字列連結は絶対に使用しない
const query = `SELECT * FROM leads WHERE data->>'name' ILIKE '%${searchQuery}%'`;
await prisma.$queryRawUnsafe(query); // 危険！
```

## 3. GINインデックスの追加

### 目的
JSONBフィールドの検索パフォーマンスを向上させるため、PostgreSQLのGINインデックスを追加します。

### 実装方法

#### 方法1: Prismaマイグレーションで追加

`prisma/migrations/XXXX_add_gin_index/migration.sql`を作成：

```sql
-- JSONBフィールドにGINインデックスを追加
CREATE INDEX IF NOT EXISTS "leads_data_gin_idx" ON "leads" USING GIN ("data");

-- 複合インデックス（テナントID + 組織ID + JSONB）も推奨
CREATE INDEX IF NOT EXISTS "leads_tenant_org_data_gin_idx" 
ON "leads" USING GIN ("tenantId", "organizationId", "data");
```

#### 方法2: 手動でSQLを実行

```sql
-- 開発環境で直接実行
CREATE INDEX IF NOT EXISTS leads_data_gin_idx ON leads USING GIN (data);
```

#### 方法3: Prismaの`db execute`を使用

```bash
# SQLファイルを作成
echo "CREATE INDEX IF NOT EXISTS leads_data_gin_idx ON leads USING GIN (data);" > add_gin_index.sql

# 実行
npx prisma db execute --file add_gin_index.sql --schema prisma/schema.prisma
```

### インデックスの効果
- JSONBフィールドの検索速度が大幅に向上
- `data->>'name'`などのJSONB演算子での検索が高速化
- 大量データでもパフォーマンスが維持される

### 注意事項
- GINインデックスは更新時にオーバーヘッドが発生するため、書き込み頻度が高い場合は検討が必要
- インデックスサイズが大きくなる可能性があるため、ディスク容量に注意

## 4. パフォーマンス測定

### 推奨される測定項目
1. 検索クエリの実行時間
2. インデックス使用状況（`EXPLAIN ANALYZE`）
3. データベースの負荷

### 測定方法
```sql
-- クエリプランの確認
EXPLAIN ANALYZE
SELECT * FROM leads
WHERE "tenantId" = 'xxx'
  AND "organizationId" = 'yyy'
  AND (data->>'name')::text ILIKE '%検索文字列%';
```

## 5. 今後の最適化ロードマップ

### 短期（すぐに実施可能）
1. ✅ SQLインジェクション対策の確認（完了）
2. ⏳ GINインデックスの追加
3. ⏳ クエリパフォーマンスの測定

### 中期（スキーマ変更が必要）
1. コアフィールドの昇格（name, phoneNumber, address）
2. 通常のカラムへのインデックス追加
3. アプリケーションコードの更新

### 長期（アーキテクチャ改善）
1. 全文検索機能の追加（PostgreSQLの`tsvector`）
2. 検索結果のキャッシュ
3. 検索APIの最適化

## 参考資料

- [PostgreSQL JSONB Documentation](https://www.postgresql.org/docs/current/datatype-json.html)
- [Prisma Raw Queries](https://www.prisma.io/docs/concepts/components/prisma-client/raw-database-access)
- [PostgreSQL GIN Indexes](https://www.postgresql.org/docs/current/gin.html)

