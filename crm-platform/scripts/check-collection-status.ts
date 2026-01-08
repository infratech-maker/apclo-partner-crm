import { config } from "dotenv";
import { resolve } from "path";

// 環境変数の読み込み (.env.local)
config({ path: resolve(__dirname, "../.env.local") });

import { db } from "../src/lib/db";
import { scrapingJobs, leads } from "../src/lib/db/schema";
import { withTenant } from "../src/lib/db/tenant-helper";
import { sql, eq } from "drizzle-orm";
import { prisma } from "../src/lib/prisma";

async function checkCollectionStatus() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📊 リスト収集状況");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("");

  await withTenant(async (tenantId) => {
    // 1. Leads テーブルの統計
    console.log("📋 Leads テーブル:");
    const leadsCountResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(leads);
    const totalLeads = Number(leadsCountResult[0]?.count || 0);
    console.log(`   総件数: ${totalLeads.toLocaleString()} 件`);

    // 電話番号あり
    const leadsWithPhoneResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(sql`${leads.data}->>'phone' IS NOT NULL AND ${leads.data}->>'phone' != ''`);
    const leadsWithPhone = Number(leadsWithPhoneResult[0]?.count || 0);
    const phoneRate = totalLeads > 0 ? ((leadsWithPhone / totalLeads) * 100).toFixed(1) : "0.0";
    console.log(`   電話番号あり: ${leadsWithPhone.toLocaleString()} 件 (${phoneRate}%)`);

    // 2. ScrapingJobs テーブルの統計
    console.log("");
    console.log("📋 ScrapingJobs テーブル:");
    const jobsCountResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(scrapingJobs)
      .where(eq(scrapingJobs.tenantId, tenantId));
    const totalJobs = Number(jobsCountResult[0]?.count || 0);
    console.log(`   総ジョブ数: ${totalJobs.toLocaleString()} 件`);

    // ステータス別
    const statusCounts = await db
      .select({
        status: scrapingJobs.status,
        count: sql<number>`count(*)`,
      })
      .from(scrapingJobs)
      .where(eq(scrapingJobs.tenantId, tenantId))
      .groupBy(scrapingJobs.status);

    for (const row of statusCounts) {
      const status = row.status;
      const count = Number(row.count || 0);
      console.log(`   ${status}: ${count.toLocaleString()} 件`);
    }

    // 3. MasterLead テーブルの統計
    console.log("");
    console.log("📋 MasterLead テーブル:");
    const masterLeadsCount = await prisma.masterLead.count();
    console.log(`   総件数: ${masterLeadsCount.toLocaleString()} 件`);

    // ソース別
    const sourceCounts = await prisma.masterLead.groupBy({
      by: ['source'],
      _count: {
        id: true,
      },
    });

    for (const row of sourceCounts) {
      const source = row.source || 'unknown';
      const count = row._count.id;
      console.log(`   ${source}: ${count.toLocaleString()} 件`);
    }

    // 電話番号あり
    const masterLeadsWithPhone = await prisma.masterLead.count({
      where: {
        phone: {
          not: null,
        },
      },
    });
    const masterPhoneRate = masterLeadsCount > 0 ? ((masterLeadsWithPhone / masterLeadsCount) * 100).toFixed(1) : "0.0";
    console.log(`   電話番号あり: ${masterLeadsWithPhone.toLocaleString()} 件 (${masterPhoneRate}%)`);

    // 4. 直近24時間の活動
    console.log("");
    console.log("📋 直近24時間の活動:");
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const recentLeads = await db
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(sql`${leads.createdAt} > ${oneDayAgo.toISOString()}`);
    const recentLeadsCount = Number(recentLeads[0]?.count || 0);
    console.log(`   新規Leads: ${recentLeadsCount.toLocaleString()} 件`);

    const recentMasterLeads = await prisma.masterLead.count({
      where: {
        createdAt: {
          gte: oneDayAgo,
        },
      },
    });
    console.log(`   新規MasterLeads: ${recentMasterLeads.toLocaleString()} 件`);

    const recentJobs = await db
      .select({ count: sql<number>`count(*)` })
      .from(scrapingJobs)
      .where(
        sql`${scrapingJobs.tenantId} = ${tenantId} AND ${scrapingJobs.createdAt} > ${oneDayAgo.toISOString()}`
      );
    const recentJobsCount = Number(recentJobs[0]?.count || 0);
    console.log(`   新規ジョブ: ${recentJobsCount.toLocaleString()} 件`);

    // 5. 最新のログファイル確認
    console.log("");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📋 最新の収集ログ");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("");

    const { readFileSync, existsSync } = await import("fs");
    const logPath = resolve(__dirname, "../logs/new-open-collection.log");
    
    if (existsSync(logPath)) {
      const logContent = readFileSync(logPath, "utf-8");
      const lines = logContent.split("\n").filter(line => line.trim() !== "");
      const lastLines = lines.slice(-10);
      console.log("新規リスト収集ログ（最後の10行）:");
      lastLines.forEach(line => console.log(`   ${line}`));
    } else {
      console.log("⚠️  新規リスト収集のログファイルが見つかりません");
    }
  });
}

checkCollectionStatus()
  .then(() => {
    console.log("");
    console.log("✅ 統計情報の取得が完了しました");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ エラーが発生しました:", error);
    process.exit(1);
  });
