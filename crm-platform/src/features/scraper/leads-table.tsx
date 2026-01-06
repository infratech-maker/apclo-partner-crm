"use client";

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFacetedMinMaxValues,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

type Lead = {
  id: string;
  source: string;
  data: any;
  status: string;
  createdAt: string | null; // ISO string形式
  updatedAt: string | null; // ISO string形式
};

function formatDate(date: string | null) {
  if (!date) return "-";
  try {
    return new Date(date).toLocaleString("ja-JP");
  } catch {
    return "-";
  }
}

// カテゴリからスラッシュより後ろの部分のみを抽出
function extractCategory(category: string | null | undefined): string {
  if (!category) return "-";
  const parts = category.split("/");
  if (parts.length > 1) {
    return parts[parts.length - 1].trim();
  }
  return category.trim();
}

// 住所の表示
function formatAddress(address: string | null | undefined): string {
  if (!address) return "-";
  return address;
}

const columns: ColumnDef<Lead>[] = [
  {
    accessorKey: "id",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="ID" />
    ),
    cell: ({ row }) => (
      <span className="font-mono text-xs">{String(row.getValue("id")).slice(0, 8)}...</span>
    ),
  },
  {
    id: "name",
    header: ({ column, table }) => {
      try {
        const columnInstance = table.getColumn("name");
        const facetedValues = columnInstance?.getFacetedUniqueValues();
        // facetedValuesが存在し、Mapであり、size > 0の場合のみ渡す
        const validFacetedValues = (facetedValues instanceof Map && facetedValues.size > 0) ? facetedValues : undefined;
        return (
          <DataTableColumnHeader column={column} title="店舗名" facetedValues={validFacetedValues} />
        );
      } catch (error) {
        console.error("Error in name header:", error);
        return (
          <DataTableColumnHeader column={column} title="店舗名" />
        );
      }
    },
    cell: ({ row }) => {
      const data = row.original.data as any;
      let name = "-";
      let isFranchise = false;
      
      if (data) {
        if (typeof data === "object" && data !== null) {
          name = data.name || data.store_name || "-";
          isFranchise = data.is_franchise === true;
        } else if (typeof data === "string") {
          try {
            const parsed = JSON.parse(data);
            name = parsed.name || parsed.store_name || "-";
            isFranchise = parsed.is_franchise === true;
          } catch {
            name = "-";
          }
        }
      }
      
      return (
        <div className="flex items-center gap-2">
          <span className="font-medium">{name}</span>
          {isFranchise && (
            <Badge variant="secondary" className="text-xs">
              FC/系列
            </Badge>
          )}
        </div>
      );
    },
    filterFn: (row, id, value) => {
      if (!value || (Array.isArray(value) && value.length === 0) || (typeof value === "string" && value.length === 0)) return true;
      const data = row.original.data as any;
      const name = (typeof data === "object" && data?.name ? data.name : "").toLowerCase();
      return Array.isArray(value) ? value.some((v) => name.includes(v.toLowerCase())) : name.includes(value.toLowerCase());
    },
  },
  {
    id: "address",
    header: "住所・アクセス",
    cell: ({ row }) => {
      const data = row.original.data as any;
      let address: string | null = null;
      
      if (data) {
        if (typeof data === "object" && data !== null) {
          address = data.address || data.住所 || data.location || null;
        } else if (typeof data === "string") {
          try {
            const parsed = JSON.parse(data);
            address = parsed.address || parsed.住所 || parsed.location || null;
          } catch {
            address = null;
          }
        }
      }
      
      return (
        <span className="text-sm text-gray-600" title={address || "-"}>
          {formatAddress(address)}
        </span>
      );
    },
  },
  {
    id: "category",
    header: ({ column, table }) => {
      try {
        const columnInstance = table.getColumn("category");
        const facetedValues = columnInstance?.getFacetedUniqueValues();
        const validFacetedValues = (facetedValues instanceof Map && facetedValues.size > 0) ? facetedValues : undefined;
        return (
          <DataTableColumnHeader column={column} title="カテゴリ" facetedValues={validFacetedValues} />
        );
      } catch (error) {
        console.error("Error in category header:", error);
        return (
          <DataTableColumnHeader column={column} title="カテゴリ" />
        );
      }
    },
    cell: ({ row }) => {
      const data = row.original.data as any;
      let category: string | null = null;
      
      if (data) {
        if (typeof data === "object" && data !== null) {
          category = data.category || data.カテゴリ || data.genre || null;
        } else if (typeof data === "string") {
          try {
            const parsed = JSON.parse(data);
            category = parsed.category || parsed.カテゴリ || parsed.genre || null;
          } catch {
            category = null;
          }
        }
      }
      
      const extracted = extractCategory(category);
      return <span className="text-sm">{extracted}</span>;
    },
    filterFn: (row, id, value) => {
      if (!value || (Array.isArray(value) && value.length === 0) || (typeof value === "string" && value.length === 0)) return true;
      const data = row.original.data as any;
      const category = (typeof data === "object" && data?.category ? data.category : "");
      const extracted = extractCategory(category).toLowerCase();
      return Array.isArray(value) ? value.some((v) => extracted.includes(v.toLowerCase())) : extracted.includes(value.toLowerCase());
    },
  },
  {
    id: "phone",
    header: ({ column, table }) => {
      try {
        const columnInstance = table.getColumn("phone");
        const facetedValues = columnInstance?.getFacetedUniqueValues();
        const validFacetedValues = (facetedValues instanceof Map && facetedValues.size > 0) ? facetedValues : undefined;
        return (
          <DataTableColumnHeader column={column} title="電話番号" facetedValues={validFacetedValues} />
        );
      } catch (error) {
        console.error("Error in phone header:", error);
        return (
          <DataTableColumnHeader column={column} title="電話番号" />
        );
      }
    },
    accessorFn: (row) => {
      const data = row.data as any;
      return data?.phone || data?.電話番号 || "";
    },
    filterFn: (row, id, value) => {
      if (!value || (Array.isArray(value) && value.length === 0) || (typeof value === "string" && value.length === 0)) return true;
      const data = row.original.data as any;
      const phone = (typeof data === "object" && data?.phone ? data.phone : "").toLowerCase();
      return Array.isArray(value) ? value.some((v) => phone.includes(v.toLowerCase())) : phone.includes(value.toLowerCase());
    },
    cell: ({ row }) => {
      const data = row.original.data as any;
      let phone: string | null = null;
      
      if (data) {
        if (typeof data === "object" && data !== null) {
          phone = data.phone || data.電話番号 || null;
        } else if (typeof data === "string") {
          try {
            const parsed = JSON.parse(data);
            phone = parsed.phone || parsed.電話番号 || null;
          } catch {
            phone = null;
          }
        }
      }
      
      return (
        <span className="text-sm font-mono">
          {phone || "-"}
        </span>
      );
    },
  },
  {
    id: "open_date",
    header: ({ column, table }) => {
      try {
        const columnInstance = table.getColumn("open_date");
        const facetedValues = columnInstance?.getFacetedUniqueValues();
        const validFacetedValues = (facetedValues instanceof Map && facetedValues.size > 0) ? facetedValues : undefined;
        return (
          <DataTableColumnHeader column={column} title="オープン日" facetedValues={validFacetedValues} />
        );
      } catch (error) {
        console.error("Error in open_date header:", error);
        return (
          <DataTableColumnHeader column={column} title="オープン日" />
        );
      }
    },
    accessorFn: (row) => {
      const data = row.data as any;
      return data?.open_date || data?.オープン日 || "";
    },
    filterFn: (row, id, value) => {
      if (!value || (Array.isArray(value) && value.length === 0) || (typeof value === "string" && value.length === 0)) return true;
      const data = row.original.data as any;
      const openDate = (typeof data === "object" && data?.open_date ? data.open_date : "").toLowerCase();
      return Array.isArray(value) ? value.some((v) => openDate.includes(v.toLowerCase())) : openDate.includes(value.toLowerCase());
    },
    cell: ({ row }) => {
      const data = row.original.data as any;
      let openDate: string | null = null;
      
      if (data) {
        if (typeof data === "object" && data !== null) {
          openDate = data.open_date || data.オープン日 || null;
        } else if (typeof data === "string") {
          try {
            const parsed = JSON.parse(data);
            openDate = parsed.open_date || parsed.オープン日 || null;
          } catch {
            openDate = null;
          }
        }
      }
      
      return (
        <span className="text-sm">
          {openDate || "-"}
        </span>
      );
    },
  },
  {
    id: "business_hours",
    header: ({ column, table }) => {
      try {
        const columnInstance = table.getColumn("business_hours");
        const facetedValues = columnInstance?.getFacetedUniqueValues();
        const validFacetedValues = (facetedValues instanceof Map && facetedValues.size > 0) ? facetedValues : undefined;
        return (
          <DataTableColumnHeader column={column} title="営業時間" facetedValues={validFacetedValues} />
        );
      } catch (error) {
        console.error("Error in business_hours header:", error);
        return (
          <DataTableColumnHeader column={column} title="営業時間" />
        );
      }
    },
    accessorFn: (row) => {
      const data = row.data as any;
      return data?.business_hours || data?.営業時間 || data?.regular_holiday || data?.定休日 || "";
    },
    filterFn: (row, id, value) => {
      if (!value || (Array.isArray(value) && value.length === 0) || (typeof value === "string" && value.length === 0)) return true;
      const data = row.original.data as any;
      const businessHours = (typeof data === "object" && data ? (data.business_hours || data.営業時間 || data.regular_holiday || data.定休日 || "") : "").toLowerCase();
      return Array.isArray(value) ? value.some((v) => businessHours.includes(v.toLowerCase())) : businessHours.includes(value.toLowerCase());
    },
    cell: ({ row }) => {
      const data = row.original.data as any;
      let businessHours: string | null = null;
      
      if (data) {
        if (typeof data === "object" && data !== null) {
          // business_hoursを優先、なければregular_holiday
          businessHours = data.business_hours || data.営業時間 || data.regular_holiday || data.定休日 || null;
        } else if (typeof data === "string") {
          try {
            const parsed = JSON.parse(data);
            businessHours = parsed.business_hours || parsed.営業時間 || parsed.regular_holiday || parsed.定休日 || null;
          } catch {
            businessHours = null;
          }
        }
      }
      
      return (
        <span className="text-sm" title={businessHours || "-"}>
          {businessHours && businessHours.length > 30 
            ? `${businessHours.slice(0, 30)}...` 
            : (businessHours || "-")}
        </span>
      );
    },
  },
  {
    id: "transport",
    header: ({ column, table }) => {
      try {
        const columnInstance = table.getColumn("transport");
        const facetedValues = columnInstance?.getFacetedUniqueValues();
        const validFacetedValues = (facetedValues instanceof Map && facetedValues.size > 0) ? facetedValues : undefined;
        return (
          <DataTableColumnHeader column={column} title="交通手段" facetedValues={validFacetedValues} />
        );
      } catch (error) {
        console.error("Error in transport header:", error);
        return (
          <DataTableColumnHeader column={column} title="交通手段" />
        );
      }
    },
    accessorFn: (row) => {
      const data = row.data as any;
      return data?.transport || data?.交通手段 || "";
    },
    filterFn: (row, id, value) => {
      if (!value || (Array.isArray(value) && value.length === 0) || (typeof value === "string" && value.length === 0)) return true;
      const data = row.original.data as any;
      const transport = (typeof data === "object" && data?.transport ? data.transport : "").toLowerCase();
      return Array.isArray(value) ? value.some((v) => transport.includes(v.toLowerCase())) : transport.includes(value.toLowerCase());
    },
    cell: ({ row }) => {
      const data = row.original.data as any;
      let transport: string | null = null;
      
      if (data) {
        if (typeof data === "object" && data !== null) {
          transport = data.transport || data.交通手段 || null;
        } else if (typeof data === "string") {
          try {
            const parsed = JSON.parse(data);
            transport = parsed.transport || parsed.交通手段 || null;
          } catch {
            transport = null;
          }
        }
      }
      
      return (
        <span className="text-sm text-gray-600" title={transport || "-"}>
          {transport && transport.length > 20 
            ? `${transport.slice(0, 20)}...` 
            : (transport || "-")}
        </span>
      );
    },
  },
  {
    id: "budget",
    header: ({ column, table }) => {
      try {
        const columnInstance = table.getColumn("budget");
        const facetedValues = columnInstance?.getFacetedUniqueValues();
        const validFacetedValues = (facetedValues instanceof Map && facetedValues.size > 0) ? facetedValues : undefined;
        return (
          <DataTableColumnHeader column={column} title="予算" facetedValues={validFacetedValues} />
        );
      } catch (error) {
        console.error("Error in budget header:", error);
        return (
          <DataTableColumnHeader column={column} title="予算" />
        );
      }
    },
    accessorFn: (row) => {
      const data = row.data as any;
      return data?.budget || data?.予算 || "";
    },
    filterFn: (row, id, value) => {
      if (!value || (Array.isArray(value) && value.length === 0) || (typeof value === "string" && value.length === 0)) return true;
      const data = row.original.data as any;
      const budget = (typeof data === "object" && data?.budget ? data.budget : "").toLowerCase();
      return Array.isArray(value) ? value.some((v) => budget.includes(v.toLowerCase())) : budget.includes(value.toLowerCase());
    },
    cell: ({ row }) => {
      const data = row.original.data as any;
      let budget: string | null = null;
      
      if (data) {
        if (typeof data === "object" && data !== null) {
          budget = data.budget || data.予算 || null;
        } else if (typeof data === "string") {
          try {
            const parsed = JSON.parse(data);
            budget = parsed.budget || parsed.予算 || null;
          } catch {
            budget = null;
          }
        }
      }
      
      return (
        <span className="text-sm font-medium">
          {budget ? (
            <span className="text-green-700">¥ {budget}</span>
          ) : (
            "-"
          )}
        </span>
      );
    },
  },
  {
    id: "related_stores",
    header: ({ column, table }) => {
      try {
        const columnInstance = table.getColumn("related_stores");
        const facetedValues = columnInstance?.getFacetedUniqueValues();
        const validFacetedValues = (facetedValues instanceof Map && facetedValues.size > 0) ? facetedValues : undefined;
        return (
          <DataTableColumnHeader column={column} title="関連店舗" facetedValues={validFacetedValues} />
        );
      } catch (error) {
        console.error("Error in related_stores header:", error);
        return (
          <DataTableColumnHeader column={column} title="関連店舗" />
        );
      }
    },
    accessorFn: (row) => {
      const data = row.data as any;
      const relatedStores = data?.related_stores || data?.関連店舗;
      if (Array.isArray(relatedStores)) {
        return relatedStores.join(", ");
      }
      return relatedStores ? "あり" : "";
    },
    filterFn: (row, id, value) => {
      if (!value || (Array.isArray(value) && value.length === 0) || (typeof value === "string" && value.length === 0)) return true;
      const data = row.original.data as any;
      const relatedStores = data?.related_stores || data?.関連店舗;
      const hasRelatedStores = Array.isArray(relatedStores) ? relatedStores.length > 0 : (typeof relatedStores === "string" && relatedStores.length > 0);
      const displayValue = hasRelatedStores ? "あり" : "なし";
      return Array.isArray(value) ? value.some((v) => displayValue.includes(v.toLowerCase())) : displayValue.includes(value.toLowerCase());
    },
    cell: ({ row }) => {
      const data = row.original.data as any;
      let relatedStores: string | string[] | null = null;
      
      if (data) {
        if (typeof data === "object" && data !== null) {
          relatedStores = data.related_stores || data.関連店舗 || null;
        } else if (typeof data === "string") {
          try {
            const parsed = JSON.parse(data);
            relatedStores = parsed.related_stores || parsed.関連店舗 || null;
          } catch {
            relatedStores = null;
          }
        }
      }
      
      if (!relatedStores) {
        return <span className="text-sm text-gray-400">-</span>;
      }
      
      const hasRelatedStores = Array.isArray(relatedStores) 
        ? relatedStores.length > 0 
        : typeof relatedStores === "string" && relatedStores.length > 0;
      
      return hasRelatedStores ? (
        <Badge variant="secondary" className="text-xs">
          系列店あり
        </Badge>
      ) : (
        <span className="text-sm text-gray-400">-</span>
      );
    },
  },
  {
    id: "city",
    header: ({ column, table }) => {
      try {
        const columnInstance = table.getColumn("city");
        const facetedValues = columnInstance?.getFacetedUniqueValues();
        const validFacetedValues = (facetedValues instanceof Map && facetedValues.size > 0) ? facetedValues : undefined;
        return (
          <DataTableColumnHeader column={column} title="都市" facetedValues={validFacetedValues} />
        );
      } catch (error) {
        console.error("Error in city header:", error);
        return (
          <DataTableColumnHeader column={column} title="都市" />
        );
      }
    },
    cell: ({ row }) => {
      const data = row.original.data as any;
      let city = "-";
      
      if (data) {
        if (typeof data === "object" && data !== null) {
          city = data.city || data.都市 || data.prefecture || data.都道府県 || "-";
        } else if (typeof data === "string") {
          try {
            const parsed = JSON.parse(data);
            city = parsed.city || parsed.都市 || parsed.prefecture || parsed.都道府県 || "-";
          } catch {
            city = "-";
          }
        }
      }
      
      return <span className="text-sm">{city}</span>;
    },
    filterFn: (row, id, value) => {
      if (!value || (Array.isArray(value) && value.length === 0) || (typeof value === "string" && value.length === 0)) return true;
      const data = row.original.data as any;
      const city = (typeof data === "object" && data ? (data.city || data.prefecture || "") : "").toLowerCase();
      return Array.isArray(value) ? value.some((v) => city.includes(v.toLowerCase())) : city.includes(value.toLowerCase());
    },
  },
  {
    accessorKey: "source",
    header: "Source",
    cell: ({ row }) => {
      const source = row.getValue("source");
      const sourceStr = typeof source === "string" ? source : String(source || "");
      
      // Source URLから表示名を取得
      const getSourceDisplayName = (url: string): string => {
        try {
          const urlObj = new URL(url);
          const hostname = urlObj.hostname;
          
          if (hostname.includes("tabelog.com")) {
            return "食べログ";
          }
          // 将来的に他のソースも追加可能
          // if (hostname.includes("example.com")) {
          //   return "Example";
          // }
          
          // デフォルト: ホスト名を表示
          return hostname.replace(/^www\./, "");
        } catch {
          // URL解析に失敗した場合は元のURLを返す
          return sourceStr;
        }
      };
      
      const displayName = getSourceDisplayName(sourceStr);
      
      return (
        <a
          href={sourceStr}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline text-xs"
          title={sourceStr}
        >
          {displayName}
        </a>
      );
    },
  },
  {
    accessorKey: "status",
    header: ({ column, table }) => {
      try {
        const columnInstance = table.getColumn("status");
        const facetedValues = columnInstance?.getFacetedUniqueValues();
        const validFacetedValues = (facetedValues instanceof Map && facetedValues.size > 0) ? facetedValues : undefined;
        return (
          <DataTableColumnHeader column={column} title="Status" facetedValues={validFacetedValues} />
        );
      } catch (error) {
        console.error("Error in status header:", error);
        return (
          <DataTableColumnHeader column={column} title="Status" />
        );
      }
    },
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      return (
        <Badge variant={status === "new" ? "secondary" : "default"}>
          {status}
        </Badge>
      );
    },
    filterFn: (row, id, value) => {
      if (!value || (Array.isArray(value) && value.length === 0) || (typeof value === "string" && value.length === 0)) return true;
      const status = row.getValue(id) as string;
      return Array.isArray(value) ? value.includes(status) : status === value;
    },
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Created At" />
    ),
    cell: ({ row }) => formatDate(row.getValue("createdAt")),
  },
  {
    accessorKey: "updatedAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Updated At" />
    ),
    cell: ({ row }) => formatDate(row.getValue("updatedAt")),
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => {
      const lead = row.original;
      return (
        <LeadDetailDialog lead={lead} />
      );
    },
  },
];

// リード詳細ダイアログコンポーネント
function LeadDetailDialog({ lead }: { lead: Lead }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          View Details
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>リード詳細</DialogTitle>
          <DialogDescription>
            ID: {lead.id}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div>
            <h3 className="font-semibold mb-2">基本情報</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">店舗名:</span>{" "}
                <span className="font-medium">{(lead.data as any)?.name || "-"}</span>
                {(lead.data as any)?.is_franchise && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    FC/系列
                  </Badge>
                )}
              </div>
              <div>
                <span className="text-gray-500">ステータス:</span>{" "}
                <Badge variant={lead.status === "new" ? "secondary" : "default"}>
                  {lead.status}
                </Badge>
              </div>
              <div>
                <span className="text-gray-500">電話番号:</span>{" "}
                <span className="font-mono">{(lead.data as any)?.phone || (lead.data as any)?.電話番号 || "-"}</span>
              </div>
              <div>
                <span className="text-gray-500">都市:</span>{" "}
                <span>{(lead.data as any)?.city || (lead.data as any)?.prefecture || "-"}</span>
              </div>
              <div>
                <span className="text-gray-500">カテゴリ:</span>{" "}
                <span>{extractCategory((lead.data as any)?.category)}</span>
              </div>
              <div>
                <span className="text-gray-500">オープン日:</span>{" "}
                <span>{(lead.data as any)?.open_date || (lead.data as any)?.オープン日 || "-"}</span>
              </div>
              <div>
                <span className="text-gray-500">営業時間:</span>{" "}
                <span>{(lead.data as any)?.business_hours || (lead.data as any)?.営業時間 || (lead.data as any)?.regular_holiday || (lead.data as any)?.定休日 || "-"}</span>
              </div>
              <div>
                <span className="text-gray-500">交通手段:</span>{" "}
                <span>{(lead.data as any)?.transport || (lead.data as any)?.交通手段 || "-"}</span>
              </div>
              <div>
                <span className="text-gray-500">予算:</span>{" "}
                <span className="font-medium text-green-700">
                  {(lead.data as any)?.budget || (lead.data as any)?.予算 ? `¥ ${(lead.data as any)?.budget || (lead.data as any)?.予算}` : "-"}
                </span>
              </div>
              <div>
                <span className="text-gray-500">関連店舗:</span>{" "}
                {(lead.data as any)?.related_stores ? (
                  <Badge variant="secondary" className="text-xs">
                    系列店あり
                  </Badge>
                ) : (
                  <span>-</span>
                )}
              </div>
              <div>
                <span className="text-gray-500">フランチャイズ:</span>{" "}
                <span>{(lead.data as any)?.is_franchise ? "はい" : "いいえ"}</span>
              </div>
              <div className="col-span-2">
                <span className="text-gray-500">Source:</span>{" "}
                <a
                  href={lead.source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                  title={lead.source}
                >
                  {(() => {
                    try {
                      const urlObj = new URL(lead.source);
                      const hostname = urlObj.hostname;
                      if (hostname.includes("tabelog.com")) {
                        return "食べログ";
                      }
                      return hostname.replace(/^www\./, "");
                    } catch {
                      return lead.source;
                    }
                  })()}
                </a>
              </div>
            </div>
          </div>
          <div>
            <h3 className="font-semibold mb-2">生データ (JSON)</h3>
            <pre className="bg-gray-100 p-4 rounded-md overflow-auto text-xs">
              {JSON.stringify(lead.data, null, 2)}
            </pre>
          </div>
          <div>
            <h3 className="font-semibold mb-2">メタデータ</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">作成日時:</span>{" "}
                <span>{formatDate(lead.createdAt)}</span>
              </div>
              <div>
                <span className="text-gray-500">更新日時:</span>{" "}
                <span>{formatDate(lead.updatedAt)}</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type LeadsTableProps = {
  initialLeads: Lead[];
  totalCount: number;
  page: number;
  totalPages: number;
};

export function LeadsTable({ 
  initialLeads, 
  totalCount, 
  page,
  totalPages,
}: LeadsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    router.push(`/dashboard/leads?${params.toString()}`);
  };

  const table = useReactTable({
    data: initialLeads,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedMinMaxValues: getFacetedMinMaxValues(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
  });

  if (initialLeads.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-gray-500">
        リードがありません
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 総件数表示 */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          <span className="font-semibold">Total Records: {totalCount}件</span>
          {" "}
          <span className="text-gray-500">
            (表示中: {initialLeads.length}件 / ページ {page}/{totalPages})
          </span>
        </div>
      </div>

      {/* グローバル検索 */}
      <div className="flex items-center gap-4">
        <Input
          placeholder="店舗名で検索..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-sm"
        />
        {(columnFilters.length > 0 || globalFilter) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setColumnFilters([]);
              setGlobalFilter("");
            }}
          >
            フィルターをクリア
          </Button>
        )}
      </div>

      {/* テーブル */}
      <div className="overflow-x-auto border rounded-md">
        <table className="w-full border-collapse">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-gray-200 bg-gray-50">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-200">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 text-sm">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ページネーション */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          ページ {page} / {totalPages} ({totalCount}件中)
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(1)}
            disabled={page === 1}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(page - 1)}
            disabled={page === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(totalPages)}
            disabled={page >= totalPages}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {table.getFilteredRowModel().rows.length === 0 && (
        <div className="py-8 text-center text-sm text-gray-500">
          フィルター条件に一致するリードがありません
        </div>
      )}
    </div>
  );
}
