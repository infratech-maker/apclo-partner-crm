import { pgTable, text, timestamp, uuid, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { tenants } from "./tenants";

/**
 * スクレイピングジョブステータス
 */
export const scrapingJobStatusEnum = pgEnum("scraping_job_status", [
  "pending",    // 待機中
  "running",    // 実行中
  "completed",  // 完了
  "failed",     // 失敗
  "cancelled",  // キャンセル
]);

/**
 * スクレイピングジョブテーブル
 * 
 * 設計理由:
 * - スクレイピングジョブの実行履歴を管理
 * - BullMQと連携して非同期処理を管理
 * - ジョブのステータスと結果を追跡
 * 
 * マルチテナント対応:
 * - tenant_id により、テナント間のデータ分離を実現
 * - RLS準備: 将来的にPostgreSQLのRow Level Securityを有効化し、tenant_idによる自動フィルタリングを実装
 */
export const scrapingJobs = pgTable("scraping_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenantId")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(), // マルチテナント対応: テナントID
  
  // ジョブ情報
  url: text("url").notNull(),
  status: scrapingJobStatusEnum("status").default("pending").notNull(),
  
  // BullMQ連携
  bullmqJobId: text("bullmqJobId"), // BullMQのジョブID
  
  // 結果・エラー情報
  result: jsonb("result"), // スクレイピング結果（JSONB）
  error: text("error"), // エラーメッセージ
  
  // メタデータ
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

/**
 * リードテーブル（スクレイピングで取得したデータ）
 * 
 * 設計理由:
 * - スクレイピングで取得したリード情報を保存
 * - 未対応リストとして管理し、CTIで架電後に案件化
 * - 動的なデータ構造に対応するため、dataカラムにJSONBを使用
 * 
 * マルチテナント対応:
 * - tenant_id により、テナント間のデータ分離を実現
 * - RLS準備: 将来的にPostgreSQLのRow Level Securityを有効化し、tenant_idによる自動フィルタリングを実装
 */
export const leads = pgTable("leads", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id, { onDelete: "cascade" })
    .notNull(), // マルチテナント対応: テナントID
  
  // スクレイピングジョブとの関連
  scrapingJobId: uuid("scraping_job_id").references(() => scrapingJobs.id, { onDelete: "set null" }),
  
  // リード情報
  source: text("source").notNull(), // 取得元URL
  data: jsonb("data").notNull(), // スクレイピングで取得したデータ（JSONB）
  
  // ステータス
  status: text("status").default("new").notNull(), // "new" | "contacted" | "qualified" | "converted" | "rejected"
  
  // メタデータ
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const scrapingJobsRelations = relations(scrapingJobs, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [scrapingJobs.tenantId],
    references: [tenants.id],
  }),
  leads: many(leads),
}));

export const leadsRelations = relations(leads, ({ one }) => ({
  tenant: one(tenants, {
    fields: [leads.tenantId],
    references: [tenants.id],
  }),
  scrapingJob: one(scrapingJobs, {
    fields: [leads.scrapingJobId],
    references: [scrapingJobs.id],
  }),
}));

