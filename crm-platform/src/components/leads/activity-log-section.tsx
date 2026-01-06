"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getActivityLogs, createActivityLog } from "@/lib/actions/activity-logs";
import { ActivityType } from "@prisma/client";
import { Phone, Mail, MapPin, MessageSquare, MoreHorizontal, Plus, Clock, User } from "lucide-react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { LeadStatusBadge } from "./lead-status-badge";

interface ActivityLog {
  id: string;
  type: ActivityType;
  status: string;
  note: string | null;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
}

interface ActivityLogSectionProps {
  leadId: string;
  currentStatus?: string;
  onStatusChange?: (status: string) => void;
}

const ACTIVITY_TYPE_OPTIONS = [
  { value: "CALL", label: "架電", icon: Phone },
  { value: "VISIT", label: "訪問", icon: MapPin },
  { value: "EMAIL", label: "メール", icon: Mail },
  { value: "CHAT", label: "チャット/SNS", icon: MessageSquare },
  { value: "OTHER", label: "その他", icon: MoreHorizontal },
];

const STATUS_OPTIONS = [
  { value: "", label: "変更なし" },
  { value: "NEW", label: "新規" },
  { value: "CALLING", label: "架電中" },
  { value: "CONNECTED", label: "接続済み" },
  { value: "APPOINTMENT", label: "アポイント獲得" },
  { value: "NG", label: "お断り" },
  { value: "CALLBACK", label: "掛け直し" },
];

const getActivityTypeIcon = (type: ActivityType) => {
  const option = ACTIVITY_TYPE_OPTIONS.find((opt) => opt.value === type);
  return option?.icon || MoreHorizontal;
};

const getActivityTypeLabel = (type: ActivityType) => {
  const option = ACTIVITY_TYPE_OPTIONS.find((opt) => opt.value === type);
  return option?.label || "その他";
};

export function ActivityLogSection({
  leadId,
  currentStatus,
  onStatusChange,
}: ActivityLogSectionProps) {
  const router = useRouter();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // フォーム状態
  const [type, setType] = useState<ActivityType>("CALL");
  const [status, setStatus] = useState("");
  const [note, setNote] = useState("");

  // アクティビティログを取得
  useEffect(() => {
    if (leadId) {
      loadLogs();
    }
  }, [leadId]);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const data = await getActivityLogs(leadId);
      setLogs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "アクティビティログの取得に失敗しました。");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim() && !status) {
      setError("メモまたはステータスを入力してください。");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      // ステータスが空文字列の場合は、現在のリードのステータスを使用
      // サーバー側で「変更なし」として処理される
      const finalStatus = status || currentStatus || "";
      await createActivityLog(leadId, type, finalStatus, note || undefined);
      
      // ステータスが変更された場合は親コンポーネントに通知
      if (status && status !== currentStatus && onStatusChange) {
        onStatusChange(status);
      }
      
      setNote("");
      setType("CALL");
      setStatus("");
      setIsDialogOpen(false);
      router.refresh();
      await loadLogs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "アクティビティログの作成に失敗しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="text-sm text-gray-500">読み込み中...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">活動履歴</h3>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              活動を記録
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>活動を記録</DialogTitle>
              <DialogDescription>
                架電、訪問、メールなどの活動を記録します
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>活動種別</Label>
                <Select
                  value={type}
                  onValueChange={(value) => setType(value as ActivityType)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTIVITY_TYPE_OPTIONS.map((option) => {
                      const Icon = option.icon;
                      return (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            {option.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>ステータス</Label>
                <Select
                  value={status}
                  onValueChange={setStatus}
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>メモ</Label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="活動の詳細を記録してください..."
                  rows={4}
                  disabled={isSubmitting}
                />
              </div>

              {error && (
                <div className="rounded-md bg-red-50 p-4">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={isSubmitting}
                >
                  キャンセル
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "保存中..." : "記録する"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {logs.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          活動履歴がありません
        </div>
      ) : (
        <div className="space-y-4">
          {logs.map((log) => {
            const Icon = getActivityTypeIcon(log.type);
            return (
              <div
                key={log.id}
                className="border rounded-lg p-4 space-y-2 bg-white"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-blue-100">
                      <Icon className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {getActivityTypeLabel(log.type)}
                        </span>
                        <LeadStatusBadge status={log.status} />
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                        <User className="h-3 w-3" />
                        <span>{log.user.name}</span>
                        <Clock className="h-3 w-3 ml-2" />
                        <span>
                          {format(new Date(log.createdAt), "yyyy年MM月dd日 HH:mm")}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                {log.note && (
                  <div className="pl-12 text-sm text-gray-700 bg-gray-50 rounded p-2 whitespace-pre-wrap break-words overflow-wrap-anywhere">
                    {log.note}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

