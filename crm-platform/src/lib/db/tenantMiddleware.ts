/**
 * Next.js用テナントミドルウェア
 * 
 * リクエストごとにテナントIDを取得し、データベースセッションに設定します。
 */

import { NextRequest, NextResponse } from "next/server";
import { setTenantContext } from "./tenantContext";

/**
 * リクエストからテナントIDを取得
 * 
 * 優先順位:
 * 1. サブドメイン（例: company-abc.crm-platform.com）
 * 2. ヘッダー（X-Tenant-ID）
 * 3. クエリパラメータ（tenant_id）
 * 
 * @param request Next.jsリクエスト
 * @returns テナントID、見つからない場合はnull
 */
export function getTenantIdFromRequest(request: NextRequest): string | null {
  // 1. サブドメインから取得
  const hostname = request.headers.get("host") || "";
  const subdomain = hostname.split(".")[0];
  
  // サブドメインが "www" や "app" でない場合、テナントスラッグとして扱う
  if (subdomain && subdomain !== "www" && subdomain !== "app" && subdomain !== "localhost") {
    // スラッグからテナントIDを取得する必要がある（別途実装）
    // ここでは例として、スラッグをそのまま返す（実際にはDBから取得）
    return subdomain;
  }
  
  // 2. ヘッダーから取得
  const tenantIdFromHeader = request.headers.get("X-Tenant-ID");
  if (tenantIdFromHeader) {
    return tenantIdFromHeader;
  }
  
  // 3. クエリパラメータから取得
  const { searchParams } = new URL(request.url);
  const tenantIdFromQuery = searchParams.get("tenant_id");
  if (tenantIdFromQuery) {
    return tenantIdFromQuery;
  }
  
  return null;
}

/**
 * テナントスラッグからテナントIDを取得
 * 
 * @param slug テナントスラッグ（例: "company-abc"）
 * @returns テナントID（UUID文字列）
 */
export async function getTenantIdFromSlug(slug: string): Promise<string | null> {
  // 動的インポートで循環参照を回避
  const dbModule = await import("./index");
  const schemaModule = await import("./schema");
  const ormModule = await import("drizzle-orm");
  
  const tenant = await dbModule.db
    .select({ id: schemaModule.tenants.id })
    .from(schemaModule.tenants)
    .where(ormModule.eq(schemaModule.tenants.slug, slug))
    .limit(1);
  
  return tenant[0]?.id || null;
}

/**
 * Next.js API Route用テナントミドルウェア
 * 
 * 使用例:
 * ```typescript
 * export default withTenant(async (req, res) => {
 *   // この時点で、データベースセッションにテナントIDが設定されている
 *   const orgs = await db.select().from(organizations);
 *   // RLSにより、自動的に現在のテナントのデータのみが返される
 *   res.json(orgs);
 * });
 * ```
 */
export function withTenant(
  handler: (req: NextRequest, context?: any) => Promise<NextResponse>
) {
  return async (req: NextRequest, context?: any): Promise<NextResponse> => {
    try {
      // テナントIDを取得
      const tenantSlugOrId = getTenantIdFromRequest(req);
      
      if (!tenantSlugOrId) {
        return NextResponse.json(
          { error: "Tenant not found" },
          { status: 401 }
        );
      }
      
      // スラッグの場合はIDに変換
      let tenantId: string;
      if (tenantSlugOrId.includes("-") && tenantSlugOrId.length === 36) {
        // UUID形式の場合
        tenantId = tenantSlugOrId;
      } else {
        // スラッグの場合
        const id = await getTenantIdFromSlug(tenantSlugOrId);
        if (!id) {
          return NextResponse.json(
            { error: "Invalid tenant slug" },
            { status: 401 }
          );
        }
        tenantId = id;
      }
      
      // データベースセッションにテナントIDを設定
      await setTenantContext(tenantId);
      
      // ハンドラーを実行
      return await handler(req, context);
    } catch (error) {
      console.error("Tenant middleware error:", error);
      return NextResponse.json(
        { error: "Tenant context error", details: error instanceof Error ? error.message : String(error) },
        { status: 500 }
      );
    }
  };
}

/**
 * Server Actions用テナントコンテキスト設定
 * 
 * 使用例:
 * ```typescript
 * "use server";
 * 
 * export async function getOrganizations() {
 *   await setTenantContextForServerAction();
 *   return await db.select().from(organizations);
 * }
 * ```
 */
export async function setTenantContextForServerAction(tenantId?: string): Promise<void> {
  // Server Actionsでは、headers() からテナントIDを取得
  const { headers } = await import("next/headers");
  
  if (tenantId) {
    await setTenantContext(tenantId);
    return;
  }
  
  // ヘッダーから取得を試みる
  const headersList = await headers();
  const tenantIdFromHeader = headersList.get("X-Tenant-ID");
  if (tenantIdFromHeader) {
    await setTenantContext(tenantIdFromHeader);
    return;
  }
  
  throw new Error("Tenant ID not found in request context");
}

