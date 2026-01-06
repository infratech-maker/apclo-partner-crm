import { config } from "dotenv";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";

// 環境変数を読み込む
config({ path: resolve(__dirname, "../.env.local") });
config({ path: resolve(__dirname, "../.env") });

const prisma = new PrismaClient();

/**
 * リードデータの存在確認スクリプト
 */
async function checkLeadsData() {
  console.log("🔍 リードデータの存在確認中...\n");

  try {
    // 総件数を取得
    const totalCount = await prisma.lead.count();
    console.log(`📊 総リード数: ${totalCount}件\n`);

    if (totalCount === 0) {
      console.log("⚠️  データベースにリードデータが存在しません");
      return;
    }

    // テナント別の統計
    const tenantStats = await prisma.lead.groupBy({
      by: ["tenantId"],
      _count: {
        _all: true,
      },
    });

    console.log("📊 テナント別のリード数:");
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
      console.log(`   総数: ${stat._count._all}件`);
      console.log(`   組織別内訳:`);
      for (const orgStat of orgStats) {
        const orgId = orgStat.organizationId || "(null)";
        console.log(`     - ${orgId}: ${orgStat._count._all}件`);
      }
    }

    // サンプルデータを取得
    console.log("\n📋 サンプルリードデータ（最新5件）:");
    const sampleLeads = await prisma.lead.findMany({
      take: 5,
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
        data: true,
      },
    });

    for (const lead of sampleLeads) {
      console.log(`\n   ID: ${lead.id}`);
      console.log(`   ソース: ${lead.source}`);
      console.log(`   テナントID: ${lead.tenantId}`);
      console.log(`   組織ID: ${lead.organizationId || "(null)"}`);
      console.log(`   ステータス: ${lead.status}`);
      console.log(`   作成日: ${lead.createdAt}`);
      if (lead.data && typeof lead.data === "object") {
        const data = lead.data as any;
        console.log(`   データ: ${JSON.stringify(data).substring(0, 100)}...`);
      }
    }

    // 特定のテナントIDのリードデータを確認
    const targetTenantId = "ff424270-d1ee-4a72-9f57-984066600402";
    const targetTenantCount = await prisma.lead.count({
      where: {
        tenantId: targetTenantId,
      },
    });

    console.log(`\n🎯 対象テナント (${targetTenantId}) のリード数: ${targetTenantCount}件`);

    if (targetTenantCount > 0) {
      const targetOrgId = "7f79c785-1f85-4ec1-88bb-67aff9d119fc";
      const withOrgCount = await prisma.lead.count({
        where: {
          tenantId: targetTenantId,
          organizationId: targetOrgId,
        },
      });
      const nullOrgCount = await prisma.lead.count({
        where: {
          tenantId: targetTenantId,
          organizationId: null,
        },
      });

      console.log(`   組織ID (${targetOrgId}) に紐づく: ${withOrgCount}件`);
      console.log(`   組織未設定 (null): ${nullOrgCount}件`);
    }
  } catch (error) {
    console.error("❌ エラーが発生しました:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// メイン処理
checkLeadsData()
  .then(() => {
    console.log("\n✅ 確認が完了しました");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ 処理中にエラーが発生しました:", error);
    process.exit(1);
  });



