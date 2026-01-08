/**
 * スクレイピングワーカー
 * 
 * BullMQと連携して、非同期でスクレイピングジョブを処理します
 * Playwrightを使用して、食べログなどのサイトからデータを取得します
 */

import { chromium, Browser, Page } from "playwright";

export interface ScrapingResult {
  name?: string;
  address?: string;
  category?: string;
  phone?: string;
  open_date?: string;
  regular_holiday?: string;
  transport?: string;
  business_hours?: string;
  budget?: string;
  website?: string; // 公式アカウント（HPURL）
  related_stores?: string | string[];
  is_franchise?: boolean;
  takeout_available?: boolean; // テイクアウト可否
  delivery_available?: boolean; // デリバリー可否
  delivery_services?: string[]; // デリバリーサービス名（Uber Eats、出前館など）
  url: string;
  // UberEats用フィールド
  latitude?: number | null;
  longitude?: number | null;
  rating?: number;
  rating_count?: number;
  description?: string;
  // UberEats固有のデータ構造
  ubereats?: {
    name: string;
    url: string;
    address: string;
    latitude: number | null;
    longitude: number | null;
    rating: number | null;
    review_count: number | null;
    price_range: string | null;
    categories: string | null;
    brand_name: string | null;
    transport: string;
    business_hours: string | null;
  };
  [key: string]: any;
}

/**
 * 食べログの店舗詳細ページから情報を取得
 * 
 * @param url 食べログの店舗URL
 * @returns スクレイピング結果
 */
export async function scrapeTabelogStore(url: string): Promise<ScrapingResult> {
  let browser: Browser | null = null;

  try {
    // ブラウザを起動
    browser = await chromium.launch({
      headless: true,
    });

    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });

    const page = await context.newPage();

    // ページにアクセス
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

    // 基本情報を取得
    const result: ScrapingResult = {
      url: url,
    };

    // ========================================
    // ヘルパー関数: 特定のCSSセレクタからテキストを取得（高速・確実）
    // ========================================
    const getTextBySelector = async (selector: string): Promise<string | null> => {
      try {
        const el = page.locator(selector).first();
        // タイムアウトを短く設定（存在しない場合の待ち時間を短縮）
        if (await el.isVisible({ timeout: 500 }).catch(() => false)) {
          let text = await el.innerText();
          // 予算などで改行が含まれる場合があるため、空白・改行を整理
          return text.replace(/\s+/g, ' ').trim();
        }
        return null;
      } catch {
        return null;
      }
    };

    // ========================================
    // ヘルパー関数: テーブルヘッダー(th)の文字から隣のセル(td)を取得（汎用バックアップ）
    // ========================================
    const getTableValue = async (headerText: string): Promise<string | null> => {
      try {
        // ヘッダーセル(th)を検索
        const th = page.locator(`th:has-text("${headerText}")`).first();
        // 親のtrを探し、その中のtdを取得
        const td = page.locator('tr').filter({ has: th }).locator('td').first();
        
        if (await td.count() > 0) {
          let text = await td.innerText();
          return text.replace(/\s+/g, ' ').trim();
        }
        return null;
      } catch {
        return null;
      }
    };

    // 店舗名を取得（複数の方法を試行）
    try {
      // ページが完全に読み込まれるまで待機
      await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(2000); // 追加の待機時間
      
      let name: string | null = null;
      
      // 方法1: ページタイトルから取得（最も確実）
      try {
        const title = await page.title();
        if (title) {
          // タイトルから「店舗名 - エリア - 食べログ」の形式を解析
          // 例: "吉野家 帯広白樺店 - 柏林台（牛丼） - 食べログ"
          const titleMatch = title.match(/^([^-]+?)\s*-\s*[^-]+/);
          if (titleMatch && titleMatch[1]) {
            name = titleMatch[1].trim();
          }
        }
      } catch (error) {
        console.warn("Failed to get name from title:", error);
      }
      
      // 方法2: メタタグから取得
      if (!name) {
        try {
          const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
          if (ogTitle) {
            const ogMatch = ogTitle.match(/^([^-]+?)\s*-\s*[^-]+/);
            if (ogMatch && ogMatch[1]) {
              name = ogMatch[1].trim();
            }
          }
        } catch (error) {
          // メタタグ取得失敗は無視
        }
      }
      
      // 方法3: セレクタから取得（フォールバック）
      if (!name) {
        const selectors = [
          "h1.display-name",
          "h2.display-name",
          ".display-name",
          "h1.rst-name",
          "h2.rst-name",
          ".rst-name",
          "h1",
          "h2"
        ];
        
        for (const selector of selectors) {
          try {
            const nameElements = page.locator(selector);
            const count = await nameElements.count();
            
            if (count > 0) {
              // 最初の要素を取得
              const nameElement = nameElements.first();
              if (await nameElement.isVisible({ timeout: 1000 }).catch(() => false)) {
                const text = await nameElement.textContent();
                if (text && text.trim().length > 0 && text.trim().length < 100) {
                  // 長すぎるテキストは除外（通常、店舗名は100文字以内）
                  name = text.trim();
                  break;
                }
              }
            }
          } catch {
            continue;
          }
        }
      }
      
      if (name) {
        // 改行コードを削除し、空白を正規化
        result.name = name
          .replace(/\n/g, " ")
          .replace(/\r/g, "")
          .replace(/\t/g, " ")
          .replace(/\s+/g, " ")
          .trim();
      }
    } catch (error) {
      console.warn("Failed to get store name:", error);
    }

    // 住所を取得（修正版）
    try {
      // 方法1: 「住所」というテキストを持つ<th>を見つけ、その兄弟要素である<td>の中の<p class="rstinfo-table__address">を取得
      // Playwrightのfilter({ hasText: '住所' })を使用してより確実に取得
      const addressRow = page.locator("table.rstinfo-table tr").filter({ hasText: "住所" });
      
      if (await addressRow.count() > 0) {
        // <td>内の<p class="rstinfo-table__address">を取得
        const addressElement = addressRow.locator("td p.rstinfo-table__address").first();
        
        if (await addressElement.count() > 0) {
          // innerText()でネストされたタグ（<a>, <span>）内のテキストをすべて結合
          const addressText = await addressElement.innerText();
          
          // 改行コードをスペースに置換し、前後の空白をトリム
          result.address = addressText
            .replace(/\n/g, " ")      // 改行をスペースに置換
            .replace(/\r/g, "")        // キャリッジリターンを削除
            .replace(/\t/g, " ")       // タブをスペースに置換
            .replace(/\s+/g, " ")      // 連続する空白を1つに
            .trim();                   // 前後の空白をトリム
        } else {
          // フォールバック1: <td>内のテキストを直接取得
          const tdElement = addressRow.locator("td").first();
          if (await tdElement.count() > 0) {
            const addressText = await tdElement.innerText();
            result.address = addressText
              .replace(/\n/g, " ")
              .replace(/\r/g, "")
              .replace(/\t/g, " ")
              .replace(/\s+/g, " ")
              .trim();
          }
        }
      } else {
        // 方法2: フォールバック - 直接セレクタで取得
        const addressElement = page.locator("p.rstinfo-table__address").first();
        if (await addressElement.count() > 0) {
          const addressText = await addressElement.innerText();
          result.address = addressText
            .replace(/\n/g, " ")
            .replace(/\r/g, "")
            .replace(/\t/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        } else {
          // 方法3: 最後のフォールバック - テーブル全体から「住所」を含む行を探す
          const allRows = page.locator("table.rstinfo-table tr");
          const rowCount = await allRows.count();
          
          for (let i = 0; i < rowCount; i++) {
            const row = allRows.nth(i);
            const rowText = await row.textContent();
            
            if (rowText && rowText.includes("住所")) {
              const tdElement = row.locator("td").first();
              if (await tdElement.count() > 0) {
                const addressText = await tdElement.innerText();
                result.address = addressText
                  .replace(/\n/g, " ")
                  .replace(/\r/g, "")
                  .replace(/\t/g, " ")
                  .replace(/\s+/g, " ")
                  .trim();
                break;
              }
            }
          }
        }
      }
    } catch (error) {
      console.warn("Failed to get address:", error);
    }

    // カテゴリを取得
    try {
      const categoryRow = page.locator("table.rstinfo-table tr").filter({ hasText: "ジャンル" });
      if (await categoryRow.count() > 0) {
        const categoryElement = categoryRow.locator("td").first();
        const categoryText = await categoryElement.textContent();
        if (categoryText) {
          result.category = categoryText.trim();
        }
      }
    } catch (error) {
      console.warn("Failed to get category:", error);
    }

    // 電話番号を取得（ハイブリッドロジック）
    try {
      // クラス: .rstinfo-table__tel-num (最優先)
      // テーブル: "予約・" または "電話番号"
      const phoneText = 
        await getTextBySelector('.rstinfo-table__tel-num') || 
        await getTableValue('予約・') || 
        await getTableValue('電話番号');
      
      if (phoneText) {
        // 電話番号パターン（0XX-XXXX-XXXX または 0XXX-XX-XXXX など）を抽出
        const phonePattern = /0\d{1,4}[-\s(]?\d{1,4}[-\s)]?\d{4}/;
        const match = phoneText.match(phonePattern);
        if (match) {
          // ハイフンに統一
          result.phone = match[0].replace(/[\s()]/g, "").replace(/(\d{2,4})(\d{4})(\d{4})/, "$1-$2-$3");
        } else {
          // パターンに一致しない場合は、トリムしたテキストをそのまま使用
          result.phone = phoneText.trim();
        }
      }
    } catch (error) {
      console.warn("Failed to get phone:", error);
    }

    // オープン日を取得（ハイブリッドロジック）
    try {
      // クラス: .rstinfo-opened-date (最優先)
      // テーブル: "オープン日"
      const openDateText = 
        await getTextBySelector('.rstinfo-opened-date') || 
        await getTableValue('オープン日');
      
      if (openDateText) {
        result.open_date = openDateText;
      }
    } catch (error) {
      console.warn("Failed to get open date:", error);
    }

    // 定休日を取得
    try {
      const holidayRow = page.locator("table.rstinfo-table tr").filter({ hasText: "定休日" });
      if (await holidayRow.count() > 0) {
        const holidayElement = holidayRow.locator("td").first();
        const holidayText = await holidayElement.textContent();
        if (holidayText) {
          const trimmed = holidayText.trim();
          result.regular_holiday = trimmed;
          // 日本語フィールド名も追加
          (result as any).定休日 = trimmed;
        }
      }
    } catch (error) {
      console.warn("Failed to get regular holiday:", error);
    }

    // 交通手段を取得（ハイブリッドロジック）
    try {
      const transportText = await getTableValue('交通手段');
      if (transportText) {
        const trimmed = transportText.trim();
        result.transport = trimmed;
        // 日本語フィールド名も追加
        (result as any).交通手段 = trimmed;
        (result as any).交通アクセス = trimmed;
      }
    } catch (error) {
      console.warn("Failed to get transport:", error);
    }

    // 営業時間を取得（ハイブリッドロジック）
    try {
      // クラス指定なしのため、テーブル検索のみ
      const businessHoursText = await getTableValue('営業時間');
      if (businessHoursText) {
        const trimmed = businessHoursText.trim();
        result.business_hours = trimmed;
        // 日本語フィールド名も追加
        (result as any).営業時間 = trimmed;
      }
    } catch (error) {
      console.warn("Failed to get business hours:", error);
    }

    // 予算を取得（ハイブリッドロジック）
    try {
      // クラス: .rstinfo-table__budget (最優先)
      // テーブル: "予算"
      const budgetText = 
        await getTextBySelector('.rstinfo-table__budget') || 
        await getTableValue('予算');
      
      if (budgetText) {
        result.budget = budgetText;
      }
    } catch (error) {
      console.warn("Failed to get budget:", error);
    }

    // 公式アカウント（HPURL）を取得
    try {
      let websiteUrl: string | null = null;

      // 方法1: 「公式サイト」というテキストを持つリンクを探す
      const officialSiteLink = page.locator('a:has-text("公式サイト"), a:has-text("ホームページ"), a:has-text("公式HP")').first();
      if (await officialSiteLink.count() > 0) {
        const href = await officialSiteLink.getAttribute("href");
        if (href) {
          // 相対URLの場合は絶対URLに変換
          try {
            const urlObj = new URL(href, url);
            websiteUrl = urlObj.href;
          } catch {
            websiteUrl = href;
          }
        }
      }

      // 方法2: テーブル内の「公式サイト」行を探す
      if (!websiteUrl) {
        const websiteRow = page.locator("table.rstinfo-table tr").filter({ hasText: /(公式サイト|ホームページ|公式HP|公式アカウント)/ });
        if (await websiteRow.count() > 0) {
          // 行内のリンクを探す
          const linkInRow = websiteRow.locator("td a").first();
          if (await linkInRow.count() > 0) {
            const href = await linkInRow.getAttribute("href");
            if (href) {
              try {
                const urlObj = new URL(href, url);
                websiteUrl = urlObj.href;
              } catch {
                websiteUrl = href;
              }
            }
          } else {
            // リンクがない場合はテキストを取得
            const textElement = websiteRow.locator("td").first();
            const text = await textElement.textContent();
            if (text) {
              // URLパターンを抽出
              const urlPattern = /https?:\/\/[^\s]+/;
              const match = text.match(urlPattern);
              if (match) {
                websiteUrl = match[0];
              }
            }
          }
        }
      }

      // 方法3: メタタグから取得（og:urlやcanonicalなど）
      if (!websiteUrl) {
        try {
          const ogUrl = await page.locator('meta[property="og:url"]').getAttribute("content");
          if (ogUrl && !ogUrl.includes("tabelog.com")) {
            websiteUrl = ogUrl;
          }
        } catch {
          // メタタグ取得失敗は無視
        }
      }

      if (websiteUrl) {
        result.website = websiteUrl;
        // 日本語フィールド名も追加
        (result as any).公式HP = websiteUrl;
        (result as any).公式アカウント = websiteUrl;
      }
    } catch (error) {
      console.warn("Failed to get website:", error);
    }

    // 関連店舗情報を取得（ハイブリッドロジック）
    try {
      const relatedStores: string[] = [];
      
      // "このお店の系列店" または "系列店" というリンクがあるか
      const relatedStoresLink = page.locator('a:has-text("このお店の系列店"), a:has-text("系列店")').first();
      const hasRelatedStores = await relatedStoresLink.count() > 0;
      
      if (hasRelatedStores) {
        // リンクのhrefを取得
        const href = await relatedStoresLink.getAttribute("href");
        if (href) {
          relatedStores.push(href);
        }
        
        // 他の系列店リンクも探す
        const allRelatedLinks = page.locator('a:has-text("このお店の系列店"), a:has-text("系列店")');
        const linkCount = await allRelatedLinks.count();
        
        for (let i = 0; i < linkCount; i++) {
          const link = allRelatedLinks.nth(i);
          const linkHref = await link.getAttribute("href");
          if (linkHref && !relatedStores.includes(linkHref)) {
            relatedStores.push(linkHref);
          }
        }
      }

      // フォールバック: クラス名で判定
      if (relatedStores.length === 0) {
        const relatedStoreElements = page.locator(".rstinfo-table__other-store, .other-store, .related-stores");
        const elementCount = await relatedStoreElements.count();
        
        if (elementCount > 0) {
          for (let i = 0; i < elementCount; i++) {
            const element = relatedStoreElements.nth(i);
            const text = await element.textContent();
            if (text) {
              relatedStores.push(text.trim());
            }
          }
        }
      }

      if (relatedStores.length > 0) {
        result.related_stores = relatedStores.length === 1 ? relatedStores[0] : relatedStores;
      }
    } catch (error) {
      console.warn("Failed to get related stores:", error);
    }

    // フランチャイズ判定（関連店舗情報を元に判定）
    try {
      let isFranchise = false;

      // 方法1: 関連店舗情報が存在する場合
      if (result.related_stores) {
        isFranchise = true;
      }

      // 方法2: 「このお店の系列店」へのリンクが存在するかチェック（フォールバック）
      if (!isFranchise) {
        const franchiseLink = page.locator("a").filter({ 
          hasText: /(このお店の系列店|系列店|フランチャイズ)/ 
        });
        if (await franchiseLink.count() > 0) {
          isFranchise = true;
        }
      }

      // 方法3: クラス名で判定（フォールバック）
      if (!isFranchise) {
        const franchiseElement = page.locator(".rstinfo-table__other-store, .other-store");
        if (await franchiseElement.count() > 0) {
          isFranchise = true;
        }
      }

      // 方法4: 店舗名にフランチャイズを示唆するキーワードや支店パターンが含まれているかチェック
      if (!isFranchise && result.name) {
        const name = result.name;

        // パターン1: 「〇〇支店」「〇〇号店」「〇〇チェーン」など
        const franchiseKeywordPattern = /(支店|号店|チェーン)/;
        const headStoreExcludePattern = /本店/;

        if (franchiseKeywordPattern.test(name) && !headStoreExcludePattern.test(name)) {
          isFranchise = true;
        } else {
          // パターン2: スペース区切りで支店名が入っているか簡易判定
          // 例: "店名 新宿店", "店名 渋谷店" など
          const branchPattern = /\s+[^\s]+店$/;
          if (branchPattern.test(name)) {
            isFranchise = true;
          } else {
            // パターン3: 「店」「本店」が店舗名につく場合（ユーザー要求）
            // 例: "〇〇店", "〇〇本店" など
            // ただし、「本店」のみの場合は除外（本店は通常FCではない）
            const storePattern = /店$/;
            const headStoreOnlyPattern = /^[^店]*本店$/;
            
            if (storePattern.test(name) && !headStoreOnlyPattern.test(name)) {
              // 「店」で終わるが、「本店」のみではない場合
              isFranchise = true;
            }
          }
        }
      }

      result.is_franchise = isFranchise;
    } catch (error) {
      console.warn("Failed to detect franchise:", error);
      result.is_franchise = false;
    }

    // アクセス情報を取得（住所が取得できなかった場合のフォールバック）
    if (!result.address) {
      try {
        const accessRow = page.locator("table.rstinfo-table tr").filter({ hasText: "アクセス" });
        if (await accessRow.count() > 0) {
          const accessElement = accessRow.locator("td").first();
          const accessText = await accessElement.textContent();
          if (accessText) {
            result.address = accessText.trim();
          }
        }
      } catch (error) {
        console.warn("Failed to get access info:", error);
      }
    }

    await context.close();
    return result;
  } catch (error) {
    console.error("Scraping error:", error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * __NEXT_DATA__から店舗情報を抽出（複数のパスを試行）
 */
function extractStoreDataFromNextData(nextData: any): any {
  const possiblePaths = [
    nextData?.props?.pageProps?.store,
    nextData?.props?.pageProps?.initialState?.store,
    nextData?.props?.pageProps?.storeData,
    nextData?.store,
    nextData?.props?.pageProps?.data?.store,
    nextData?.query?.store,
  ];

  for (const path of possiblePaths) {
    if (path && typeof path === 'object') {
      return path;
    }
  }

  return null;
}

/**
 * 住所情報を抽出（純粋な文字列のみ、座標は含まない）
 */
/**
 * JSON-LD (構造化データ) から住所を抽出
 */
async function extractAddressFromJsonLd(page: any): Promise<string | null> {
  try {
    const jsonLdScripts = await page.locator('script[type="application/ld+json"]').all();
    
    for (const script of jsonLdScripts) {
      try {
        const content = await script.textContent();
        if (!content) continue;
        
        const jsonLd = JSON.parse(content);
        
        // @graph配列がある場合も処理
        let data: any[] = [];
        if (Array.isArray(jsonLd)) {
          data = jsonLd;
        } else if (jsonLd['@graph'] && Array.isArray(jsonLd['@graph'])) {
          data = jsonLd['@graph'];
        } else {
          data = [jsonLd];
        }
        
        // 再帰的に住所を探索する関数
        const findAddress = (obj: any): string | null => {
          if (!obj || typeof obj !== 'object') return null;
          
          // 直接addressプロパティがある場合
          if (obj.address) {
            const addr = obj.address;
            if (typeof addr === 'string' && addr.trim()) {
              return addr.trim();
            }
            if (typeof addr === 'object') {
              const parts = [
                addr.streetAddress,
                addr.addressLocality,
                addr.addressRegion,
                addr.postalCode,
                addr.addressCountry,
              ].filter(Boolean);
              
              if (parts.length > 0) {
                return parts.join(' ');
              }
              
              if (addr.formattedAddress) {
                return addr.formattedAddress;
              }
            }
          }
          
          // locationプロパティ内を探索
          if (obj.location && obj.location.address) {
            const addr = obj.location.address;
            if (typeof addr === 'string' && addr.trim()) {
              return addr.trim();
            }
            if (typeof addr === 'object') {
              const parts = [
                addr.streetAddress,
                addr.addressLocality,
                addr.addressRegion,
                addr.postalCode,
              ].filter(Boolean);
              
              if (parts.length > 0) {
                return parts.join(' ');
              }
            }
          }
          
          return null;
        };
        
        for (const item of data) {
          // @typeがRestaurant, FoodEstablishment, LocalBusinessの場合
          const type = item['@type'];
          if (type === 'Restaurant' || type === 'FoodEstablishment' || type === 'LocalBusiness' || 
              (Array.isArray(type) && type.some((t: string) => t === 'Restaurant' || t === 'FoodEstablishment' || t === 'LocalBusiness'))) {
            const address = findAddress(item);
            if (address) {
              return address;
            }
          }
          
          // @typeに関係なく、addressプロパティがある場合は試行
          const address = findAddress(item);
          if (address) {
            return address;
          }
        }
      } catch (e) {
        // JSONパースエラーは無視
        continue;
      }
    }
  } catch (e) {
    // エラーは無視
  }
  
  return null;
}

/**
 * メタタグから住所を抽出
 */
async function extractAddressFromMetaTags(page: any): Promise<string | null> {
  try {
    // og:description や description から住所を抽出
    const metaTags = [
      'meta[property="og:description"]',
      'meta[name="description"]',
      'meta[property="og:street-address"]',
      'meta[property="og:locality"]',
    ];
    
    for (const selector of metaTags) {
      try {
        const meta = page.locator(selector).first();
        const count = await meta.count();
        
        if (count > 0) {
          const content = await meta.getAttribute('content');
          
          if (content) {
            // 住所らしいパターンを抽出（郵便番号、都道府県、市区町村など）
            const addressPattern = /([0-9]{3}-?[0-9]{4}[\s]*)?([東京都大阪府京都府]|[都道府県]|[市区町村]+)/;
            const match = content.match(addressPattern);
            
            if (match && match.index !== undefined) {
              // より広い範囲で住所を抽出
              const fullMatch = content.match(/(.{0,50}[0-9]{3}-?[0-9]{4}[\s]*[都道府県市区町村].{0,100})/);
              if (fullMatch) {
                return fullMatch[1].trim();
              }
              return content.substring(Math.max(0, match.index - 20), Math.min(content.length, match.index + 100)).trim();
            }
          }
        }
      } catch (e) {
        continue;
      }
    }
  } catch (e) {
    // エラーは無視
  }
  
  return null;
}

/**
 * JavaScript変数（window.__NEXT_DATA__など）から住所を抽出
 */
async function extractAddressFromJavaScriptVars(page: any): Promise<string | null> {
  try {
    const address = await page.evaluate(() => {
      // 再帰的に住所を探索する関数
      const findAddressInObject = (obj: any, depth: number = 0): string | null => {
        if (depth > 5 || !obj || typeof obj !== 'object') return null;
        
        // 直接addressプロパティがある場合
        if (obj.address) {
          if (typeof obj.address === 'string' && obj.address.trim()) {
            return obj.address.trim();
          }
          if (typeof obj.address === 'object') {
            const addr = obj.address;
            if (addr.formattedAddress) return addr.formattedAddress;
            if (addr.fullAddress) return addr.fullAddress;
            const parts = [
              addr.streetAddress,
              addr.addressLocality,
              addr.addressRegion,
              addr.postalCode,
            ].filter(Boolean);
            if (parts.length > 0) return parts.join(' ');
          }
        }
        
        // locationプロパティ内を探索
        if (obj.location) {
          const locAddr = findAddressInObject(obj.location, depth + 1);
          if (locAddr) return locAddr;
        }
        
        // storeプロパティ内を探索
        if (obj.store) {
          const storeAddr = findAddressInObject(obj.store, depth + 1);
          if (storeAddr) return storeAddr;
        }
        
        return null;
      };
      
      // window.__NEXT_DATA__ から取得
      try {
        const nextData = (window as any).__NEXT_DATA__;
        if (nextData) {
          // 複数のパスを探索
          const searchPaths = [
            nextData?.props?.pageProps?.store,
            nextData?.props?.pageProps?.initialState?.store,
            nextData?.props?.pageProps,
            nextData?.props,
            nextData,
          ];
          
          for (const path of searchPaths) {
            const addr = findAddressInObject(path);
            if (addr) return addr;
          }
        }
      } catch (e) {}
      
      // UBER_DATA から取得
      try {
        const uberData = (window as any).UBER_DATA;
        if (uberData) {
          const addr = findAddressInObject(uberData);
          if (addr) return addr;
        }
      } catch (e) {}
      
      // window.__UBER_DATA__ から取得
      try {
        const uberData2 = (window as any).__UBER_DATA__;
        if (uberData2) {
          const addr = findAddressInObject(uberData2);
          if (addr) return addr;
        }
      } catch (e) {}
      
      // window.storeData から取得
      try {
        const storeData = (window as any).storeData;
        if (storeData) {
          const addr = findAddressInObject(storeData);
          if (addr) return addr;
        }
      } catch (e) {}
      
      return null;
    });
    
    if (address) {
      return address;
    }
  } catch (e) {
    // エラーは無視
  }
  
  return null;
}

/**
 * DOMから住所を抽出（強化版）
 */
async function extractAddressFromDOM(page: any): Promise<string | null> {
  try {
    const address = await page.evaluate(() => {
      // 方法1: 「住所」「所在地」というキーワードの近くのテキストを取得
      const keywords = ['住所', '所在地', 'Address', 'address', 'ロケーション', 'Location'];
      
      for (const keyword of keywords) {
        // キーワードを含む要素を探す
        const elements = Array.from(document.querySelectorAll('*')).filter((el: any) => {
          const text = el.textContent || '';
          return text.includes(keyword) && text.length < 200;
        });
        
        for (const el of elements) {
          // 親要素や兄弟要素から住所を探す
          const parent = el.parentElement;
          if (parent) {
            const text = parent.textContent || '';
            // 郵便番号パターンを含む場合
            if (/\d{3}-?\d{4}/.test(text)) {
              // キーワード以降のテキストを抽出
              const index = text.indexOf(keyword);
              if (index !== -1) {
                const addressText = text.substring(index + keyword.length).trim();
                // 改行や不要な文字を削除
                const cleaned = addressText.split('\n')[0].replace(/\s+/g, ' ').trim();
                if (cleaned.length > 5 && cleaned.length < 200) {
                  return cleaned;
                }
              }
            }
          }
        }
      }
      
      // 方法2: 地図リンク（Google Maps）を含む要素から取得
      const mapLinks = Array.from(document.querySelectorAll('a[href*="maps.google.com"], a[href*="google.com/maps"]'));
      for (const link of mapLinks) {
        const text = link.textContent?.trim();
        if (text && text.length > 5 && text.length < 200 && /\d{3}-?\d{4}/.test(text)) {
          return text;
        }
        
        // 親要素から取得
        const parent = link.parentElement;
        if (parent) {
          const text = parent.textContent?.trim();
          if (text && text.length > 5 && text.length < 200 && /\d{3}-?\d{4}/.test(text)) {
            // 住所部分のみを抽出
            const match = text.match(/(.{0,50}\d{3}-?\d{4}[\s]*[都道府県市区町村].{0,100})/);
            if (match) {
              return match[1].trim();
            }
          }
        }
      }
      
      // 方法3: アイコン要素（地図アイコンなど）の近くから取得
      const iconSelectors = [
        '[class*="location"]',
        '[class*="address"]',
        '[class*="map"]',
        '[data-testid*="location"]',
        '[data-testid*="address"]',
        'svg[class*="location"]',
        'svg[class*="map"]',
      ];
      
      for (const selector of iconSelectors) {
        const icons = document.querySelectorAll(selector);
        for (const icon of icons) {
          // 親要素や兄弟要素から住所を探す
          let current: any = icon.parentElement;
          for (let i = 0; i < 3 && current; i++) {
            const text = current.textContent?.trim();
            if (text && text.length > 5 && text.length < 200 && /\d{3}-?\d{4}/.test(text)) {
              // 郵便番号を含む部分を抽出
              const match = text.match(/(.{0,50}\d{3}-?\d{4}[\s]*[都道府県市区町村].{0,100})/);
              if (match) {
                return match[1].trim();
              }
              return text.substring(0, 100).trim();
            }
            current = current.parentElement;
          }
        }
      }
      
      // 方法4: 一般的なセレクタで取得
      const selectors = [
        '[data-testid*="address"]',
        '[class*="address"]',
        '[class*="location"]',
        '[id*="address"]',
        '[id*="location"]',
        '[aria-label*="address"]',
        '[aria-label*="Address"]',
        '[aria-label*="住所"]',
      ];
      
      for (const selector of selectors) {
        try {
          const elements = document.querySelectorAll(selector);
          for (const el of elements) {
            const text = el.textContent?.trim();
            if (text && text.length > 5 && text.length < 200) {
              // 郵便番号パターンを含む場合
              if (/\d{3}-?\d{4}/.test(text)) {
                return text;
              }
              // 都道府県名を含む場合
              if (/[東京都大阪府京都府]|[都道府県]/.test(text)) {
                return text;
              }
            }
          }
        } catch (e) {
          continue;
        }
      }
      
      // 方法5: ボタン要素内のテキストから取得
      const buttons = Array.from(document.querySelectorAll('button, a[role="button"]'));
      for (const button of buttons) {
        const text = button.textContent?.trim();
        if (text && text.length > 5 && text.length < 200) {
          // 郵便番号パターンを含む場合
          if (/\d{3}-?\d{4}/.test(text) && /[都道府県市区町村]/.test(text)) {
            return text;
          }
        }
      }
      
      // 方法6: テーブルやリスト内の住所を探す
      const tables = Array.from(document.querySelectorAll('table, ul, ol, dl'));
      for (const table of tables) {
        const text = table.textContent || '';
        // 「住所」というキーワードと郵便番号を含む場合
        if (text.includes('住所') && /\d{3}-?\d{4}/.test(text)) {
          const rows = Array.from(table.querySelectorAll('tr, li, dt, dd'));
          for (const row of rows) {
            const rowText = row.textContent?.trim();
            if (rowText && rowText.includes('住所') && /\d{3}-?\d{4}/.test(rowText)) {
              // 住所部分を抽出
              const match = rowText.match(/(.{0,20}住所[：:]\s*)(.{0,100}\d{3}-?\d{4}[\s]*[都道府県市区町村].{0,50})/);
              if (match && match[2]) {
                return match[2].trim();
              }
            }
          }
        }
      }
      
      // 方法7: 全てのテキストノードから郵便番号パターンを探す
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null
      );
      
      let node;
      while (node = walker.nextNode()) {
        const text = node.textContent?.trim();
        if (text && text.length > 10 && text.length < 200) {
          // 郵便番号と都道府県名を含む場合
          if (/\d{3}-?\d{4}/.test(text) && /[都道府県市区町村]/.test(text)) {
            // 親要素のテキストも確認
            const parent = node.parentElement;
            if (parent) {
              const parentText = parent.textContent?.trim();
              if (parentText && parentText.length < 300) {
                // より完全な住所を取得
                const match = parentText.match(/(.{0,50}\d{3}-?\d{4}[\s]*[都道府県市区町村].{0,100})/);
                if (match) {
                  return match[1].trim();
                }
              }
            }
            return text;
          }
        }
      }
      
      return null;
    });
    
    if (address) {
      return address;
    }
  } catch (e) {
    // エラーは無視
  }
  
  return null;
}

/**
 * 最後に余計な「Japan」や末尾のゴミを取る補助関数
 */
function cleanupFinalText(text: string): string {
  return text
    .replace(/^日本[、,]\s*/, '')
    .replace(/^日本\s*,\s*/, '')
    .replace(/^Japan[,\s]*/i, '')
    .replace(/,?\s*Japan$/i, '')
    .replace(/\s+JP\s*$/, '')
    .replace(/\s+APAC\s*$/, '')
    .replace(/\s+APACX\s*$/, '')
    .replace(/\s+\d{3}-?\d{4}\s*$/, '') // 末尾の郵便番号を削除
    .replace(/Uber.*$/i, '') // 万が一後ろに残っていた場合
    .replace(/\s+/g, ' ') // 連続する空白を1つに
    .trim();
}

/**
 * 住所をクリーニング（ノイズ除去・正規化）
 * アンカー戦略: 郵便番号 → 都道府県 → 市区町村（番地含む）の優先順位で抽出
 */
function cleanAddress(raw: string | null): string | null {
  if (!raw || typeof raw !== 'string') {
    return null;
  }

  const original = raw.trim();
  
  // 1. ノイズ除去（HTMLタグや特殊文字）
  let clean = original.replace(/<[^>]*>/g, '').trim();

  // 2. 郵便番号での抽出 (〒000-0000 ... または 000-0000 ...)
  // 郵便番号が見つかった場合、その位置から末尾までを取得
  const postalMatch = clean.match(/(〒?\d{3}-?\d{4}.*)/);
  if (postalMatch && postalMatch[1]) {
    const result = cleanupFinalText(postalMatch[1]);
    if (result && result.length > 0 && result.length <= 200) {
      console.log(`[Address Clean] Original: "${original.substring(0, 80)}${original.length > 80 ? '...' : ''}" -> Cleaned: "${result.substring(0, 80)}${result.length > 80 ? '...' : ''}"`);
      return result;
    }
  }

  // 3. 都道府県での抽出 (北海道|東京都|(?:大阪|京都)府|.{2,3}県)
  // 47都道府県を網羅するRegex
  const prefRegex = /(北海道|東京都|(?:大阪|京都)府|.{2,3}県)(.*)/;
  const prefMatch = clean.match(prefRegex);
  if (prefMatch && prefMatch[0]) {
    // マッチした「都道府県 + それ以降」を結合して返す
    const result = cleanupFinalText(prefMatch[0]);
    if (result && result.length > 0 && result.length <= 200) {
      console.log(`[Address Clean] Original: "${original.substring(0, 80)}${original.length > 80 ? '...' : ''}" -> Cleaned: "${result.substring(0, 80)}${result.length > 80 ? '...' : ''}"`);
      return result;
    }
  }

  // 4. フォールバック: 市区町村から始まり、番地(数字)を含む場合のみ許可
  // 例: "港区六本木1-2-3" -> OK / "港区のマクドナルド" -> NG
  // \S{2,6} は2〜6文字の非空白文字（市区町村名の長さを想定）
  // [市区町村] の後に数字が含まれる場合のみ採用
  const cityMatch = clean.match(/(\S{2,6}[市区町村].*\d+.*)/);
  if (cityMatch && cityMatch[1]) {
    const result = cleanupFinalText(cityMatch[1]);
    if (result && result.length > 0 && result.length <= 200) {
      console.log(`[Address Clean] Original: "${original.substring(0, 80)}${original.length > 80 ? '...' : ''}" -> Cleaned: "${result.substring(0, 80)}${result.length > 80 ? '...' : ''}"`);
      return result;
    }
  }

  // 有効な住所パターンが見つからない場合は null を返す
  console.log(`[Address Clean] Original: "${original.substring(0, 100)}..." -> Cleaned: null (no valid address pattern)`);
  return null;
}

/**
 * storeDataオブジェクトから住所を抽出（既存のロジック）
 */
function extractUbereatsAddress(storeData: any): string | null {
  const addressPaths = [
    storeData?.address?.formattedAddress,
    storeData?.location?.address?.formattedAddress,
    storeData?.address?.fullAddress,
    storeData?.location?.fullAddress,
  ];

  for (const path of addressPaths) {
    if (path && typeof path === 'string') {
      return path;
    }
  }

  // フォールバック: 部分的な住所情報を組み立て
  const addressParts = [
    storeData?.address?.streetAddress,
    storeData?.address?.city,
    storeData?.address?.state,
    storeData?.address?.postalCode,
  ].filter(Boolean);

  if (addressParts.length > 0) {
    return addressParts.join(' ');
  }

  return null;
}

/**
 * カテゴリを抽出（配列をカンマ区切り文字列に変換）
 */
function extractUbereatsCategories(storeData: any): string[] {
  const categories = 
    storeData?.categories ||
    storeData?.cuisines ||
    storeData?.tags ||
    [];

  if (Array.isArray(categories)) {
    return categories.map((cat: any) => {
      if (typeof cat === 'string') {
        return cat;
      }
      return cat?.title || cat?.name || cat?.displayName || String(cat);
    }).filter(Boolean);
  }

  return [];
}

/**
 * 予算を変換（$マーク数を日本円レンジに変換）
 */
function convertUbereatsPriceRange(priceRange: string | number | null | undefined): string | null {
  if (!priceRange) return null;

  // 文字列の場合
  if (typeof priceRange === 'string') {
    // $マークの数をカウント（連続する$をカウント）
    const dollarMatch = priceRange.match(/^\$+/);
    const dollarCount = dollarMatch ? dollarMatch[0].length : 0;
    
    // UberEatsの価格帯ランクに合わせて変換
    const conversionMap: { [key: number]: string } = {
      1: '〜￥1,000',           // $ または $:
      2: '￥1,000〜￥2,000',    // $$
      3: '￥2,000〜￥3,000',    // $$$
      4: '￥3,000〜',           // $$$$
    };

    if (dollarCount > 0 && dollarCount <= 4) {
      return conversionMap[dollarCount];
    }

    // $マークが含まれているが、数が不明な場合
    if (priceRange.includes('$')) {
      return '〜￥1,000'; // デフォルト
    }

    // 数値が含まれている場合
    const numberMatch = priceRange.match(/\d+/);
    if (numberMatch) {
      const num = parseInt(numberMatch[0], 10);
      if (num === 1) return '〜￥1,000';
      if (num === 2) return '￥1,000〜￥2,000';
      if (num === 3) return '￥2,000〜￥3,000';
      if (num >= 4) return '￥3,000〜';
    }

    return null;
  }

  // 数値の場合
  if (typeof priceRange === 'number') {
    if (priceRange === 1) return '〜￥1,000';
    if (priceRange === 2) return '￥1,000〜￥2,000';
    if (priceRange === 3) return '￥2,000〜￥3,000';
    if (priceRange >= 4) return '￥3,000〜';
    return null;
  }

  return null;
}

/**
 * 緯度・経度を抽出
 */
function extractUbereatsLocation(storeData: any): { latitude?: number; longitude?: number } {
  const location = storeData?.location || storeData?.address;

  return {
    latitude: location?.latitude || storeData?.latitude || undefined,
    longitude: location?.longitude || storeData?.longitude || undefined,
  };
}

/**
 * ブランド/チェーン情報を抽出
 */
function extractUbereatsBrandInfo(storeData: any): string | null {
  const brandPaths = [
    storeData?.brand?.name,
    storeData?.parentBrand?.name,
    storeData?.sectionName,
    storeData?.chainName,
    storeData?.franchiseName,
    storeData?.brandName,
    storeData?.parent?.name,
    storeData?.group?.name,
  ];

  for (const brand of brandPaths) {
    if (brand && typeof brand === 'string' && brand.trim().length > 0) {
      return brand.trim();
    }
  }

  return null;
}

/**
 * 営業時間を整形（曜日別の構造化データをテキスト形式に変換）
 */
function formatUbereatsBusinessHours(hours: any): string | null {
  if (!hours) return null;

  // 文字列の場合
  if (typeof hours === 'string') {
    return hours;
  }

  // 配列の場合
  if (Array.isArray(hours)) {
    return hours.map((day: any) => {
      if (typeof day === 'string') {
        return day;
      }
      return `${day.day || day.dayOfWeek || ''}: ${day.open || day.start || ''} - ${day.close || day.end || ''}`;
    }).join('; ');
  }

  // オブジェクトの場合
  if (typeof hours === 'object') {
    const dayNames = ['月', '火', '水', '木', '金', '土', '日'];
    const formatted: string[] = [];

    for (const [key, value] of Object.entries(hours)) {
      if (value && typeof value === 'object') {
        const dayHours = value as any;
        const dayName = dayNames[parseInt(key)] || key;
        formatted.push(`${dayName}: ${dayHours.open || dayHours.start || ''} - ${dayHours.close || dayHours.end || ''}`);
      }
    }

    if (formatted.length > 0) {
      return formatted.join('; ');
    }
  }

  return null;
}

/**
 * グルナビの店舗詳細ページから情報を取得
 * 
 * @param url グルナビの店舗URL
 * @returns スクレイピング結果
 */
export async function scrapeGnaviStore(url: string): Promise<ScrapingResult> {
  let browser: Browser | null = null;

  try {
    // ブラウザを起動
    browser = await chromium.launch({
      headless: true,
    });

    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });

    const page = await context.newPage();

    // ページにアクセス
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

    // 基本情報を取得
    const result: ScrapingResult = {
      url: url,
    };

    // ヘルパー関数: 特定のCSSセレクタからテキストを取得
    const getTextBySelector = async (selector: string): Promise<string | null> => {
      try {
        const el = page.locator(selector).first();
        if (await el.isVisible({ timeout: 500 }).catch(() => false)) {
          let text = await el.innerText();
          return text.replace(/\s+/g, ' ').trim();
        }
        return null;
      } catch {
        return null;
      }
    };

    // ページが完全に読み込まれるまで待機
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // 店舗名を取得
    try {
      let name: string | null = null;
      
      // 方法1: ページタイトルから取得
      try {
        const title = await page.title();
        if (title) {
          // タイトルから「店舗名 - エリア - ぐるなび」の形式を解析
          const titleMatch = title.match(/^([^-]+?)\s*-\s*[^-]+/);
          if (titleMatch && titleMatch[1]) {
            name = titleMatch[1].trim();
          }
        }
      } catch (error) {
        console.warn("Failed to get name from title:", error);
      }
      
      // 方法2: メタタグから取得
      if (!name) {
        try {
          const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
          if (ogTitle) {
            const ogMatch = ogTitle.match(/^([^-]+?)\s*-\s*[^-]+/);
            if (ogMatch && ogMatch[1]) {
              name = ogMatch[1].trim();
            }
          }
        } catch (error) {
          // メタタグ取得失敗は無視
        }
      }
      
      // 方法3: h1タグから取得
      if (!name) {
        const h1Selectors = [
          "h1.shop-name",
          "h1.store-name",
          "h1",
        ];
        
        for (const selector of h1Selectors) {
          try {
            const nameElement = page.locator(selector).first();
            if (await nameElement.isVisible({ timeout: 1000 }).catch(() => false)) {
              const text = await nameElement.textContent();
              if (text && text.trim().length > 0 && text.trim().length < 100) {
                name = text.trim();
                break;
              }
            }
          } catch {
            continue;
          }
        }
      }
      
      if (name) {
        result.name = name
          .replace(/\n/g, " ")
          .replace(/\r/g, "")
          .replace(/\t/g, " ")
          .replace(/\s+/g, " ")
          .trim();
      }
    } catch (error) {
      console.warn("Failed to get store name:", error);
    }

    // 住所を取得
    try {
      // グルナビの住所セレクタを試行
      const addressSelectors = [
        ".shop-address",
        ".store-address",
        ".address",
        "[itemprop='address']",
        "dl dt:has-text('住所') + dd",
        "table tr:has-text('住所') td",
      ];
      
      for (const selector of addressSelectors) {
        try {
          const addressElement = page.locator(selector).first();
          if (await addressElement.isVisible({ timeout: 500 }).catch(() => false)) {
            const addressText = await addressElement.innerText();
            if (addressText && addressText.trim().length > 0) {
              result.address = addressText
                .replace(/\n/g, " ")
                .replace(/\r/g, "")
                .replace(/\t/g, " ")
                .replace(/\s+/g, " ")
                .trim();
              break;
            }
          }
        } catch {
          continue;
        }
      }
    } catch (error) {
      console.warn("Failed to get address:", error);
    }

    // カテゴリを取得
    try {
      const categorySelectors = [
        ".shop-genre",
        ".store-genre",
        ".genre",
        "[itemprop='servesCuisine']",
        "dl dt:has-text('ジャンル') + dd",
        "table tr:has-text('ジャンル') td",
      ];
      
      for (const selector of categorySelectors) {
        try {
          const categoryElement = page.locator(selector).first();
          if (await categoryElement.isVisible({ timeout: 500 }).catch(() => false)) {
            const categoryText = await categoryElement.textContent();
            if (categoryText) {
              result.category = categoryText.trim();
              break;
            }
          }
        } catch {
          continue;
        }
      }
    } catch (error) {
      console.warn("Failed to get category:", error);
    }

    // 電話番号を取得
    try {
      const phoneSelectors = [
        ".shop-tel",
        ".store-tel",
        ".tel",
        "[itemprop='telephone']",
        "dl dt:has-text('電話番号') + dd",
        "table tr:has-text('電話番号') td",
      ];
      
      for (const selector of phoneSelectors) {
        try {
          const phoneElement = page.locator(selector).first();
          if (await phoneElement.isVisible({ timeout: 500 }).catch(() => false)) {
            const phoneText = await phoneElement.textContent();
            if (phoneText) {
              // 電話番号パターンを抽出
              const phonePattern = /0\d{1,4}[-\s(]?\d{1,4}[-\s)]?\d{4}/;
              const match = phoneText.match(phonePattern);
              if (match) {
                result.phone = match[0].replace(/[\s()]/g, "").replace(/(\d{2,4})(\d{4})(\d{4})/, "$1-$2-$3");
                break;
              }
            }
          }
        } catch {
          continue;
        }
      }
    } catch (error) {
      console.warn("Failed to get phone:", error);
    }

    // 営業時間を取得
    try {
      const businessHoursSelectors = [
        ".shop-hours",
        ".store-hours",
        ".hours",
        "[itemprop='openingHours']",
        "dl dt:has-text('営業時間') + dd",
        "table tr:has-text('営業時間') td",
      ];
      
      for (const selector of businessHoursSelectors) {
        try {
          const hoursElement = page.locator(selector).first();
          if (await hoursElement.isVisible({ timeout: 500 }).catch(() => false)) {
            const hoursText = await hoursElement.textContent();
            if (hoursText) {
              result.business_hours = hoursText.trim();
              break;
            }
          }
        } catch {
          continue;
        }
      }
    } catch (error) {
      console.warn("Failed to get business hours:", error);
    }

    // 定休日を取得
    try {
      const holidaySelectors = [
        ".shop-holiday",
        ".store-holiday",
        ".holiday",
        "dl dt:has-text('定休日') + dd",
        "table tr:has-text('定休日') td",
      ];
      
      for (const selector of holidaySelectors) {
        try {
          const holidayElement = page.locator(selector).first();
          if (await holidayElement.isVisible({ timeout: 500 }).catch(() => false)) {
            const holidayText = await holidayElement.textContent();
            if (holidayText) {
              result.regular_holiday = holidayText.trim();
              break;
            }
          }
        } catch {
          continue;
        }
      }
    } catch (error) {
      console.warn("Failed to get regular holiday:", error);
    }

    // 交通手段を取得
    try {
      const transportSelectors = [
        ".shop-access",
        ".store-access",
        ".access",
        "dl dt:has-text('アクセス') + dd",
        "dl dt:has-text('交通手段') + dd",
        "table tr:has-text('アクセス') td",
        "table tr:has-text('交通手段') td",
      ];
      
      for (const selector of transportSelectors) {
        try {
          const transportElement = page.locator(selector).first();
          if (await transportElement.isVisible({ timeout: 500 }).catch(() => false)) {
            const transportText = await transportElement.textContent();
            if (transportText) {
              result.transport = transportText.trim();
              break;
            }
          }
        } catch {
          continue;
        }
      }
    } catch (error) {
      console.warn("Failed to get transport:", error);
    }

    // 公式サイトを取得
    try {
      const websiteSelectors = [
        "a:has-text('公式サイト')",
        "a:has-text('ホームページ')",
        "a:has-text('公式HP')",
        "[itemprop='url']",
      ];
      
      for (const selector of websiteSelectors) {
        try {
          const websiteElement = page.locator(selector).first();
          if (await websiteElement.isVisible({ timeout: 500 }).catch(() => false)) {
            const href = await websiteElement.getAttribute("href");
            if (href) {
              try {
                const urlObj = new URL(href, url);
                result.website = urlObj.href;
                break;
              } catch {
                result.website = href;
                break;
              }
            }
          }
        } catch {
          continue;
        }
      }
    } catch (error) {
      console.warn("Failed to get website:", error);
    }

    // フランチャイズ判定
    try {
      let isFranchise = false;

      // 方法1: 店舗名にフランチャイズを示唆するキーワードが含まれているか
      if (result.name) {
        const name = result.name;
        const franchiseKeywordPattern = /(支店|号店|チェーン)/;
        const headStoreExcludePattern = /本店/;

        if (franchiseKeywordPattern.test(name) && !headStoreExcludePattern.test(name)) {
          isFranchise = true;
        } else {
          const branchPattern = /\s+[^\s]+店$/;
          if (branchPattern.test(name)) {
            isFranchise = true;
          } else {
            const storePattern = /店$/;
            const headStoreOnlyPattern = /^[^店]*本店$/;
            
            if (storePattern.test(name) && !headStoreOnlyPattern.test(name)) {
              isFranchise = true;
            }
          }
        }
      }

      result.is_franchise = isFranchise;
    } catch (error) {
      console.warn("Failed to detect franchise:", error);
      result.is_franchise = false;
    }

    // テイクアウト可否を取得
    try {
      let takeoutAvailable = false;

      // 方法1: ページ内のテキストから判定
      const pageText = await page.textContent("body");
      if (pageText) {
        const takeoutKeywords = [
          "テイクアウト",
          "テークアウト",
          "takeout",
          "take-out",
          "持ち帰り",
          "お持ち帰り",
        ];
        const takeoutPattern = new RegExp(takeoutKeywords.join("|"), "i");
        if (takeoutPattern.test(pageText)) {
          takeoutAvailable = true;
        }
      }

      // 方法2: 特定のセレクタから判定
      if (!takeoutAvailable) {
        const takeoutSelectors = [
          ':has-text("テイクアウト")',
          ':has-text("テークアウト")',
          ':has-text("持ち帰り")',
          '[class*="takeout"]',
          '[class*="take-out"]',
        ];

        for (const selector of takeoutSelectors) {
          try {
            const element = page.locator(selector).first();
            if (await element.isVisible({ timeout: 500 }).catch(() => false)) {
              takeoutAvailable = true;
              break;
            }
          } catch {
            continue;
          }
        }
      }

      result.takeout_available = takeoutAvailable;
    } catch (error) {
      console.warn("Failed to detect takeout availability:", error);
      result.takeout_available = false;
    }

    // デリバリー可否を取得
    try {
      let deliveryAvailable = false;
      const deliveryServices: string[] = [];

      // 方法1: ページ内のテキストから判定
      const pageText = await page.textContent("body");
      if (pageText) {
        const deliveryKeywords = [
          "ubereats", "Uber Eats", "ウーバーイーツ",
          "出前館", "demaecan", "demae-can",
          "楽天デリバリー", "楽天デリ",
          "デリバリー", "delivery",
          "menu", "メニュー",
        ];
        const deliveryPattern = new RegExp(deliveryKeywords.join("|"), "i");
        if (deliveryPattern.test(pageText)) {
          deliveryAvailable = true;
          
          // どのサービスかを特定
          if (/ubereats|Uber Eats|ウーバーイーツ/i.test(pageText)) {
            deliveryServices.push("Uber Eats");
          }
          if (/出前館|demaecan|demae-can/i.test(pageText)) {
            deliveryServices.push("出前館");
          }
          if (/楽天デリバリー|楽天デリ/i.test(pageText)) {
            deliveryServices.push("楽天デリバリー");
          }
        }
      }

      // 方法2: 特定のセレクタから判定
      if (!deliveryAvailable) {
        const deliverySelectors = [
          ':has-text("Uber Eats")',
          ':has-text("ウーバーイーツ")',
          ':has-text("出前館")',
          ':has-text("楽天デリバリー")',
          ':has-text("デリバリー")',
          '[class*="delivery"]',
          '[class*="ubereats"]',
          '[href*="ubereats"]',
          '[href*="demaecan"]',
          '[href*="demae-can"]',
        ];

        for (const selector of deliverySelectors) {
          try {
            const element = page.locator(selector).first();
            if (await element.isVisible({ timeout: 500 }).catch(() => false)) {
              deliveryAvailable = true;
              
              // リンクからサービス名を取得
              const href = await element.getAttribute("href").catch(() => null);
              if (href) {
                if (href.includes("ubereats")) {
                  deliveryServices.push("Uber Eats");
                } else if (href.includes("demaecan") || href.includes("demae-can")) {
                  deliveryServices.push("出前館");
                } else if (href.includes("rakuten") || href.includes("楽天")) {
                  deliveryServices.push("楽天デリバリー");
                }
              }
              break;
            }
          } catch {
            continue;
          }
        }
      }

      // 方法3: リンクから判定
      if (!deliveryAvailable) {
        const deliveryLinks = await page.locator('a[href*="ubereats"], a[href*="demaecan"], a[href*="demae-can"], a[href*="menu"]').all();
        if (deliveryLinks.length > 0) {
          deliveryAvailable = true;
          for (const link of deliveryLinks) {
            try {
              const href = await link.getAttribute("href");
              if (href) {
                if (href.includes("ubereats")) {
                  deliveryServices.push("Uber Eats");
                } else if (href.includes("demaecan") || href.includes("demae-can")) {
                  deliveryServices.push("出前館");
                } else if (href.includes("rakuten") || href.includes("楽天")) {
                  deliveryServices.push("楽天デリバリー");
                }
              }
            } catch {
              continue;
            }
          }
        }
      }

      result.delivery_available = deliveryAvailable;
      result.delivery_services = deliveryServices.length > 0 ? deliveryServices : undefined;
    } catch (error) {
      console.warn("Failed to detect delivery availability:", error);
      result.delivery_available = false;
    }

    await context.close();
    return result;
  } catch (error) {
    console.error("Scraping error:", error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * UberEatsの店舗詳細ページから情報を取得
 * ネットワークリクエストを傍受してAPIレスポンスから直接データを取得
 * 
 * @param url UberEatsの店舗URL
 * @returns スクレイピング結果
 */
export async function scrapeUbereatsStore(url: string): Promise<ScrapingResult> {
  let browser: Browser | null = null;

  try {
    // ランダムなUser-Agentを生成（人間らしさを演出）
    const userAgents = [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
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
      // 追加のヘッダーで人間らしさを演出
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

    // CAPTCHA検知用のキーワード
    const captchaKeywords = ['captcha', 'ロボット', 'robot', 'ブロック', 'block', 'verify', 'verification', 'challenge'];

    // CAPTCHA検知処理
    page.on('response', async (response) => {
      try {
        const url = response.url();
        const status = response.status();
        
        // ブロックページやCAPTCHAページの可能性があるステータスコード
        if (status === 403 || status === 429) {
          console.warn(`⚠️ アクセスブロックの可能性: ${url} (Status: ${status})`);
        }
      } catch (e) {
        // エラーは無視
      }
    });

    // ページの内容を定期的にチェックしてCAPTCHAを検知
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

    // ネットワークリクエストを傍受してAPIレスポンスをキャプチャ
    let capturedData: any = null;
    const apiPatterns = [
      /\/api\/getFeedV1/i,
      /\/api\/stores/i,
      /graphql/i,
      /\/api\/v1\/stores/i,
      /\/api\/store/i,
    ];

    // レスポンスを傍受（厳格なフィルタリング）
    page.on('response', async (response) => {
      const url = response.url();
      const resourceType = response.request().resourceType();
      
      // 厳格なフィルタリング: XHR/Fetchリクエストのみ処理
      if (resourceType !== 'fetch' && resourceType !== 'xhr') {
        return;
      }
      
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
        
        // 店舗データが含まれているか確認
        if (jsonData && (jsonData.data || jsonData.store || jsonData.feed || jsonData.stores)) {
          capturedData = jsonData;
          console.log(`✅ APIレスポンスをキャプチャ: ${url}`);
        }
      } catch (e) {
        // JSONパースエラーは無視
      }
    });

    // ページにアクセス
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
    
    // 404エラーチェック
    if (response && response.status() === 404) {
      throw new Error(`Page not found (404): ${url}`);
    }

    // ランダムな待機時間（3〜7秒）
    const randomWait = Math.floor(Math.random() * 4000) + 3000;
    await page.waitForTimeout(randomWait);

    // 店舗カードや主要な要素が表示されるまで待機
    const selectors = [
      '[data-testid*="store"]',
      '.store-header',
      'h1',
      '[class*="store"]',
      '[class*="restaurant"]',
    ];

    let elementFound = false;
    for (const selector of selectors) {
      try {
        await page.waitForSelector(selector, { timeout: 10000, state: 'visible' });
        elementFound = true;
        break;
      } catch (e) {
        // 次のセレクタを試す
        continue;
      }
    }

    if (!elementFound) {
      console.warn("主要な要素が見つかりませんでしたが、続行します");
    }

    // 追加のランダム待機
    const additionalWait = Math.floor(Math.random() * 2000) + 1000;
    await page.waitForTimeout(additionalWait);

    // CAPTCHAチェック（ページ読み込み後）
    await checkForCaptcha();

    // スクロールしてコンテンツを読み込む（人間らしい動作）
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 3);
    });
    await page.waitForTimeout(1000);
    
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await page.waitForTimeout(1000);

    // スクロール処理完了後、全てのネットワーク処理が完了するまで待機（競合対策）
    console.log("⏳ ネットワーク処理の完了を待機中...");
    await page.waitForTimeout(5000);

    // 再度CAPTCHAチェック
    await checkForCaptcha();

    // キャプチャされたデータを確認、なければ__NEXT_DATA__をフォールバック
    let storeData: any = null;

    if (capturedData) {
      // APIレスポンスから店舗データを抽出
      storeData = capturedData.data?.store || 
                  capturedData.store || 
                  capturedData.feed?.stores?.[0] ||
                  capturedData.stores?.[0] ||
                  capturedData;
    }

    // フォールバック: __NEXT_DATA__を試行
    if (!storeData) {
      try {
        const nextDataScript = page.locator('script#__NEXT_DATA__').first();
        const scriptContent = await nextDataScript.textContent({ timeout: 5000 });
        
        if (scriptContent) {
          const nextData = JSON.parse(scriptContent);
          storeData = extractStoreDataFromNextData(nextData);
        }
      } catch (e) {
        console.warn("__NEXT_DATA__の取得に失敗しました");
      }
    }

    // それでもデータが取得できない場合は、DOMから直接抽出を試行
    if (!storeData) {
      try {
        // DOMから直接データを抽出
        const domData = await page.evaluate(() => {
          const data: any = {};
          
          // 店舗名
          const nameEl = document.querySelector('h1') || 
                         document.querySelector('[data-testid*="store-name"]') ||
                         document.querySelector('[class*="store-name"]');
          if (nameEl) data.name = nameEl.textContent?.trim();
          
          // 住所
          const addressEl = document.querySelector('[data-testid*="address"]') ||
                           document.querySelector('[class*="address"]');
          if (addressEl) data.address = addressEl.textContent?.trim();
          
          return data;
        });
        
        if (domData && domData.name) {
          storeData = domData;
        }
      } catch (e) {
        console.warn("DOMからのデータ抽出に失敗しました");
      }
    }

    if (!storeData) {
      throw new Error("店舗データが見つかりませんでした（APIレスポンス、__NEXT_DATA__、DOMのいずれからも取得できませんでした）");
    }

    // 必須項目のチェック
    const name = storeData.title || storeData.name || storeData.displayName || null;

    if (!name) {
      throw new Error("店舗名が取得できませんでした（必須項目）");
    }

    // 多層的なアプローチで住所を取得（優先度順）
    let address: string | null = null;
    const addressExtractionMethods = [
      { name: 'JSON-LD (構造化データ)', func: () => extractAddressFromJsonLd(page) },
      { name: 'メタタグ', func: () => extractAddressFromMetaTags(page) },
      { name: 'JavaScript変数', func: () => extractAddressFromJavaScriptVars(page) },
      { name: 'DOM抽出', func: () => extractAddressFromDOM(page) },
      { name: 'storeDataオブジェクト', func: () => Promise.resolve(extractUbereatsAddress(storeData)) },
    ];

    console.log("🔍 住所抽出を試行中...");
    for (const method of addressExtractionMethods) {
      try {
        const extractedAddress = await method.func();
        if (extractedAddress && extractedAddress.trim().length > 0) {
          address = extractedAddress.trim();
          console.log(`  ✅ 住所を取得: ${method.name} - ${address.substring(0, 50)}...`);
          break;
        }
      } catch (e) {
        console.warn(`  ⚠️ ${method.name}での住所抽出に失敗:`, e);
        continue;
      }
    }

    // 住所をクリーニング
    address = cleanAddress(address);

    // 住所が取得できなかった場合のデバッグ情報
    if (!address) {
      console.error("❌ 住所が取得できませんでした。デバッグ情報を出力します...");
      
      try {
        // ページのHTMLの一部を取得
        const pageHtml = await page.evaluate(() => {
          return document.body.innerHTML.substring(0, 500);
        });
        console.error("📄 ページHTML（先頭500文字）:", pageHtml);
        
        // storeDataの状態を確認
        console.error("📊 storeDataの状態:", JSON.stringify(storeData, null, 2).substring(0, 500));
        
        // ページのタイトルとURLを確認
        const pageTitle = await page.title().catch(() => '取得失敗');
        const pageUrl = page.url();
        console.error("🌐 ページ情報:", { title: pageTitle, url: pageUrl });
        
        // JSON-LDスクリプトの存在確認
        const jsonLdCount = await page.locator('script[type="application/ld+json"]').count().catch(() => 0);
        console.error("📋 JSON-LDスクリプト数:", jsonLdCount);
        
        // メタタグの確認
        const metaDescription = await page.locator('meta[name="description"], meta[property="og:description"]').first().getAttribute('content').catch(() => null);
        console.error("📝 メタタグdescription:", metaDescription);
        
        // DOM内の住所関連要素の確認
        const addressElements = await page.evaluate(() => {
          const elements = Array.from(document.querySelectorAll('*')).filter((el: any) => {
            const text = el.textContent || '';
            return (text.includes('住所') || text.includes('所在地') || text.includes('Address')) && text.length < 200;
          });
          return elements.slice(0, 5).map((el: any) => ({
            tag: el.tagName,
            text: el.textContent?.substring(0, 100),
            className: el.className,
          }));
        }).catch(() => []);
        console.error("🏷️ 住所関連要素:", addressElements);
        
      } catch (debugError) {
        console.error("デバッグ情報の取得に失敗:", debugError);
      }
      
      throw new Error("住所が取得できませんでした（全ての抽出方法を試行しましたが失敗）");
    }

    // データ抽出
    const categories = extractUbereatsCategories(storeData);
    const location = extractUbereatsLocation(storeData);
    const brandInfo = extractUbereatsBrandInfo(storeData);
    const priceRange = convertUbereatsPriceRange(storeData.priceRange || storeData.price);
    const businessHours = formatUbereatsBusinessHours(
      storeData.hours || 
      storeData.businessHours || 
      storeData.openingHours
    );

    // 評価情報
    let rating: number | undefined = undefined;
    let ratingCount: number | undefined = undefined;
    
    if (storeData.rating) {
      rating = typeof storeData.rating === 'number' 
        ? storeData.rating 
        : parseFloat(storeData.rating);
    }
    if (storeData.ratingCount || storeData.reviewCount) {
      ratingCount = storeData.ratingCount || storeData.reviewCount;
    }

    // 基本情報を取得
    const result: ScrapingResult = {
      url: url,
      name: name,
      address: address, // 純粋な住所文字列のみ（座標は含まない、クリーニング済み）
      category: categories.length > 0 ? categories.join(', ') : undefined,
      phone: storeData.phone || storeData.phoneNumber || storeData.contactPhone || null,
      budget: priceRange || undefined,
      business_hours: businessHours || undefined,
      transport: undefined, // UberEatsの場合は交通手段は常にundefined（駅からの徒歩分数は取得困難）
      related_stores: brandInfo || undefined,
      latitude: location.latitude || undefined,
      longitude: location.longitude || undefined,
      rating: rating,
      rating_count: ratingCount,
    };
    
    // 交通手段がnullであることを確認（ログ出力）
    console.log(`[Transport] Store: ${name} -> transport: ${result.transport === null ? 'null (correct)' : result.transport}`);

    // UberEats固有のデータをubereatsオブジェクトとして保存
    // leadsテーブルのdata (JSONB)カラム内に保存される構造
    result.ubereats = {
      name: name,
      url: url,
      address: address,
      latitude: location.latitude || null,
      longitude: location.longitude || null,
      rating: rating || null,
      review_count: ratingCount || null,
      price_range: priceRange || null,
      categories: categories.length > 0 ? categories.join(', ') : null,
      brand_name: brandInfo || null,
      transport: "", // UberEatsの場合は交通手段は常に空文字列
      business_hours: businessHours || null,
    };

    await context.close();
    return result;
  } catch (error) {
    console.error("Scraping error:", error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Google Mapsの店舗詳細ページからテイクアウト可否とデリバリー可否を取得
 * 
 * @param url Google Mapsの店舗URL
 * @returns スクレイピング結果（テイクアウト可否とデリバリー可否のみ）
 */
export async function scrapeGoogleMapsPlace(url: string): Promise<ScrapingResult> {
  let browser: Browser | null = null;

  try {
    // ブラウザを起動
    browser = await chromium.launch({
      headless: true,
    });

    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });

    const page = await context.newPage();

    // ページにアクセス
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

    // 基本情報を取得
    const result: ScrapingResult = {
      url: url,
    };

    // ページが完全に読み込まれるまで待機
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(3000);

    // テイクアウト可否を取得
    try {
      let takeoutAvailable = false;

      // 方法1: ページ内のテキストから判定
      const pageText = await page.textContent("body");
      if (pageText) {
        const takeoutKeywords = [
          "テイクアウト",
          "テークアウト",
          "takeout",
          "take-out",
          "take out",
          "持ち帰り",
          "お持ち帰り",
          "テイクアウト可",
          "テイクアウト対応",
        ];
        const takeoutPattern = new RegExp(takeoutKeywords.join("|"), "i");
        if (takeoutPattern.test(pageText)) {
          takeoutAvailable = true;
        }
      }

      // 方法2: 特定のセレクタから判定
      if (!takeoutAvailable) {
        const takeoutSelectors = [
          ':has-text("テイクアウト")',
          ':has-text("テークアウト")',
          ':has-text("持ち帰り")',
          '[class*="takeout"]',
          '[class*="take-out"]',
          '[aria-label*="takeout"]',
          '[aria-label*="テイクアウト"]',
        ];

        for (const selector of takeoutSelectors) {
          try {
            const element = page.locator(selector).first();
            if (await element.isVisible({ timeout: 500 }).catch(() => false)) {
              takeoutAvailable = true;
              break;
            }
          } catch {
            continue;
          }
        }
      }

      result.takeout_available = takeoutAvailable;
    } catch (error) {
      console.warn("Failed to detect takeout availability from Google Maps:", error);
      result.takeout_available = false;
    }

    // デリバリー可否を取得
    try {
      let deliveryAvailable = false;
      const deliveryServices: string[] = [];

      // 方法1: ページ内のテキストから判定
      const pageText = await page.textContent("body");
      if (pageText) {
        const deliveryKeywords = [
          "ubereats", "Uber Eats", "ウーバーイーツ",
          "出前館", "demaecan", "demae-can",
          "楽天デリバリー", "楽天デリ",
          "デリバリー", "delivery",
          "menu", "メニュー",
          "デリバリー可",
          "デリバリー対応",
        ];
        const deliveryPattern = new RegExp(deliveryKeywords.join("|"), "i");
        if (deliveryPattern.test(pageText)) {
          deliveryAvailable = true;
          
          // どのサービスかを特定
          if (/ubereats|Uber Eats|ウーバーイーツ/i.test(pageText)) {
            deliveryServices.push("Uber Eats");
          }
          if (/出前館|demaecan|demae-can/i.test(pageText)) {
            deliveryServices.push("出前館");
          }
          if (/楽天デリバリー|楽天デリ/i.test(pageText)) {
            deliveryServices.push("楽天デリバリー");
          }
        }
      }

      // 方法2: 特定のセレクタから判定
      if (!deliveryAvailable) {
        const deliverySelectors = [
          ':has-text("Uber Eats")',
          ':has-text("ウーバーイーツ")',
          ':has-text("出前館")',
          ':has-text("楽天デリバリー")',
          ':has-text("デリバリー")',
          '[class*="delivery"]',
          '[class*="ubereats"]',
          '[href*="ubereats"]',
          '[href*="demaecan"]',
          '[href*="demae-can"]',
          '[aria-label*="delivery"]',
          '[aria-label*="デリバリー"]',
        ];

        for (const selector of deliverySelectors) {
          try {
            const element = page.locator(selector).first();
            if (await element.isVisible({ timeout: 500 }).catch(() => false)) {
              deliveryAvailable = true;
              
              // リンクからサービス名を取得
              const href = await element.getAttribute("href").catch(() => null);
              if (href) {
                if (href.includes("ubereats")) {
                  deliveryServices.push("Uber Eats");
                } else if (href.includes("demaecan") || href.includes("demae-can")) {
                  deliveryServices.push("出前館");
                } else if (href.includes("rakuten") || href.includes("楽天")) {
                  deliveryServices.push("楽天デリバリー");
                }
              }
              break;
            }
          } catch {
            continue;
          }
        }
      }

      // 方法3: リンクから判定
      if (!deliveryAvailable) {
        const deliveryLinks = await page.locator('a[href*="ubereats"], a[href*="demaecan"], a[href*="demae-can"], a[href*="menu"]').all();
        if (deliveryLinks.length > 0) {
          deliveryAvailable = true;
          for (const link of deliveryLinks) {
            try {
              const href = await link.getAttribute("href");
              if (href) {
                if (href.includes("ubereats")) {
                  deliveryServices.push("Uber Eats");
                } else if (href.includes("demaecan") || href.includes("demae-can")) {
                  deliveryServices.push("出前館");
                } else if (href.includes("rakuten") || href.includes("楽天")) {
                  deliveryServices.push("楽天デリバリー");
                }
              }
            } catch {
              continue;
            }
          }
        }
      }

      result.delivery_available = deliveryAvailable;
      result.delivery_services = deliveryServices.length > 0 ? deliveryServices : undefined;
    } catch (error) {
      console.warn("Failed to detect delivery availability from Google Maps:", error);
      result.delivery_available = false;
    }

    await context.close();
    return result;
  } catch (error) {
    console.error("Google Maps scraping error:", error);
    // エラーが発生しても空の結果を返す（Apifyのデータは保持される）
    return {
      url: url,
      takeout_available: false,
      delivery_available: false,
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
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

/**
 * 汎用スクレイピング関数
 * URLからドメインを判定し、適切なスクレイピング関数を呼び出す
 * 
 * @param url スクレイピング対象のURL
 * @returns スクレイピング結果
 */
export async function scrapeUrl(url: string): Promise<ScrapingResult> {
  const urlObj = new URL(url);
  const hostname = urlObj.hostname;

  // 食べログの場合
  if (hostname.includes("tabelog.com")) {
    return await scrapeTabelogStore(url);
  }

  // UberEatsの場合
  if (hostname.includes("ubereats.com")) {
    // URLを正規化してからスクレイピング
    const normalizedUrl = normalizeUbereatsUrl(url);
    return await scrapeUbereatsStore(normalizedUrl);
  }

  // グルナビの場合
  if (hostname.includes("gnavi.co.jp") || hostname.includes("r.gnavi.co.jp")) {
    return await scrapeGnaviStore(url);
  }

  // その他のサイトの場合（汎用スクレイピング）
  // 将来的に実装
  throw new Error(`Unsupported domain: ${hostname}`);
}

