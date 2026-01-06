import { config } from "dotenv";
import { resolve } from "path";

// 環境変数の読み込み (.env.local)
config({ path: resolve(__dirname, "../.env.local") });

import { db } from "../src/lib/db";
import { scrapingJobs, leads } from "../src/lib/db/schema";
import { withTenant } from "../src/lib/db/tenant-helper";
import { eq, and, sql } from "drizzle-orm";

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
          footer: "Progress Monitor (Hourly)",
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

async function getProgressStats() {
  return await withTenant(async (tenantId) => {
    // 1. 現在の総件数
    const totalCountResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(leads);
    const totalCount = Number(totalCountResult[0]?.count || 0);

    // 2. 直近1時間の新規追加数
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCountResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(sql`${leads.createdAt} > ${oneHourAgo.toISOString()}`);
    const recentCount = Number(recentCountResult[0]?.count || 0);

    // 3. Pending状態のジョブ数
    const pendingJobsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(scrapingJobs)
      .where(and(
        eq(scrapingJobs.tenantId, tenantId),
        eq(scrapingJobs.status, "pending")
      ));
    const pendingCount = Number(pendingJobsResult[0]?.count || 0);

    // 4. Running状態のジョブ数
    const runningJobsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(scrapingJobs)
      .where(and(
        eq(scrapingJobs.tenantId, tenantId),
        eq(scrapingJobs.status, "running")
      ));
    const runningCount = Number(runningJobsResult[0]?.count || 0);

    // 5. Failed状態のジョブ数（直近1時間）
    const failedJobsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(scrapingJobs)
      .where(and(
        eq(scrapingJobs.tenantId, tenantId),
        eq(scrapingJobs.status, "failed"),
        sql`${scrapingJobs.completedAt} > ${oneHourAgo.toISOString()}`
      ));
    const failedCount = Number(failedJobsResult[0]?.count || 0);

    // 6. Completed状態のジョブ数（直近1時間）
    const completedJobsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(scrapingJobs)
      .where(and(
        eq(scrapingJobs.tenantId, tenantId),
        eq(scrapingJobs.status, "completed"),
        sql`${scrapingJobs.completedAt} > ${oneHourAgo.toISOString()}`
      ));
    const completedCount = Number(completedJobsResult[0]?.count || 0);

    return {
      totalCount,
      recentCount,
      pendingCount,
      runningCount,
      failedCount,
      completedCount,
    };
  });
}

async function sendHourlyProgress() {
  try {
    console.log("📊 1時間ごとの進捗統計を取得中...");
    
    const stats = await getProgressStats();
    const now = new Date();
    const timeStr = now.toLocaleString("ja-JP", { 
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });

    // メッセージ構築
    const message = 
      `📈 *1時間ごとの進捗レポート* (${timeStr})\n\n` +
      `📊 *現在の総件数:* ${stats.totalCount.toLocaleString()}件\n` +
      `📈 *直近1時間の増加:* +${stats.recentCount.toLocaleString()}件\n\n` +
      `⏳ *Pending ジョブ:* ${stats.pendingCount.toLocaleString()}件\n` +
      `🔄 *Running ジョブ:* ${stats.runningCount.toLocaleString()}件\n` +
      `✅ *Completed (1時間):* ${stats.completedCount.toLocaleString()}件\n` +
      `❌ *Failed (1時間):* ${stats.failedCount.toLocaleString()}件\n\n` +
      (stats.pendingCount > 0 
        ? `💡 処理継続中。残り約${Math.ceil(stats.pendingCount / 100)}バッチ分の処理が必要です。`
        : `✅ すべてのPendingジョブが処理されました。`);

    // 色の決定
    let color: "good" | "warning" | "danger" | "info" = "info";
    if (stats.recentCount === 0 && stats.pendingCount > 0) {
      color = "warning"; // 増加がないのにPendingがある場合は警告
    } else if (stats.recentCount > 0) {
      color = "good"; // 増加している場合は成功
    } else if (stats.failedCount > stats.completedCount) {
      color = "danger"; // 失敗が多い場合は危険
    }

    await sendSlackNotification(message, color);
    
    console.log("✅ 進捗レポートをSlackに送信しました");
    console.log(`   総件数: ${stats.totalCount}件, 直近1時間: +${stats.recentCount}件`);
  } catch (error) {
    console.error("❌ 進捗レポートの送信中にエラーが発生しました:", error);
    await sendSlackNotification(
      `❌ *進捗レポート取得エラー*\n` +
      `エラー内容: ${error instanceof Error ? error.message : String(error)}`,
      "danger"
    );
  }
}

// 実行
sendHourlyProgress()
  .then(() => {
    console.log("✅ スクリプトが正常に完了しました");
    process.exit(0);
  })
  .catch((e) => {
    console.error("❌ スクリプトがエラーで終了しました:", e);
    process.exit(1);
  });





