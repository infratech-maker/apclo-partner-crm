import { config } from "dotenv";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";

// 環境変数を読み込む
config({ path: resolve(__dirname, "../.env.local") });
config({ path: resolve(__dirname, "../.env") });

const prisma = new PrismaClient();

/**
 * データベースのテーブル一覧とリードデータの存在確認
 */
async function checkDatabaseTables() {
  console.log("🔍 データベースの確認中...\n");
  console.log(`📡 DATABASE_URL: ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ":****@") || "未設定"}\n`);

  try {
    // リードテーブルの存在確認と件数
    const leadCount = await prisma.lead.count();
    console.log(`📊 leads テーブルの総件数: ${leadCount}件\n`);

    // 他のテーブルの件数も確認
    const customerCount = await prisma.customer.count();
    const userCount = await prisma.user.count();
    const organizationCount = await prisma.organization.count();
    const tenantCount = await prisma.tenant.count();

    console.log("📊 その他のテーブルの件数:");
    console.log(`   customers: ${customerCount}件`);
    console.log(`   users: ${userCount}件`);
    console.log(`   organizations: ${organizationCount}件`);
    console.log(`   tenants: ${tenantCount}件\n`);

    // テーブル一覧を取得（PostgreSQLの場合）
    if (process.env.DATABASE_URL?.includes("postgresql")) {
      const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
        ORDER BY tablename;
      `;

      console.log("📋 データベース内のテーブル一覧:");
      for (const table of tables) {
        console.log(`   - ${table.tablename}`);
      }
    }

    // リードデータが存在する場合、サンプルを表示
    if (leadCount > 0) {
      console.log("\n📋 サンプルリードデータ（最新3件）:");
      const sampleLeads = await prisma.lead.findMany({
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

      for (const lead of sampleLeads) {
        console.log(`\n   ID: ${lead.id}`);
        console.log(`   ソース: ${lead.source}`);
        console.log(`   テナントID: ${lead.tenantId}`);
        console.log(`   組織ID: ${lead.organizationId || "(null)"}`);
        console.log(`   ステータス: ${lead.status}`);
        console.log(`   作成日: ${lead.createdAt}`);
      }
    } else {
      console.log("\n⚠️  leadsテーブルにデータが存在しません");
      console.log("   過去に収集したデータが別のデータベースに存在する可能性があります");
    }
  } catch (error) {
    console.error("❌ エラーが発生しました:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// メイン処理
checkDatabaseTables()
  .then(() => {
    console.log("\n✅ 確認が完了しました");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ 処理中にエラーが発生しました:", error);
    process.exit(1);
  });



