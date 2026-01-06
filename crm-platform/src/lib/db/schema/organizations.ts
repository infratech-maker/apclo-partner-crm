import { pgTable, text, timestamp, uuid, boolean, integer, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { tenants } from "./tenants";

/**
 * 組織タイプ: 直営、1次代理店、2次代理店など
 */
export const organizationTypeEnum = pgEnum("organization_type", [
  "direct",      // 直営
  "partner_1st", // 1次代理店
  "partner_2nd", // 2次代理店
  "unit",        // ユニット
  "individual",  // 個人
]);

/**
 * 組織テーブル
 * 
 * 設計理由:
 * - parent_id による単純な階層構造は、深い階層の集計時に再帰CTEが必要でパフォーマンスが劣化
 * - Closure Table パターンにより、任意の深さの階層を1回のJOINで取得可能
 * - 集計クエリ（例: 直営配下の全代理店の売上合計）が高速化される
 * 
 * マルチテナント対応:
 * - tenant_id により、テナント間のデータ分離を実現
 * - RLS準備: 将来的にPostgreSQLのRow Level Securityを有効化し、tenant_idによる自動フィルタリングを実装
 */
// @ts-ignore - 循環参照のため型エラーが発生するが、実行時には問題ない（Drizzleでは正常なパターン）
export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(), // マルチテナント対応: テナントID
  name: text("name").notNull(),
  code: text("code"), // 組織コード（例: "DIRECT-001"）- tenant_idと組み合わせてUNIQUE
  type: organizationTypeEnum("type").notNull(),
  // @ts-ignore - 循環参照のため型エラーが発生するが、実行時には問題ない（Drizzleでは正常なパターン）
  parentId: uuid("parent_id").references(() => organizations.id, { onDelete: "cascade" }),
  
  // メタデータ
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  
  // 階層パス（Materialized Path） - 補助的な高速化用
  // 例: "/root/direct/partner-001/unit-001"
  path: text("path"),
  
  // 階層レベル（0 = ルート）
  level: integer("level").default(0).notNull(),
});

/**
 * Closure Table: 組織階層の全パスを保持
 * 
 * 設計理由:
 * - ancestor_id と descendant_id の組み合わせで、任意の2ノード間の関係を表現
 * - depth により、直接の親子関係（depth=1）と間接的な関係（depth>1）を区別
 * - これにより、「直営配下の全組織」を1回のJOINで取得可能
 * 
 * 例:
 * - 組織A > 組織B > 組織C の場合:
 *   (A, A, 0), (A, B, 1), (A, C, 2), (B, B, 0), (B, C, 1), (C, C, 0)
 * 
 * マルチテナント対応:
 * - tenant_id により、テナント間のデータ分離を実現
 * - ancestor_id と descendant_id は必ず同じ tenant_id に属する必要がある（アプリケーション層で保証）
 * - RLS準備: 将来的にPostgreSQLのRow Level Securityを有効化し、tenant_idによる自動フィルタリングを実装
 */
export const organizationClosure = pgTable("organization_closure", {
  tenantId: uuid("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(), // マルチテナント対応: テナントID
  ancestorId: uuid("ancestor_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  descendantId: uuid("descendant_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  depth: integer("depth").notNull(), // 0 = 自己参照, 1 = 直接の親子, 2+ = 間接的
});

// 複合主キーとインデックス
// 注意: Drizzleでは複合主キーは別途定義が必要（マイグレーション時に追加）

export const organizationsRelations = relations(organizations, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [organizations.tenantId],
    references: [tenants.id],
  }),
  parent: one(organizations, {
    fields: [organizations.parentId],
    references: [organizations.id],
    relationName: "parent",
  }),
  children: many(organizations, {
    relationName: "parent",
  }),
  ancestors: many(organizationClosure, {
    relationName: "ancestor",
  }),
  descendants: many(organizationClosure, {
    relationName: "descendant",
  }),
}));

export const organizationClosureRelations = relations(organizationClosure, ({ one }) => ({
  tenant: one(tenants, {
    fields: [organizationClosure.tenantId],
    references: [tenants.id],
  }),
  ancestor: one(organizations, {
    fields: [organizationClosure.ancestorId],
    references: [organizations.id],
    relationName: "ancestor",
  }),
  descendant: one(organizations, {
    fields: [organizationClosure.descendantId],
    references: [organizations.id],
    relationName: "descendant",
  }),
}));


