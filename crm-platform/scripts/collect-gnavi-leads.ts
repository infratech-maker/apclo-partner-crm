/**
 * グルナビからリードを収集するスクリプト
 *
 * 使用例:
 *   # テイクアウト可 + ニューオープンの両方を収集（デフォルト）
 *   tsx scripts/collect-gnavi-leads.ts
 *
 *   # テイクアウト可の店舗のみ
 *   tsx scripts/collect-gnavi-leads.ts --takeout 10
 *
 *   # ニューオープンの店舗のみ
 *   tsx scripts/collect-gnavi-leads.ts --newopen 10
 *
 *   # 両方（明示的）
 *   tsx scripts/collect-gnavi-leads.ts --both 10
 *
 *   # カスタムURL
 *   tsx scripts/collect-gnavi-leads.ts "https://r.gnavi.co.jp/area/jp/rs/?sc_sh=sp_newopen" 10
 *
 * 注意:
 * - Playwright を使用するため、事前に `npx playwright install chromium` が必要です
 * - グルナビの検索結果ページから店舗URLを収集し、各店舗の詳細情報をスクレイピングします
 * - デフォルトでは、テイクアウト可とニューオープンの両方の店舗を収集します
 */

import { config } from "dotenv";
import { resolve } from "path";

// 環境変数の読み込み (.env.local)
config({ path: resolve(__dirname, "../.env.local") });

import { db } from "../src/lib/db";
import { leads } from "../src/lib/db/schema";
import { withTenant } from "../src/lib/db/tenant-helper";
import { scrapeGnaviStore } from "../src/features/scraper/worker";
import { chromium, Browser } from "playwright";
import { eq, and, or, ilike, sql } from "drizzle-orm";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const BATCH_SIZE = 5; // API負荷軽減のため少なめに
const DELAY_MS = 2000; // スクレイピングマナーとして待機時間を確保

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * グルナビの検索結果ページから店舗URLを収集
 */
async function collectStoreUrlsFromGnavi(
  searchUrl: string,
  maxPages: number = 10
): Promise<string[]> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  const storeUrls: Set<string> = new Set();

  try {
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      // ページ番号をURLに追加
      // グルナビのURL構造: ?p=2 または &p=2
      let pageUrl: string;
      if (pageNum === 1) {
        // 1ページ目は元のURLを使用（ページ番号パラメータなし）
        pageUrl = searchUrl;
      } else {
        // 2ページ目以降はページ番号を追加
        if (searchUrl.includes("?")) {
          // 既にクエリパラメータがある場合
          pageUrl = `${searchUrl}&p=${pageNum}`;
        } else {
          // クエリパラメータがない場合
          pageUrl = `${searchUrl}?p=${pageNum}`;
        }
      }

      console.log(`📄 ページ ${pageNum} を取得中: ${pageUrl}`);

      try {
        console.log(`  ページにアクセス中...`);
        await page.goto(pageUrl, {
          waitUntil: "domcontentloaded",
          timeout: 60000,
        });

        // ページが完全に読み込まれるまで待機
        console.log(`  ページ読み込み待機中...`);
        await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(5000); // 追加の待機時間（JavaScriptで動的に読み込まれる可能性があるため）

        // デバッグ: ページのタイトルを確認
        const pageTitle = await page.title();
        console.log(`  ページタイトル: ${pageTitle}`);

        // デバッグ: ページのURLを確認
        const currentUrl = page.url();
        console.log(`  現在のURL: ${currentUrl}`);

        // すべてのリンクを取得して、店舗URLのパターンに一致するものをフィルタリング
        const allLinks = await page.locator('a').all();
        console.log(`  ページ内のリンク数: ${allLinks.length}`);

        // デバッグ: /r/を含むリンクを探す
        const rLinks: string[] = [];
        for (const link of allLinks) {
          try {
            const href = await link.getAttribute("href");
            if (href && (href.includes("/r/") || href.includes("r.gnavi.co.jp"))) {
              rLinks.push(href);
            }
          } catch {
            // 無視
          }
        }
        console.log(`  /r/を含むリンク数: ${rLinks.length}`);
        if (rLinks.length > 0) {
          console.log(`  /r/リンクのサンプル: ${rLinks.slice(0, 5).join(", ")}`);
        }

        let foundUrls = 0;
        const pageUrls: Set<string> = new Set();

        // グルナビの店舗URLパターン
        // 形式1: https://r.gnavi.co.jp/店舗ID/ (直接店舗ID)
        // 形式2: https://r.gnavi.co.jp/r/店舗ID/ (古い形式)
        // 店舗IDは通常、英数字とハイフンで構成される（例: 3s3h94nt0000, gj8k8c300000）
        const storeUrlPatterns = [
          /^https:\/\/r\.gnavi\.co\.jp\/[a-z0-9\-]+\/?$/, // 直接店舗ID形式
          /^https:\/\/r\.gnavi\.co\.jp\/r\/[a-z0-9\-]+\/?$/, // /r/形式
        ];

        for (const link of allLinks) {
          try {
            const href = await link.getAttribute("href");
            if (!href) continue;

            // 相対URLの場合は絶対URLに変換
            let absoluteUrl: string;
            try {
              if (href.startsWith("http")) {
                absoluteUrl = href;
              } else if (href.startsWith("//")) {
                absoluteUrl = `https:${href}`;
              } else if (href.startsWith("/")) {
                absoluteUrl = `https://r.gnavi.co.jp${href}`;
              } else {
                absoluteUrl = new URL(href, "https://r.gnavi.co.jp").href;
              }

              // クエリパラメータとフラグメントを削除して正規化
              const urlObj = new URL(absoluteUrl);
              urlObj.search = ""; // クエリパラメータを削除
              urlObj.hash = ""; // フラグメントを削除
              // 末尾のスラッシュを削除（統一のため）
              let normalizedUrl = urlObj.href;
              if (normalizedUrl.endsWith("/")) {
                normalizedUrl = normalizedUrl.slice(0, -1);
              }

              // 店舗詳細ページのURLかどうかを判定
              // 除外するパス: /rs/, /area/, /plan/, /member/, /cp/, /g/, /r/rs/ など
              const excludePatterns = [
                /\/rs\//,
                /\/area\//,
                /\/plan\//,
                /\/member\//,
                /\/cp\d+\//,
                /\/g\d+\//,
                /\/r\/rs\//,
              ];

              const shouldExclude = excludePatterns.some(pattern => pattern.test(normalizedUrl));
              
              if (!shouldExclude) {
                // 店舗URLパターンに一致するか確認
                const isStoreUrl = storeUrlPatterns.some(pattern => pattern.test(normalizedUrl));
                
                if (isStoreUrl) {
                  // 重複チェック（このページ内と全体）
                  if (!pageUrls.has(normalizedUrl) && !storeUrls.has(normalizedUrl)) {
                    storeUrls.add(normalizedUrl);
                    pageUrls.add(normalizedUrl);
                    foundUrls++;
                  }
                }
              }
            } catch (urlError) {
              // URL解析エラーは無視
              continue;
            }
          } catch (error) {
            // 個別のリンク取得エラーは無視
            continue;
          }
        }

        // デバッグ: 見つかったURLのサンプルを表示
        if (foundUrls > 0) {
          const sampleUrls = Array.from(pageUrls).slice(0, 3);
          console.log(`  見つかったURLのサンプル: ${sampleUrls.join(", ")}`);
        }

        console.log(`  ✅ ${foundUrls}件の店舗URLを取得（累計: ${storeUrls.size}件）`);

        // 次のページがない場合は終了
        if (foundUrls === 0) {
          console.log("  このページに店舗が見つかりませんでした。収集を終了します。");
          break;
        }

        // 次のページボタンが存在するか確認
        if (pageNum < maxPages) {
          const nextButton = page.locator('a:has-text("次へ"), a:has-text("次"), .pagination-next, [aria-label*="次"]').first();
          const hasNext = await nextButton.isVisible({ timeout: 1000 }).catch(() => false);
          
          if (!hasNext) {
            console.log("  次のページボタンが見つかりませんでした。収集を終了します。");
            break;
          }
        }

        // レートリミット回避
        await sleep(DELAY_MS);
      } catch (error) {
        console.error(`  ページ ${pageNum} の取得エラー:`, error);
        // エラーが発生しても次のページを試行
        continue;
      }
    }
  } catch (error) {
    console.error("検索結果ページの取得エラー:", error);
  } finally {
    await context.close();
    await browser.close();
  }

  return Array.from(storeUrls);
}

/**
 * グルナビリードを収集してデータベースに保存
 */
async function collectGnaviLeads(searchUrl: string, maxPages: number = 10) {
  await withTenant(async (tenantId) => {
    console.log("🔍 グルナビから店舗URLを収集中...");
    console.log(`検索URL: ${searchUrl}`);

    // 既存のグルナビリードを取得（重複チェック用）
    // データベースのカラム名がキャメルケース（tenantId）のため、sqlテンプレートで直接指定
    const existingLeads = await db
      .select({
        source: leads.source,
      })
      .from(leads)
      .where(
        sql`"leads"."tenantId" = ${tenantId} AND ("leads"."source" LIKE '%gnavi.co.jp%' OR "leads"."source" LIKE '%r.gnavi.co.jp%')`
      );

    const existingUrls = new Set(
      existingLeads.map((lead) => lead.source).filter(Boolean)
    );

    console.log(`既存のグルナビリード: ${existingUrls.size}件`);

    // 店舗URLを収集
    const storeUrls = await collectStoreUrlsFromGnavi(searchUrl, maxPages);
    console.log(`✅ 収集した店舗URL: ${storeUrls.length}件`);

    // 新規URLのみをフィルタリング
    const newUrls = storeUrls.filter((url) => !existingUrls.has(url));
    console.log(`新規URL: ${newUrls.length}件`);

    if (newUrls.length === 0) {
      console.log("新規の店舗が見つかりませんでした。");
      return;
    }

    let processed = 0;
    let created = 0;
    let skipped = 0;
    let errors = 0;

    // 各店舗の詳細情報をスクレイピング
    for (let i = 0; i < newUrls.length; i++) {
      const url = newUrls[i];
      processed++;

      try {
        console.log(
          `📡 [${processed}/${newUrls.length}] スクレイピング中: ${url}`
        );

        // 店舗情報をスクレイピング
        const result = await scrapeGnaviStore(url);

        if (!result.name) {
          console.warn("  ⚠️ 店舗名が取得できませんでした。スキップします。");
          skipped++;
          continue;
        }

        // MasterLeadを作成または取得
        const phone = result.phone || null;
        const name = result.name || '名称不明';
        const address = result.address || null;

        // 電話番号の正規化（空白削除、ハイフン統一など）
        const normalizedPhone = phone 
          ? phone.toString().trim().replace(/\s+/g, '').replace(/[ー－]/g, '-')
          : null;

        // MasterLeadを検索または作成
        let masterLead;
        try {
          if (normalizedPhone && normalizedPhone !== '') {
            masterLead = await prisma.masterLead.findFirst({
              where: { phone: normalizedPhone }
            });
            if (masterLead) {
              console.log(`  🔍 既存のMasterLeadを取得: ${masterLead.id}`);
            }
          }

          // まだマスタがない場合は新規作成
          if (!masterLead) {
          masterLead = await prisma.masterLead.create({
            data: {
              companyName: name,
              phone: normalizedPhone,
              address: address,
              source: url,
              data: {
                name: result.name,
                address: result.address,
                category: result.category,
                phone: result.phone,
                business_hours: result.business_hours,
                regular_holiday: result.regular_holiday,
                transport: result.transport,
                website: result.website,
                is_franchise: result.is_franchise,
                takeout_available: result.takeout_available,
                delivery_available: result.delivery_available,
                delivery_services: result.delivery_services,
              },
            }
          });
            console.log(`  ✨ 新規MasterLeadを作成: ${masterLead.id}`);
          }

          // masterLead.idが取得できているか確認
          if (!masterLead || !masterLead.id) {
            throw new Error("MasterLeadの作成または取得に失敗しました");
          }
        } catch (masterLeadError: any) {
          console.error(`  ❌ MasterLead作成エラー: ${url}`, masterLeadError);
          errors++;
          continue;
        }

        // データベースに保存
        // id、createdAt、updatedAtを明示的に生成（データベースのdefaultが設定されていないため）
        const { randomUUID } = await import("crypto");
        const now = new Date();
        await db.insert(leads).values({
          id: randomUUID(),
          tenantId: tenantId,
          masterLeadId: masterLead.id,
          source: url,
          data: {
            name: result.name,
            address: result.address,
            category: result.category,
            phone: result.phone,
            business_hours: result.business_hours,
            regular_holiday: result.regular_holiday,
            transport: result.transport,
            website: result.website,
            is_franchise: result.is_franchise,
            takeout_available: result.takeout_available,
            delivery_available: result.delivery_available,
            delivery_services: result.delivery_services,
          },
          createdAt: now,
          updatedAt: now,
        });

        created++;
        console.log(`  ✅ 保存完了: ${result.name}`);
      } catch (error: any) {
        errors++;
        const errorMessage = error?.cause?.message || error?.message || String(error);
        const errorCode = error?.cause?.code || error?.code;
        console.error(`  ❌ エラー: ${url}`);
        console.error(`     エラーメッセージ: ${errorMessage}`);
        if (errorCode) {
          console.error(`     エラーコード: ${errorCode}`);
        }
        // データベースエラーの場合は詳細を表示
        if (error?.cause?.severity) {
          console.error(`     詳細: ${error.cause.severity} - ${error.cause.detail || ''}`);
        }
      }

      // レートリミット回避
      if (i < newUrls.length - 1) {
        await sleep(DELAY_MS);
      }

      // バッチごとに進捗表示
      if (processed % BATCH_SIZE === 0) {
        console.log(
          `--- 進捗: ${processed}/${newUrls.length}件 処理済み (作成: ${created}, スキップ: ${skipped}, エラー: ${errors}) ---`
        );
      }
    }

    console.log("");
    console.log("🎉 収集完了");
    console.log(`  総URL数: ${storeUrls.length}`);
    console.log(`  新規URL: ${newUrls.length}`);
    console.log(`  作成:     ${created}`);
    console.log(`  スキップ: ${skipped}`);
    console.log(`  エラー:   ${errors}`);
  });
}

/**
 * グルナビの検索条件タイプ
 */
type SearchType = "takeout" | "newopen" | "custom";

/**
 * 検索URLを生成
 */
function buildSearchUrl(type: SearchType, customUrl?: string): string {
  const baseUrl = "https://r.gnavi.co.jp/area/jp/rs/";
  
  switch (type) {
    case "takeout":
      // テイクアウト可の店舗
      return "https://r.gnavi.co.jp/area/jp/kods00100/rs/?point=SAVE";
    case "newopen":
      // ニューオープンの店舗
      // 複数のパターンを試す（実際のURL構造に応じて調整が必要な場合があります）
      // パターン1: sc_shパラメータを使用
      return "https://r.gnavi.co.jp/area/jp/rs/?sc_sh=sp_newopen";
      // パターン2（代替）: もし上記が動作しない場合、以下を試してください
      // return "https://r.gnavi.co.jp/area/jp/rs/?sc_sh=sp_new";
    case "custom":
      return customUrl || baseUrl;
    default:
      return baseUrl;
  }
}

// メイン処理
async function main() {
  // コマンドライン引数の解析
  const args = process.argv.slice(2);
  
  let searchUrls: string[] = [];
  let maxPages = 10;

  // 引数の解析
  if (args.length === 0) {
    // デフォルト: テイクアウト可とニューオープンの両方を収集
    searchUrls = [
      buildSearchUrl("takeout"),
      buildSearchUrl("newopen"),
    ];
  } else if (args[0] === "--takeout") {
    // テイクアウト可のみ
    searchUrls = [buildSearchUrl("takeout")];
    maxPages = parseInt(args[1] || "10", 10);
  } else if (args[0] === "--newopen") {
    // ニューオープンのみ
    searchUrls = [buildSearchUrl("newopen")];
    maxPages = parseInt(args[1] || "10", 10);
  } else if (args[0] === "--both") {
    // 両方（明示的）
    searchUrls = [
      buildSearchUrl("takeout"),
      buildSearchUrl("newopen"),
    ];
    maxPages = parseInt(args[1] || "10", 10);
  } else if (args[0].startsWith("http")) {
    // カスタムURL
    searchUrls = [args[0]];
    maxPages = parseInt(args[1] || "10", 10);
  } else {
    // 不明な引数
    console.error("❌ 不正な引数です");
    console.log("");
    console.log("使用方法:");
    console.log("  tsx scripts/collect-gnavi-leads.ts                    # テイクアウト可 + ニューオープン（デフォルト）");
    console.log("  tsx scripts/collect-gnavi-leads.ts --takeout [ページ数]  # テイクアウト可のみ");
    console.log("  tsx scripts/collect-gnavi-leads.ts --newopen [ページ数]   # ニューオープンのみ");
    console.log("  tsx scripts/collect-gnavi-leads.ts --both [ページ数]     # 両方（明示的）");
    console.log("  tsx scripts/collect-gnavi-leads.ts <URL> [ページ数]      # カスタムURL");
    process.exit(1);
  }

  console.log("🚀 グルナビリード収集スクリプトを開始します");
  console.log(`検索URL数: ${searchUrls.length}`);
  searchUrls.forEach((url, index) => {
    console.log(`  ${index + 1}. ${url}`);
  });
  console.log(`最大ページ数: ${maxPages}`);
  console.log("");

  // 各検索URLに対して収集を実行
  for (let i = 0; i < searchUrls.length; i++) {
    const searchUrl = searchUrls[i];
    console.log(`\n${"=".repeat(60)}`);
    console.log(`📋 検索 ${i + 1}/${searchUrls.length}: ${searchUrl}`);
    console.log(`${"=".repeat(60)}\n`);

    await collectGnaviLeads(searchUrl, maxPages);

    // 複数の検索条件がある場合は、次の検索前に待機
    if (i < searchUrls.length - 1) {
      console.log("\n⏳ 次の検索条件に移る前に待機中...");
      await sleep(DELAY_MS * 2); // 少し長めに待機
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ すべての検索条件の処理が完了しました");
  console.log("=".repeat(60));
}

main()
  .then(() => {
    console.log("✅ スクリプト完了");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ スクリプトエラー:", error);
    process.exit(1);
  });




