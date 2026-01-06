import { config } from "dotenv";
import { resolve } from "path";

// 環境変数の読み込み (.env.local)
config({ path: resolve(__dirname, "../.env.local") });

import { db } from "../src/lib/db";
import { leads } from "../src/lib/db/schema";
import { withTenant } from "../src/lib/db/tenant-helper";
import { scrapeTabelogStore } from "../src/features/scraper/worker"; // Workerの関数を再利用
import { eq } from "drizzle-orm";

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
          footer: "Tabelog Leads Update Script",
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

type LeadRow = {
  id: string;
  source: string;
  data: any;
};

const BATCH_SIZE = 5; // API負荷軽減のため少なめに
const DELAY_MS = 2000; // スクレイピングマナーとして待機時間を確保

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 「駅 691m / …」のようなアクセス形式かどうか判定するロジック
function isAccessLikeAddress(address: string | null | undefined): boolean {
  if (!address) return false;
  // 数字+m や "/" が含まれる場合はアクセス情報とみなす
  return /駅\s*\d+m\s*\/.*|m\s*\/.*|徒歩/.test(address);
}

async function updateTabelogLeads() {
  const startTime = Date.now();
  
  // テナントコンテキストを解決してDB操作を行う
  await withTenant(async (tenantId) => {
    console.log("🔍 既存Tabelogリードを取得中...");
    
    // 開始通知
    await sendSlackNotification(
      "🚀 *Tabelogリード更新スクリプトを開始しました*\n処理を開始します...",
      "info"
    );

    // 全リード取得（件数が多い場合は本来limitを入れるべきだが、今回は全件処理）
    const existingLeads = (await db
      .select({
        id: leads.id,
        source: leads.source,
        data: leads.data,
      })
      .from(leads)) as LeadRow[];

    // 食べログのソースを持つものだけフィルタリング
    const tabelogLeads = existingLeads.filter(
      (lead) => lead.source && lead.source.includes("tabelog.com")
    );

    console.log(`✅ 対象件数: ${tabelogLeads.length}件`);
    
    // 開始通知（件数付き）
    await sendSlackNotification(
      `📊 *処理開始*\n対象件数: *${tabelogLeads.length}件*\n処理を開始します...`,
      "info"
    );

    let processed = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 0; i < tabelogLeads.length; i++) {
      const lead = tabelogLeads[i];
      processed++;

      const data = lead.data || {};
      // 現在の住所らしき値を取得
      const currentAddress: string | null =
        data.address || data.住所 || data.location || null;

      // 既に「東京都...」のような正しい住所が入っていればスキップ（再実行時のため）
      if (
        currentAddress &&
        !isAccessLikeAddress(currentAddress) &&
        currentAddress.startsWith("東京")
      ) {
        skipped++;
        continue;
      }

      try {
        console.log(
          `📡 [${processed}/${tabelogLeads.length}] 再取得中: ${lead.source}`
        );

        // Workerの関数を直接呼んでスクレイピング実行
        const result = await scrapeTabelogStore(lead.source);

        if (!result.address) {
          console.warn("  ⚠️ 住所が取得できませんでした。");
          skipped++;
          continue;
        }

        // Smart Merge: 新しい値がnull/undefined/空文字の場合は既存値を維持
        const newData = {
          ...data,
          address: result.address ?? data.address, // 新値がnullなら既存値を維持
          access: currentAddress || data.access, // 元の値をaccessに移動
          category: result.category ?? data.category,
          phone: result.phone ?? data.phone,
          open_date: result.open_date ?? data.open_date,
          regular_holiday: result.regular_holiday ?? data.regular_holiday,
          transport: result.transport ?? data.transport,
          business_hours: result.business_hours ?? data.business_hours,
          budget: result.budget ?? data.budget,
          website: result.website ?? data.website, // 公式アカウント（HPURL）
          related_stores: result.related_stores ?? data.related_stores,
          is_franchise: result.is_franchise ?? data.is_franchise,
          // 日本語フィールド名も追加（既存データとの互換性のため）
          定休日: result.regular_holiday ?? data.定休日 ?? data.regular_holiday,
          交通手段: result.transport ?? data.交通手段 ?? data.transport,
          交通アクセス: result.transport ?? data.交通アクセス ?? data.transport,
          営業時間: result.business_hours ?? data.営業時間 ?? data.business_hours,
          公式HP: result.website ?? data.公式HP ?? data.website,
          公式アカウント: result.website ?? data.公式アカウント ?? data.website,
        };

        await db
          .update(leads)
          .set({ data: newData })
          .where(eq(leads.id, lead.id));

        updated++;
        console.log(`  ✅ 更新: ${result.address}`);
      } catch (error) {
        errors++;
        console.error(`  ❌ エラー: ${lead.source}`, error);
      }

      // 負荷対策のウェイト
      await sleep(DELAY_MS);

      // バッチごとに進捗ログを出す（オプション）
      if (processed % BATCH_SIZE === 0) {
        const progressPercent = Math.round((processed / tabelogLeads.length) * 100);
        const elapsedTime = Math.floor((Date.now() - startTime) / 1000);
        const estimatedTotalTime = processed > 0 
          ? Math.floor((elapsedTime / processed) * tabelogLeads.length)
          : 0;
        const remainingTime = estimatedTotalTime - elapsedTime;
        
        console.log(
          `--- 進捗: ${processed}/${tabelogLeads.length}件 (更新: ${updated}, スキップ: ${skipped}, エラー: ${errors}) ---`
        );
        
        // 進捗通知（10件ごと、または25%、50%、75%のタイミング）
        if (
          processed % 10 === 0 ||
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
updateTabelogLeads()
  .then(() => {
    process.exit(0);
  })
  .catch(async (e) => {
    console.error(e);
    
    // エラー通知
    await sendSlackNotification(
      `❌ *処理がエラーで終了しました*\n` +
      `エラー内容: ${e instanceof Error ? e.message : String(e)}\n` +
      `スタックトレース: ${e instanceof Error ? e.stack?.slice(0, 500) : "N/A"}`,
      "danger"
    );
    
    process.exit(1);
  });


