import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../.env.local") });

import { db } from "../src/lib/db";
import { leads } from "../src/lib/db/schema";
import { withTenant } from "../src/lib/db/tenant-helper";
import { scrapeTabelogStore } from "../src/features/scraper/worker";
import { eq, sql, and, gt } from "drizzle-orm";

const DELAY_MS = 2000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function smartMerge(existingData: any, scrapedData: any): any {
  const merged: any = { ...existingData };
  const fields = [
    "name", "address", "category", "phone", "open_date", "regular_holiday",
    "transport", "business_hours", "budget", "website", "related_stores", "is_franchise", "access",
  ];
  for (const field of fields) {
    const newValue = scrapedData[field];
    if (newValue !== null && newValue !== undefined && newValue !== "") {
      merged[field] = newValue;
    }
  }
  return merged;
}

async function retryRecentLeads() {
  await withTenant(async (tenantId) => {
    console.log("🔍 直近1時間以内のリードで、詳細情報が欠損しているものを検索中...");
    
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);
    
    const incompleteLeads = await db
      .select({
        id: leads.id,
        source: leads.source,
        data: leads.data,
        updatedAt: leads.updatedAt,
      })
      .from(leads)
      .where(
        and(
          sql`${leads.source} LIKE '%tabelog.com%'`,
          sql`(
            (${leads.data}->>'phone' IS NULL OR ${leads.data}->>'phone' = '') OR
            (${leads.data}->>'budget' IS NULL OR ${leads.data}->>'budget' = '') OR
            (${leads.data}->>'business_hours' IS NULL OR ${leads.data}->>'business_hours' = '')
          )`,
          gt(leads.createdAt, oneHourAgo)
        )
      );

    console.log(`✅ 対象件数: ${incompleteLeads.length}件`);

    if (incompleteLeads.length === 0) {
      console.log("補完対象のリードがありません。");
      return;
    }

    let processed = 0;
    let updated = 0;
    let errors = 0;

    for (const lead of incompleteLeads) {
      processed++;
      try {
        console.log(`📡 [${processed}/${incompleteLeads.length}] 再取得中: ${lead.source}`);
        const result = await scrapeTabelogStore(lead.source);
        const existingData = lead.data || {};
        const mergedData = smartMerge(existingData, result);
        
        await db
          .update(leads)
          .set({
            data: mergedData,
            updatedAt: new Date(),
          })
          .where(eq(leads.id, lead.id));

        updated++;
        console.log(`  ✅ 更新完了`);
      } catch (error) {
        errors++;
        console.error(`  ❌ エラー:`, error);
      }
      await sleep(DELAY_MS);
    }

    console.log(`\n🎉 処理完了: 更新 ${updated}件, エラー ${errors}件`);
  });
}

retryRecentLeads()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
