"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { inviteUser, getOrganizations, getRoles } from "@/lib/actions/users";

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface Organization {
  id: string;
  name: string;
  code: string | null;
  type: string;
}

interface Role {
  id: string;
  name: string;
  description: string | null;
}

export function InviteUserDialog({
  open,
  onOpenChange,
  onSuccess,
}: InviteUserDialogProps) {
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState("");
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // ダイアログが開いたときに組織とロールを取得
  useEffect(() => {
    if (open) {
      setIsLoadingData(true);
      Promise.all([getOrganizations(), getRoles()])
        .then(([orgs, roleList]) => {
          setOrganizations(orgs);
          setRoles(roleList);
          setIsLoadingData(false);
        })
        .catch((err) => {
          console.error("Failed to load data:", err);
          setError(err.message);
          setIsLoadingData(false);
        });
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await inviteUser(email, roleId, organizationId);
      // 成功時の処理
      setEmail("");
      setRoleId("");
      setOrganizationId(null);
      onOpenChange(false);
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "招待に失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setEmail("");
    setRoleId("");
    setOrganizationId(null);
    setError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>ユーザーを招待</DialogTitle>
          <DialogDescription>
            新しいユーザーに招待メールを送信します。招待リンクはコンソールに出力されます。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="email">メールアドレス</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">ロール</Label>
              {isLoadingData ? (
                <div className="h-10 rounded-md border border-gray-200 flex items-center justify-center text-sm text-gray-500">
                  読み込み中...
                </div>
              ) : (
                <Select
                  value={roleId}
                  onValueChange={setRoleId}
                  required
                  disabled={isLoading}
                >
                  <SelectTrigger id="role">
                    <SelectValue placeholder="ロールを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="organization">組織（オプション）</Label>
              {isLoadingData ? (
                <div className="h-10 rounded-md border border-gray-200 flex items-center justify-center text-sm text-gray-500">
                  読み込み中...
                </div>
              ) : (
                <Select
                  value={organizationId || ""}
                  onValueChange={(value) =>
                    setOrganizationId(value || null)
                  }
                  disabled={isLoading}
                >
                  <SelectTrigger id="organization">
                    <SelectValue placeholder="組織を選択（任意）" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">未設定</SelectItem>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name} {org.code && `(${org.code})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
                {error}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              キャンセル
            </Button>
            <Button type="submit" disabled={isLoading || isLoadingData}>
              {isLoading ? "送信中..." : "招待を送信"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

