import { cn } from "@/lib/utils";

interface LeadStatusBadgeProps {
  status: string;
  className?: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  NEW: { label: "新規", className: "bg-blue-100 text-blue-800" },
  CALLING: { label: "架電中", className: "bg-yellow-100 text-yellow-800" },
  CONNECTED: { label: "接続済み", className: "bg-green-100 text-green-800" },
  APPOINTMENT: { label: "アポイント獲得", className: "bg-purple-100 text-purple-800" },
  NG: { label: "お断り", className: "bg-red-100 text-red-800" },
  CALLBACK: { label: "掛け直し", className: "bg-orange-100 text-orange-800" },
  // 旧形式のステータスも対応
  new: { label: "新規", className: "bg-blue-100 text-blue-800" },
  contacted: { label: "接触済み", className: "bg-yellow-100 text-yellow-800" },
  qualified: { label: "見込み", className: "bg-green-100 text-green-800" },
  converted: { label: "成約", className: "bg-purple-100 text-purple-800" },
  lost: { label: "失注", className: "bg-red-100 text-red-800" },
};

export function LeadStatusBadge({ status, className }: LeadStatusBadgeProps) {
  const statusInfo = statusConfig[status] || {
    label: status,
    className: "bg-gray-100 text-gray-800",
  };

  return (
    <span
      className={cn(
        "px-2 py-1 rounded-full text-xs font-medium",
        statusInfo.className,
        className
      )}
    >
      {statusInfo.label}
    </span>
  );
}

