import { config } from "dotenv";
import { resolve } from "path";

// .env.local から環境変数を読み込み
config({ path: resolve(__dirname, "../.env.local") });

import { db } from "../src/lib/db";
import { leads } from "../src/lib/db/schema";
import { sql } from "drizzle-orm";

async function main() {
  console.log("🔢 leads テーブルの総件数を集計中...");

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(leads);

  const total = Number(result[0]?.count ?? 0);

  console.log(`✅ 現在のリスト総件数: ${total} 件`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ 集計中にエラーが発生しました:", err);
    process.exit(1);
  });









