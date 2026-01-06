import { config } from "dotenv";
import { resolve } from "path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";

// 環境変数の読み込み (.env.local)
config({ path: resolve(__dirname, "../.env.local") });

import { db } from "../src/lib/db";
import { scrapingJobs, leads } from "../src/lib/db/schema";
import { withTenant } from "../src/lib/db/tenant-helper";
import { chromium, Browser } from "playwright";
import { eq, sql, inArray } from "drizzle-orm";

const MAX_PAGES = 100; // 最大ページ数（大幅拡大）
const DELAY_MS = 3000; // ページ間の待機時間（マナー）- 電話番号収集と統一
const PROGRESS_FILE = resolve(__dirname, "../logs/last-collected-page.txt"); // 進捗記録ファイル

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 前回の収集済みページ数を読み込む
function loadLastCollectedPage(): number {
  try {
    if (existsSync(PROGRESS_FILE)) {
      const content = readFileSync(PROGRESS_FILE, "utf-8").trim();
      const pageNum = parseInt(content, 10);
      if (!isNaN(pageNum) && pageNum > 0) {
        return pageNum;
      }
    }
  } catch (error) {
    console.warn("⚠️ 進捗ファイルの読み込みに失敗しました。最初から開始します。", error);
  }
  return 0; // ファイルが存在しない、または無効な場合は0を返す
}

// 収集済みページ数を保存する
function saveLastCollectedPage(pageIndex: number): void {
  try {
    const dir = resolve(__dirname, "../logs");
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(PROGRESS_FILE, pageIndex.toString(), "utf-8");
  } catch (error) {
    console.warn("⚠️ 進捗ファイルの保存に失敗しました:", error);
  }
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
          footer: "New Open Import Script",
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

async function importNewOpenStores() {
  const startTime = Date.now();
  let browser: Browser | null = null;

  try {
    // テナントIDを環境変数または引数から取得
    const envTenantId = process.env.TEST_TENANT_ID;
    const tenantId = (envTenantId && envTenantId.trim() !== "" && envTenantId !== "00000000-0000-0000-0000-000000000000")
      ? envTenantId 
      : "ff424270-d1ee-4a72-9f57-984066600402";
    
    await withTenant(async (resolvedTenantId) => {
      console.log("🚀 ニューオープンリストの収集を開始します...");
      console.log(`   テナントID: ${resolvedTenantId}`);
      
      // 開始通知
      await sendSlackNotification(
        "🚀 *ニューオープンリスト収集を開始しました*\n処理を開始します...",
        "info"
      );

      // ブラウザを起動
      browser = await chromium.launch({
        headless: true,
      });

      const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        locale: "ja-JP",
      });

      const page = await context.newPage();

      const collectedUrls: string[] = [];
      let totalPages = 0;

      // 前回の続きから開始
      const startPage = loadLastCollectedPage();
      let pageIndex = startPage > 0 ? startPage + 1 : 1; // 前回の次のページから開始
      
      if (startPage > 0) {
        console.log(`📌 前回の続きから開始: ページ ${pageIndex} から（前回まで: ${startPage}ページ）`);
      } else {
        console.log(`📌 最初から開始: ページ ${pageIndex} から`);
      }

      // 最初のページへ移動（リトライ機能付き）
      const baseUrl = 'https://tabelog.com/rstLst/?Srt=D&SrtT=nod';
      
      // pageIndex > 1の場合はURLパラメータで直接移動を試みる
      let targetUrl = baseUrl;
      if (pageIndex > 1) {
        targetUrl = `${baseUrl}&LstPg=${pageIndex}`;
        console.log(`🚀 ページ ${pageIndex} に直接移動を試みます: ${targetUrl}`);
      } else {
        console.log(`🚀 最初のページを取得中: ${baseUrl}`);
      }
      
      let retryCount = 0;
      const maxRetries = 3;
      while (retryCount < maxRetries) {
        try {
          await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
          await page.waitForTimeout(2000); // 初期読み込み待機
          
          // ページが正しく読み込まれたか確認（pageIndex > 1の場合）
          if (pageIndex > 1) {
            const elements = await page.locator('.list-rst__rst-name-target').count();
            if (elements === 0) {
              console.log(`⚠️ ページ ${pageIndex} に直接移動できませんでした（ページが存在しない可能性）。最初から開始します。`);
              // 進捗ファイルをリセット（存在しないページに到達した場合）
              saveLastCollectedPage(0);
              pageIndex = 1;
              targetUrl = baseUrl;
              await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
              await page.waitForTimeout(1000);
            } else {
              console.log(`✅ ページ ${pageIndex} に直接移動しました`);
            }
          }
          break; // 成功したらループを抜ける
        } catch (error) {
          retryCount++;
          if (retryCount >= maxRetries) {
            // 最後のリトライでも失敗した場合、最初のページから開始
            if (pageIndex > 1) {
              console.warn(`⚠️ ページ ${pageIndex} への移動に失敗しました。最初のページから開始します。`);
              pageIndex = 1;
              targetUrl = baseUrl;
              try {
                await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                await page.waitForTimeout(1000);
              } catch (finalError) {
                console.error(`❌ ページ読み込みに失敗しました（${maxRetries}回リトライ後）:`, finalError);
                throw finalError;
              }
            } else {
              console.error(`❌ ページ読み込みに失敗しました（${maxRetries}回リトライ後）:`, error);
              throw error;
            }
          } else {
            console.warn(`⚠️ ページ読み込みエラー（リトライ ${retryCount}/${maxRetries}）:`, error);
            await page.waitForTimeout(5000); // 5秒待機してからリトライ
          }
        }
      }

      // 「次へ」ボタンをクリックしてページ遷移する方式
      while (pageIndex <= MAX_PAGES) {
        try {
          // 1. リストの読み込み待機
          try {
            await page.waitForSelector('.list-rst__rst-name-target', { timeout: 10000 });
          } catch (e) {
            console.warn(`⚠️ ページ ${pageIndex}: リストが見つかりませんでした。終了します。`);
            // デバッグ用にスクリーンショットを保存（原因特定のため）
            try {
              await page.screenshot({ path: `logs/error-page-${pageIndex}.png` });
            } catch (screenshotError) {
              // スクリーンショット保存失敗は無視
            }
            break;
          }

          // 2. URL収集（絶対パス取得ロジックを使用）
          const elements = await page.locator('.list-rst__rst-name-target').all();
          const pageUrls: string[] = [];
          
          for (const element of elements) {
            try {
              const href = await element.evaluate((el) => (el as HTMLAnchorElement).href);
              if (href && href.startsWith('http') && href.includes('tabelog.com') && !href.includes('rstLst')) {
                pageUrls.push(href);
              }
            } catch (e) {
              // 個別の要素エラーは無視
              continue;
            }
          }

          // 重複チェック（同じページ内と全体）
          const uniquePageUrls = pageUrls.filter((url) => !collectedUrls.includes(url));
          collectedUrls.push(...uniquePageUrls);

          console.log(`  ✅ ページ ${pageIndex}: ${uniquePageUrls.length}件のURLを収集`);
          totalPages = pageIndex;
          
          // 進捗を保存（各ページ収集後に記録）
          saveLastCollectedPage(pageIndex);

          // 3. 次のページへ遷移処理
          if (pageIndex >= MAX_PAGES) {
            console.log(`🏁 最大ページ数（${MAX_PAGES}）に達したため終了します。`);
            // 最大ページ数に達した場合、進捗ファイルをリセット（次回は最初から開始）
            saveLastCollectedPage(0);
            console.log(`📝 進捗ファイルをリセットしました。次回は最初から開始します。`);
            break;
          }

          // 「次へ」ボタンのセレクタ（食べログの標準的なページネーション）
          const nextButton = page.locator('.c-pagination__arrow--next, a[aria-label="次へ"], .p-pagination__arrow--next');
          
          if (await nextButton.count() > 0) {
            const isVisible = await nextButton.first().isVisible().catch(() => false);
            
            if (isVisible) {
              console.log(`  ➡️ ページ ${pageIndex + 1} へ遷移中...`);
              
              // クリックして遷移
              await Promise.all([
                page.waitForLoadState('domcontentloaded'), // 読み込み完了を待つ
                nextButton.first().click(),
              ]);
              
              // 遷移後の待機（重要）
              await page.waitForTimeout(2000);
              pageIndex++;
            } else {
              console.log('🏁 「次へ」ボタンが非表示のため終了します。');
              // 最後のページに到達した場合、進捗ファイルをリセット（次回は最初から開始）
              saveLastCollectedPage(0);
              console.log(`📝 進捗ファイルをリセットしました。次回は最初から開始します。`);
              break;
            }
          } else {
            console.log('🏁 「次へ」ボタンが見つからないため終了します。');
            // 最後のページに到達した場合、進捗ファイルをリセット（次回は最初から開始）
            saveLastCollectedPage(0);
            console.log(`📝 進捗ファイルをリセットしました。次回は最初から開始します。`);
            break;
          }
        } catch (error) {
          console.error(`❌ ページ ${pageIndex} の取得中にエラーが発生しました:`, error);
          // エラーが発生しても次のページに進む
          break;
        }
      }

      await browser.close();
      browser = null;

      console.log(`\n📊 収集完了: 合計 ${collectedUrls.length}件のURLを収集しました（${totalPages}ページ）`);
      console.log(`📝 進捗記録: ページ ${totalPages} まで収集済み（次回はページ ${totalPages + 1} から開始）`);

      if (collectedUrls.length === 0) {
        await sendSlackNotification(
          "⚠️ *収集結果*\nURLが1件も収集できませんでした。",
          "warning"
        );
        return;
      }

      // 重複チェック: leadsテーブルに既に存在するURLを除外
      console.log("🔍 既存リードとの重複チェック中...");
      const existingLeads = collectedUrls.length > 0
        ? await db
            .select({ source: leads.source })
            .from(leads)
            .where(inArray(leads.source, collectedUrls))
        : [];

      const existingUrls = new Set(existingLeads.map((lead) => lead.source));
      const newUrls = collectedUrls.filter((url) => !existingUrls.has(url));

      console.log(`  ✅ 既存: ${existingUrls.size}件, 新規: ${newUrls.length}件`);

      // ジョブ登録（重複防止付き）
      console.log("📝 スクレイピングジョブを登録中...");
      
      // 既存のジョブを一括で取得（重複チェック用）
      // inArrayを使うか、全件取得してフィルタリング
      const allJobs = await db
        .select({ url: scrapingJobs.url })
        .from(scrapingJobs)
        .where(eq(scrapingJobs.tenantId, tenantId));
      
      const existingJobUrls = new Set(allJobs.map((job) => job.url));
      const urlsToRegister = newUrls.filter((url) => !existingJobUrls.has(url));

      console.log(`  ✅ 既存ジョブ: ${existingJobUrls.size}件, 新規登録: ${urlsToRegister.length}件`);

      let registered = 0;
      let skipped = existingJobUrls.size;

      // バッチで登録（パフォーマンス向上）
      const BATCH_SIZE = 50;
      for (let i = 0; i < urlsToRegister.length; i += BATCH_SIZE) {
        const batch = urlsToRegister.slice(i, i + BATCH_SIZE);
        
        try {
          await db.insert(scrapingJobs).values(
            batch.map((url) => ({
              tenantId: tenantId,
              url: url,
              status: "pending" as const,
            }))
          );
          registered += batch.length;
        } catch (error) {
          console.error(`❌ バッチ登録エラー (${i}-${i + batch.length}):`, error);
          // バッチ登録に失敗した場合、個別に登録を試みる
          for (const url of batch) {
            try {
              await db.insert(scrapingJobs).values({
                tenantId: tenantId,
                url: url,
                status: "pending",
              });
              registered++;
            } catch (individualError) {
              console.error(`❌ URL登録エラー: ${url}`, individualError);
              skipped++;
            }
          }
        }
      }

      const totalTime = Math.floor((Date.now() - startTime) / 1000);
      const minutes = Math.floor(totalTime / 60);
      const seconds = totalTime % 60;

      console.log("\n🎉 処理完了");
      console.log(`収集URL: ${collectedUrls.length}件`);
      console.log(`既存リード: ${existingUrls.size}件`);
      console.log(`新規ジョブ登録: ${registered}件`);
      console.log(`スキップ: ${skipped}件`);
      console.log(`処理時間: ${minutes}分${seconds}秒`);

      // 完了通知
      await sendSlackNotification(
        `✅ *処理完了*\n` +
        `収集URL: *${collectedUrls.length}件*\n` +
        `既存リード: ${existingUrls.size}件\n` +
        `新規ジョブ登録: *${registered}件*\n` +
        `スキップ: ${skipped}件\n` +
        `⏱️ 処理時間: ${minutes}分${seconds}秒`,
        registered > 0 ? "good" : "warning"
      );
    }, tenantId);
  } catch (error) {
    console.error("❌ エラーが発生しました:", error);
    
    // エラー通知
    await sendSlackNotification(
      `❌ *処理がエラーで終了しました*\n` +
      `エラー内容: ${error instanceof Error ? error.message : String(error)}`,
      "danger"
    );
    
    throw error;
  } finally {
    if (browser !== null) {
      await (browser as Browser).close();
    }
  }
}

// 実行
importNewOpenStores()
  .then(() => {
    console.log("✅ スクリプトが正常に完了しました");
    process.exit(0);
  })
  .catch((e) => {
    console.error("❌ スクリプトがエラーで終了しました:", e);
    process.exit(1);
  });

