'use server'

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { revalidatePath } from "next/cache"

/**
 * 検索結果からプロジェクトを作成し、リードを一括保存する
 * 
 * @param projectName プロジェクト名
 * @param masterLeadIds MasterLeadのIDリスト
 * @returns 作成結果
 */
export async function createProjectFromSearch(
  projectName: string,
  masterLeadIds: string[]
) {
  try {
    // セッション確認
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "認証が必要です" };
    }

    const tenantId = session.user.tenantId;
    const organizationId = session.user.organizationId;
    const userId = session.user.id;

    // 1. 対象のMasterLeadを取得
    const masterLeads = await prisma.masterLead.findMany({
      where: { id: { in: masterLeadIds } }
    });

    if (masterLeads.length === 0) {
      return { success: false, error: "対象のリードが見つかりません" };
    }

    // 2. トランザクション実行
    const newProject = await prisma.$transaction(async (tx) => {
      // (A) プロジェクト作成
      const project = await tx.project.create({
        data: {
          tenantId: tenantId,
          name: projectName,
          description: `AI検索による自動生成 (${masterLeads.length}件)`,
        }
      });

      // (B) Lead用データの作成
      // MasterLeadのデータをLeadの初期値としてコピー
      const leadsData = masterLeads.map(ml => {
        // dataカラムの型安全なキャスト
        const metaData = ml.data as Record<string, any> || {};
        
        // MasterLeadの情報をLeadのdataに含める
        const leadData = {
          ...metaData,
          // MasterLeadの基本情報も含める（スナップショット）
          companyName: ml.companyName,
          phone: ml.phone,
          address: ml.address,
          source: ml.source,
        };
        
        return {
          tenantId: tenantId,
          organizationId: organizationId,
          projectId: project.id,
          masterLeadId: ml.id,
          source: ml.source,
          data: leadData as any,
          status: "new",
          createdBy: userId,
        };
      });

      // (C) リード一括登録
      await tx.lead.createMany({
        data: leadsData
      });

      return project;
    });

    // 3. キャッシュ更新
    revalidatePath('/dashboard/projects');
    revalidatePath('/dashboard/leads');
    
    return { 
      success: true, 
      projectId: newProject.id,
      count: masterLeads.length
    };

  } catch (error) {
    console.error("Failed to create project:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "プロジェクトの作成に失敗しました" 
    };
  }
}
