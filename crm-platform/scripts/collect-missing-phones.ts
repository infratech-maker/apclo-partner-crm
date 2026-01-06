import { config } from "dotenv";
import { resolve } from "path";

// 環境変数の読み込み (.env.local)
config({ path: resolve(__dirname, "../.env.local") });
config({ path: resolve(__dirname, "../.env") });

import { prisma } from "../src/lib/prisma";
import { scrapeTabelogStore } from "../src/features/scraper/worker";

/**
 * 電話番号が不足しているリードに対して、食べログから電話番号を収集するスクリプト
 * 
 * 使用方法:
 *   tsx scripts/collect-missing-phones.ts <tenantId> <organizationId> [limit]
 * 
 * 例:
 *   tsx scripts/collect-missing-phones.ts ff424270-d1ee-4a72-9f57-984066600402 7f79c785-1f85-4ec1-88bb-67aff9d119fc 100
 */

const BATCH_SIZE = 5; // API負荷軽減のため少なめに
const DELAY_MS = 3000; // スクレイピングマナーとして待機時間を確保（3秒）

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function collectMissingPhones(
  tenantId: string,
  organizationId: string,
  limit?: number
) {
  console.log("📞 電話番号が不足しているリードを収集します...\n");
  console.log(`   テナントID: ${tenantId}`);
  console.log(`   組織ID: ${organizationId}`);
  if (limit) {
    console.log(`   処理上限: ${limit}件`);
  }
  console.log("");

  try {
    // 食べログのソースを持つリードをすべて取得
    const allTabelogLeads = await prisma.lead.findMany({
      where: {
        tenantId,
        organizationId,
        source: {
          contains: "tabelog.com",
        },
      },
      select: {
        id: true,
        source: true,
        data: true,
      },
    });

    // JavaScriptで電話番号がnullまたは空のリードをフィルタリング
    const leadsWithoutPhone = allTabelogLeads
      .filter((lead) => {
        const data = lead.data as any;
        const phone = data?.phone || data?.電話番号;
        return !phone || (typeof phone === "string" && phone.trim() === "");
      })
      .slice(0, limit);

    console.log(`📊 電話番号が不足しているリード: ${leadsWithoutPhone.length}件\n`);

    if (leadsWithoutPhone.length === 0) {
      console.log("✅ 電話番号が不足しているリードはありませんでした。");
      return;
    }

    let processed = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    const startTime = Date.now();

    for (let i = 0; i < leadsWithoutPhone.length; i++) {
      const lead = leadsWithoutPhone[i];
      processed++;

      try {
        const data = lead.data as any;
        const currentPhone = data?.phone || data?.電話番号;

        // 念のため、既に電話番号がある場合はスキップ
        if (currentPhone && currentPhone.trim() !== "") {
          console.log(`  ⏭️ [${processed}/${leadsWithoutPhone.length}] スキップ（既に電話番号あり）: ${lead.source}`);
          skipped++;
          continue;
        }

        console.log(`  📡 [${processed}/${leadsWithoutPhone.length}] スクレイピング中: ${lead.source}`);

        // スクレイピング実行
        const result = await scrapeTabelogStore(lead.source);

        if (!result.phone || result.phone.trim() === "") {
          console.warn(`    ⚠️ 電話番号が取得できませんでした。`);
          skipped++;
          continue;
        }

        // データを更新（既存のデータを保持しつつ、電話番号を追加）
        const updatedData = {
          ...data,
          phone: result.phone,
          電話番号: result.phone,
        };

        await prisma.lead.update({
          where: { id: lead.id },
          data: { data: updatedData },
        });

        updated++;
        console.log(`    ✅ 電話番号を更新: ${result.phone}`);
      } catch (error) {
        errors++;
        console.error(`    ❌ エラー: ${lead.source}`, error instanceof Error ? error.message : String(error));
      }

      // 負荷対策のウェイト
      await sleep(DELAY_MS);

      // バッチごとに進捗ログを出す
      if (processed % BATCH_SIZE === 0) {
        const progressPercent = Math.round((processed / leadsWithoutPhone.length) * 100);
        const elapsedTime = Math.floor((Date.now() - startTime) / 1000);
        const estimatedTotalTime = processed > 0 
          ? Math.floor((elapsedTime / processed) * leadsWithoutPhone.length)
          : 0;
        const remainingTime = estimatedTotalTime - elapsedTime;
        
        console.log(
          `--- 進捗: ${processed}/${leadsWithoutPhone.length}件 (${progressPercent}%) | 更新: ${updated}, スキップ: ${skipped}, エラー: ${errors} | 経過: ${Math.floor(elapsedTime / 60)}分${elapsedTime % 60}秒 | 残り: ${remainingTime > 0 ? `${Math.floor(remainingTime / 60)}分${remainingTime % 60}秒` : "計算中"} ---`
        );
      }
    }

    const totalTime = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(totalTime / 60);
    const seconds = totalTime % 60;

    console.log("\n🎉 処理完了");
    console.log(`   総件数: ${leadsWithoutPhone.length}件`);
    console.log(`   更新: ${updated}件`);
    console.log(`   スキップ: ${skipped}件`);
    console.log(`   エラー: ${errors}件`);
    console.log(`   総処理時間: ${minutes}分${seconds}秒`);
  } catch (error) {
    console.error("❌ エラーが発生しました:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// コマンドライン引数から取得
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error("❌ エラー: テナントIDと組織IDを指定してください。");
  console.error("使用方法: tsx scripts/collect-missing-phones.ts <tenantId> <organizationId> [limit]");
  process.exit(1);
}

const tenantId = args[0];
const organizationId = args[1];
const limit = args[2] ? parseInt(args[2], 10) : undefined;

if (isNaN(limit as number) && limit !== undefined) {
  console.error("❌ エラー: limitは数値である必要があります。");
  process.exit(1);
}

collectMissingPhones(tenantId, organizationId, limit)
  .then(() => {
    console.log("\n✅ スクリプトが正常に完了しました。");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ スクリプトがエラーで終了しました:", error);
    process.exit(1);
  });

