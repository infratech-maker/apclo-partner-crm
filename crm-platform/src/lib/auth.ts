import NextAuth, { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

/**
 * NextAuth.js設定
 * 
 * 機能:
 * - Credentials Provider（Email/Password）による認証
 * - セッション情報の拡張（tenantId, organizationId, role, permissions）
 */
export const authConfig: NextAuthConfig = {
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        // ユーザーを検索（テナントIDは後で取得するため、まずはemailで検索）
        // 注意: tenantId_emailは複合UNIQUEなので、全テナントから検索する必要がある
        const user = await prisma.user.findFirst({
          where: {
            email: credentials.email as string,
          },
          include: {
            tenant: true,
            userOrganizations: {
              where: { isPrimary: true },
              include: {
                organization: true,
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
                  include: {
                    rolePermissions: {
                      include: {
                        permission: true,
                      },
                    },
                  },
                },
              },
            },
          },
        });

        if (!user) {
          throw new Error("Invalid email or password");
        }

        // ユーザーが無効な場合はログインを拒否
        if (!user.isActive) {
          throw new Error("User account is inactive");
        }

        // パスワードを検証
        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!isPasswordValid) {
          throw new Error("Invalid email or password");
        }

        // 主所属組織を取得
        const primaryOrganization = user.userOrganizations[0]?.organization;

        // ユーザーの権限を取得（すべてのロールの権限を結合）
        const permissions = new Set<string>();
        for (const userRole of user.userRoles) {
          for (const rolePermission of userRole.role.rolePermissions) {
            const permission = rolePermission.permission;
            permissions.add(`${permission.resource}:${permission.action}`);
          }
        }

        // ロール名を取得（最初のロールを使用、複数ある場合は優先順位を考慮）
        const roleName = user.userRoles[0]?.role.name || "User";

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          tenantId: user.tenantId,
          organizationId: primaryOrganization?.id || null,
          role: roleName,
          permissions: Array.from(permissions),
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      // 初回ログイン時、ユーザー情報をトークンに追加
      if (user) {
        token.id = user.id;
        token.tenantId = user.tenantId;
        token.organizationId = user.organizationId;
        token.role = user.role;
        token.permissions = user.permissions;
      }
      return token;
    },
    async session({ session, token }) {
      // セッションに拡張情報を追加
      if (session.user) {
        session.user.id = token.id as string;
        session.user.tenantId = token.tenantId as string;
        session.user.organizationId = token.organizationId as string | null;
        session.user.role = token.role as string;
        session.user.permissions = token.permissions as string[];
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export const { handlers, signIn, signOut, auth } = NextAuth(authConfig);

