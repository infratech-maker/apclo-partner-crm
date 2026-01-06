import { config } from "dotenv";
import { resolve } from "path";

// 環境変数の読み込み (.env.local)
config({ path: resolve(__dirname, "../.env.local") });

import { db } from "../src/lib/db";
import { leads } from "../src/lib/db/schema";
import { withTenant } from "../src/lib/db/tenant-helper";
import { eq, sql } from "drizzle-orm";

/**
 * 店舗名からフランチャイズ判定を行う
 */
function detectFranchiseFromName(name: string | null | undefined): boolean {
  if (!name || typeof name !== "string") {
    return false;
  }

  // パターン1: 「〇〇支店」「〇〇号店」「〇〇チェーン」など
  const franchiseKeywordPattern = /(支店|号店|チェーン)/;
  const headStoreExcludePattern = /本店/;

  if (franchiseKeywordPattern.test(name) && !headStoreExcludePattern.test(name)) {
    return true;
  }

  // パターン2: スペース区切りで支店名が入っているか簡易判定
  // 例: "店名 新宿店", "店名 渋谷店" など
  const branchPattern = /\s+[^\s]+店$/;
  if (branchPattern.test(name)) {
    return true;
  }

  // パターン3: 「店」「本店」が店舗名につく場合
  // 例: "〇〇店", "〇〇本店" など
  // ただし、「本店」のみの場合は除外（本店は通常FCではない）
  const storePattern = /店$/;
  const headStoreOnlyPattern = /^[^店]*本店$/;
  
  if (storePattern.test(name) && !headStoreOnlyPattern.test(name)) {
    return true;
  }

  return false;
}

async function updateFranchiseTags() {
  await withTenant(async (tenantId) => {
    console.log("🔍 既存データのフランチャイズ判定を開始します...");

    // すべてのリードを取得
    const allLeads = await db
      .select({
        id: leads.id,
        data: leads.data,
      })
      .from(leads)
      .where(eq(leads.tenantId, tenantId));

    console.log(`📊 対象件数: ${allLeads.length}件`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const lead of allLeads) {
      try {
        const data = lead.data as any;
        if (!data || typeof data !== "object") {
          skipped++;
          continue;
        }

        const name = data.name || data.store_name || null;
        const currentIsFranchise = data.is_franchise === true;

        // 店舗名からフランチャイズ判定
        const shouldBeFranchise = detectFranchiseFromName(name);

        // 既に正しい値が設定されている場合はスキップ
        if (currentIsFranchise === shouldBeFranchise) {
          skipped++;
          continue;
        }

        // データを更新
        const updatedData = {
          ...data,
          is_franchise: shouldBeFranchise,
        };

        await db
          .update(leads)
          .set({
            data: updatedData as any,
            updatedAt: new Date(),
          })
          .where(eq(leads.id, lead.id));

        updated++;
        
        if (updated % 100 === 0) {
          console.log(`  📝 進捗: ${updated}件更新済み...`);
        }
      } catch (error) {
        errors++;
        console.error(`  ❌ エラー (ID: ${lead.id}):`, error);
      }
    }

    console.log("\n🎉 更新完了");
    console.log(`  更新: ${updated}件`);
    console.log(`  スキップ: ${skipped}件`);
    console.log(`  エラー: ${errors}件`);
  });
}

// 実行
updateFranchiseTags()
  .then(() => {
    console.log("✅ スクリプトが正常に完了しました");
    process.exit(0);
  })
  .catch((e) => {
    console.error("❌ スクリプトがエラーで終了しました:", e);
    process.exit(1);
  });




