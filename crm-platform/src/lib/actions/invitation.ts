"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

/**
 * 招待トークンを検証
 * 
 * @param token 招待トークン
 * @returns 招待情報、無効な場合はnull
 */
export async function verifyInvitationToken(token: string) {
  const invitation = await prisma.invitation.findUnique({
    where: {
      token,
    },
    select: {
      id: true,
      email: true,
      tenantId: true,
      organizationId: true,
      roleId: true,
      expiresAt: true,
      status: true,
      invitedBy: true,
      tenant: {
        select: {
          id: true,
          name: true,
          isActive: true,
        },
      },
      organization: {
        select: {
          id: true,
          name: true,
        },
      },
      role: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!invitation) {
    return {
      valid: false,
      error: "INVALID_TOKEN",
      message: "この招待リンクは無効です。",
    };
  }

  // 有効期限チェック
  if (invitation.expiresAt < new Date()) {
    return {
      valid: false,
      error: "EXPIRED",
      message: "この招待リンクの有効期限が切れています。",
    };
  }

  // ステータスチェック
  if (invitation.status !== "PENDING") {
    return {
      valid: false,
      error: "ALREADY_USED",
      message: "この招待リンクは既に使用されています。",
    };
  }

  // テナントの有効性チェック
  if (!invitation.tenant.isActive) {
    return {
      valid: false,
      error: "TENANT_INACTIVE",
      message: "このテナントは無効です。",
    };
  }

  return {
    valid: true,
    invitation: {
      id: invitation.id,
      email: invitation.email,
      tenantId: invitation.tenantId,
      tenantName: invitation.tenant.name,
      organizationId: invitation.organizationId,
      organizationName: invitation.organization?.name || null,
      roleId: invitation.roleId,
      roleName: invitation.role?.name || null,
      invitedBy: invitation.invitedBy,
    },
  };
}

/**
 * 招待を受諾してユーザーを登録
 * 
 * @param token 招待トークン
 * @param name ユーザー名
 * @param password パスワード
 */
export async function acceptInvitation(
  token: string,
  name: string,
  password: string
) {
  // トークンを検証
  const verification = await verifyInvitationToken(token);

  if (!verification.valid) {
    throw new Error(verification.message);
  }

  const { invitation } = verification;

  if (!invitation) {
    throw new Error("招待情報が見つかりません。");
  }

  // パスワードのバリデーション
  if (!password || password.length < 8) {
    throw new Error("パスワードは8文字以上である必要があります。");
  }

  if (!name || name.trim().length === 0) {
    throw new Error("名前を入力してください。");
  }

  // トランザクション処理
  const result = await prisma.$transaction(async (tx) => {
    // パスワードをハッシュ化
    const passwordHash = await bcrypt.hash(password, 10);

    // Userテーブルに新規レコードを作成
    const user = await tx.user.create({
      data: {
        tenantId: invitation.tenantId,
        email: invitation.email,
        passwordHash,
        name: name.trim(),
        isActive: true,
      },
    });

    // UserOrganizationを作成（組織が指定されている場合）
    if (invitation.organizationId) {
      await tx.userOrganization.create({
        data: {
          userId: user.id,
          organizationId: invitation.organizationId,
          tenantId: invitation.tenantId,
          isPrimary: true,
          roleInOrg: "member",
        },
      });
    }

    // UserRoleを作成（ロールが指定されている場合）
    if (invitation.roleId) {
      await tx.userRole.create({
        data: {
          userId: user.id,
          roleId: invitation.roleId,
          tenantId: invitation.tenantId,
          assignedBy: invitation.invitedBy, // 招待者のIDを使用
          expiresAt: null,
        },
      });
    }

    // Invitationレコードを削除（二度使えないようにする）
    await tx.invitation.delete({
      where: {
        id: invitation.id,
      },
    });

    return user;
  });

  // 自動ログイン（オプション）
  // 注意: NextAuth.js v5では、signIn関数の使用方法が異なる可能性があります
  // ここでは、ユーザーをログインページへリダイレクトすることを推奨します

  return {
    success: true,
    userId: result.id,
    email: result.email,
  };
}

