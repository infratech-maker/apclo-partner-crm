import { config } from "dotenv";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";

// 環境変数を読み込む
config({ path: resolve(__dirname, "../.env.local") });
config({ path: resolve(__dirname, "../.env") });

const prisma = new PrismaClient();

/**
 * スクレイピングデータの確認
 */
async function checkScrapingData() {
  console.log("🔍 スクレイピングデータの確認中...\n");

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
        console.log(`   ステータス: ${job.status}`);
        console.log(`   作成日: ${job.createdAt}`);
        console.log(`   関連リード数: ${job.leads.length}件`);
      }
    }

    // すべてのテーブルでデータが存在するか確認
    console.log("\n📊 全テーブルのデータ件数:");
    const tables = [
      { name: "leads", count: await prisma.lead.count() },
      { name: "scraping_jobs", count: await prisma.scrapingJob.count() },
      { name: "customers", count: await prisma.customer.count() },
      { name: "users", count: await prisma.user.count() },
      { name: "organizations", count: await prisma.organization.count() },
      { name: "tenants", count: await prisma.tenant.count() },
    ];

    for (const table of tables) {
      if (table.count > 0) {
        console.log(`   ✅ ${table.name}: ${table.count}件`);
      } else {
        console.log(`   ⚠️  ${table.name}: ${table.count}件`);
      }
    }

    // 別のデータベース名の可能性を確認
    console.log("\n💡 ヒント:");
    console.log("   もし過去に収集したデータが別のデータベースに存在する場合:");
    console.log("   1. 別のDATABASE_URLを確認してください");
    console.log("   2. データベース名が異なる可能性があります（例: crm_platform_old, scraped_data など）");
    console.log("   3. データを移行する必要がある場合は、データ移行スクリプトを作成します");
  } catch (error) {
    console.error("❌ エラーが発生しました:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// メイン処理
checkScrapingData()
  .then(() => {
    console.log("\n✅ 確認が完了しました");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ 処理中にエラーが発生しました:", error);
    process.exit(1);
  });






