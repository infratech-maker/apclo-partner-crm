/**
 * Leadsデータのデイリーバックアップスクリプト
 * 
 * 実行方法:
 *   npm run backup:leads
 * 
 * またはcronで自動実行:
 *   0 2 * * * cd /path/to/crm-platform && npm run backup:leads
 */

import { prisma } from "../src/lib/prisma";
import * as fs from "fs";
import * as path from "path";
import { format } from "date-fns";

const BACKUP_DIR = path.join(process.cwd(), "backups", "leads");
const MAX_GENERATIONS = 2; // 2世代保存

/**
 * バックアップディレクトリを確保
 */
function ensureBackupDirectory(): void {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`✅ バックアップディレクトリを作成しました: ${BACKUP_DIR}`);
  }
}

/**
 * 古いバックアップファイルを削除（2世代を超えるもの）
 */
function cleanupOldBackups(): void {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter((file) => file.startsWith("leads_") && file.endsWith(".json"))
      .map((file) => ({
        name: file,
        path: path.join(BACKUP_DIR, file),
        stat: fs.statSync(path.join(BACKUP_DIR, file)),
      }))
      .sort((a, b) => b.stat.mtime.getTime() - a.stat.mtime.getTime()); // 新しい順

    // 2世代を超えるファイルを削除
    if (files.length > MAX_GENERATIONS) {
      const filesToDelete = files.slice(MAX_GENERATIONS);
      for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
        console.log(`🗑️  古いバックアップを削除しました: ${file.name}`);
      }
    }
  } catch (error) {
    console.error("⚠️  古いバックアップの削除中にエラーが発生しました:", error);
  }
}

/**
 * Leadsデータをバックアップ
 */
async function backupLeads(): Promise<void> {
  const startTime = Date.now();
  console.log("🚀 Leadsデータのバックアップを開始します...");

  try {
    // バックアップディレクトリを確保
    ensureBackupDirectory();

    // 全リードデータを取得
    console.log("📊 リードデータを取得中...");
    const leads = await prisma.lead.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    console.log(`✅ ${leads.length}件のリードデータを取得しました`);

    // バックアップファイル名（日付付き）
    const dateStr = format(new Date(), "yyyy-MM-dd");
    const backupFileName = `leads_${dateStr}.json`;
    const backupFilePath = path.join(BACKUP_DIR, backupFileName);

    // バックアップデータを構築
    const backupData = {
      backupDate: new Date().toISOString(),
      totalLeads: leads.length,
      leads: leads.map((lead) => ({
        id: lead.id,
        name: lead.name,
        source: lead.source,
        sourceUrl: lead.sourceUrl,
        status: lead.status,
        data: lead.data,
        notes: lead.notes,
        tenantId: lead.tenantId,
        organizationId: lead.organizationId,
        assignedToId: lead.assignedToId,
        createdAt: lead.createdAt.toISOString(),
        updatedAt: lead.updatedAt.toISOString(),
      })),
    };

    // JSONファイルとして保存
    fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2), "utf-8");
    const fileSize = fs.statSync(backupFilePath).size;
    const fileSizeMB = (fileSize / 1024 / 1024).toFixed(2);

    console.log(`✅ バックアップを保存しました: ${backupFileName}`);
    console.log(`   📁 ファイルサイズ: ${fileSizeMB} MB`);
    console.log(`   📊 リード数: ${leads.length}件`);

    // 古いバックアップを削除
    cleanupOldBackups();

    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ バックアップが完了しました（実行時間: ${elapsedTime}秒）`);

    // 保存されているバックアップファイル一覧を表示
    const existingBackups = fs
      .readdirSync(BACKUP_DIR)
      .filter((file) => file.startsWith("leads_") && file.endsWith(".json"))
      .sort()
      .reverse();
    
    console.log(`\n📦 保存されているバックアップ（${existingBackups.length}世代）:`);
    for (const backup of existingBackups) {
      const backupPath = path.join(BACKUP_DIR, backup);
      const stat = fs.statSync(backupPath);
      const sizeMB = (stat.size / 1024 / 1024).toFixed(2);
      console.log(`   - ${backup} (${sizeMB} MB, ${format(stat.mtime, "yyyy-MM-dd HH:mm:ss")})`);
    }
  } catch (error) {
    console.error("❌ バックアップ中にエラーが発生しました:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 実行
if (require.main === module) {
  backupLeads()
    .then(() => {
      console.log("✅ スクリプトが正常に完了しました");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ スクリプトがエラーで終了しました:", error);
      process.exit(1);
    });
}

