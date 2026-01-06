// src/features/scraper/worker.ts
//
// 食べログの店舗詳細ページをスクレイピングするワーカー（雛形）
// Playwright などのブラウザオートメーションライブラリと組み合わせて使用することを想定しています。

import type { Page } from "playwright";

export interface ScrapedStore {
  name: string;
  url: string;
  isFranchise: boolean;
  // 必要に応じて他のフィールドを追加
}

/**
 * 食べログ店舗ページをスクレイピングし、店舗情報を返す
 */
export async function scrapeTabelogStore(page: Page): Promise<ScrapedStore> {
  const url = page.url();

  // 店名取得
  const name =
    (await page
      .locator(".rstinfo-table__name-wrap")
      .first()
      .innerText()
      .catch(() => "")) || "";

  // --- 修正後のフランチャイズ判定ロジック ---

  // 1. ページ内のリンク判定（既存想定）
  const relatedStoresLink = page
    .locator('a:has-text("このお店の系列店"), a:has-text("系列店")')
    .first();
  const hasRelatedStoresLink = (await relatedStoresLink.count()) > 0;

  // 2. 店名によるキーワード判定（新規追加）
  // "支店", "号店", "チェーン" など、または「〜店」で終わる場合はフランチャイズ候補
  let hasFranchiseKeyword = false;
  if (!name.includes("本店")) {
    if (/支店|号店|チェーン/.test(name)) {
      hasFranchiseKeyword = true;
    } else if (name.endsWith("店")) {
      hasFranchiseKeyword = true;
    }
  }

  // 最終判定: どちらかが true ならフランチャイズとする
  const isFranchise = hasRelatedStoresLink || hasFranchiseKeyword;

  return {
    name,
    url,
    isFranchise,
  };
}


