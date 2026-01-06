"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { LeadStatusBadge } from "./lead-status-badge";
import { ActivityLogSection } from "./activity-log-section";
import { updateLead } from "@/lib/actions/leads";
import { ExternalLink, Phone, MapPin, Link as LinkIcon } from "lucide-react";
import { useRouter } from "next/navigation";

interface Lead {
  id: string;
  source: string;
  data: any;
  status: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface LeadDetailSheetProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_OPTIONS = [
  { value: "NEW", label: "新規" },
  { value: "CALLING", label: "架電中" },
  { value: "CONNECTED", label: "接続済み" },
  { value: "APPOINTMENT", label: "アポイント獲得" },
  { value: "NG", label: "お断り" },
  { value: "CALLBACK", label: "掛け直し" },
];

export function LeadDetailSheet({
  lead,
  open,
  onOpenChange,
}: LeadDetailSheetProps) {
  const router = useRouter();
  const [status, setStatus] = useState(lead?.status || "NEW");
  const [notes, setNotes] = useState(lead?.notes || "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  // リードが変更されたときに状態を更新
  useEffect(() => {
    if (lead) {
      setStatus(lead.status || "NEW");
      setNotes(lead.notes || "");
      setError("");
    }
  }, [lead]);

  const handleStatusChange = async (newStatus: string) => {
    if (!lead) return;

    setStatus(newStatus);
    setIsSaving(true);
    setError("");

    try {
      await updateLead(lead.id, { status: newStatus });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ステータスの更新に失敗しました。");
      setStatus(lead.status); // 元に戻す
    } finally {
      setIsSaving(false);
    }
  };

  const handleNotesSave = async () => {
    if (!lead) return;

    setIsSaving(true);
    setError("");

    try {
      await updateLead(lead.id, { notes });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "メモの保存に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  };

  if (!lead) {
    return null;
  }

  const data = lead.data || {};
  const storeName = data.name || data.store_name || data.店舗名 || "店舗名不明";
  const phone = data.phone || data.phone_number || data.電話番号 || "-";
  const address = data.address || data.詳細住所 || data.住所 || "-";
  const url = lead.source || "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span>{storeName}</span>
            <LeadStatusBadge status={status} />
          </SheetTitle>
          <SheetDescription>
            作成日: {new Date(lead.createdAt).toLocaleDateString("ja-JP")}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* 基本情報 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">基本情報</h3>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-gray-500" />
                電話番号
              </Label>
              <div className="text-sm text-gray-700">
                {phone !== "-" ? (
                  <a
                    href={`tel:${phone}`}
                    className="text-blue-600 hover:text-blue-700 underline"
                  >
                    {phone}
                  </a>
                ) : (
                  phone
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-gray-500" />
                住所
              </Label>
              <div className="text-sm text-gray-700">{address}</div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <LinkIcon className="h-4 w-4 text-gray-500" />
                URL
              </Label>
              <div className="text-sm">
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 underline flex items-center gap-1"
                  >
                    {url}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="text-gray-500">-</span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>インポート元</Label>
              <div className="text-sm text-gray-700">
                {lead.source || "不明"}
              </div>
            </div>
          </div>

          {/* ステータス変更 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">ステータス</h3>
            <div className="space-y-2">
              <Label>ステータスを変更</Label>
              <Select
                value={status}
                onValueChange={handleStatusChange}
                disabled={isSaving}
              >
                <SelectTrigger>
                  <SelectValue placeholder="ステータスを選択" />
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
          </div>

          {/* メモ/コメント */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">メモ</h3>
            <div className="space-y-2">
              <Label>架電メモ・コメント</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="架電時のメモやコメントを入力してください..."
                rows={6}
                disabled={isSaving}
              />
              <Button
                onClick={handleNotesSave}
                disabled={isSaving || notes === (lead.notes || "")}
                size="sm"
              >
                {isSaving ? "保存中..." : "メモを保存"}
              </Button>
            </div>
          </div>

          {/* アクティビティログ */}
          <ActivityLogSection
            leadId={lead.id}
            currentStatus={status}
            onStatusChange={(newStatus) => {
              setStatus(newStatus);
              // リードデータも更新するため、親コンポーネントに通知
              router.refresh();
            }}
          />

          {/* エラーメッセージ */}
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

