import { config } from "dotenv";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";
import Database from "better-sqlite3";

// 環境変数を読み込む
config({ path: resolve(__dirname, "../.env.local") });
config({ path: resolve(__dirname, "../.env") });

const prisma = new PrismaClient();

/**
 * 既存のリードデータの電話番号と住所を修正
 * 
 * 使用方法:
 *   tsx scripts/fix-leads-phone-address.ts <sqlite_db_path> <tenantId> <organizationId>
 * 
 * 例:
 *   tsx scripts/fix-leads-phone-address.ts /Users/a/名称未設定フォルダ/instance/restaurants_local.db ff424270-d1ee-4a72-9f57-984066600402 7f79c785-1f85-4ec1-88bb-67aff9d119fc
 */
async function fixLeadsPhoneAddress(
  sqliteDbPath: string,
  tenantId: string,
  organizationId: string
) {
  console.log("🔄 リードデータの電話番号と住所を修正中...\n");
  console.log(`📁 SQLite3データベース: ${sqliteDbPath}`);
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
    // storesテーブルからデータを取得（店舗名とURLでマッチング）
    const stores = db.prepare("SELECT * FROM stores").all() as Array<{
      store_id: string;
      name: string;
      phone: string | null;
      address: string | null;
      category: string | null;
      url: string | null;
      website: string | null;
    }>;

    console.log(`📊 SQLite3から取得した店舗データ: ${stores.length}件\n`);

    // 店舗名とURLでマップを作成（マッチング用）
    const storeMapByUrl = new Map<string, { phone: string | null; address: string | null }>();
    const storeMapByName = new Map<string, Array<{ phone: string | null; address: string | null }>>();
    
    for (const store of stores) {
      // 電話番号と住所を正規化（空文字列をnullに変換）
      const normalizedPhone = store.phone && store.phone.trim() !== "" ? store.phone.trim() : null;
      const normalizedAddress = store.address && store.address.trim() !== "" ? store.address.trim() : null;
      
      // URL/websiteでマップ
      if (store.url) {
        storeMapByUrl.set(store.url, {
          phone: normalizedPhone,
          address: normalizedAddress,
        });
        // 末尾スラッシュあり/なしの両方でマップ
        if (store.url.endsWith("/")) {
          storeMapByUrl.set(store.url.slice(0, -1), {
            phone: normalizedPhone,
            address: normalizedAddress,
          });
        } else {
          storeMapByUrl.set(store.url + "/", {
            phone: normalizedPhone,
            address: normalizedAddress,
          });
        }
      }
      if (store.website) {
        storeMapByUrl.set(store.website, {
          phone: normalizedPhone,
          address: normalizedAddress,
        });
      }
      
      // 店舗名でマップ（同名店舗がある可能性があるため配列で保持）
      if (store.name) {
        if (!storeMapByName.has(store.name)) {
          storeMapByName.set(store.name, []);
        }
        storeMapByName.get(store.name)!.push({
          phone: normalizedPhone,
          address: normalizedAddress,
        });
      }
    }

    // 既存のリードを取得
    const leads = await prisma.lead.findMany({
      where: {
        tenantId,
        organizationId,
      },
      select: {
        id: true,
        source: true,
        data: true,
      },
    });

    console.log(`📊 修正対象のリード数: ${leads.length}件\n`);

    let updated = 0;
    let skipped = 0;
    let phoneUpdated = 0;
    let addressUpdated = 0;
    let noMatch = 0;
    let matchedByUrl = 0;
    let matchedByName = 0;
    let phoneFoundButNotUpdated = 0;
    let phoneNotFound = 0;

    // バッチ処理で更新
    const BATCH_SIZE = 100;
    for (let i = 0; i < leads.length; i += BATCH_SIZE) {
      const batch = leads.slice(i, i + BATCH_SIZE);

      for (const lead of batch) {
        try {
          const data = lead.data as any;
          if (!data) {
            skipped++;
            continue;
          }

          // SQLiteデータから電話番号と住所を取得
          // マッチング方法: source URL > data.url > data.website > 店舗名
          let storeInfo: { phone: string | null; address: string | null } | null = null;
          
          // 1. source URLでマッチング
          if (lead.source && storeMapByUrl.has(lead.source)) {
            storeInfo = storeMapByUrl.get(lead.source)!;
            matchedByUrl++;
          }
          // 2. data.urlでマッチング
          else if (data.url && storeMapByUrl.has(data.url)) {
            storeInfo = storeMapByUrl.get(data.url)!;
            matchedByUrl++;
          }
          // 3. data.websiteでマッチング
          else if (data.website && storeMapByUrl.has(data.website)) {
            storeInfo = storeMapByUrl.get(data.website)!;
            matchedByUrl++;
          }
          // 4. source URLの末尾スラッシュを除いてマッチング
          else if (lead.source) {
            const sourceWithoutSlash = lead.source.replace(/\/$/, "");
            if (storeMapByUrl.has(sourceWithoutSlash)) {
              storeInfo = storeMapByUrl.get(sourceWithoutSlash)!;
              matchedByUrl++;
            }
          }
          // 4. 店舗名でマッチング（最後の手段）
          else if (data.name || data.店舗名) {
            const storeName = data.name || data.店舗名;
            if (storeMapByName.has(storeName)) {
              const candidates = storeMapByName.get(storeName)!;
              // 電話番号または住所がある最初の候補を使用
              const candidate = candidates.find(s => s.phone || s.address) || candidates[0];
              if (candidate) {
                storeInfo = candidate;
                matchedByName++;
              }
            }
          }

          if (!storeInfo) {
            noMatch++;
            skipped++;
            continue;
          }

          // データを更新
          const updatedData: any = {
            ...data,
          };

          let hasUpdate = false;

          // 電話番号を更新（nullでない場合のみ）
          if (storeInfo.phone) {
            const currentPhone = data.phone || data.電話番号;
            // null、undefined、空文字列の場合は更新対象
            const shouldUpdate = !currentPhone || 
                                 (typeof currentPhone === "string" && currentPhone.trim() === "") ||
                                 (typeof currentPhone === "string" && currentPhone.trim() !== storeInfo.phone);
            
            if (shouldUpdate) {
              updatedData.phone = storeInfo.phone;
              updatedData.電話番号 = storeInfo.phone;
              phoneUpdated++;
              hasUpdate = true;
            } else {
              phoneFoundButNotUpdated++;
            }
          } else {
            phoneNotFound++;
          }

          // 住所を更新（カテゴリ情報が混在している場合や、nullの場合）
          if (storeInfo.address) {
            // 現在の住所がカテゴリ情報を含んでいるかチェック
            const currentAddress = data.address || data.住所 || data.詳細住所 || "";
            const isCategoryInfo = currentAddress.includes("/") && (
              currentAddress.includes("イタリアン") ||
              currentAddress.includes("カフェ") ||
              currentAddress.includes("寿司") ||
              currentAddress.includes("居酒屋") ||
              currentAddress.includes("スイーツ") ||
              currentAddress.includes("パン") ||
              currentAddress.includes("焼肉")
            );

            // カテゴリ情報が混在している、またはnullの場合は更新
            if (isCategoryInfo || !currentAddress || currentAddress === "") {
              updatedData.address = storeInfo.address;
              updatedData.住所 = storeInfo.address;
              updatedData.詳細住所 = storeInfo.address;
              addressUpdated++;
              hasUpdate = true;
            } else if (currentAddress !== storeInfo.address) {
              // 既存の値と異なる場合も更新
              updatedData.address = storeInfo.address;
              updatedData.住所 = storeInfo.address;
              updatedData.詳細住所 = storeInfo.address;
              addressUpdated++;
              hasUpdate = true;
            }
          }

          if (hasUpdate) {
            await prisma.lead.update({
              where: {
                id: lead.id,
              },
              data: {
                data: updatedData,
              },
            });

            updated++;
          } else {
            skipped++;
          }

          // 進捗表示（100件ごと）
          if ((i + updated + skipped) % 100 === 0) {
            console.log(`   進捗: ${i + updated + skipped}/${leads.length}件処理済み`);
          }
        } catch (error) {
          console.error(`   ❌ エラー (ID: ${lead.id}):`, error);
          skipped++;
        }
      }
    }

    console.log(`\n✅ 修正完了:`);
    console.log(`   更新: ${updated}件`);
    console.log(`   電話番号更新: ${phoneUpdated}件`);
    console.log(`   住所更新: ${addressUpdated}件`);
    console.log(`   URLでマッチ: ${matchedByUrl}件`);
    console.log(`   店舗名でマッチ: ${matchedByName}件`);
    console.log(`   マッチなし: ${noMatch}件`);
    console.log(`   電話番号あり（更新対象外）: ${phoneFoundButNotUpdated}件`);
    console.log(`   電話番号なし: ${phoneNotFound}件`);
    console.log(`   スキップ: ${skipped}件`);
    console.log(`   合計: ${leads.length}件`);
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
    console.error("");
    console.error("使用方法:");
    console.error("  tsx scripts/fix-leads-phone-address.ts <sqlite_db_path> <tenantId> <organizationId>");
    console.error("");
    console.error("例:");
    console.error("  tsx scripts/fix-leads-phone-address.ts /path/to/restaurants_local.db ff424270-d1ee-4a72-9f57-984066600402 7f79c785-1f85-4ec1-88bb-67aff9d119fc");
    process.exit(1);
  }

  const [sqliteDbPath, tenantId, organizationId] = args;

  await fixLeadsPhoneAddress(sqliteDbPath, tenantId, organizationId);
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

