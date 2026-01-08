import { config } from "dotenv";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";

// 環境変数を読み込む
config({ path: resolve(__dirname, "../.env.local") });
config({ path: resolve(__dirname, "../.env") });

const prisma = new PrismaClient();

/**
 * 既存のリードデータに日本語フィールド名を追加するスクリプト
 * 
 * 使用方法:
 *   tsx scripts/update-leads-data-format.ts <tenantId> <organizationId>
 * 
 * 例:
 *   tsx scripts/update-leads-data-format.ts ff424270-d1ee-4a72-9f57-984066600402 7f79c785-1f85-4ec1-88bb-67aff9d119fc
 */
async function updateLeadsDataFormat(
  tenantId: string,
  organizationId: string
) {
  console.log("🔄 リードデータの形式を更新中...\n");
  console.log(`   テナントID: ${tenantId}`);
  console.log(`   組織ID: ${organizationId}\n`);

  try {
    // 対象のリードデータを取得
    const leads = await prisma.lead.findMany({
      where: {
        tenantId,
        organizationId,
      },
      select: {
        id: true,
        data: true,
      },
    });

    console.log(`📊 対象リード数: ${leads.length}件\n`);

    if (leads.length === 0) {
      console.log("⚠️  更新するデータがありません");
      return;
    }

    let updated = 0;
    let skipped = 0;

    // バッチ処理で更新
    const BATCH_SIZE = 100;
    for (let i = 0; i < leads.length; i += BATCH_SIZE) {
      const batch = leads.slice(i, i + BATCH_SIZE);

      for (const lead of batch) {
        try {
          const data = lead.data as any;

          // 既に日本語フィールド名が存在する場合はスキップ
          if (data && (data.店舗名 || data.電話番号 || data.住所)) {
            skipped++;
            continue;
          }

          // データを更新（日本語フィールド名を追加）
          const updatedData: any = {
            ...data,
            // 日本語フィールド名を追加（既存の英語フィールド名から取得）
            店舗名: data?.name || data?.store_name || data?.店舗名 || "",
            電話番号: data?.phone || data?.phone_number || data?.電話番号 || null,
            住所: data?.address || data?.詳細住所 || data?.住所 || null,
            詳細住所: data?.address || data?.詳細住所 || data?.住所 || null,
          };

          await prisma.lead.update({
            where: {
              id: lead.id,
            },
            data: {
              data: updatedData,
            },
          });

          updated++;

          // 進捗表示（100件ごと）
          if ((i + updated) % 100 === 0) {
            console.log(`   進捗: ${i + updated}/${leads.length}件更新済み`);
          }
        } catch (error) {
          console.error(`   ❌ エラー (ID: ${lead.id}):`, error);
        }
      }
    }

    console.log(`\n✅ 更新完了:`);
    console.log(`   更新: ${updated}件`);
    console.log(`   スキップ: ${skipped}件`);
    console.log(`   合計: ${leads.length}件`);
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
    console.error("使用方法: tsx scripts/update-leads-data-format.ts <tenantId> <organizationId>");
    console.error("\n例:");
    console.error("  tsx scripts/update-leads-data-format.ts ff424270-d1ee-4a72-9f57-984066600402 7f79c785-1f85-4ec1-88bb-67aff9d119fc");
    process.exit(1);
  }

  const [tenantId, organizationId] = args;

  await updateLeadsDataFormat(tenantId, organizationId);
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






