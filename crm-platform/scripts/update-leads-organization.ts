import { config } from "dotenv";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";

// 環境変数を読み込む
config({ path: resolve(__dirname, "../.env.local") });
config({ path: resolve(__dirname, "../.env") });

const prisma = new PrismaClient();

/**
 * リードデータのorganizationIdを更新するスクリプト
 * 
 * 使用方法:
 *   tsx scripts/update-leads-organization.ts <tenantId> <organizationId>
 * 
 * 例:
 *   tsx scripts/update-leads-organization.ts ff424270-d1ee-4a72-9f57-984066600402 7f79c785-1f85-4ec1-88bb-67aff9d119fc
 */
async function updateLeadsOrganization(
  tenantId: string,
  organizationId: string
) {
  console.log("🔄 リードデータのorganizationIdを更新中...");
  console.log(`   テナントID: ${tenantId}`);
  console.log(`   組織ID: ${organizationId}`);

  try {
    // 更新前の統計を取得
    const beforeStats = await prisma.lead.groupBy({
      by: ["organizationId"],
      where: {
        tenantId,
      },
      _count: {
        _all: true,
      },
    });

    console.log("\n📊 更新前の統計:");
    beforeStats.forEach((stat) => {
      const orgId = stat.organizationId || "(null)";
      console.log(`   organizationId: ${orgId} => ${stat._count._all}件`);
    });

    // organizationIdがnullのリードを更新
    const result = await prisma.lead.updateMany({
      where: {
        tenantId,
        organizationId: null,
      },
      data: {
        organizationId,
      },
    });

    console.log(`\n✅ 更新完了: ${result.count}件のリードデータを更新しました`);

    // 更新後の統計を取得
    const afterStats = await prisma.lead.groupBy({
      by: ["organizationId"],
      where: {
        tenantId,
      },
      _count: {
        _all: true,
      },
    });

    console.log("\n📊 更新後の統計:");
    afterStats.forEach((stat) => {
      const orgId = stat.organizationId || "(null)";
      console.log(`   organizationId: ${orgId} => ${stat._count._all}件`);
    });
  } catch (error) {
    console.error("❌ エラーが発生しました:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// メイン処理
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error("❌ 引数が不足しています");
    console.error("使用方法: tsx scripts/update-leads-organization.ts <tenantId> <organizationId>");
    console.error("\n例:");
    console.error("  tsx scripts/update-leads-organization.ts ff424270-d1ee-4a72-9f57-984066600402 7f79c785-1f85-4ec1-88bb-67aff9d119fc");
    process.exit(1);
  }

  const [tenantId, organizationId] = args;

  await updateLeadsOrganization(tenantId, organizationId);
}

main()
  .then(() => {
    console.log("\n✅ 処理が完了しました");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ 処理中にエラーが発生しました:", error);
    process.exit(1);
  });



