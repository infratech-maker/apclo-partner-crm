import { notFound, redirect } from "next/navigation";
import { verifyInvitationToken } from "@/lib/actions/invitation";
import { AcceptInviteForm } from "@/components/auth/accept-invite-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;

  // トークンを検証
  const verification = await verifyInvitationToken(token);

  if (!verification.valid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              <CardTitle className="text-red-600">招待リンクが無効です</CardTitle>
            </div>
            <CardDescription>
              {verification.message}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                この招待リンクは使用できないか、有効期限が切れています。
                新しい招待リンクを管理者に依頼してください。
              </p>
              <a
                href="/login"
                className="text-sm text-blue-600 hover:text-blue-700 underline"
              >
                ログインページに戻る
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { invitation } = verification;

  if (!invitation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              <CardTitle className="text-red-600">招待情報が見つかりません</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              招待情報を取得できませんでした。
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
            アカウント登録
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {invitation.tenantName} への招待を受諾します
          </p>
        </div>

        <AcceptInviteForm
          email={invitation.email}
          token={token}
          tenantName={invitation.tenantName}
          organizationName={invitation.organizationName}
          roleName={invitation.roleName}
        />
      </div>
    </div>
  );
}

