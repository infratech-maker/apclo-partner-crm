// scripts/update-franchise-tags.ts
// 既存データに対してフランチャイズ判定を行い、タグ付けを更新するための雛形スクリプトです。
// 実際の永続化（DB 更新や CSV 出力など）は、プロジェクト側のデータ層に合わせて実装してください。

/* eslint-disable no-console */

import type { ScrapedStore } from "../src/features/scraper/worker";
// import { chromium } from "playwright"; // 実運用時に有効化
// import { scrapeTabelogStore } from "../src/features/scraper/worker";

// TODO: 実際の既存データ取得ロジックに置き換えてください
// 例: DB から URL 一覧を取得する、既存の JSON を読み込む、など
const existingStoreUrls: string[] = [
  // "https://tabelog.com/fukuoka/A4001/A400102/XXXXXXXX/",
];

async function updateFranchiseTags() {
  console.log("🚀 既存データのフランチャイズ判定を開始します");

  if (existingStoreUrls.length === 0) {
    console.warn(
      "ℹ️  existingStoreUrls が空です。実データの URL 一覧をこの配列に投入してください。"
    );
  }

  // 実運用時の雛形:
  // const browser = await chromium.launch();
  // const context = await browser.newContext();

  const updated: ScrapedStore[] = [];

  for (const url of existingStoreUrls) {
    console.log(`\n=== ${url} をチェック中 ===`);

    // TODO: 実プロジェクトでは Playwright でページを開いて scrapeTabelogStore を呼び出します
    // const page = await context.newPage();
    // await page.goto(url, { waitUntil: "networkidle" });
    // const store = await scrapeTabelogStore(page);

    // 雛形ではダミー結果のみ
    const store: ScrapedStore = {
      name: "ダミー店舗",
      url,
      isFranchise: false,
    };

    console.log(
      `  判定結果: name="${store.name}", isFranchise=${store.isFranchise}`
    );

    // TODO: ここで DB / ファイルに対して isFranchise タグを反映
    // 例: await prisma.store.update({ where: { url }, data: { isFranchise: store.isFranchise } });

    updated.push(store);
  }

  // if (browser) await browser.close();

  console.log("\n✅ フランチャイズタグの更新処理（雛形）が完了しました");
}

// 実行コンテキスト（Node）の型情報がない場合でもビルドできるように any で宣言
declare const require: any;
declare const module: any;
declare const process: any;

if (typeof require !== "undefined" && require.main === module) {
  updateFranchiseTags().catch((err) => {
    // eslint-disable-next-line no-console
    console.error("❌ フランチャイズタグ更新中にエラーが発生しました:", err);
    process.exit(1);
  });
}