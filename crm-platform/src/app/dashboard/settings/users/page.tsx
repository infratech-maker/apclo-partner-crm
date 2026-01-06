import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getUsers } from "@/lib/actions/users";
import { UserTable } from "@/components/users/user-table";
import { InviteUserDialog } from "@/components/users/invite-user-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus } from "lucide-react";
import { UsersPageClient } from "@/components/users/users-page-client";

export default async function UsersPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // 権限チェック: Userロールはアクセス不可
  if (session.user.role === "User") {
    redirect("/dashboard");
  }

  // ユーザー一覧を取得
  let users: Awaited<ReturnType<typeof getUsers>> = [];
  try {
    users = await getUsers();
  } catch (error) {
    console.error("Failed to fetch users:", error);
    // エラーが発生した場合は空配列を返す
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Users (ユーザー管理)
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            ユーザーの管理と招待を行います
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>ユーザー一覧</CardTitle>
              <CardDescription>
                登録済みユーザーと招待中のユーザーを表示します
              </CardDescription>
            </div>
            <UsersPageClient initialUsers={users} />
          </div>
        </CardHeader>
        <CardContent>
          <UserTable users={users} />
        </CardContent>
      </Card>
    </div>
  );
}
