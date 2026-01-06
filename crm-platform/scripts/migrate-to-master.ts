/**
 * 既存のleadsデータを元にMasterLeadを生成し、紐付けを行うスクリプト
 * 
 * 実行方法:
 *   npx tsx scripts/migrate-to-master.ts
 * 
 * 機能:
 * - 既存のleadsデータからMasterLeadを生成
 * - 電話番号による名寄せ（重複データの統合）
 * - LeadとMasterLeadの紐付け
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 データ移行を開始します...');
  const startTime = Date.now();
  
  try {
    // 1. まだマスタに紐付いていないリードを全件取得
    // メモリ圧迫を防ぐため、件数が多い場合は分割処理（cursorなど）を検討してください
    const totalLeads = await prisma.lead.count({
      where: { masterLeadId: null },
    });

    console.log(`📋 対象リード数: ${totalLeads}件`);

    if (totalLeads === 0) {
      console.log('✅ 移行対象のリードがありません。移行は完了しています。');
      return;
    }

    // バッチ処理でメモリ使用量を抑制
    const BATCH_SIZE = 1000;
    let processed = 0;
    let created = 0;
    let linked = 0;
    let errors = 0;

    let skip = 0;

    while (true) {
      // オフセットベースのページネーション
      const leads = await prisma.lead.findMany({
        where: { masterLeadId: null },
        orderBy: { createdAt: 'asc' },
        take: BATCH_SIZE,
        skip: skip,
      });

      if (leads.length === 0) {
        break;
      }

      for (const lead of leads) {
        try {
          // dataカラムから型安全に値を取り出すためのキャスト
          const data = lead.data as Record<string, any>;
          
          // 名寄せキーの決定（電話番号があれば電話番号、なければ店舗名）
          // ※実データに合わせて調整してください
          const phone = data['phone'] || data['電話番号'] || null;
          const name = data['name'] || data['店舗名'] || '名称不明';
          const address = data['address'] || data['住所'] || null;

          // 電話番号の正規化（空白削除、ハイフン統一など）
          const normalizedPhone = phone 
            ? phone.toString().trim().replace(/\s+/g, '').replace(/[ー－]/g, '-')
            : null;

          // 2. MasterLeadを作成 または 既存を取得 (Upsert的なロジック)
          let masterLead;

          // 電話番号がある場合は、電話番号で既存マスタを探す（名寄せ）
          if (normalizedPhone && normalizedPhone !== '') {
            masterLead = await prisma.masterLead.findFirst({
              where: { phone: normalizedPhone }
            });
          }

          // まだマスタがない場合は新規作成
          if (!masterLead) {
            masterLead = await prisma.masterLead.create({
              data: {
                companyName: name,
                phone: normalizedPhone,
                address: address,
                source: lead.source,
                data: lead.data || {}, // 既存データをコピー
              }
            });
            created++;
          } else {
            // 既存マスタがある場合は、より詳細なデータがあれば更新
            const existingData = masterLead.data as Record<string, any>;
            const newData = lead.data as Record<string, any>;
            
            // 既存データに不足している情報があれば更新
            let shouldUpdate = false;
            const updatedData = { ...existingData };
            
            // 店舗名がより詳細な場合は更新
            if (newData['name'] && (!existingData['name'] || existingData['name'].length < newData['name'].length)) {
              updatedData['name'] = newData['name'];
              shouldUpdate = true;
            }
            if (newData['店舗名'] && (!existingData['店舗名'] || existingData['店舗名'].length < newData['店舗名'].length)) {
              updatedData['店舗名'] = newData['店舗名'];
              shouldUpdate = true;
            }
            
            // 住所がより詳細な場合は更新
            if (newData['address'] && (!existingData['address'] || existingData['address'].length < newData['address'].length)) {
              updatedData['address'] = newData['address'];
              shouldUpdate = true;
            }
            if (newData['住所'] && (!existingData['住所'] || existingData['住所'].length < newData['住所'].length)) {
              updatedData['住所'] = newData['住所'];
              shouldUpdate = true;
            }
            
            // その他のフィールドもマージ（既存データを優先）
            for (const key in newData) {
              if (!existingData[key] && newData[key]) {
                updatedData[key] = newData[key];
                shouldUpdate = true;
              }
            }
            
            if (shouldUpdate) {
              await prisma.masterLead.update({
                where: { id: masterLead.id },
                data: { 
                  data: updatedData,
                  companyName: updatedData['name'] || updatedData['店舗名'] || masterLead.companyName,
                  address: updatedData['address'] || updatedData['住所'] || masterLead.address,
                }
              });
            }
          }

          // 3. Leadに紐付けを更新
          await prisma.lead.update({
            where: { id: lead.id },
            data: {
              masterLeadId: masterLead.id,
            }
          });

          linked++;
          processed++;

          // 進捗表示
          if (processed % 100 === 0) {
            const progress = Math.round((processed / totalLeads) * 100);
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            console.log(`✅ ${processed}/${totalLeads}件 処理完了 (${progress}%) | 作成: ${created}, 紐付け: ${linked}, エラー: ${errors} | 経過: ${Math.floor(elapsed / 60)}分${elapsed % 60}秒`);
          }
        } catch (error) {
          errors++;
          console.error(`❌ リードID ${lead.id} の処理中にエラー:`, error);
        }
      }

      // 次のオフセットを設定
      skip += leads.length;
      
      if (leads.length < BATCH_SIZE) {
        break;
      }
    }

    const totalTime = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(totalTime / 60);
    const seconds = totalTime % 60;

    console.log('\n🎉 移行完了しました！');
    console.log(`   総処理件数: ${processed}件`);
    console.log(`   新規作成: ${created}件`);
    console.log(`   紐付け: ${linked}件`);
    console.log(`   エラー: ${errors}件`);
    console.log(`   総処理時間: ${minutes}分${seconds}秒`);

    // 統計情報を表示
    const masterLeadCount = await prisma.masterLead.count();
    const linkedLeadCount = await prisma.lead.count({
      where: { masterLeadId: { not: null } }
    });
    const unlinkedLeadCount = await prisma.lead.count({
      where: { masterLeadId: null }
    });

    console.log('\n📊 移行後の統計:');
    console.log(`   MasterLead数: ${masterLeadCount}件`);
    console.log(`   紐付け済みLead: ${linkedLeadCount}件`);
    console.log(`   未紐付けLead: ${unlinkedLeadCount}件`);
  } catch (error) {
    console.error('❌ 移行中にエラーが発生しました:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

