/**
 * テナントヘルパー
 * 
 * Drizzleのトランザクションを使用して、PostgreSQLのセッション変数 `app.current_tenant` をセットするラッパー関数
 * アプリケーション層からデータベース層へテナントIDを安全に渡す仕組み
 */

import { db } from "./index";
import { sql } from "drizzle-orm";
import { tenants } from "./schema";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";

/**
 * テナントIDを取得
 * 
 * 優先順位:
 * 1. 引数で指定された tenantId
 * 2. ヘッダーの x-tenant-id
 * 3. 環境変数の TEST_TENANT_ID
 * 
 * @param tenantId オプション: テナントID（UUID文字列）
 * @returns テナントID、見つからない場合はnull
 */
async function getTenantId(tenantId?: string): Promise<string | null> {
  // 1. 引数で指定された場合
  if (tenantId) {
    return tenantId;
  }

  // 2. ヘッダーから取得（Next.js Server Components / Server Actions）
  try {
    const headersList = await headers();
    const tenantIdFromHeader = headersList.get("x-tenant-id");
    if (tenantIdFromHeader) {
      return tenantIdFromHeader;
    }
  } catch (error) {
    // headers() が利用できない環境（例: API Route）では無視
  }

  // 3. 環境変数から取得（ローカル開発用）
  const tenantIdFromEnv = process.env.TEST_TENANT_ID;
  if (tenantIdFromEnv) {
    return tenantIdFromEnv;
  }

  return null;
}

/**
 * テナントIDの検証
 * 
 * @param tenantId テナントID（UUID文字列）
 * @throws Error テナントが存在しない、または無効な場合
 */
async function validateTenant(tenantId: string): Promise<void> {
  try {
    const tenant = await db
      .select({
        id: tenants.id,
        isActive: tenants.isActive,
      })
      .from(tenants)
      .where(
        eq(tenants.id, tenantId)
      )
      .limit(1);

    if (tenant.length === 0) {
      throw new Error(`Invalid tenant: ${tenantId}`);
    }

    // isActiveがfalseの場合はエラー（isActiveカラムが存在する場合のみ）
    if (tenant[0]?.isActive === false) {
      throw new Error(`Inactive tenant: ${tenantId}`);
    }
  } catch (error: any) {
    // is_activeカラムが存在しない場合は、idのみで検証
    if (error?.code === '42703' || error?.message?.includes('is_active')) {
      const tenant = await db
        .select({
          id: tenants.id,
        })
        .from(tenants)
        .where(
          eq(tenants.id, tenantId)
        )
        .limit(1);

      if (tenant.length === 0) {
        throw new Error(`Invalid tenant: ${tenantId}`);
      }
    } else {
      throw error;
    }
  }
}

/**
 * テナントコンテキストを設定した状態で関数を実行
 * 
 * Drizzleのトランザクションを使用して、PostgreSQLのセッション変数 `app.current_tenant` をセットします。
 * `set_config` は `is_local = true` (トランザクション内限定) で実行されます。
 * 
 * 使用例:
 * ```typescript
 * const result = await withTenant(async (tenantId) => {
 *   // この時点で、テナントコンテキストが設定されている
 *   // tenantId は自動的に渡される
 *   const orgs = await db.select().from(organizations);
 *   // RLSにより、自動的に現在のテナントのデータのみが返される
 *   return orgs;
 * });
 * ```
 * 
 * @param fn 実行する関数（tenantId が引数として渡される）
 * @param tenantId オプション: テナントID（指定しない場合は自動取得）
 * @returns 関数の戻り値
 * @throws Error テナントIDが見つからない、または無効な場合
 */
export async function withTenant<T>(
  fn: (tenantId: string) => Promise<T>,
  tenantId?: string
): Promise<T> {
  // テナントIDを取得
  const resolvedTenantId = await getTenantId(tenantId);
  
  if (!resolvedTenantId) {
    throw new Error(
      "Tenant ID not found. Provide tenantId argument, set x-tenant-id header, or set TEST_TENANT_ID environment variable."
    );
  }

  // テナントの検証
  await validateTenant(resolvedTenantId);

  // トランザクション内でセッション変数を設定
  return await db.transaction(async (tx) => {
    // set_config を is_local = true で実行（トランザクション内限定）
    await tx.execute(
      sql`SELECT set_config('app.current_tenant', ${resolvedTenantId}::text, true)`
    );

    // 関数を実行（この時点でRLSが有効）
    // tenantId を引数として渡す
    return await fn(resolvedTenantId);
  });
}

/**
 * テナントコンテキストを設定（トランザクション外）
 * 
 * 注意: 通常は `withTenant` を使用してください。
 * この関数は、トランザクション外でセッション変数を設定する必要がある場合に使用します。
 * 
 * @param tenantId オプション: テナントID（指定しない場合は自動取得）
 * @throws Error テナントIDが見つからない、または無効な場合
 */
export async function setTenantContext(tenantId?: string): Promise<void> {
  const resolvedTenantId = await getTenantId(tenantId);
  
  if (!resolvedTenantId) {
    throw new Error(
      "Tenant ID not found. Provide tenantId argument, set x-tenant-id header, or set TEST_TENANT_ID environment variable."
    );
  }

  // テナントの検証
  await validateTenant(resolvedTenantId);

  // セッション変数を設定（is_local = true）
  await db.execute(
    sql`SELECT set_config('app.current_tenant', ${resolvedTenantId}::text, true)`
  );
}

/**
 * 現在のセッションに設定されているテナントIDを取得
 * 
 * 注意: トランザクション内で呼び出す必要がある場合があります。
 * `withTenant` 内で呼び出す場合は、既にセッション変数が設定されているため正常に動作します。
 * 
 * @returns テナントID（UUID文字列）、設定されていない場合はnull
 */
export async function getCurrentTenant(): Promise<string | null> {
  try {
    const result = await db.execute(
      sql`SELECT current_setting('app.current_tenant', true) as get_current_tenant`
    );
    
    // postgres-js の結果形式に合わせて取得
    const value = (result as any)[0]?.get_current_tenant;
    return value && value !== 'null' ? value : null;
  } catch (error) {
    // セッション変数が設定されていない場合
    return null;
  }
}

/**
 * テナントコンテキストをクリア
 * 
 * 注意: 通常は使用しない。セッション終了時に自動的にクリアされる。
 */
export async function clearTenantContext(): Promise<void> {
  await db.execute(
    sql`SELECT set_config('app.current_tenant', NULL, true)`
  );
}

