import { config } from "dotenv";
import { resolve } from "path";

// 環境変数の読み込み (.env.local)
config({ path: resolve(__dirname, "../.env.local") });

import { db } from "../src/lib/db";
import { leads } from "../src/lib/db/schema";
import { withTenant } from "../src/lib/db/tenant-helper";
import { scrapeTabelogStore } from "../src/features/scraper/worker";
import { eq, sql, and } from "drizzle-orm";

const BATCH_SIZE = 10; // バッチ処理サイズ
const DELAY_MS = 2000; // スクレイピングマナーとして待機時間を確保
const CONCURRENT_LIMIT = 3; // 並列処理数（店舗名更新は慎重に）

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Smart Merge: 新しい値がnull/undefined/空文字の場合は既存値を維持
 * ただし、nameフィールドは常に更新（正しい店舗名を取得するため）
 */
function smartMerge(existingData: any, scrapedData: any): any {
  const merged: any = { ...existingData };

  // 各フィールドをSmart Merge
  const fields = [
    "address",
    "category",
    "phone",
    "open_date",
    "regular_holiday",
    "transport",
    "business_hours",
    "budget",
    "website", // 公式アカウント（HPURL）
    "related_stores",
    "is_franchise",
    "access",
  ];

  for (const field of fields) {
    // 新しい値が存在し、null/undefined/空文字でない場合は使用
    const newValue = scrapedData[field];
    if (
      newValue !== null &&
      newValue !== undefined &&
      newValue !== ""
    ) {
      merged[field] = newValue;
    }
    // それ以外の場合は既存値を維持（既にmergedに含まれている）
  }

  // nameフィールドは常に更新（正しい店舗名を取得するため）
  if (scrapedData.name && scrapedData.name.trim().length > 0) {
    merged.name = scrapedData.name.trim();
  }

  return merged;
}

// Slack通知関数
async function sendSlackNotification(message: string, color: "good" | "warning" | "danger" | "info" = "info") {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.warn("⚠️ SLACK_WEBHOOK_URLが設定されていません。Slack通知をスキップします。");
    return;
  }

  try {
    const colorMap = {
      good: "#36a64f",
      warning: "#ff9900",
      danger: "#ff0000",
      info: "#439fe0",
    };

    const payload = {
      attachments: [
        {
          color: colorMap[color],
          text: message,
          footer: "Update Store Names Script",
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    };

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.warn(`⚠️ Slack通知の送信に失敗しました: ${response.statusText}`);
    }
  } catch (error) {
    console.warn("⚠️ Slack通知の送信中にエラーが発生しました:", error);
  }
}

async function updateStoreNames() {
  const startTime = Date.now();

  await withTenant(async (tenantId) => {
    console.log("🔍 食べログリードの店舗名を更新中...");

    // 開始通知
    await sendSlackNotification(
      "🚀 *店舗名更新スクリプトを開始しました*\n処理を開始します...",
      "info"
    );

    // すべての食べログリードを取得
    const tabelogLeads = await db
      .select({
        id: leads.id,
        source: leads.source,
        data: leads.data,
        updatedAt: leads.updatedAt,
      })
      .from(leads)
      .where(
        and(
          eq(leads.tenantId, tenantId),
          sql`${leads.source} LIKE '%tabelog.com%'`
        )
      )
      .limit(1000); // 一度に処理する件数を制限（必要に応じて調整）

    console.log(`✅ 対象件数: ${tabelogLeads.length}件`);

    if (tabelogLeads.length === 0) {
      await sendSlackNotification(
        "ℹ️ *処理完了*\n対象となるリードは見つかりませんでした。",
        "info"
      );
      return;
    }

    // 開始通知（件数付き）
    await sendSlackNotification(
      `📊 *処理開始*\n対象件数: *${tabelogLeads.length}件*\n処理を開始します...`,
      "info"
    );

    let processed = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    // 並列処理用の関数
    async function updateLead(lead: typeof tabelogLeads[0], index: number): Promise<"updated" | "skipped" | "error"> {
      try {
        console.log(
          `📡 [${index + 1}/${tabelogLeads.length}] 再取得中: ${lead.source}`
        );

        // スクレイピング実行
        const result = await scrapeTabelogStore(lead.source);

        // 既存データを取得
        const existingData = (lead.data as any) || {};
        const existingName = existingData.name || "";

        // 新しい店舗名が取得できたか確認
        if (!result.name || result.name.trim().length === 0) {
          console.log(`  ⚠️ 店舗名が取得できませんでした: ${lead.source}`);
          return "skipped";
        }

        // 店舗名が変更されているか確認
        if (existingName === result.name.trim()) {
          console.log(`  ⏭️ 店舗名に変更なし: ${lead.source}`);
          return "skipped";
        }

        // Smart Merge: 新しい値がnull/undefined/空文字の場合は既存値を維持
        // ただし、nameフィールドは常に更新
        const mergedData = smartMerge(existingData, result);

        // データを更新
        await db
          .update(leads)
          .set({
            data: mergedData,
            updatedAt: new Date(),
          })
          .where(eq(leads.id, lead.id));

        console.log(`  ✅ 更新完了: ${existingName} → ${result.name}`);
        return "updated";
      } catch (error) {
        console.error(`  ❌ エラー: ${lead.source}`, error);
        return "error";
      }
    }

    // 並列処理の実行
    for (let i = 0; i < tabelogLeads.length; i += CONCURRENT_LIMIT) {
      const batch = tabelogLeads.slice(i, i + CONCURRENT_LIMIT);
      
      // バッチを並列処理して結果を集計
      const results = await Promise.all(batch.map((lead, batchIndex) => updateLead(lead, i + batchIndex)));
      
      // 結果を集計
      results.forEach((result) => {
        processed++;
        if (result === "updated") updated++;
        else if (result === "error") errors++;
        else if (result === "skipped") skipped++;
      });
      
      // バッチ間の待機時間（負荷対策）
      if (i + CONCURRENT_LIMIT < tabelogLeads.length) {
        await sleep(DELAY_MS);
      }

      // 進捗ログ
      if (processed % BATCH_SIZE === 0 || processed === tabelogLeads.length) {
        const progressPercent = Math.round((processed / tabelogLeads.length) * 100);
        const elapsedTime = Math.floor((Date.now() - startTime) / 1000);
        
        console.log(
          `--- 進捗: ${processed}/${tabelogLeads.length}件 (${progressPercent}%) (更新: ${updated}, スキップ: ${skipped}, エラー: ${errors}) ---`
        );

        // 進捗通知
        if (
          processed % 50 === 0 ||
          progressPercent === 25 ||
          progressPercent === 50 ||
          progressPercent === 75
        ) {
          await sendSlackNotification(
            `📈 *進捗レポート*\n` +
            `処理済み: *${processed}/${tabelogLeads.length}件* (${progressPercent}%)\n` +
            `✅ 更新: ${updated}件\n` +
            `⏭️ スキップ: ${skipped}件\n` +
            `❌ エラー: ${errors}件\n` +
            `⏱️ 経過時間: ${Math.floor(elapsedTime / 60)}分${elapsedTime % 60}秒`,
            progressPercent >= 75 ? "good" : progressPercent >= 50 ? "info" : "warning"
          );
        }
      }
    }

    const totalTime = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(totalTime / 60);
    const seconds = totalTime % 60;

    console.log("\n🎉 処理完了");
    console.log(
      `総件数: ${tabelogLeads.length}, 更新: ${updated}, スキップ: ${skipped}, エラー: ${errors}`
    );

    // 完了通知
    const color = errors > 0 ? "warning" : "good";
    await sendSlackNotification(
      `✅ *処理完了*\n` +
      `総件数: *${tabelogLeads.length}件*\n` +
      `✅ 更新: *${updated}件*\n` +
      `⏭️ スキップ: ${skipped}件\n` +
      (errors > 0 ? `❌ エラー: *${errors}件*\n` : "") +
      `⏱️ 総処理時間: ${minutes}分${seconds}秒`,
      color
    );
  });
}

// 実行
updateStoreNames()
  .then(() => {
    console.log("✅ スクリプトが正常に完了しました");
    process.exit(0);
  })
  .catch(async (e) => {
    console.error("❌ スクリプトがエラーで終了しました:", e);

    // エラー通知
    await sendSlackNotification(
      `❌ *処理がエラーで終了しました*\n` +
      `エラー内容: ${e instanceof Error ? e.message : String(e)}`,
      "danger"
    );

    process.exit(1);
  });




