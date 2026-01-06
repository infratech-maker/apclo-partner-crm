-- JSONBフィールドにGINインデックスを追加
-- リード検索のパフォーマンス向上のため

-- 単一のJSONBフィールドに対するGINインデックス
CREATE INDEX IF NOT EXISTS "leads_data_gin_idx" ON "leads" USING GIN ("data");

-- 複合インデックス（テナントID + 組織ID + JSONB）
-- 検索条件に合わせて最適化
CREATE INDEX IF NOT EXISTS "leads_tenant_org_data_gin_idx" 
ON "leads" USING GIN ("tenantId", "organizationId", "data");

-- ステータスフィルター用のインデックス（既存のインデックスと併用）
-- 注意: 既に @@index([tenantId, status]) が存在する場合は不要

