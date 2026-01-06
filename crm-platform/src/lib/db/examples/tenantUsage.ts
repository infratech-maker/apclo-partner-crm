/**
 * テナントコンテキスト使用例
 * 
 * このファイルは実装例を示すためのものです。
 * 実際のプロジェクトでは削除しても構いません。
 */

import { db } from "../index";
import { organizations, customers, products } from "../schema";
import { setTenantContext, withTenantContext, getCurrentTenant } from "../tenantContext";
import { eq, and } from "drizzle-orm";

// ============================================
// 例1: 基本的な使用方法
// ============================================

export async function example1_BasicUsage() {
  const tenantId = "123e4567-e89b-12d3-a456-426614174000";
  
  // テナントコンテキストを設定
  await setTenantContext(tenantId);
  
  // この時点で、すべてのクエリが自動的にこのテナントのデータのみにアクセス
  const orgs = await db.select().from(organizations);
  // RLSにより、tenant_id = tenantId のレコードのみが返される
  
  return orgs;
}

// ============================================
// 例2: withTenantContext を使用した実行
// ============================================

export async function example2_WithTenantContext() {
  const tenantId = "123e4567-e89b-12d3-a456-426614174000";
  
  // テナントコンテキストを設定した状態で関数を実行
  const result = await withTenantContext(tenantId, async () => {
    const orgs = await db.select().from(organizations);
    const customerList = await db.select().from(customers);
    
    return { orgs, customers: customerList };
  });
  
  return result;
}

// ============================================
// 例3: 明示的なフィルタリング（RLSと併用）
// ============================================

export async function example3_ExplicitFiltering() {
  const tenantId = "123e4567-e89b-12d3-a456-426614174000";
  
  await setTenantContext(tenantId);
  
  // RLSが有効でも、明示的にフィルタリングすることも可能
  const activeOrgs = await db
    .select()
    .from(organizations)
    .where(
      and(
        eq(organizations.tenantId, tenantId), // 明示的なフィルタ
        eq(organizations.isActive, true)
      )
    );
  
  return activeOrgs;
}

// ============================================
// 例4: 現在のテナントIDを取得
// ============================================

export async function example4_GetCurrentTenant() {
  const tenantId = await getCurrentTenant();
  
  if (!tenantId) {
    throw new Error("Tenant context not set");
  }
  
  // テナント情報を取得
  const tenant = await db
    .select()
    .from(organizations)
    .where(eq(organizations.tenantId, tenantId))
    .limit(1);
  
  return tenant;
}

// ============================================
// 例5: トランザクション内での使用
// ============================================

export async function example5_Transaction() {
  const tenantId = "123e4567-e89b-12d3-a456-426614174000";
  
  await setTenantContext(tenantId);
  
  // トランザクション内でも、テナントコンテキストは維持される
  await db.transaction(async (tx) => {
    const org = await tx
      .insert(organizations)
      .values({
        tenantId: tenantId,
        name: "New Organization",
        type: "direct",
      })
      .returning();
    
    const product = await tx
      .insert(products)
      .values({
        tenantId: tenantId,
        name: "New Product",
        code: "PROD-001",
        category: "service",
      })
      .returning();
    
    return { org, product };
  });
}

// ============================================
// 例6: エラーハンドリング
// ============================================

export async function example6_ErrorHandling() {
  try {
    // 無効なテナントIDを設定しようとするとエラー
    await setTenantContext("invalid-tenant-id");
  } catch (error) {
    if (error instanceof Error) {
      console.error("Tenant context error:", error.message);
      // "Invalid or inactive tenant: invalid-tenant-id"
    }
  }
}

// ============================================
// 例7: Next.js API Routeでの使用
// ============================================

/*
// app/api/organizations/route.ts
import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/lib/db/tenantMiddleware";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";

export const GET = withTenant(async (req: NextRequest) => {
  // この時点で、テナントコンテキストが設定されている
  const orgs = await db.select().from(organizations);
  
  return NextResponse.json(orgs);
});
*/

// ============================================
// 例8: Server Actionsでの使用
// ============================================

/*
// app/actions/organizations.ts
"use server";

import { setTenantContextForServerAction } from "@/lib/db/tenantMiddleware";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";

export async function getOrganizations() {
  // Server Actionsでは、headers() からテナントIDを取得
  await setTenantContextForServerAction();
  
  const orgs = await db.select().from(organizations);
  return orgs;
}
*/

