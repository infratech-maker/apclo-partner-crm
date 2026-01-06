import { config } from "dotenv";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";
import Database from "better-sqlite3";

// 環境変数を読み込む
config({ path: resolve(__dirname, "../.env.local") });
config({ path: resolve(__dirname, "../.env") });

const prisma = new PrismaClient();

/**
 * SQLite3データベースから店舗データを取得してZenMapのleadsテーブルにインポート
 * 
 * 使用方法:
 *   tsx scripts/import-stores-from-sqlite.ts <sqlite_db_path> <tenantId> <organizationId>
 * 
 * 例:
 *   tsx scripts/import-stores-from-sqlite.ts /Users/a/名称未設定フォルダ/instance/restaurants_local.db ff424270-d1ee-4a72-9f57-984066600402 7f79c785-1f85-4ec1-88bb-67aff9d119fc
 */
async function importStoresFromSqlite(
  sqliteDbPath: string,
  tenantId: string,
  organizationId: string
) {
  console.log("🔄 SQLite3データベースから店舗データをインポート中...\n");
  console.log(`📁 SQLite3データベース: ${sqliteDbPath}`);
  console.log(`   テナントID: ${tenantId}`);
  console.log(`   組織ID: ${organizationId}\n`);

  console.log(`   テナントID: ${tenantId}`);
  console.log(`   組織ID: ${organizationId}\n`);

  // SQLite3データベースに接続
  let db: Database.Database;
  try {
    db = new Database(sqliteDbPath, { readonly: true });
    console.log("✅ SQLite3データベースに接続しました\n");
  } catch (error) {
    console.error("❌ SQLite3データベースへの接続に失敗しました:", error);
    throw error;
  }

  try {
    // storesテーブルからデータを取得
    const stores = db.prepare("SELECT * FROM stores").all() as Array<{
      store_id: string;
      name: string;
      phone: string | null;
      website: string | null;
      address: string | null;
      category: string | null;
      rating: number | null;
      city: string | null;
      place_id: string | null;
      url: string | null;
      location: string | null;
      opening_date: string | null;
      closed_day: string | null;
      transport: string | null;
      business_hours: string | null;
      official_account: string | null;
      data_source: string | null;
      collected_at: string | null;
      updated_at: string | null;
      is_franchise: boolean | null;
    }>;

    console.log(`📊 取得した店舗データ: ${stores.length}件\n`);

    if (stores.length === 0) {
      console.log("⚠️  インポートするデータがありません");
      return;
    }

    // 既存のリードを取得（重複チェック用）
    const existingLeads = await prisma.lead.findMany({
      where: {
        tenantId,
        organizationId,
      },
      select: {
        source: true,
      },
    });

    const existingSources = new Set(existingLeads.map((lead) => lead.source));

    // リードデータを準備
    const leadsToCreate: Array<{
      tenantId: string;
      organizationId: string;
      source: string;
      data: any;
      status: string;
      notes: string | null;
    }> = [];

    let skipped = 0;
    let processed = 0;

    for (const store of stores) {
      processed++;

      // ソースURLを決定（url > website > store_idベースのURL）
      const sourceUrl =
        store.url ||
        store.website ||
        `https://example.com/store/${store.store_id}`;

      // 重複チェック
      if (existingSources.has(sourceUrl)) {
        skipped++;
        continue;
      }

      // データオブジェクトを作成（ZenMapの形式に合わせる）
      // 日本語フィールド名と英語フィールド名の両方を設定
      const leadData: any = {
        // 基本情報（英語フィールド名）
        name: store.name || "",
        phone: store.phone || null,
        address: store.address || null,
        website: store.website || null,
        url: store.url || null,

        // 基本情報（日本語フィールド名 - ZenMap標準形式）
        店舗名: store.name || "",
        電話番号: store.phone || null,
        住所: store.address || null,
        詳細住所: store.address || null, // 詳細住所も同じ値を設定

        // 店舗情報
        category: store.category || null,
        rating: store.rating || null,
        city: store.city || null,
        place_id: store.place_id || null,

        // 営業情報
        opening_date: store.opening_date || null,
        closed_day: store.closed_day || null,
        business_hours: store.business_hours || null,
        transport: store.transport || null,

        // その他
        official_account: store.official_account || null,
        location: store.location || null,
        is_franchise: store.is_franchise || false,

        // メタデータ
        store_id: store.store_id,
        data_source: store.data_source || "sqlite_import",
        collected_at: store.collected_at || null,
        original_updated_at: store.updated_at || null,
      };

      leadsToCreate.push({
        tenantId,
        organizationId,
        source: sourceUrl,
        data: leadData,
        status: "new",
        notes: store.data_source
          ? `SQLite3からインポート: ${store.data_source}`
          : "SQLite3からインポート",
      });

      // 重複チェック用セットに追加
      existingSources.add(sourceUrl);

      // 進捗表示（100件ごと）
      if (processed % 100 === 0) {
        console.log(`   進捗: ${processed}/${stores.length}件処理済み`);
      }
    }

    console.log(`\n📊 インポート準備完了:`);
    console.log(`   新規: ${leadsToCreate.length}件`);
    console.log(`   スキップ（重複）: ${skipped}件`);
    console.log(`   合計: ${stores.length}件\n`);

    if (leadsToCreate.length === 0) {
      console.log("⚠️  インポートするデータがありません（すべて重複）");
      return;
    }

    // 一括登録（バッチ処理）
    const BATCH_SIZE = 100;
    let imported = 0;
    let errors = 0;

    console.log("📥 データベースに登録中...\n");

    for (let i = 0; i < leadsToCreate.length; i += BATCH_SIZE) {
      const batch = leadsToCreate.slice(i, i + BATCH_SIZE);

      try {
        await prisma.lead.createMany({
          data: batch,
          skipDuplicates: true,
        });
        imported += batch.length;
        console.log(`   ✅ ${i + 1}-${Math.min(i + BATCH_SIZE, leadsToCreate.length)}件登録完了`);
      } catch (error) {
        console.error(`   ❌ バッチ登録エラー (${i + 1}-${i + BATCH_SIZE}):`, error);
        // バッチ登録に失敗した場合、個別に登録を試みる
        for (const lead of batch) {
          try {
            await prisma.lead.create({
              data: lead,
            });
            imported++;
          } catch (individualError) {
            console.error(`   ❌ 個別登録エラー: ${lead.source}`, individualError);
            errors++;
          }
        }
      }
    }

    console.log(`\n✅ インポート完了:`);
    console.log(`   成功: ${imported}件`);
    console.log(`   エラー: ${errors}件`);
    console.log(`   スキップ: ${skipped}件`);
    console.log(`   合計: ${stores.length}件`);
  } catch (error) {
    console.error("❌ エラーが発生しました:", error);
    throw error;
  } finally {
    db.close();
    await prisma.$disconnect();
  }
}

// メイン処理
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 3) {
    console.error("❌ 引数が不足しています");
    console.error("使用方法: tsx scripts/import-stores-from-sqlite.ts <sqlite_db_path> <tenantId> <organizationId>");
    console.error("\n例:");
    console.error("  tsx scripts/import-stores-from-sqlite.ts /Users/a/名称未設定フォルダ/instance/restaurants_local.db ff424270-d1ee-4a72-9f57-984066600402 7f79c785-1f85-4ec1-88bb-67aff9d119fc");
    console.error("\nテナントIDと組織IDは、デバッグページ（/dashboard/customers/debug）で確認できます");
    process.exit(1);
  }

  const [sqliteDbPath, tenantId, organizationId] = args;

  await importStoresFromSqlite(sqliteDbPath, tenantId, organizationId);
}

main()
  .then(() => {
    console.log("\n✅ 処理が完了しました");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ 処理中にエラーが発生しました:", error);
    process.exit(1);
  });

