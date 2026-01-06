"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { acceptInvitation } from "@/lib/actions/invitation";

interface AcceptInviteFormProps {
  email: string;
  token: string;
  tenantName?: string;
  organizationName?: string | null;
  roleName?: string | null;
}

export function AcceptInviteForm({
  email,
  token,
  tenantName,
  organizationName,
  roleName,
}: AcceptInviteFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // バリデーション
    if (!name.trim()) {
      setError("名前を入力してください。");
      return;
    }

    if (!password) {
      setError("パスワードを入力してください。");
      return;
    }

    if (password.length < 8) {
      setError("パスワードは8文字以上である必要があります。");
      return;
    }

    if (password !== confirmPassword) {
      setError("パスワードが一致しません。");
      return;
    }

    setIsLoading(true);

    try {
      const result = await acceptInvitation(token, name, password);

      if (result.success) {
        // 登録成功後、ログインページへリダイレクト
        router.push("/login?registered=true");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました。");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>アカウント登録</CardTitle>
        <CardDescription>
          {tenantName && (
            <div className="mt-2 space-y-1 text-sm">
              <p>テナント: {tenantName}</p>
              {organizationName && <p>組織: {organizationName}</p>}
              {roleName && <p>ロール: {roleName}</p>}
            </div>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">メールアドレス</Label>
            <Input
              id="email"
              type="email"
              value={email}
              disabled
              className="bg-gray-50"
            />
            <p className="text-xs text-gray-500">
              このメールアドレスで登録されます
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">名前</Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="山田 太郎"
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">パスワード</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8文字以上"
              required
              disabled={isLoading}
              minLength={8}
            />
            <p className="text-xs text-gray-500">
              8文字以上で入力してください
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">パスワード（確認）</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="パスワードを再入力"
              required
              disabled={isLoading}
              minLength={8}
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "登録中..." : "登録を完了する"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

