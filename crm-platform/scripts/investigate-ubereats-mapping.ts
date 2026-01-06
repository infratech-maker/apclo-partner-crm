import { config } from "dotenv";
import { resolve } from "path";

// 環境変数の読み込み (.env.local)
config({ path: resolve(__dirname, "../.env.local") });

import { chromium, Browser } from "playwright";

/**
 * UberEatsの__NEXT_DATA__から店舗情報を抽出し、既存カラムへのマッピングを調査
 */

interface UberEatsStoreData {
  // 元のUberEatsデータ構造
  raw: any;
  
  // 抽出された値
  extracted: {
    title?: string;
    address?: string;
    categories?: string[];
    phoneNumber?: string;
    priceRange?: string;
    rating?: number;
    location?: {
      latitude?: number;
      longitude?: number;
    };
    hours?: any;
  };
  
  // 既存カラムへのマッピング結果
  mapped: {
    name?: string;                    // 店舗名
    address?: string;                 // 住所・アクセス
    category?: string;                // カテゴリ
    phone?: string;                   // 電話番号
    budget?: string;                  // 予算
    rating?: number;                  // 評価（追加フィールド）
    latitude?: number;                // 緯度（追加フィールド）
    longitude?: number;               // 経度（追加フィールド）
    business_hours?: string;          // 営業時間
    transport?: string;               // 交通手段
    open_date?: string;               // オープン日（不明項目）
    related_stores?: string;          // 関連店舗（不明項目）
  };
}

/**
 * __NEXT_DATA__から店舗情報を抽出（複数のパスを試行）
 */
function extractStoreDataFromNextData(nextData: any): any {
  const possiblePaths = [
    // パス1: props.pageProps.store
    nextData?.props?.pageProps?.store,
    // パス2: props.pageProps.initialState.store
    nextData?.props?.pageProps?.initialState?.store,
    // パス3: props.pageProps.storeData
    nextData?.props?.pageProps?.storeData,
    // パス4: store
    nextData?.store,
    // パス5: props.pageProps.data.store
    nextData?.props?.pageProps?.data?.store,
    // パス6: query.store
    nextData?.query?.store,
  ];

  // 最初に見つかった有効なパスを返す
  for (const path of possiblePaths) {
    if (path && typeof path === 'object') {
      return path;
    }
  }

  return null;
}

/**
 * 住所情報を抽出
 */
function extractAddress(storeData: any): string | null {
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
function extractCategories(storeData: any): string[] {
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
 * 予算を変換（$マーク数などを日本円レンジに変換）
 */
function convertPriceRange(priceRange: string | number | null | undefined): string | null {
  if (!priceRange) return "";

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

    return "";
  }

  // 数値の場合
  if (typeof priceRange === 'number') {
    if (priceRange === 1) return '〜￥1,000';
    if (priceRange === 2) return '￥1,000〜￥2,000';
    if (priceRange === 3) return '￥2,000〜￥3,000';
    if (priceRange >= 4) return '￥3,000〜';
    return "";
  }

  return "";
}

/**
 * 営業時間を整形（曜日別の構造化データをテキスト形式に変換）
 */
function formatBusinessHours(hours: any): string | null {
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
 * 緯度・経度を抽出
 */
function extractLocation(storeData: any): { latitude?: number; longitude?: number } {
  const location = storeData?.location || storeData?.address;

  return {
    latitude: location?.latitude || storeData?.latitude || undefined,
    longitude: location?.longitude || storeData?.longitude || undefined,
  };
}

/**
 * ブランド/チェーン情報を抽出
 */
function extractBrandInfo(storeData: any): string | null {
  // 探索パスの候補
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
 * UberEatsの店舗データを既存カラム構造にマッピング
 */
function mapToExistingColumns(storeData: any): UberEatsStoreData['mapped'] {
  const mapped: UberEatsStoreData['mapped'] = {};

  // 1. 店舗名 (name)
  mapped.name = storeData?.title || storeData?.name || storeData?.displayName || null;

  // 2. 住所・アクセス (address) - 純粋な住所文字列のみ（座標は分離）
  const address = extractAddress(storeData);
  if (address) {
    mapped.address = address; // 座標情報は結合しない
  }

  // 3. カテゴリ (category) - 配列をカンマ区切り文字列に変換
  const categories = extractCategories(storeData);
  if (categories.length > 0) {
    mapped.category = categories.join(', ');
  }

  // 4. 電話番号 (phone)
  mapped.phone = storeData?.phone || storeData?.phoneNumber || storeData?.contactPhone || null;

  // 5. 予算 (budget) - $マーク数を日本円レンジに変換
  mapped.budget = convertPriceRange(storeData?.priceRange || storeData?.price) || undefined;

  // 6. 評価 (rating) - 追加フィールド
  if (storeData?.rating) {
    mapped.rating = typeof storeData.rating === 'number' 
      ? storeData.rating 
      : parseFloat(storeData.rating);
  }

  // 7. 緯度・経度 (latitude, longitude) - 追加フィールド（住所とは分離）
  const location = extractLocation(storeData);
  if (location.latitude) {
    mapped.latitude = location.latitude;
  }
  if (location.longitude) {
    mapped.longitude = location.longitude;
  }

  // 8. 営業時間 (business_hours) - 曜日別データをテキスト形式に整形
  mapped.business_hours = formatBusinessHours(
    storeData?.hours || 
    storeData?.businessHours || 
    storeData?.openingHours
  ) || undefined;

  // 9. 交通手段 (transport) - 固定文言
  mapped.transport = 'UberEatsデリバリー';

  // 10. オープン日 (open_date) - 不明項目（デフォルト: undefined）
  mapped.open_date = undefined;

  // 11. 関連店舗 (related_stores) - ブランド情報を探索
  const brandInfo = extractBrandInfo(storeData);
  mapped.related_stores = brandInfo || undefined;

  return mapped;
}

/**
 * 調査用スクリプトのメイン関数
 */
async function investigateUbereatsMapping(url: string) {
  let browser: Browser | null = null;

  try {
    console.log(`🔍 UberEatsのデータ構造を調査中: ${url}\n`);

    // ブラウザを起動
    browser = await chromium.launch({
      headless: true,
    });

    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      locale: "ja-JP",
    });

    const page = await context.newPage();

    // ページにアクセス
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    
    if (response && response.status() === 404) {
      throw new Error(`Page not found (404): ${url}`);
    }

    // ページが完全に読み込まれるまで待機
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // __NEXT_DATA__スクリプトタグからJSONデータを取得
    const nextDataScript = await page.locator('script#__NEXT_DATA__').first();
    const scriptContent = await nextDataScript.textContent();

    if (!scriptContent) {
      throw new Error("__NEXT_DATA__スクリプトタグが見つかりませんでした");
    }

    const nextData = JSON.parse(scriptContent);
    console.log("✅ __NEXT_DATA__を取得しました\n");

    // 店舗データを抽出
    const storeData = extractStoreDataFromNextData(nextData);

    if (!storeData) {
      console.error("❌ 店舗データが見つかりませんでした");
      console.log("\n📋 __NEXT_DATA__の構造:");
      console.log(JSON.stringify(nextData, null, 2).slice(0, 2000) + "...");
      return;
    }

    console.log("✅ 店舗データを抽出しました\n");

    // 抽出された値を表示
    const location = extractLocation(storeData);
    const extracted = {
      title: storeData?.title || storeData?.name || storeData?.displayName,
      address: extractAddress(storeData),
      latitude: location.latitude || null,
      longitude: location.longitude || null,
      categories: extractCategories(storeData),
      phoneNumber: storeData?.phone || storeData?.phoneNumber || storeData?.contactPhone,
      priceRange: storeData?.priceRange || storeData?.price,
      rating: storeData?.rating,
      hours: storeData?.hours || storeData?.businessHours || storeData?.openingHours,
      brand: extractBrandInfo(storeData),
    };

    // マッピング結果
    const mapped = mapToExistingColumns(storeData);

    // 結果を表示
    console.log("=".repeat(80));
    console.log("📊 抽出された値（UberEats側）");
    console.log("=".repeat(80));
    console.table(extracted);

    console.log("\n" + "=".repeat(80));
    console.log("📋 既存カラムへのマッピング結果");
    console.log("=".repeat(80));
    
    // マッピング結果を表示用に整形（座標情報を明示的に表示）
    const mappedForDisplay = {
      "店舗名 (name)": mapped.name || "-",
      "住所・アクセス (address)": mapped.address || "-",
      "緯度 (latitude)": mapped.latitude !== undefined ? mapped.latitude : "-",
      "経度 (longitude)": mapped.longitude !== undefined ? mapped.longitude : "-",
      "カテゴリ (category)": mapped.category || "-",
      "電話番号 (phone)": mapped.phone || "-",
      "予算 (budget)": mapped.budget || "-",
      "評価 (rating)": mapped.rating !== undefined ? mapped.rating : "-",
      "営業時間 (business_hours)": mapped.business_hours || "-",
      "交通手段 (transport)": mapped.transport || "-",
      "オープン日 (open_date)": mapped.open_date || "-",
      "関連店舗 (related_stores)": mapped.related_stores || "-",
    };
    
    console.table(mappedForDisplay);
    
    // 確認メッセージ
    console.log("\n" + "=".repeat(80));
    console.log("✅ マッピング確認ポイント");
    console.log("=".repeat(80));
    const confirmations = [
      {
        項目: "住所の分離",
        状態: mapped.address && !mapped.address.includes("緯度") ? "✅ OK（座標情報なし）" : "⚠️ 要確認",
        説明: "住所は純粋な文字列のみ（座標は別項目）",
      },
      {
        項目: "予算の変換",
        状態: mapped.budget && (mapped.budget.includes("￥") || mapped.budget === "") ? "✅ OK" : "⚠️ 要確認",
        説明: `予算: ${mapped.budget || "空文字"}`,
      },
      {
        項目: "関連店舗（ブランド）",
        状態: mapped.related_stores ? "✅ ブランド情報あり" : "ℹ️ ブランド情報なし",
        説明: mapped.related_stores ? `ブランド: ${mapped.related_stores}` : "デフォルト: null",
      },
      {
        項目: "座標情報",
        状態: (mapped.latitude && mapped.longitude) ? "✅ 座標あり" : "ℹ️ 座標なし",
        説明: mapped.latitude && mapped.longitude 
          ? `緯度: ${mapped.latitude}, 経度: ${mapped.longitude}` 
          : "座標情報は別項目として管理",
      },
    ];
    console.table(confirmations);

    // 詳細なJSONパス情報
    console.log("\n" + "=".repeat(80));
    console.log("🔍 JSONパス情報");
    console.log("=".repeat(80));
    
    const pathInfo = {
      "店舗名 (title)": [
        "storeData.title",
        "storeData.name",
        "storeData.displayName",
      ].filter(path => {
        const parts = path.split('.');
        let value = storeData;
        for (const part of parts.slice(1)) {
          value = value?.[part];
        }
        return value !== undefined;
      }),
      "住所 (address)": [
        "storeData.address.formattedAddress",
        "storeData.location.address.formattedAddress",
        "storeData.address.fullAddress",
      ].filter(path => {
        const parts = path.split('.');
        let value = storeData;
        for (const part of parts.slice(1)) {
          value = value?.[part];
        }
        return value !== undefined;
      }),
      "カテゴリ (categories)": [
        "storeData.categories",
        "storeData.cuisines",
        "storeData.tags",
      ].filter(path => {
        const parts = path.split('.');
        let value = storeData;
        for (const part of parts.slice(1)) {
          value = value?.[part];
        }
        return value !== undefined && (Array.isArray(value) ? value.length > 0 : true);
      }),
      "電話番号 (phoneNumber)": [
        "storeData.phone",
        "storeData.phoneNumber",
        "storeData.contactPhone",
      ].filter(path => {
        const parts = path.split('.');
        let value = storeData;
        for (const part of parts.slice(1)) {
          value = value?.[part];
        }
        return value !== undefined;
      }),
      "予算 (priceRange)": [
        "storeData.priceRange",
        "storeData.price",
      ].filter(path => {
        const parts = path.split('.');
        let value = storeData;
        for (const part of parts.slice(1)) {
          value = value?.[part];
        }
        return value !== undefined;
      }),
      "評価 (rating)": [
        "storeData.rating",
      ].filter(path => {
        const parts = path.split('.');
        let value = storeData;
        for (const part of parts.slice(1)) {
          value = value?.[part];
        }
        return value !== undefined;
      }),
      "緯度・経度 (location)": [
        "storeData.location.latitude/longitude",
        "storeData.address.latitude/longitude",
        "storeData.latitude/longitude",
      ].filter(() => {
        const loc = extractLocation(storeData);
        return loc.latitude !== undefined || loc.longitude !== undefined;
      }),
      "営業時間 (hours)": [
        "storeData.hours",
        "storeData.businessHours",
        "storeData.openingHours",
      ].filter(path => {
        const parts = path.split('.');
        let value = storeData;
        for (const part of parts.slice(1)) {
          value = value?.[part];
        }
        return value !== undefined;
      }),
      "ブランド/チェーン (brand)": [
        "storeData.brand.name",
        "storeData.parentBrand.name",
        "storeData.sectionName",
        "storeData.chainName",
      ].filter(path => {
        const parts = path.split('.');
        let value = storeData;
        for (const part of parts.slice(1)) {
          value = value?.[part];
        }
        return value !== undefined && (typeof value === 'string' ? value.length > 0 : true);
      }),
    };

    console.table(pathInfo);

    // 不明項目のリスト
    console.log("\n" + "=".repeat(80));
    console.log("⚠️ 不明項目（UberEats側で取得困難）");
    console.log("=".repeat(80));
    
    const unknownItems = [
      {
        項目: "オープン日 (open_date)",
        理由: "UberEatsのAPIには店舗のオープン日情報が含まれていない",
        デフォルト値: "null（空文字）",
        代替案: "店舗登録日時を取得できる場合は使用可能",
      },
      {
        項目: "関連店舗 (related_stores)",
        理由: "UberEatsは個別店舗単位で管理されているが、ブランド情報が存在する場合がある",
        デフォルト値: "null（ブランド情報がない場合）",
        代替案: "store.brand.name, store.parentBrand.name, store.sectionName などから抽出を試行",
      },
      {
        項目: "定休日 (regular_holiday)",
        理由: "営業時間データに含まれる可能性があるが、構造が不明確",
        デフォルト値: "営業時間データから推測可能な場合は抽出",
        代替案: "営業時間が空の曜日を定休日として扱う",
      },
    ];

    console.table(unknownItems);

    // 完全なstoreDataを表示（デバッグ用）
    console.log("\n" + "=".repeat(80));
    console.log("📦 完全なstoreData構造（最初の1000文字）");
    console.log("=".repeat(80));
    console.log(JSON.stringify(storeData, null, 2).slice(0, 1000) + "...\n");

    await context.close();
  } catch (error) {
    console.error("❌ エラーが発生しました:", error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// 実行
const url = process.argv[2];

if (!url) {
  console.log("📝 使用方法:");
  console.log("  npx tsx scripts/investigate-ubereats-mapping.ts <UberEats店舗URL>");
  console.log("");
  console.log("例:");
  console.log("  npx tsx scripts/investigate-ubereats-mapping.ts https://www.ubereats.com/jp/store/...");
  process.exit(1);
}

investigateUbereatsMapping(url)
  .then(() => {
    console.log("\n✅ 調査が完了しました");
    process.exit(0);
  })
  .catch((e) => {
    console.error("❌ 調査がエラーで終了しました:", e);
    process.exit(1);
  });

