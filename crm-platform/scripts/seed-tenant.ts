/**
 * テスト用テナントのシードスクリプト
 * 
 * ローカル開発環境でテスト用テナントを作成します。
 * RLSをバイパスして直接テーブルに挿入するため、このスクリプトを実行してください。
 * 
 * 実行方法:
 * ```bash
 * npx tsx scripts/seed-tenant.ts
 * ```
 */

import { db } from "../src/lib/db/index";
import { tenants } from "../src/lib/db/schema";
import { sql } from "drizzle-orm";

const TEST_TENANT_ID = "00000000-0000-0000-0000-000000000000";
const TEST_TENANT_NAME = "Test Company";
const TEST_TENANT_SLUG = "test-co";

async function seedTenant() {
  try {
    console.log("Creating test tenant...");

    // 既存のテナントを確認
    const existingTenant = await db
      .select()
      .from(tenants)
      .where(sql`${tenants.id} = ${TEST_TENANT_ID}::uuid`)
      .limit(1);

    if (existingTenant.length > 0) {
      console.log("✅ Test tenant already exists!");
      console.log(`   ID: ${existingTenant[0].id}`);
      console.log(`   Name: ${existingTenant[0].name}`);
      console.log(`   Slug: ${existingTenant[0].slug}`);
      console.log(`\n   Add this to your .env.local:`);
      console.log(`   TEST_TENANT_ID=${TEST_TENANT_ID}`);
      return;
    }

    // Drizzle ORMを使って直接挿入
    await db.insert(tenants).values({
      id: TEST_TENANT_ID,
      name: TEST_TENANT_NAME,
      slug: TEST_TENANT_SLUG,
      isActive: true,
    });

    // 確認
    const tenant = await db
      .select()
      .from(tenants)
      .where(sql`${tenants.id} = ${TEST_TENANT_ID}::uuid`)
      .limit(1);

    if (tenant.length > 0) {
      console.log("✅ Test tenant created successfully!");
      console.log(`   ID: ${tenant[0].id}`);
      console.log(`   Name: ${tenant[0].name}`);
      console.log(`   Slug: ${tenant[0].slug}`);
      console.log(`\n   Add this to your .env.local:`);
      console.log(`   TEST_TENANT_ID=${TEST_TENANT_ID}`);
    } else {
      console.log("⚠️  Tenant creation failed.");
    }
  } catch (error: any) {
    if (error?.code === '23505') {
      // ユニーク制約違反（既に存在する）
      console.log("✅ Test tenant already exists!");
      console.log(`\n   Add this to your .env.local:`);
      console.log(`   TEST_TENANT_ID=${TEST_TENANT_ID}`);
    } else {
      console.error("❌ Error creating test tenant:", error);
      process.exit(1);
    }
  } finally {
    process.exit(0);
  }
}

seedTenant();

