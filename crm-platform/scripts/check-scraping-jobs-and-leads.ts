import { config } from "dotenv";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";

// 環境変数を読み込む
config({ path: resolve(__dirname, "../.env.local") });
config({ path: resolve(__dirname, "../.env") });

const prisma = new PrismaClient();

/**
 * スクレイピングジョブとリードデータの確認
 */
async function checkScrapingJobsAndLeads() {
  console.log("🔍 スクレイピングジョブとリードデータの確認中...\n");

  try {
    // スクレイピングジョブの確認
    const scrapingJobs = await prisma.scrapingJob.findMany({
      take: 10,
      orderBy: {
        createdAt: "desc",
      },
      include: {
        leads: {
          take: 5,
        },
      },
    });

    console.log(`📊 スクレイピングジョブ数: ${scrapingJobs.length}件\n`);

    if (scrapingJobs.length > 0) {
      console.log("📋 スクレイピングジョブ一覧:");
      for (const job of scrapingJobs) {
        console.log(`\n   ID: ${job.id}`);
        console.log(`   URL: ${job.url}`);
        console.log(`   ステータス: ${job.status}`);
        console.log(`   テナントID: ${job.tenantId}`);
        console.log(`   作成日: ${job.createdAt}`);
        console.log(`   関連リード数: ${job.leads.length}件`);

        if (job.leads.length > 0) {
          console.log(`   リードデータ:`);
          for (const lead of job.leads) {
            console.log(`     - ID: ${lead.id}`);
            console.log(`       ソース: ${lead.source}`);
            console.log(`       組織ID: ${lead.organizationId || "(null)"}`);
            console.log(`       ステータス: ${lead.status}`);
            console.log(`       作成日: ${lead.createdAt}`);
          }
        }
      }
    } else {
      console.log("⚠️  スクレイピングジョブが存在しません");
    }

    // 全テナントのリードデータを確認
    const allLeads = await prisma.lead.findMany({
      take: 10,
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        source: true,
        tenantId: true,
        organizationId: true,
        status: true,
        createdAt: true,
        scrapingJobId: true,
      },
    });

    console.log(`\n📊 全テナントのリードデータ（最新10件）: ${allLeads.length}件\n`);

    if (allLeads.length > 0) {
      console.log("📋 リードデータ一覧:");
      for (const lead of allLeads) {
        console.log(`\n   ID: ${lead.id}`);
        console.log(`   ソース: ${lead.source}`);
        console.log(`   テナントID: ${lead.tenantId}`);
        console.log(`   組織ID: ${lead.organizationId || "(null)"}`);
        console.log(`   ステータス: ${lead.status}`);
        console.log(`   スクレイピングジョブID: ${lead.scrapingJobId || "(null)"}`);
        console.log(`   作成日: ${lead.createdAt}`);
      }
    } else {
      console.log("⚠️  リードデータが存在しません");
    }

    // テナント別の統計
    const tenantStats = await prisma.lead.groupBy({
      by: ["tenantId"],
      _count: {
        _all: true,
      },
    });

    if (tenantStats.length > 0) {
      console.log("\n📊 テナント別のリード数:");
      for (const stat of tenantStats) {
        const orgStats = await prisma.lead.groupBy({
          by: ["organizationId"],
          where: {
            tenantId: stat.tenantId,
          },
          _count: {
            _all: true,
          },
        });

        console.log(`\n   テナントID: ${stat.tenantId}`);
        console.log(`   総数: ${Number(stat._count._all)}件`);
        console.log(`   組織別内訳:`);
        for (const orgStat of orgStats) {
          const orgId = orgStat.organizationId || "(null)";
          console.log(`     - ${orgId}: ${orgStat._count._all}件`);
        }
      }
    }
  } catch (error) {
    console.error("❌ エラーが発生しました:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// メイン処理
checkScrapingJobsAndLeads()
  .then(() => {
    console.log("\n✅ 確認が完了しました");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ 処理中にエラーが発生しました:", error);
    process.exit(1);
  });

