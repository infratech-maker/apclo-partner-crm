import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ApifyClient } from 'apify-client';

const apifyClient = new ApifyClient({
  token: process.env.APIFY_API_TOKEN,
});

/**
 * 電話番号を正規化する（空白、ハイフン、括弧を削除）
 */
function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone || typeof phone !== 'string') return null;
  return phone.replace(/[\s()-]/g, '').trim() || null;
}

/**
 * JSONデータをマージする（既存データを保持しつつ、新しいデータを追加）
 */
function mergeData(existingData: any, newData: any): any {
  if (!existingData || typeof existingData !== 'object') {
    return newData;
  }
  if (!newData || typeof newData !== 'object') {
    return existingData;
  }
  
  // 既存データをコピー
  const merged = { ...existingData };
  
  // 新しいデータで上書き（ただし、既存の値がより詳細な場合は保持）
  for (const key in newData) {
    if (newData[key] !== null && newData[key] !== undefined && newData[key] !== '') {
      // 文字列の場合、既存の値がより長い場合は保持
      if (typeof merged[key] === 'string' && typeof newData[key] === 'string') {
        if (merged[key].length < newData[key].length) {
          merged[key] = newData[key];
        }
      } else {
        merged[key] = newData[key];
      }
    }
  }
  
  return merged;
}

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get('secret');

  // セキュリティチェック
  if (secret !== process.env.APIFY_WEBHOOK_SECRET) {
    console.error('❌ Invalid webhook secret');
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch (error) {
    console.error('❌ Failed to parse request body:', error);
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { eventType, resource } = body;

  // イベントタイプの確認
  if (eventType !== 'ACTOR.RUN.SUCCEEDED') {
    console.log(`ℹ️  Event ignored: ${eventType}`);
    return NextResponse.json({ message: 'Event ignored' });
  }

  if (!resource?.defaultDatasetId) {
    console.error('❌ Missing defaultDatasetId in resource');
    return NextResponse.json({ error: 'Missing dataset ID' }, { status: 400 });
  }

  try {
    console.log(`📥 Webhook received: Fetching dataset ${resource.defaultDatasetId}`);
    
    // Apifyからデータを取得
    const dataset = await apifyClient.dataset(resource.defaultDatasetId).listItems();
    const items = dataset.items;
    
    console.log(`📊 Received ${items.length} items from Apify`);

    let savedCount = 0;
    let updatedCount = 0;
    let createdCount = 0;
    let skippedCount = 0;

    for (const item of items) {
      if (!item.title) {
        skippedCount++;
        continue;
      }

      // デバッグ: 最初のアイテムのデータ構造をログ出力
      if (savedCount === 0) {
        console.log('📋 Sample item data structure:', JSON.stringify(item, null, 2));
      }

      // 電話番号の取得と正規化
      const phoneRaw = item.phoneUnformatted || item.phone;
      const phone = normalizePhone(phoneRaw as string | null | undefined);

      // レビュー数の取得（複数のフィールド名を確認）
      const reviewsCount = item.reviewsCount || item.reviews || item.reviewCount || item.numberOfReviews || null;
      
      // 評価スコアの取得
      const rating = item.totalScore || item.rating || item.averageRating || null;

      // テイクアウト可否とデリバリー可否の取得
      let takeoutAvailable: boolean | null = null;
      let deliveryAvailable: boolean | null = null;
      const deliveryServices: string[] = [];

      // Apifyのデータから直接取得を試みる
      if (item.takeout !== undefined) {
        takeoutAvailable = Boolean(item.takeout);
      }
      if (item.delivery !== undefined) {
        deliveryAvailable = Boolean(item.delivery);
      }

      // デリバリーサービスの取得
      if (item.deliveryServices && Array.isArray(item.deliveryServices)) {
        deliveryServices.push(...item.deliveryServices);
      } else if (item.deliveryServices && typeof item.deliveryServices === 'string') {
        deliveryServices.push(item.deliveryServices);
      }

      // Google MapsのURLから直接スクレイピングを試みる（Apifyのデータに情報がない場合）
      if ((takeoutAvailable === null || deliveryAvailable === null) && item.url) {
        try {
          const workerModule = await import('@/features/scraper/worker');
          if (workerModule.scrapeGoogleMapsPlace && typeof workerModule.scrapeGoogleMapsPlace === 'function') {
            const scrapingResult = await workerModule.scrapeGoogleMapsPlace(item.url as string);
            
            if (takeoutAvailable === null && scrapingResult.takeout_available !== undefined) {
              takeoutAvailable = scrapingResult.takeout_available;
            }
            if (deliveryAvailable === null && scrapingResult.delivery_available !== undefined) {
              deliveryAvailable = scrapingResult.delivery_available;
            }
            if (scrapingResult.delivery_services && scrapingResult.delivery_services.length > 0) {
              deliveryServices.push(...scrapingResult.delivery_services);
            }
          }
        } catch (error) {
          console.warn(`⚠️ Failed to scrape Google Maps place for ${item.title}:`, error);
        }
      }

      // データの準備
      const leadData = {
        name: item.title,
        address: item.address,
        category: item.categoryName || item.category,
        rating: rating,
        reviews: reviewsCount,
        reviewsCount: reviewsCount, // 複数のフィールド名に対応
        url: item.url,
        website: item.website,
        lat: (item.location as any)?.lat,
        lng: (item.location as any)?.lng,
        placeId: item.placeId,
        takeout_available: takeoutAvailable,
        delivery_available: deliveryAvailable,
        delivery_services: deliveryServices.length > 0 ? deliveryServices : undefined,
        ...item, // その他の生データも保持
      };

      if (phone) {
        // 電話番号がある場合は、電話番号で既存レコードを検索
        const existingMasterLead = await prisma.masterLead.findFirst({
          where: { phone },
        });

        if (existingMasterLead) {
          // 既存レコードがある場合: データをマージ更新
          const mergedData = mergeData(existingMasterLead.data, leadData);
          
          await prisma.masterLead.update({
            where: { id: existingMasterLead.id },
            data: {
              companyName: item.title || existingMasterLead.companyName,
              address: item.address || existingMasterLead.address,
              source: 'google_maps', // ソースを更新
              data: mergedData,
            },
          });
          updatedCount++;
        } else {
          // 新規作成
          await prisma.masterLead.create({
            data: {
              companyName: (item.title as string) || '名称不明',
              phone: phone,
              address: (item.address as string) || undefined,
              source: 'google_maps',
              data: leadData as any,
            },
          });
          createdCount++;
        }
        savedCount++;
      } else {
        // 電話番号がない場合は、店舗名と住所で重複チェック
        // ただし、完全一致は難しいため、とりあえず新規作成
        // 将来的には住所の正規化や類似度チェックを実装することも可能
        const existingMasterLead = await prisma.masterLead.findFirst({
          where: {
            companyName: item.title as string,
            address: (item.address as string) || undefined,
          },
        });

        if (!existingMasterLead) {
          await prisma.masterLead.create({
            data: {
              companyName: item.title as string,
              address: (item.address as string) || undefined,
              source: 'google_maps',
              data: leadData as any,
            },
          });
          createdCount++;
          savedCount++;
        } else {
          // 既存レコードがある場合: データをマージ更新
          const mergedData = mergeData(existingMasterLead.data, leadData);
          
          await prisma.masterLead.update({
            where: { id: existingMasterLead.id },
            data: {
              address: ((item.address as string) || existingMasterLead.address) || undefined,
              source: 'google_maps',
              data: mergedData,
            },
          });
          updatedCount++;
          savedCount++;
        }
      }
    }

    console.log(`✅ Webhook processing completed: ${savedCount} saved (${createdCount} created, ${updatedCount} updated, ${skippedCount} skipped)`);

    return NextResponse.json({
      success: true,
      count: savedCount,
      created: createdCount,
      updated: updatedCount,
      skipped: skippedCount,
    });
  } catch (error) {
    console.error('❌ Apify Webhook Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


