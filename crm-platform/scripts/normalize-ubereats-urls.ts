import { config } from "dotenv";
import { resolve } from "path";

// 環境変数の読み込み (.env.local)
config({ path: resolve(__dirname, "../.env.local") });

import { db } from "../src/lib/db";
import { scrapingJobs } from "../src/lib/db/schema";
import { withTenant } from "../src/lib/db/tenant-helper";
import { eq, and, like } from "drizzle-orm";

/**
 * UberEatsのURLを正規化（クエリパラメータを削除）
 */
function normalizeUbereatsUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    
    // クエリパラメータを全て削除
    urlObj.search = '';
    urlObj.hash = '';
    
    // 正規化されたURLを返す
    return urlObj.toString();
  } catch (e) {
    // URLパースエラーの場合は、クエリパラメータ部分を手動で削除
    const queryIndex = url.indexOf('?');
    if (queryIndex !== -1) {
      return url.substring(0, queryIndex);
    }
    const hashIndex = url.indexOf('#');
    if (hashIndex !== -1) {
      return url.substring(0, hashIndex);
    }
    return url;
  }
}

async function normalizeUbereatsJobUrls() {
  await withTenant(async (tenantId) => {
    console.log("🔍 UberEatsのジョブURLを正規化中...");

    // UberEatsのジョブを取得
    const ubereatsJobs = await db
      .select()
      .from(scrapingJobs)
      .where(
        and(
          eq(scrapingJobs.tenantId, tenantId),
          like(scrapingJobs.url, "%ubereats.com%")
        )
      );

    console.log(`✅ ${ubereatsJobs.length}件のUberEatsジョブを発見`);

    let updated = 0;
    let skipped = 0;

    for (const job of ubereatsJobs) {
      const normalizedUrl = normalizeUbereatsUrl(job.url);
      
      // URLが変更されている場合のみ更新
      if (normalizedUrl !== job.url) {
        try {
          // 重複チェック: 正規化後のURLが既に存在するか
          const existingJob = await db
            .select()
            .from(scrapingJobs)
            .where(
              and(
                eq(scrapingJobs.tenantId, tenantId),
                eq(scrapingJobs.url, normalizedUrl)
              )
            )
            .limit(1);

          if (existingJob.length > 0) {
            // 既に正規化されたURLが存在する場合は、元のジョブを削除
            await db
              .delete(scrapingJobs)
              .where(eq(scrapingJobs.id, job.id));
            console.log(`  ⏭️ 重複のため削除: ${job.url.substring(0, 80)}...`);
            skipped++;
          } else {
            // URLを更新
            await db
              .update(scrapingJobs)
              .set({ url: normalizedUrl })
              .where(eq(scrapingJobs.id, job.id));
            console.log(`  ✅ 更新: ${job.url.substring(0, 60)}... → ${normalizedUrl.substring(0, 60)}...`);
            updated++;
          }
        } catch (error) {
          console.error(`  ❌ エラー: ${job.url}`, error);
        }
      } else {
        skipped++;
      }
    }

    console.log("\n🎉 処理完了");
    console.log(`更新: ${updated}件`);
    console.log(`スキップ: ${skipped}件`);
  });
}

// 実行
normalizeUbereatsJobUrls()
  .then(() => {
    console.log("✅ スクリプトが正常に完了しました");
    process.exit(0);
  })
  .catch((e) => {
    console.error("❌ スクリプトがエラーで終了しました:", e);
    process.exit(1);
  });






