"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { ActivityType } from "@prisma/client";

/**
 * リードのアクティビティログを取得
 * 
 * @param leadId リードID
 * @returns アクティビティログ一覧
 */
export async function getActivityLogs(leadId: string) {
  const session = await auth();

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const { tenantId } = session.user;

  // ユーザーの主所属組織を取得
  const userOrg = await prisma.userOrganization.findFirst({
    where: {
      userId: session.user.id,
      isPrimary: true,
    },
    select: {
      organizationId: true,
    },
  });

  if (!userOrg) {
    return [];
  }

  // リードが存在し、同じテナント・組織に属しているか確認
  const lead = await prisma.lead.findFirst({
    where: {
      id: leadId,
      tenantId,
      organizationId: userOrg.organizationId,
    },
  });

  if (!lead) {
    throw new Error("Lead not found");
  }

  // アクティビティログを取得（新しい順）
  const logs = await prisma.activityLog.findMany({
    where: {
      leadId,
      tenantId,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return logs;
}

/**
 * アクティビティログを作成
 * 
 * @param leadId リードID
 * @param type 活動種別
 * @param status ステータス
 * @param note メモ
 * @returns 作成されたアクティビティログ
 */
export async function createActivityLog(
  leadId: string,
  type: ActivityType,
  status: string,
  note?: string
) {
  const session = await auth();

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const { tenantId } = session.user;

  // ユーザーの主所属組織を取得
  const userOrg = await prisma.userOrganization.findFirst({
    where: {
      userId: session.user.id,
      isPrimary: true,
    },
    select: {
      organizationId: true,
    },
  });

  if (!userOrg) {
    throw new Error("Organization not found");
  }

  // リードが存在し、同じテナント・組織に属しているか確認
  const lead = await prisma.lead.findFirst({
    where: {
      id: leadId,
      tenantId,
      organizationId: userOrg.organizationId,
    },
  });

  if (!lead) {
    throw new Error("Lead not found");
  }

  // アクティビティログを作成
  const activityLog = await prisma.activityLog.create({
    data: {
      leadId,
      type,
      status,
      note: note || null,
      tenantId,
      organizationId: userOrg.organizationId,
      userId: session.user.id,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
        },
      },
    },
  });

  // リードのステータスも更新（ステータスが指定され、かつ現在のステータスと異なる場合のみ）
  // 空文字列の場合は「変更なし」を意味するため、リードのステータスは更新しない
  if (status && status.trim().length > 0 && status !== lead.status) {
    await prisma.lead.update({
      where: {
        id: leadId,
      },
      data: {
        status,
        updatedBy: session.user.id,
      },
    });
  }

  // 一覧ページを再検証
  revalidatePath("/dashboard/leads");

  return activityLog;
}

