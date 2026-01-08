import { config } from "dotenv";
import { resolve } from "path";

// 環境変数の読み込み (.env.local)
config({ path: resolve(__dirname, "../.env.local") });

import { db } from "../src/lib/db";
import { scrapingJobs } from "../src/lib/db/schema";
import { withTenant } from "../src/lib/db/tenant-helper";
import { eq, and, sql } from "drizzle-orm";

async function checkPendingJobs() {
  await withTenant(async (tenantId) => {
    console.log("🔍 スクレイピングジョブの状態を確認中...\n");

    // 各ステータスのジョブ数を取得
    const pendingResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(scrapingJobs)
      .where(and(
        eq(scrapingJobs.tenantId, tenantId),
        eq(scrapingJobs.status, "pending")
      ));
    const pendingCount = Number(pendingResult[0]?.count || 0);

    const runningResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(scrapingJobs)
      .where(and(
        eq(scrapingJobs.tenantId, tenantId),
        eq(scrapingJobs.status, "running")
      ));
    const runningCount = Number(runningResult[0]?.count || 0);

    const completedResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(scrapingJobs)
      .where(and(
        eq(scrapingJobs.tenantId, tenantId),
        eq(scrapingJobs.status, "completed")
      ));
    const completedCount = Number(completedResult[0]?.count || 0);

    const failedResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(scrapingJobs)
      .where(and(
        eq(scrapingJobs.tenantId, tenantId),
        eq(scrapingJobs.status, "failed")
      ));
    const failedCount = Number(failedResult[0]?.count || 0);

    console.log("📊 ジョブステータス一覧:");
    console.log(`  ⏳ Pending:  ${pendingCount}件`);
    console.log(`  🔄 Running:  ${runningCount}件`);
    console.log(`  ✅ Completed: ${completedCount}件`);
    console.log(`  ❌ Failed:   ${failedCount}件`);
    console.log(`  📦 合計:     ${pendingCount + runningCount + completedCount + failedCount}件\n`);

    if (pendingCount > 0) {
      console.log(`⚠️  ${pendingCount}件のPendingジョブが処理待ちです。`);
      console.log(`   process-pending-jobs.ts が実行されているか確認してください。\n`);
      
      // 最新のPendingジョブを5件表示
      const latestPending = await db
        .select({
          id: scrapingJobs.id,
          url: scrapingJobs.url,
          createdAt: scrapingJobs.createdAt,
        })
        .from(scrapingJobs)
        .where(and(
          eq(scrapingJobs.tenantId, tenantId),
          eq(scrapingJobs.status, "pending")
        ))
        .limit(5);
      
      console.log("📋 最新のPendingジョブ（5件）:");
      latestPending.forEach((job, index) => {
        console.log(`   ${index + 1}. ${job.url.substring(0, 60)}...`);
        console.log(`      作成日時: ${job.createdAt}`);
      });
    } else {
      console.log("✅ Pendingジョブはありません。すべて処理済みです。");
    }
  });
}

checkPendingJobs()
  .then(() => {
    console.log("\n✅ 確認完了");
    process.exit(0);
  })
  .catch((e) => {
    console.error("❌ エラーが発生しました:", e);
    process.exit(1);
  });








