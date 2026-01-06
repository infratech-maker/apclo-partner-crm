"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";

/**
 * ユーザー一覧を取得
 * 
 * ロールに基づいて取得範囲を制限:
 * - Super Admin: 自分のテナントの全ユーザー
 * - Org Admin: 自分の組織（および配下組織）のユーザーのみ
 * - User: アクセス権限なし（エラー）
 */
export async function getUsers() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const userRole = session.user.role;
  const tenantId = session.user.tenantId;
  const organizationId = session.user.organizationId;

  // Userロールはアクセス権限なし
  if (userRole === "User") {
    throw new Error("Access denied: Insufficient permissions");
  }

  // Super Admin: 自分のテナントの全ユーザー
  if (userRole === "Super Admin") {
    const users = await prisma.user.findMany({
      where: {
        tenantId,
        isActive: true,
      },
      include: {
        userOrganizations: {
          where: { isPrimary: true },
          include: {
            organization: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        userRoles: {
          where: {
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: new Date() } },
            ],
          },
          include: {
            role: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // 招待中のユーザーも取得
    const invitations = await prisma.invitation.findMany({
      where: {
        tenantId,
        status: "PENDING",
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
        role: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // ユーザーと招待を統合して返す
    const userList = users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      organization: user.userOrganizations[0]?.organization?.name || "未所属",
      organizationId: user.userOrganizations[0]?.organization?.id || null,
      role: user.userRoles[0]?.role.name || "未設定",
      status: "Active" as const,
      createdAt: user.createdAt,
    }));

    const invitationList = invitations.map((invitation) => ({
      id: invitation.id,
      name: null,
      email: invitation.email,
      organization: invitation.organization?.name || "未設定",
      organizationId: invitation.organizationId || null,
      role: invitation.role?.name || "未設定",
      status: "Invited" as const,
      createdAt: invitation.createdAt,
    }));

    return [...userList, ...invitationList];
  }

  // Org Admin: 自分の組織（および配下組織）のユーザーのみ
  if (userRole === "Org Admin" && organizationId) {
    // 自分の組織と配下組織のIDを取得（OrganizationClosureを使用）
    const descendantOrgs = await prisma.organizationClosure.findMany({
      where: {
        tenantId,
        ancestorId: organizationId,
      },
      select: {
        descendantId: true,
      },
    });

    const orgIds = [organizationId, ...descendantOrgs.map((o) => o.descendantId)];

    const users = await prisma.user.findMany({
      where: {
        tenantId,
        isActive: true,
        userOrganizations: {
          some: {
            organizationId: {
              in: orgIds,
            },
            isPrimary: true,
          },
        },
      },
      include: {
        userOrganizations: {
          where: { isPrimary: true },
          include: {
            organization: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        userRoles: {
          where: {
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: new Date() } },
            ],
          },
          include: {
            role: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // 招待中のユーザーも取得（同じ組織範囲）
    const invitations = await prisma.invitation.findMany({
      where: {
        tenantId,
        status: "PENDING",
        organizationId: {
          in: orgIds,
        },
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
        role: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const userList = users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      organization: user.userOrganizations[0]?.organization?.name || "未所属",
      organizationId: user.userOrganizations[0]?.organization?.id || null,
      role: user.userRoles[0]?.role.name || "未設定",
      status: "Active" as const,
      createdAt: user.createdAt,
    }));

    const invitationList = invitations.map((invitation) => ({
      id: invitation.id,
      name: null,
      email: invitation.email,
      organization: invitation.organization?.name || "未設定",
      organizationId: invitation.organizationId || null,
      role: invitation.role?.name || "未設定",
      status: "Invited" as const,
      createdAt: invitation.createdAt,
    }));

    return [...userList, ...invitationList];
  }

  throw new Error("Access denied: Insufficient permissions or missing organization");
}

/**
 * 組織一覧を取得（招待時に使用）
 */
export async function getOrganizations() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const tenantId = session.user.tenantId;
  const userRole = session.user.role;
  const organizationId = session.user.organizationId;

  if (userRole === "User") {
    throw new Error("Access denied: Insufficient permissions");
  }

  // Super Admin: 自分のテナントの全組織
  if (userRole === "Super Admin") {
    const organizations = await prisma.organization.findMany({
      where: {
        tenantId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        code: true,
        type: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return organizations;
  }

  // Org Admin: 自分の組織（および配下組織）
  if (userRole === "Org Admin" && organizationId) {
    const descendantOrgs = await prisma.organizationClosure.findMany({
      where: {
        tenantId,
        ancestorId: organizationId,
      },
      select: {
        descendantId: true,
      },
    });

    const orgIds = [organizationId, ...descendantOrgs.map((o) => o.descendantId)];

    const organizations = await prisma.organization.findMany({
      where: {
        tenantId,
        id: {
          in: orgIds,
        },
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        code: true,
        type: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return organizations;
  }

  return [];
}

/**
 * ロール一覧を取得（招待時に使用）
 */
export async function getRoles() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const tenantId = session.user.tenantId;

  const roles = await prisma.role.findMany({
    where: {
      tenantId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      description: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  return roles;
}

/**
 * ユーザーを招待
 * 
 * @param email メールアドレス
 * @param roleId ロールID
 * @param organizationId 組織ID（オプション）
 */
export async function inviteUser(
  email: string,
  roleId: string,
  organizationId?: string | null
) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const userRole = session.user.role;
  const tenantId = session.user.tenantId;

  // 権限チェック
  if (userRole === "User") {
    throw new Error("Access denied: Insufficient permissions");
  }

  // メールアドレスのバリデーション
  if (!email || !email.includes("@")) {
    throw new Error("Invalid email address");
  }

  // 既存のユーザーまたは招待が存在するかチェック
  const existingUser = await prisma.user.findFirst({
    where: {
      tenantId,
      email,
    },
  });

  if (existingUser) {
    throw new Error("User with this email already exists");
  }

  const existingInvitation = await prisma.invitation.findFirst({
    where: {
      tenantId,
      email,
      status: "PENDING",
    },
  });

  if (existingInvitation) {
    throw new Error("Invitation already sent to this email");
  }

  // トークンを生成
  const token = randomBytes(32).toString("hex");

  // 有効期限を設定（7日後）
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  // 招待レコードを作成
  const invitation = await prisma.invitation.create({
    data: {
      email,
      token,
      tenantId,
      roleId,
      organizationId: organizationId || null,
      expiresAt,
      status: "PENDING",
      invitedBy: session.user.id,
    },
  });

  // モック: コンソールに招待リンクを出力
  const inviteUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/invite/${token}`;
  console.log("📧 Invitation Link:", inviteUrl);
  console.log("Email:", email);
  console.log("Role ID:", roleId);
  console.log("Organization ID:", organizationId || "None");

  // UIを更新
  revalidatePath("/dashboard/settings/users");

  return {
    id: invitation.id,
    email: invitation.email,
    token: invitation.token,
    inviteUrl,
  };
}

