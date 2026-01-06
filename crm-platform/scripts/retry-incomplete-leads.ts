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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Smart Merge: 新しい値がnull/undefined/空文字の場合は既存値を維持
 */
function smartMerge(existingData: any, scrapedData: any): any {
  const merged: any = { ...existingData };

  // 各フィールドをSmart Merge
  const fields = [
    "name",
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
          footer: "Retry Incomplete Leads Script",
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

async function retryIncompleteLeads() {
  const startTime = Date.now();

  await withTenant(async (tenantId) => {
    console.log("🔍 欠損データを持つリードを検索中...");

    // 開始通知
    await sendSlackNotification(
      "🚀 *欠損データリトライスクリプトを開始しました*\n処理を開始します...",
      "info"
    );

    // 24時間制限を一時的に無効化（データ数を優先するフェーズのため）
    // const twentyFourHoursAgo = new Date();
    // twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    // 条件: 食べログのソース かつ (phone, budget, business_hours のいずれかが null/空)
    // 注意: 24時間制限を削除したため、直近に作成されたデータも対象になります
    const incompleteLeads = await db
      .select({
        id: leads.id,
        source: leads.source,
        data: leads.data,
        updatedAt: leads.updatedAt,
      })
      .from(leads)
      .where(
        and(
          sql`${leads.source} LIKE '%tabelog.com%'`,
          sql`(
            (${leads.data}->>'phone' IS NULL OR ${leads.data}->>'phone' = '') OR
            (${leads.data}->>'budget' IS NULL OR ${leads.data}->>'budget' = '') OR
            (${leads.data}->>'business_hours' IS NULL OR ${leads.data}->>'business_hours' = '')
          )`
          // 24時間制限を削除: lt(leads.updatedAt, twentyFourHoursAgo)
        )
      );

    console.log(`✅ 対象件数: ${incompleteLeads.length}件`);

    if (incompleteLeads.length === 0) {
      await sendSlackNotification(
        "ℹ️ *処理完了*\n欠損データを持つリードは見つかりませんでした。",
        "info"
      );
      return;
    }

    // 開始通知（件数付き）
    await sendSlackNotification(
      `📊 *処理開始*\n対象件数: *${incompleteLeads.length}件*\n処理を開始します...`,
      "info"
    );

    let processed = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 0; i < incompleteLeads.length; i++) {
      const lead = incompleteLeads[i];
      processed++;

      try {
        console.log(
          `📡 [${processed}/${incompleteLeads.length}] 再取得中: ${lead.source}`
        );

        // スクレイピング実行
        const result = await scrapeTabelogStore(lead.source);

        // 既存データを取得
        const existingData = lead.data || {};

        // Smart Merge: 新しい値がnull/undefined/空文字の場合は既存値を維持
        const mergedData = smartMerge(existingData, result);

        // データを更新
        await db
          .update(leads)
          .set({
            data: mergedData,
            updatedAt: new Date(),
          })
          .where(eq(leads.id, lead.id));

        updated++;
        console.log(`  ✅ 更新完了: ${lead.source}`);
      } catch (error) {
        errors++;
        console.error(`  ❌ エラー: ${lead.source}`, error);
      }

      // 負荷対策のウェイト
      await sleep(DELAY_MS);

      // バッチごとに進捗ログを出す
      if (processed % BATCH_SIZE === 0) {
        const progressPercent = Math.round((processed / incompleteLeads.length) * 100);
        const elapsedTime = Math.floor((Date.now() - startTime) / 1000);
        const estimatedTotalTime = processed > 0 
          ? Math.floor((elapsedTime / processed) * incompleteLeads.length)
          : 0;
        const remainingTime = estimatedTotalTime - elapsedTime;

        console.log(
          `--- 進捗: ${processed}/${incompleteLeads.length}件 (更新: ${updated}, スキップ: ${skipped}, エラー: ${errors}) ---`
        );

        // 進捗通知
        if (
          processed % 10 === 0 ||
          progressPercent === 25 ||
          progressPercent === 50 ||
          progressPercent === 75
        ) {
          await sendSlackNotification(
            `📈 *進捗レポート*\n` +
            `処理済み: *${processed}/${incompleteLeads.length}件* (${progressPercent}%)\n` +
            `✅ 更新: ${updated}件\n` +
            `⏭️ スキップ: ${skipped}件\n` +
            `❌ エラー: ${errors}件\n` +
            `⏱️ 経過時間: ${Math.floor(elapsedTime / 60)}分${elapsedTime % 60}秒\n` +
            (remainingTime > 0 ? `⏳ 推定残り時間: ${Math.floor(remainingTime / 60)}分${remainingTime % 60}秒` : ""),
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
      `総件数: ${incompleteLeads.length}, 更新: ${updated}, スキップ: ${skipped}, エラー: ${errors}`
    );

    // 完了通知
    const color = errors > 0 ? "warning" : "good";
    await sendSlackNotification(
      `✅ *処理完了*\n` +
      `総件数: *${incompleteLeads.length}件*\n` +
      `✅ 更新: *${updated}件*\n` +
      `⏭️ スキップ: ${skipped}件\n` +
      (errors > 0 ? `❌ エラー: *${errors}件*\n` : "") +
      `⏱️ 総処理時間: ${minutes}分${seconds}秒`,
      color
    );
  });
}

// 実行
retryIncompleteLeads()
  .then(() => {
    console.log("✅ スクリプトが正常に完了しました");
    process.exit(0);
  })
  .catch(async (e) => {
    console.error("❌ スクリプトがエラーで終了しました:", e);

    // エラー通知
    await sendSlackNotification(
      `❌ *処理がエラーで終了しました*\n` +
      `エラー内容: ${e instanceof Error ? e.message : String(e)}\n` +
      `スタックトレース: ${e instanceof Error ? e.stack?.slice(0, 500) : "N/A"}`,
      "danger"
    );

    process.exit(1);
  });
