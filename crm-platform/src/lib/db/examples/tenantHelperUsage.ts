/**
 * テナントヘルパー使用例
 * 
 * このファイルは実装例を示すためのものです。
 * 実際のプロジェクトでは削除しても構いません。
 */

import { withTenant, setTenantContext, getCurrentTenant } from "../tenant-helper";
import { db } from "../index";
import { organizations, customers, products } from "../schema";
import { eq } from "drizzle-orm";

// ============================================
// 例1: 基本的な使用方法（環境変数から自動取得）
// ============================================

export async function example1_BasicUsage() {
  // 環境変数 TEST_TENANT_ID から自動的にテナントIDを取得
  const orgs = await withTenant(async (tenantId) => {
    // この時点で、テナントコンテキストが設定されている
    // tenantId は自動的に渡される
    // RLSにより、自動的に現在のテナントのデータのみが返される
    return await db.select().from(organizations);
  });
  
  return orgs;
}

// ============================================
// 例2: テナントIDを明示的に指定
// ============================================

export async function example2_ExplicitTenantId() {
  const tenantId = "123e4567-e89b-12d3-a456-426614174000";
  
  const orgs = await withTenant(
    async (resolvedTenantId) => {
      // resolvedTenantId は引数で指定した tenantId と同じ
      return await db.select().from(organizations);
    },
    tenantId // テナントIDを明示的に指定
  );
  
  return orgs;
}

// ============================================
// 例3: 複数のクエリを実行
// ============================================

export async function example3_MultipleQueries() {
  const result = await withTenant(async (tenantId) => {
    const orgs = await db.select().from(organizations);
    const customerList = await db.select().from(customers);
    const productList = await db.select().from(products);
    
    return { orgs, customers: customerList, products: productList };
  });
  
  return result;
}

// ============================================
// 例4: トランザクション内での使用
// ============================================

export async function example4_Transaction() {
  const result = await withTenant(async (tenantId) => {
    // withTenant 内でトランザクションを使用することも可能
    // 注意: withTenant 自体がトランザクションを使用しているため、
    // ネストされたトランザクションになる
    return await db.transaction(async (tx) => {
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
  });
  
  return result;
}

// ============================================
// 例5: 現在のテナントIDを取得
// ============================================

export async function example5_GetCurrentTenant() {
  await setTenantContext(); // 環境変数から自動取得
  
  const tenantId = await getCurrentTenant();
  console.log("Current tenant:", tenantId);
  
  if (!tenantId) {
    throw new Error("Tenant context not set");
  }
  
  return tenantId;
}

// ============================================
// 例6: Server Actionsでの使用
// ============================================

/*
// app/actions/organizations.ts
"use server";

import { withTenant } from "@/lib/db/tenant-helper";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";

export async function getOrganizations() {
  // ヘッダーの x-tenant-id または環境変数の TEST_TENANT_ID が自動的に使用される
  return await withTenant(async () => {
    return await db.select().from(organizations);
  });
}

export async function createOrganization(name: string) {
  return await withTenant(async () => {
    return await db
      .insert(organizations)
      .values({ name, type: "direct" })
      .returning();
  });
}
*/

// ============================================
// 例7: API Routeでの使用
// ============================================

/*
// app/api/organizations/route.ts
import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/lib/db/tenant-helper";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";

export async function GET(request: NextRequest) {
  try {
    // ヘッダーの x-tenant-id または環境変数の TEST_TENANT_ID が自動的に使用される
    const orgs = await withTenant(async () => {
      return await db.select().from(organizations);
    });
    
    return NextResponse.json(orgs);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const org = await withTenant(async () => {
      return await db
        .insert(organizations)
        .values({
          name: body.name,
          type: body.type || "direct",
        })
        .returning();
    });
    
    return NextResponse.json(org[0], { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
*/

// ============================================
// 例8: エラーハンドリング
// ============================================

export async function example8_ErrorHandling() {
  try {
    const orgs = await withTenant(async () => {
      return await db.select().from(organizations);
    });
    
    return orgs;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("Tenant ID not found")) {
        console.error("テナントIDが見つかりません。環境変数 TEST_TENANT_ID を設定してください。");
      } else if (error.message.includes("Invalid or inactive tenant")) {
        console.error("無効なテナントIDです。テナントが存在し、有効であることを確認してください。");
      } else {
        console.error("予期しないエラー:", error.message);
      }
    }
    throw error;
  }
}

