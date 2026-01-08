import { config } from "dotenv";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";

// 環境変数を読み込む
config({ path: resolve(__dirname, "../.env.local") });
config({ path: resolve(__dirname, "../.env") });

/**
 * 別のデータベース名でリードデータを確認
 */
async function checkOtherDatabases() {
  console.log("🔍 別のデータベース名でリードデータを確認中...\n");

  // 確認する可能性のあるデータベース名
  const possibleDatabaseNames = [
    "crm_platform",
    "crm_platform_old",
    "scraped_data",
    "leads_db",
    "callgetter",
    "call_sender",
  ];

  const currentDbUrl = process.env.DATABASE_URL || "";
  const baseUrl = currentDbUrl.replace(/\/[^\/]+$/, ""); // データベース名を除いたURL

  console.log(`📡 ベースURL: ${baseUrl.replace(/:[^:@]+@/, ":****@")}\n`);

  for (const dbName of possibleDatabaseNames) {
    try {
      const testDbUrl = `${baseUrl}/${dbName}`;
      console.log(`🔍 データベース "${dbName}" を確認中...`);

      const testPrisma = new PrismaClient({
        datasources: {
          db: {
            url: testDbUrl,
          },
        },
      });

      const leadCount = await testPrisma.lead.count();
      const customerCount = await testPrisma.customer.count();
      const scrapingJobCount = await testPrisma.scrapingJob.count();

      if (leadCount > 0 || customerCount > 0 || scrapingJobCount > 0) {
        console.log(`   ✅ データが見つかりました！`);
        console.log(`      - leads: ${leadCount}件`);
        console.log(`      - customers: ${customerCount}件`);
        console.log(`      - scraping_jobs: ${scrapingJobCount}件`);

        // サンプルデータを取得
        if (leadCount > 0) {
          const sampleLeads = await testPrisma.lead.findMany({
            take: 3,
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
            },
          });

          console.log(`\n   📋 サンプルリードデータ:`);
          for (const lead of sampleLeads) {
            console.log(`      - ID: ${lead.id}`);
            console.log(`        ソース: ${lead.source}`);
            console.log(`        テナントID: ${lead.tenantId}`);
            console.log(`        組織ID: ${lead.organizationId || "(null)"}`);
            console.log(`        作成日: ${lead.createdAt}`);
          }
        }

        console.log(`\n   💡 このデータベースからデータを移行するには:`);
        console.log(`      DATABASE_URL="${testDbUrl}" を設定してデータ移行スクリプトを実行してください\n`);

        await testPrisma.$disconnect();
        return testDbUrl;
      } else {
        console.log(`   ⚠️  データなし\n`);
      }

      await testPrisma.$disconnect();
    } catch (error: any) {
      if (error.code === "P1003" || error.message?.includes("does not exist")) {
        console.log(`   ⚠️  データベースが存在しません\n`);
      } else {
        console.log(`   ❌ エラー: ${error.message}\n`);
      }
    }
  }

  console.log("💡 ヒント:");
  console.log("   もしデータが別のデータベースに存在する場合:");
  console.log("   1. 正しいデータベース名を確認してください");
  console.log("   2. DATABASE_URLを一時的に変更してデータ移行スクリプトを実行してください");
  console.log("   3. または、データベース名を教えていただければ、移行スクリプトを作成します");

  return null;
}

// メイン処理
checkOtherDatabases()
  .then((foundDbUrl) => {
    if (foundDbUrl) {
      console.log(`\n✅ データが見つかりました: ${foundDbUrl.replace(/:[^:@]+@/, ":****@")}`);
    } else {
      console.log("\n⚠️  データが見つかりませんでした");
    }
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ 処理中にエラーが発生しました:", error);
    process.exit(1);
  });






