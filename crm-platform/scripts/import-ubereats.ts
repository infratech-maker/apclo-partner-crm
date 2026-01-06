import { config } from "dotenv";
import { resolve } from "path";

// 環境変数の読み込み (.env.local)
config({ path: resolve(__dirname, "../.env.local") });

import { db } from "../src/lib/db";
import { scrapingJobs, leads } from "../src/lib/db/schema";
import { withTenant } from "../src/lib/db/tenant-helper";
import { chromium, Browser } from "playwright";
import { eq, sql, inArray } from "drizzle-orm";

const DELAY_MS = 2000; // ページ間の待機時間（マナー）
const MAX_TEST_ITEMS = 10; // テスト用: 収集する店舗数の上限

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * UberEatsのURLを正規化（クエリパラメータを削除）
 * 例: https://www.ubereats.com/jp/store/xxx?diningMode=DELIVERY&mod=... 
 *  → https://www.ubereats.com/jp/store/xxx
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
          footer: "UberEats Import Script",
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

/**
 * UberEatsのエリア別一覧ページから店舗URLを収集
 * 
 * @param areaUrl UberEatsのエリア別一覧ページURL（例: https://www.ubereats.com/jp/location/tokyo）
 */
async function importUbereatsStores(areaUrl: string = "https://www.ubereats.com/jp/location/tokyo") {
  const startTime = Date.now();
  let browser: Browser | null = null;

  try {
    await withTenant(async (tenantId) => {
      console.log(`🚀 UberEatsリストの収集を開始します...`);
      console.log(`📍 対象URL: ${areaUrl}`);
      
      // 開始通知
      await sendSlackNotification(
        `🚀 *UberEatsリスト収集を開始しました*\n対象URL: ${areaUrl}\n処理を開始します...`,
        "info"
      );

      // ランダムなUser-Agentを生成
      const userAgents = [
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
      ];
      const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];

      // ブラウザを起動（Headlessモードを無効化）
      browser = await chromium.launch({
        headless: false, // ボット検知回避のため可視化
        slowMo: 100, // 人間らしい操作速度
      });

      const context = await browser.newContext({
        userAgent: randomUserAgent,
        locale: "ja-JP",
        viewport: { width: 1920, height: 1080 },
        extraHTTPHeaders: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
      });

      const page = await context.newPage();

      const collectedUrls: string[] = [];
      // Mapを使用して店舗URLをキーに重複排除（UUIDやIDも保存可能）
      const capturedStoreMap = new Map<string, { url: string; id?: string; slug?: string }>();

      // CAPTCHA検知用のキーワード
      const captchaKeywords = ['captcha', 'ロボット', 'robot', 'ブロック', 'block', 'verify', 'verification', 'challenge'];

      // CAPTCHA検知処理
      const checkForCaptcha = async () => {
        try {
          const pageContent = await page.content();
          const pageText = await page.evaluate(() => document.body.innerText.toLowerCase());
          
          for (const keyword of captchaKeywords) {
            if (pageText.includes(keyword.toLowerCase()) || pageContent.toLowerCase().includes(keyword.toLowerCase())) {
              console.error(`\n🚨 CAPTCHAまたはブロック画面が検出されました！`);
              console.error(`キーワード: ${keyword}`);
              console.error(`\n手動で解決してください。解決後、このコンソールでEnterキーを押してください。`);
              console.error(`ブラウザを閉じるには、Ctrl+Cを押してください。\n`);
              
              // 開発者が手動で解決できるように一時停止
              await page.pause();
              break;
            }
          }
        } catch (e) {
          // エラーは無視
        }
      };

      // ネットワークリクエストを傍受して店舗URLを取得（厳格なフィルタリング）
      page.on('response', async (response) => {
        const url = response.url();
        const resourceType = response.request().resourceType();
        
        // 厳格なフィルタリング: XHR/Fetchリクエストのみ処理
        if (resourceType !== 'fetch' && resourceType !== 'xhr') {
          return;
        }
        
        const apiPatterns = [
          /\/api\/getFeedV1/i,
          /\/api\/stores/i,
          /graphql/i,
          /\/api\/v1\/stores/i,
          /\/api\/feed/i,
        ];

        // URLパターンのチェック
        if (!apiPatterns.some(pattern => pattern.test(url))) {
          return;
        }

        // 画像、CSS、Analyticsなどの除外
        const excludedPatterns = [
          /\.(jpg|jpeg|png|gif|webp|svg|ico)$/i,
          /\.(css|js)$/i,
          /analytics/i,
          /tracking/i,
          /pixel/i,
          /beacon/i,
        ];
        
        if (excludedPatterns.some(pattern => pattern.test(url))) {
          return;
        }

        try {
          const contentType = response.headers()['content-type'] || '';
          
          // JSONレスポンスのみ処理
          if (!contentType.includes('application/json')) {
            return;
          }
          
          const jsonData = await response.json();
          
          // 店舗リストからURLを抽出
          const stores = jsonData.data?.stores || 
                       jsonData.stores || 
                       jsonData.feed?.stores ||
                       jsonData.data?.feed?.stores ||
                       [];
          
          if (Array.isArray(stores)) {
            for (const store of stores) {
              // テスト上限チェック: 収集済み店舗数が上限に達したら終了
              if (capturedStoreMap.size >= MAX_TEST_ITEMS) {
                break;
              }
              
              if (store.url || store.slug || store.id) {
                let storeUrl = store.url 
                  ? (store.url.startsWith("http") ? store.url : `https://www.ubereats.com${store.url}`)
                  : `https://www.ubereats.com/jp/store/${store.slug || store.id}`;
                
                // URLを正規化（クエリパラメータを削除）
                storeUrl = normalizeUbereatsUrl(storeUrl);
                
                if (storeUrl.includes('/store/')) {
                  // Mapを使用して重複排除（URLをキーに）
                  const storeKey = store.id || store.slug || storeUrl;
                  if (!capturedStoreMap.has(storeKey)) {
                    capturedStoreMap.set(storeKey, {
                      url: storeUrl,
                      id: store.id,
                      slug: store.slug,
                    });
                    
                    // 追加後に再度チェック
                    if (capturedStoreMap.size >= MAX_TEST_ITEMS) {
                      break;
                    }
                  }
                }
              }
            }
          }
        } catch (e) {
          // JSONパースエラーは無視
        }
      });

      // ページにアクセス
      console.log(`📄 ページを取得中: ${areaUrl}`);
      try {
        await page.goto(areaUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
        
        // ランダムな待機時間（3〜7秒）
        const randomWait = Math.floor(Math.random() * 4000) + 3000;
        await page.waitForTimeout(randomWait);
      } catch (error) {
        console.error(`❌ ページ読み込みエラー:`, error);
        throw error;
      }

      // CAPTCHAチェック（ページ読み込み後）
      await checkForCaptcha();

      // 店舗リストが表示されるまで待機
      const selectors = [
        '[data-testid*="store"]',
        'a[href*="/store/"]',
        '[class*="store-card"]',
        '[class*="restaurant-card"]',
      ];

      let elementFound = false;
      for (const selector of selectors) {
        try {
          await page.waitForSelector(selector, { timeout: 15000, state: 'visible' });
          elementFound = true;
          break;
        } catch (e) {
          continue;
        }
      }

      if (!elementFound) {
        console.warn("店舗リスト要素が見つかりませんでしたが、続行します");
      }

      // スクロールしてコンテンツを読み込む（UberEatsは遅延読み込みが多い）
      console.log("📜 ページをスクロールしてコンテンツを読み込み中...");
      for (let i = 0; i < 10; i++) {
        // テスト上限チェック: 収集済み店舗数が上限に達したら終了
        if (capturedStoreMap.size >= MAX_TEST_ITEMS) {
          console.log(`\n✅ テスト上限（${MAX_TEST_ITEMS}件）に達したため、スクロールを終了します`);
          break;
        }
        
        // ランダムなスクロール位置（ブラウザコンテキスト内で取得）
        const scrollPosition = await page.evaluate(() => {
          return Math.random() * document.body.scrollHeight;
        });
        await page.evaluate((pos) => {
          window.scrollTo(0, pos);
        }, scrollPosition);
        
        // ランダムな待機時間（1〜3秒）
        const waitTime = Math.floor(Math.random() * 2000) + 1000;
        await page.waitForTimeout(waitTime);
        
        // スクロール後に再度チェック（APIレスポンスが処理された可能性があるため）
        if (capturedStoreMap.size >= MAX_TEST_ITEMS) {
          console.log(`\n✅ テスト上限（${MAX_TEST_ITEMS}件）に達したため、スクロールを終了します`);
          break;
        }
      }
      
      // 最後に最下部までスクロール
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      
      // スクロール処理完了後、全てのネットワーク処理が完了するまで待機（競合対策）
      console.log("⏳ ネットワーク処理の完了を待機中...");
      await page.waitForTimeout(5000);

      // 再度CAPTCHAチェック
      await checkForCaptcha();

      // 店舗カードからURLを抽出（フォールバック、Mapを使用して重複排除）
      console.log("🔍 店舗URLを抽出中（DOMから）...");
      
      // UberEatsの店舗カードセレクタ（複数のパターンを試行）
      const storeSelectors = [
        'a[href*="/store/"]',
        '[data-testid*="store"] a',
        '.store-card a',
        'a[href^="/jp/store/"]',
      ];

      let domExtractionFound = false;
      const initialMapSize = capturedStoreMap.size;

      for (const selector of storeSelectors) {
        try {
          const links = await page.locator(selector).all();
          if (links.length > 0) {
            console.log(`  ✅ セレクタ "${selector}" で ${links.length}件のリンクを発見`);
            
            for (const link of links) {
              // テスト上限チェック: 収集済み店舗数が上限に達したら終了
              if (capturedStoreMap.size >= MAX_TEST_ITEMS) {
                console.log(`\n✅ テスト上限（${MAX_TEST_ITEMS}件）に達したため、DOM抽出を終了します`);
                break;
              }
              
              try {
                const href = await link.evaluate((el) => (el as HTMLAnchorElement).href);
                if (href && href.includes("/store/")) {
                  // 完全なURLに変換（相対パスの場合）
                  let fullUrl = href.startsWith("http") 
                    ? href 
                    : new URL(href, "https://www.ubereats.com").toString();
                  
                  // URLを正規化（クエリパラメータを削除）
                  fullUrl = normalizeUbereatsUrl(fullUrl);
                  
                  // Mapを使用して重複排除（URLをキーに）
                  const storeKey = fullUrl;
                  if (!capturedStoreMap.has(storeKey)) {
                    capturedStoreMap.set(storeKey, { url: fullUrl });
                    domExtractionFound = true;
                    
                    // 追加後に再度チェック
                    if (capturedStoreMap.size >= MAX_TEST_ITEMS) {
                      console.log(`\n✅ テスト上限（${MAX_TEST_ITEMS}件）に達したため、DOM抽出を終了します`);
                      break;
                    }
                  }
                }
              } catch (e) {
                // 個別のリンクエラーは無視
                continue;
              }
            }
            
            // ループを抜けた後もチェック
            if (capturedStoreMap.size >= MAX_TEST_ITEMS) {
              break;
            }
            
            if (domExtractionFound) {
              break; // 成功したセレクタが見つかったら終了
            }
          }
        } catch (e) {
          console.warn(`  ⚠️ セレクタ "${selector}" でエラー:`, e);
          continue;
        }
      }

      // フォールバック: __NEXT_DATA__から店舗情報を取得
      if (!domExtractionFound && capturedStoreMap.size === 0) {
        console.log("  🔄 フォールバック: __NEXT_DATA__から店舗情報を取得中...");
        try {
          const nextDataScript = await page.locator('script#__NEXT_DATA__').first();
          const scriptContent = await nextDataScript.textContent();

          if (scriptContent) {
            const nextData = JSON.parse(scriptContent);
            
            // 店舗リストを抽出（UberEatsのデータ構造に基づく）
            const stores = 
              nextData?.props?.pageProps?.stores ||
              nextData?.props?.pageProps?.initialState?.stores ||
              nextData?.stores ||
              [];

            if (Array.isArray(stores) && stores.length > 0) {
              for (const store of stores) {
                // テスト上限チェック: 収集済み店舗数が上限に達したら終了
                if (capturedStoreMap.size >= MAX_TEST_ITEMS) {
                  console.log(`\n✅ テスト上限（${MAX_TEST_ITEMS}件）に達したため、__NEXT_DATA__抽出を終了します`);
                  break;
                }
                
                if (store.url || store.slug || store.id) {
                  let storeUrl = store.url 
                    ? (store.url.startsWith("http") ? store.url : `https://www.ubereats.com${store.url}`)
                    : `https://www.ubereats.com/jp/store/${store.slug || store.id}`;
                  
                  // URLを正規化（クエリパラメータを削除）
                  storeUrl = normalizeUbereatsUrl(storeUrl);
                  
                  // Mapを使用して重複排除
                  const storeKey = store.id || store.slug || storeUrl;
                  if (!capturedStoreMap.has(storeKey)) {
                    capturedStoreMap.set(storeKey, {
                      url: storeUrl,
                      id: store.id,
                      slug: store.slug,
                    });
                    
                    // 追加後に再度チェック
                    if (capturedStoreMap.size >= MAX_TEST_ITEMS) {
                      console.log(`\n✅ テスト上限（${MAX_TEST_ITEMS}件）に達したため、__NEXT_DATA__抽出を終了します`);
                      break;
                    }
                  }
                }
              }
              console.log(`  ✅ __NEXT_DATA__から ${capturedStoreMap.size}件の店舗URLを抽出（重複排除済み）`);
            }
          }
        } catch (e) {
          console.warn("  ⚠️ __NEXT_DATA__の解析に失敗:", e);
        }
      }

      // テスト上限チェック: 上限に達していた場合のログ出力
      if (capturedStoreMap.size >= MAX_TEST_ITEMS) {
        console.log(`\n⚠️ テストモード: 収集上限（${MAX_TEST_ITEMS}件）に達しました`);
      }

      // Mapから最終的なURLリストを作成（重複排除済み）
      if (capturedStoreMap.size > 0) {
        const allUniqueUrls = Array.from(capturedStoreMap.values()).map(store => store.url);
        collectedUrls.push(...allUniqueUrls);
        const apiCount = initialMapSize;
        const domCount = capturedStoreMap.size - initialMapSize;
        console.log(`📊 最終的な重複排除後のURL数: ${collectedUrls.length}件（API: ${apiCount}件、DOM: ${domCount}件）`);
      }
      console.log(`\n📊 収集完了: 合計 ${collectedUrls.length}件のURLを収集しました`);

      await browser.close();
      browser = null;

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
    });
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
// コマンドライン引数からURLを取得、またはデフォルト値を使用
const areaUrl = process.argv[2] || "https://www.ubereats.com/jp/location/tokyo";

importUbereatsStores(areaUrl)
  .then(() => {
    console.log("✅ スクリプトが正常に完了しました");
    process.exit(0);
  })
  .catch((e) => {
    console.error("❌ スクリプトがエラーで終了しました:", e);
    process.exit(1);
  });

