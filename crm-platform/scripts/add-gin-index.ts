/**
 * GINインデックス追加スクリプト
 * 
 * JSONBフィールドの検索パフォーマンス向上のため、PostgreSQLのGINインデックスを追加します。
 * 
 * 実行方法:
 *   tsx scripts/add-gin-index.ts
 */

import { prisma } from "../src/lib/prisma";

async function addGinIndex() {
  try {
    console.log("📊 GINインデックスを追加しています...");

    // JSONBフィールドにGINインデックスを追加
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS leads_data_gin_idx 
      ON leads USING GIN (data)
    `;

    console.log("✅ GINインデックスを追加しました: leads_data_gin_idx");

    // 複合インデックス（テナントID + 組織ID + JSONB）
    // 注意: PostgreSQLでは複合GINインデックスは直接サポートされていないため、
    // 通常のB-treeインデックスとGINインデックスを組み合わせて使用
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS leads_tenant_org_idx 
      ON leads ("tenantId", "organizationId")
    `;

    console.log("✅ 複合インデックスを追加しました: leads_tenant_org_idx");

    // インデックスの確認
    const indexes = await prisma.$queryRaw<Array<{
      indexname: string;
      indexdef: string;
    }>>`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'leads'
        AND indexname LIKE '%gin%'
      ORDER BY indexname
    `;

    console.log("\n📋 追加されたGINインデックス:");
    indexes.forEach((idx) => {
      console.log(`  - ${idx.indexname}`);
    });

    console.log("\n✨ 完了しました！");
  } catch (error) {
    console.error("❌ エラーが発生しました:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// スクリプトを実行
addGinIndex();

