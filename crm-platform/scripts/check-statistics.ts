import { config } from "dotenv";
import { resolve } from "path";

// 環境変数の読み込み (.env.local)
config({ path: resolve(__dirname, "../.env.local") });

import { getLeadsStatistics } from "../src/features/scraper/leads-actions";

async function checkStatistics() {
  try {
    console.log("📊 統計情報を取得中...\n");
    
    const stats = await getLeadsStatistics();
    
    console.log("✅ 統計情報:");
    console.log(`  総店舗数: ${stats.totalStores}件`);
    console.log(`  電話番号取得率: ${stats.phoneAcquisitionRate}%`);
    console.log(`  ウェブサイト取得率: ${stats.websiteAcquisitionRate}%`);
    console.log(`  都市数: ${stats.cityCount}件`);
    console.log(`  補完完了店舗数: ${stats.completedStores}件`);
    
    console.log("\n✅ 統計情報の取得が完了しました");
  } catch (error) {
    console.error("❌ エラーが発生しました:", error);
    process.exit(1);
  }
}

checkStatistics()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("❌ スクリプトがエラーで終了しました:", e);
    process.exit(1);
  });



