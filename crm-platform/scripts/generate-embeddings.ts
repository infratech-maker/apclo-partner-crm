/**
 * MasterLeadデータをベクトル化してLeadVectorテーブルに保存するバッチスクリプト
 * 
 * 実行方法:
 *   npx tsx scripts/generate-embeddings.ts
 * 
 * 前提:
 * - OpenAI API Keyが環境変数OPENAI_API_KEYに設定されていること
 * - LeadVectorテーブルがデータベースに存在すること
 * - pgvector拡張が有効になっていること
 */

import { config } from "dotenv";
import { resolve } from "path";

// 環境変数の読み込み (.env.local)
config({ path: resolve(__dirname, "../.env.local") });

import { PrismaClient } from "@prisma/client";
import { generateEmbedding } from "../src/lib/ai/embedding";

const prisma = new PrismaClient();

// バッチ処理の設定
const BATCH_SIZE = 10; // 一度に処理する件数（レート制限対策）
const DELAY_MS = 200; // API呼び出しごとの待機時間（ミリ秒）

/**
 * 検索対象となるテキストを生成する
 * 
 * @param lead - MasterLeadオブジェクト
 * @returns ベクトル化するテキスト
 */
function createContent(lead: any): string {
  const data = lead.data as any || {};
  
  // 検索に引っかかってほしい重要項目を列挙
  const parts = [
    `店名: ${lead.companyName || '不明'}`,
    `住所: ${lead.address || '不明'}`,
    `電話番号: ${lead.phone || '不明'}`,
    `ソース: ${lead.source || '不明'}`,
  ];

  // data内の情報を追加
  if (data.category) {
    parts.push(`カテゴリ: ${data.category}`);
  }
  if (data.description) {
    parts.push(`概要: ${data.description}`);
  }
  if (data.name && data.name !== lead.companyName) {
    parts.push(`名称: ${data.name}`);
  }
  if (data.店舗名 && data.店舗名 !== lead.companyName) {
    parts.push(`店舗名: ${data.店舗名}`);
  }
  
  // Google Maps等の詳細データがある場合
  if (data.rating) {
    parts.push(`評価: ${data.rating}`);
  }
  if (data.reviews) {
    parts.push(`レビュー数: ${data.reviews}`);
  }
  if (data.totalScore) {
    parts.push(`総合スコア: ${data.totalScore}`);
  }
  if (data.reviewsCount) {
    parts.push(`レビュー数: ${data.reviewsCount}`);
  }
  
  // その他のキーワード
  if (data.categoryName) {
    parts.push(`カテゴリ名: ${data.categoryName}`);
  }
  if (data.transport || data.交通手段 || data.交通アクセス) {
    parts.push(`交通手段: ${data.transport || data.交通手段 || data.交通アクセス}`);
  }
  if (data.businessHours || data.営業時間) {
    parts.push(`営業時間: ${data.businessHours || data.営業時間}`);
  }
  if (data.regularHoliday || data.定休日) {
    parts.push(`定休日: ${data.regularHoliday || data.定休日}`);
  }

  return parts.filter(p => p && !p.includes(': 不明')).join('\n');
}

async function main() {
  console.log('🚀 ベクトル生成バッチを開始します...');
  console.log('');

  // 環境変数の確認
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY環境変数が設定されていません');
    process.exit(1);
  }

  try {
    // 1. すでにベクトルが存在するMasterLeadのIDを取得
    console.log('📊 既存のベクトルデータを確認中...');
    const existingVectors = await prisma.leadVector.findMany({
      select: { masterLeadId: true }
    });
    const processedIds = new Set(existingVectors.map(v => v.masterLeadId));
    console.log(`   ✅ 既存ベクトル: ${processedIds.size}件`);
    console.log('');

    // 2. 未処理のMasterLeadを取得
    console.log('📋 未処理のMasterLeadを取得中...');
    const allLeads = await prisma.masterLead.findMany({
      where: {
        id: { notIn: Array.from(processedIds) }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`   ✅ 未処理のリード数: ${allLeads.length}件`);
    console.log('');

    if (allLeads.length === 0) {
      console.log('🎉 すべてのリードが既にベクトル化されています！');
      return;
    }

    // 3. バッチ処理 (レート制限対策)
    let successCount = 0;
    let errorCount = 0;
    let skipCount = 0;

    console.log(`📦 バッチ処理を開始します（バッチサイズ: ${BATCH_SIZE}件、待機時間: ${DELAY_MS}ms）`);
    console.log('');

    for (let i = 0; i < allLeads.length; i += BATCH_SIZE) {
      const batch = allLeads.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(allLeads.length / BATCH_SIZE);
      
      console.log(`📦 バッチ ${batchNum}/${totalBatches} を処理中... (${i + 1}-${Math.min(i + BATCH_SIZE, allLeads.length)}件)`);
      
      await Promise.all(
        batch.map(async (lead) => {
          try {
            const content = createContent(lead);
            
            // 空データや極端に短いものはスキップ
            if (content.length < 10) {
              console.log(`   ⏭️  スキップ: ${lead.companyName} (内容が短すぎます)`);
              skipCount++;
              return;
            }

            // Embedding生成
            const vector = await generateEmbedding(content);

            // SQLで保存 (PrismaのUnsupported型対応)
            // UUID生成には pgcrypto の gen_random_uuid() を使用
            await prisma.$executeRaw`
              INSERT INTO "lead_vectors" ("id", "masterLeadId", "content", "embedding", "createdAt")
              VALUES (gen_random_uuid(), ${lead.id}, ${content}, ${vector}::vector, NOW())
              ON CONFLICT ("masterLeadId") DO NOTHING
            `;

            successCount++;
            process.stdout.write('✅');
          } catch (error) {
            errorCount++;
            console.error(`\n   ❌ Error processing lead ${lead.companyName}:`, error instanceof Error ? error.message : error);
            process.stdout.write('❌');
          }
        })
      );

      console.log(''); // 改行

      // レート制限回避のためのウェイト（最後のバッチ以外）
      if (i + BATCH_SIZE < allLeads.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }
    }

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 処理結果');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   ✅ 成功: ${successCount}件`);
    console.log(`   ❌ エラー: ${errorCount}件`);
    console.log(`   ⏭️  スキップ: ${skipCount}件`);
    console.log(`   📊 合計: ${allLeads.length}件`);
    console.log('');
    console.log('🎉 ベクトル生成バッチが完了しました！');
  } catch (error) {
    console.error('❌ バッチ処理中にエラーが発生しました:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('❌ スクリプトがエラーで終了しました:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
