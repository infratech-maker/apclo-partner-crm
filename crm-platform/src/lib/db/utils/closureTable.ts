/**
 * Closure Table ヘルパー関数
 * 
 * 組織階層の管理を簡素化するためのユーティリティ
 */

import { db } from "../index";
import { organizations, organizationClosure } from "../schema";
import { eq, and, sql, gt } from "drizzle-orm";

/**
 * 組織を追加し、Closure Tableを更新
 * 
 * @param orgData 組織データ
 * @param parentId 親組織ID（ルートの場合はnull）
 */
export async function addOrganization(
  orgData: {
    name: string;
    code?: string;
    type: "direct" | "partner_1st" | "partner_2nd" | "unit" | "individual";
    parentId?: string | null;
  }
) {
  // 親組織の情報を取得（level, path計算用）
  let parentLevel = 0;
  let parentPath = "/root";

  if (orgData.parentId) {
    const parent = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgData.parentId))
      .limit(1);

    if (parent.length > 0) {
      parentLevel = parent[0].level;
      parentPath = parent[0].path || "/root";
    }
  }

  // 組織を追加
  const [newOrg] = await db
    .insert(organizations)
    .values({
      name: orgData.name,
      code: orgData.code,
      type: orgData.type,
      parentId: orgData.parentId || null,
      level: parentLevel + 1,
      path: `${parentPath}/${orgData.code || "org"}`,
    })
    .returning();

  // Closure Tableを更新
  // 1. 自己参照 (depth=0)
  await db.insert(organizationClosure).values({
    tenantId: newOrg.tenantId,
    ancestorId: newOrg.id,
    descendantId: newOrg.id,
    depth: 0,
  });

  // 2. 親組織の全祖先との関係を追加
  if (orgData.parentId) {
    const ancestors = await db
      .select({
        ancestorId: organizationClosure.ancestorId,
        depth: organizationClosure.depth,
      })
      .from(organizationClosure)
      .where(eq(organizationClosure.descendantId, orgData.parentId));

    if (ancestors.length > 0) {
      await db.insert(organizationClosure).values(
        ancestors.map((anc) => ({
          tenantId: newOrg.tenantId,
          ancestorId: anc.ancestorId,
          descendantId: newOrg.id,
          depth: (anc.depth || 0) + 1,
        }))
      );
    }
  }

  return newOrg;
}

/**
 * 組織の全子孫を取得（Closure Tableを使用）
 * 
 * @param organizationId 組織ID
 * @param includeSelf 自分自身を含めるか
 */
export async function getDescendants(organizationId: string, includeSelf = false) {
  const conditions = includeSelf
    ? [eq(organizationClosure.ancestorId, organizationId)]
    : [
        eq(organizationClosure.ancestorId, organizationId),
        gt(organizationClosure.depth, 0),
      ];

  const descendants = await db
    .select({
      organization: organizations,
      depth: organizationClosure.depth,
    })
    .from(organizationClosure)
    .innerJoin(
      organizations,
      eq(organizationClosure.descendantId, organizations.id)
    )
    .where(and(...conditions));

  return descendants;
}

/**
 * 組織の全祖先を取得
 * 
 * @param organizationId 組織ID
 * @param includeSelf 自分自身を含めるか
 */
export async function getAncestors(organizationId: string, includeSelf = false) {
  const conditions = includeSelf
    ? [eq(organizationClosure.descendantId, organizationId)]
    : [
        eq(organizationClosure.descendantId, organizationId),
        gt(organizationClosure.depth, 0),
      ];

  const ancestors = await db
    .select({
      organization: organizations,
      depth: organizationClosure.depth,
    })
    .from(organizationClosure)
    .innerJoin(
      organizations,
      eq(organizationClosure.ancestorId, organizations.id)
    )
    .where(and(...conditions));

  return ancestors;
}

/**
 * 組織を削除（Closure Tableも自動更新）
 * 
 * 注意: CASCADE DELETEにより、Closure Tableの関連レコードは自動削除される
 */
export async function deleteOrganization(organizationId: string) {
  // 子組織がある場合は削除できない（ビジネスロジック）
  const children = await db
    .select()
    .from(organizations)
    .where(eq(organizations.parentId, organizationId))
    .limit(1);

  if (children.length > 0) {
    throw new Error("子組織が存在するため削除できません");
  }

  await db.delete(organizations).where(eq(organizations.id, organizationId));
}

