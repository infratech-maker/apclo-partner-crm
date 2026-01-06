"use client";

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { LeadStatusBadge } from "./lead-status-badge";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";

interface Lead {
  id: string;
  source: string;
  data: any;
  status: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface LeadTableProps {
  leads: Lead[];
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onLeadClick?: (lead: Lead) => void;
}

// カテゴリからスラッシュより後ろの部分のみを抽出
function extractCategory(category: string | null | undefined): string {
  if (!category || category === "-") return "-";
  const parts = category.split("/");
  if (parts.length > 1) {
    return parts[parts.length - 1].trim();
  }
  return category.trim();
}

// URLから表示名を取得
function getSourceDisplayName(urlStr: string): string {
  if (!urlStr || urlStr === "-") return "-";
  try {
    const urlObj = new URL(urlStr);
    const hostname = urlObj.hostname;
    if (hostname.includes("tabelog.com")) {
      return "食べログ";
    }
    return hostname;
  } catch {
    return urlStr.length > 30 ? `${urlStr.slice(0, 30)}...` : urlStr;
  }
}

// デリバリー導入の判定
function getDeliveryStatus(data: any, source: string): string {
  const transport = data?.transport || data?.交通アクセス || "";
  const dataSource = data?.data_source || "";
  const sourceUrl = source || "";

  // transportフィールドにデリバリー関連の文字列が含まれているか
  if (transport && typeof transport === "string") {
    const transportLower = transport.toLowerCase();
    if (
      transportLower.includes("ubereats") ||
      transportLower.includes("デリバリー") ||
      transportLower.includes("delivery") ||
      transportLower.includes("出前館") ||
      transportLower.includes("menu") ||
      transportLower.includes("楽天デリバリー")
    ) {
      return "あり";
    }
  }

  // data_sourceがデリバリーサービスか
  if (dataSource && typeof dataSource === "string") {
    const sourceLower = dataSource.toLowerCase();
    if (
      sourceLower.includes("ubereats") ||
      sourceLower.includes("delivery") ||
      sourceLower.includes("デリバリー")
    ) {
      return "あり";
    }
  }

  // source URLから判定
  if (sourceUrl && typeof sourceUrl === "string") {
    const urlLower = sourceUrl.toLowerCase();
    if (
      urlLower.includes("ubereats") ||
      urlLower.includes("demae-can") ||
      urlLower.includes("menu")
    ) {
      return "あり";
    }
  }

  return "-";
}

const columns: ColumnDef<Lead>[] = [
  {
    id: "name",
    header: ({ column, table }) => {
      try {
        const columnInstance = table.getColumn("name");
        const facetedValues = columnInstance?.getFacetedUniqueValues();
        const validFacetedValues =
          facetedValues instanceof Map && facetedValues.size > 0
            ? facetedValues
            : undefined;
        return (
          <DataTableColumnHeader
            column={column}
            title="店舗名"
            facetedValues={validFacetedValues}
          />
        );
      } catch (error) {
        return <DataTableColumnHeader column={column} title="店舗名" />;
      }
    },
    accessorFn: (row: Lead) => {
      const data = row.data as any;
      if (!data || typeof data !== "object") return "-";
      return data.name || data.store_name || data.店舗名 || "-";
    },
    filterFn: (row, id, value) => {
      if (!value || (Array.isArray(value) && value.length === 0) || (typeof value === "string" && value.length === 0)) return true;
      const data = row.original.data as any;
      if (!data || typeof data !== "object") return false;
      const name = (data.name || data.store_name || data.店舗名 || "").toLowerCase();
      return Array.isArray(value)
        ? value.some((v) => name.includes(v.toLowerCase()))
        : name.includes(value.toLowerCase());
    },
    cell: ({ row }) => {
      const data = row.original.data as any;
      if (!data) return <span className="font-medium">-</span>;
      const storeName = data.name || data.store_name || data.店舗名 || "-";
      return <span className="font-medium">{storeName}</span>;
    },
  },
  {
    id: "category",
    header: ({ column, table }) => {
      try {
        const columnInstance = table.getColumn("category");
        const facetedValues = columnInstance?.getFacetedUniqueValues();
        const validFacetedValues =
          facetedValues instanceof Map && facetedValues.size > 0
            ? facetedValues
            : undefined;
        return (
          <DataTableColumnHeader
            column={column}
            title="カテゴリ"
            facetedValues={validFacetedValues}
          />
        );
      } catch (error) {
        return <DataTableColumnHeader column={column} title="カテゴリ" />;
      }
    },
    accessorFn: (row: Lead) => {
      const data = row.data as any;
      if (!data || typeof data !== "object") return "-";
      const category = data.category || data.カテゴリ || data.genre || "-";
      return extractCategory(category);
    },
    filterFn: (row, id, value) => {
      if (!value || (Array.isArray(value) && value.length === 0) || (typeof value === "string" && value.length === 0)) return true;
      const data = row.original.data as any;
      if (!data || typeof data !== "object") return false;
      const category = data.category || data.カテゴリ || data.genre || "";
      const extracted = extractCategory(category).toLowerCase();
      return Array.isArray(value)
        ? value.some((v) => extracted.includes(v.toLowerCase()))
        : extracted.includes(value.toLowerCase());
    },
    cell: ({ row }) => {
      const data = row.original.data as any;
      if (!data) return <span className="text-sm">-</span>;
      const category = data.category || data.カテゴリ || data.genre || "-";
      const extracted = extractCategory(category);
      return <span className="text-sm">{extracted}</span>;
    },
  },
  {
    id: "phone",
    header: ({ column, table }) => {
      try {
        const columnInstance = table.getColumn("phone");
        const facetedValues = columnInstance?.getFacetedUniqueValues();
        const validFacetedValues =
          facetedValues instanceof Map && facetedValues.size > 0
            ? facetedValues
            : undefined;
        return (
          <DataTableColumnHeader
            column={column}
            title="電話番号"
            facetedValues={validFacetedValues}
          />
        );
      } catch (error) {
        return <DataTableColumnHeader column={column} title="電話番号" />;
      }
    },
    accessorFn: (row: Lead) => {
      const data = row.data as any;
      if (!data || typeof data !== "object") return "-";
      return data.phone || data.phone_number || data.電話番号 || "-";
    },
    filterFn: (row, id, value) => {
      if (!value || (Array.isArray(value) && value.length === 0) || (typeof value === "string" && value.length === 0)) return true;
      const data = row.original.data as any;
      if (!data || typeof data !== "object") return false;
      const phone = (data.phone || data.phone_number || data.電話番号 || "").toLowerCase();
      return Array.isArray(value)
        ? value.some((v) => phone.includes(v.toLowerCase()))
        : phone.includes(value.toLowerCase());
    },
    cell: ({ row }) => {
      const data = row.original.data as any;
      if (!data) return <span className="font-mono text-sm">-</span>;
      const phone = data.phone || data.phone_number || data.電話番号 || "-";
      return <span className="font-mono text-sm">{phone}</span>;
    },
  },
  {
    id: "address",
    header: ({ column, table }) => {
      try {
        const columnInstance = table.getColumn("address");
        const facetedValues = columnInstance?.getFacetedUniqueValues();
        const validFacetedValues =
          facetedValues instanceof Map && facetedValues.size > 0
            ? facetedValues
            : undefined;
        return (
          <DataTableColumnHeader
            column={column}
            title="住所"
            facetedValues={validFacetedValues}
          />
        );
      } catch (error) {
        return <DataTableColumnHeader column={column} title="住所" />;
      }
    },
    accessorFn: (row: Lead) => {
      const data = row.data as any;
      if (!data || typeof data !== "object") return "-";
      return data.address || data.詳細住所 || data.住所 || "-";
    },
    filterFn: (row, id, value) => {
      if (!value || (Array.isArray(value) && value.length === 0) || (typeof value === "string" && value.length === 0)) return true;
      const data = row.original.data as any;
      if (!data || typeof data !== "object") return false;
      const address = (data.address || data.詳細住所 || data.住所 || "").toLowerCase();
      return Array.isArray(value)
        ? value.some((v) => address.includes(v.toLowerCase()))
        : address.includes(value.toLowerCase());
    },
    cell: ({ row }) => {
      const data = row.original.data as any;
      if (!data) return <span className="max-w-xs truncate text-sm block">-</span>;
      const address = data.address || data.詳細住所 || data.住所 || "-";
      return (
        <span className="max-w-xs truncate text-sm block" title={address}>
          {address}
        </span>
      );
    },
  },
  {
    id: "url",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="URL" />
    ),
    accessorFn: (row: Lead) => {
      return row.source || row.data?.url || row.data?.website || "-";
    },
    cell: ({ row }) => {
      const url = row.original.source || row.original.data?.url || row.original.data?.website || "-";
      return (
        <span className="text-sm">
          {url !== "-" ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {getSourceDisplayName(url)}
            </a>
          ) : (
            "-"
          )}
        </span>
      );
    },
  },
  {
    id: "opening_date",
    header: ({ column, table }) => {
      try {
        const columnInstance = table.getColumn("opening_date");
        const facetedValues = columnInstance?.getFacetedUniqueValues();
        const validFacetedValues =
          facetedValues instanceof Map && facetedValues.size > 0
            ? facetedValues
            : undefined;
        return (
          <DataTableColumnHeader
            column={column}
            title="オープン日"
            facetedValues={validFacetedValues}
          />
        );
      } catch (error) {
        return <DataTableColumnHeader column={column} title="オープン日" />;
      }
    },
    accessorFn: (row: Lead) => {
      const data = row.data || {};
      return data.opening_date || data.open_date || data.オープン日 || "-";
    },
    filterFn: (row, id, value) => {
      if (!value || (Array.isArray(value) && value.length === 0)) return true;
      const data = row.original.data || {};
      const openDate = (data.opening_date || data.open_date || data.オープン日 || "").toLowerCase();
      return Array.isArray(value)
        ? value.some((v) => openDate.includes(v.toLowerCase()))
        : openDate.includes(value.toLowerCase());
    },
    cell: ({ row }) => {
      const data = row.original.data as any;
      if (!data) return <span className="text-sm">-</span>;
      const openingDate = data.opening_date || data.open_date || data.オープン日 || "-";
      return <span className="text-sm">{openingDate}</span>;
    },
  },
  {
    id: "delivery",
    header: ({ column, table }) => {
      try {
        const columnInstance = table.getColumn("delivery");
        const facetedValues = columnInstance?.getFacetedUniqueValues();
        const validFacetedValues =
          facetedValues instanceof Map && facetedValues.size > 0
            ? facetedValues
            : undefined;
        return (
          <DataTableColumnHeader
            column={column}
            title="デリバリー導入"
            facetedValues={validFacetedValues}
          />
        );
      } catch (error) {
        return <DataTableColumnHeader column={column} title="デリバリー導入" />;
      }
    },
    accessorFn: (row: Lead) => {
      return getDeliveryStatus(row.data, row.source);
    },
    filterFn: (row, id, value) => {
      if (!value || (Array.isArray(value) && value.length === 0)) return true;
      const deliveryStatus = getDeliveryStatus(row.original.data, row.original.source);
      return Array.isArray(value)
        ? value.includes(deliveryStatus)
        : deliveryStatus === value;
    },
    cell: ({ row }) => {
      const deliveryStatus = getDeliveryStatus(row.original.data, row.original.source);
      return <span className="text-sm">{deliveryStatus}</span>;
    },
  },
  {
    id: "regular_holiday",
    header: ({ column, table }) => {
      try {
        const columnInstance = table.getColumn("regular_holiday");
        const facetedValues = columnInstance?.getFacetedUniqueValues();
        const validFacetedValues =
          facetedValues instanceof Map && facetedValues.size > 0
            ? facetedValues
            : undefined;
        return (
          <DataTableColumnHeader
            column={column}
            title="定休日"
            facetedValues={validFacetedValues}
          />
        );
      } catch (error) {
        return <DataTableColumnHeader column={column} title="定休日" />;
      }
    },
    accessorFn: (row: Lead) => {
      const data = row.data as any;
      if (!data || typeof data !== "object") return "-";
      return data.regular_holiday || data.定休日 || "-";
    },
    filterFn: (row, id, value) => {
      if (!value || (Array.isArray(value) && value.length === 0) || (typeof value === "string" && value.length === 0)) return true;
      const data = row.original.data as any;
      if (!data || typeof data !== "object") return false;
      const holiday = (data.regular_holiday || data.定休日 || "").toLowerCase();
      return Array.isArray(value)
        ? value.some((v) => holiday.includes(v.toLowerCase()))
        : holiday.includes(value.toLowerCase());
    },
    cell: ({ row }) => {
      const data = row.original.data as any;
      if (!data) return <span className="text-sm">-</span>;
      const holiday = data.regular_holiday || data.定休日 || "-";
      return <span className="text-sm">{holiday}</span>;
    },
  },
  {
    id: "transport",
    header: ({ column, table }) => {
      try {
        const columnInstance = table.getColumn("transport");
        const facetedValues = columnInstance?.getFacetedUniqueValues();
        const validFacetedValues =
          facetedValues instanceof Map && facetedValues.size > 0
            ? facetedValues
            : undefined;
        return (
          <DataTableColumnHeader
            column={column}
            title="交通手段"
            facetedValues={validFacetedValues}
          />
        );
      } catch (error) {
        return <DataTableColumnHeader column={column} title="交通手段" />;
      }
    },
    accessorFn: (row: Lead) => {
      const data = row.data as any;
      if (!data || typeof data !== "object") return "-";
      return data.transport || data.交通手段 || data.交通アクセス || "-";
    },
    filterFn: (row, id, value) => {
      if (!value || (Array.isArray(value) && value.length === 0) || (typeof value === "string" && value.length === 0)) return true;
      const data = row.original.data as any;
      if (!data || typeof data !== "object") return false;
      const transport = (data.transport || data.交通手段 || data.交通アクセス || "").toLowerCase();
      return Array.isArray(value)
        ? value.some((v) => transport.includes(v.toLowerCase()))
        : transport.includes(value.toLowerCase());
    },
    cell: ({ row }) => {
      const data = row.original.data as any;
      if (!data) return <span className="text-sm">-</span>;
      const transport = data.transport || data.交通手段 || data.交通アクセス || "-";
      return <span className="text-sm max-w-xs truncate block" title={transport}>{transport}</span>;
    },
  },
  {
    id: "business_hours",
    header: ({ column, table }) => {
      try {
        const columnInstance = table.getColumn("business_hours");
        const facetedValues = columnInstance?.getFacetedUniqueValues();
        const validFacetedValues =
          facetedValues instanceof Map && facetedValues.size > 0
            ? facetedValues
            : undefined;
        return (
          <DataTableColumnHeader
            column={column}
            title="営業時間"
            facetedValues={validFacetedValues}
          />
        );
      } catch (error) {
        return <DataTableColumnHeader column={column} title="営業時間" />;
      }
    },
    accessorFn: (row: Lead) => {
      const data = row.data as any;
      if (!data || typeof data !== "object") return "-";
      return data.business_hours || data.営業時間 || "-";
    },
    filterFn: (row, id, value) => {
      if (!value || (Array.isArray(value) && value.length === 0) || (typeof value === "string" && value.length === 0)) return true;
      const data = row.original.data as any;
      if (!data || typeof data !== "object") return false;
      const hours = (data.business_hours || data.営業時間 || "").toLowerCase();
      return Array.isArray(value)
        ? value.some((v) => hours.includes(v.toLowerCase()))
        : hours.includes(value.toLowerCase());
    },
    cell: ({ row }) => {
      const data = row.original.data as any;
      if (!data) return <span className="text-sm">-</span>;
      const hours = data.business_hours || data.営業時間 || "-";
      return <span className="text-sm max-w-xs truncate block" title={hours}>{hours}</span>;
    },
  },
  {
    id: "website",
    header: ({ column, table }) => {
      try {
        const columnInstance = table.getColumn("website");
        const facetedValues = columnInstance?.getFacetedUniqueValues();
        const validFacetedValues =
          facetedValues instanceof Map && facetedValues.size > 0
            ? facetedValues
            : undefined;
        return (
          <DataTableColumnHeader
            column={column}
            title="公式アカウント（HPURL）"
            facetedValues={validFacetedValues}
          />
        );
      } catch (error) {
        return <DataTableColumnHeader column={column} title="公式アカウント（HPURL）" />;
      }
    },
    accessorFn: (row: Lead) => {
      const data = row.data as any;
      if (!data || typeof data !== "object") return "-";
      return data.website || data.公式HP || data.公式アカウント || "-";
    },
    filterFn: (row, id, value) => {
      if (!value || (Array.isArray(value) && value.length === 0) || (typeof value === "string" && value.length === 0)) return true;
      const data = row.original.data as any;
      if (!data || typeof data !== "object") return false;
      const website = (data.website || data.公式HP || data.公式アカウント || "").toLowerCase();
      return Array.isArray(value)
        ? value.some((v) => website.includes(v.toLowerCase()))
        : website.includes(value.toLowerCase());
    },
    cell: ({ row }) => {
      const data = row.original.data as any;
      if (!data) return <span className="text-sm">-</span>;
      const website = data.website || data.公式HP || data.公式アカウント || "-";
      return (
        <span className="text-sm">
          {website !== "-" ? (
            <a
              href={website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline max-w-xs truncate block"
              onClick={(e) => e.stopPropagation()}
              title={website}
            >
              {website.length > 30 ? `${website.slice(0, 30)}...` : website}
            </a>
          ) : (
            "-"
          )}
        </span>
      );
    },
  },
  {
    accessorKey: "status",
    header: ({ column, table }) => {
      try {
        const columnInstance = table.getColumn("status");
        const facetedValues = columnInstance?.getFacetedUniqueValues();
        const validFacetedValues =
          facetedValues instanceof Map && facetedValues.size > 0
            ? facetedValues
            : undefined;
        return (
          <DataTableColumnHeader
            column={column}
            title="ステータス"
            facetedValues={validFacetedValues}
          />
        );
      } catch (error) {
        return <DataTableColumnHeader column={column} title="ステータス" />;
      }
    },
    filterFn: (row, id, value) => {
      if (!value || (Array.isArray(value) && value.length === 0)) return true;
      const status = row.getValue(id) as string;
      return Array.isArray(value) ? value.includes(status) : status === value;
    },
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      return <LeadStatusBadge status={status} />;
    },
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="作成日" />
    ),
    cell: ({ row }) => {
      const date = row.original.createdAt;
      if (!date) return <span>-</span>;
      const formatted = new Date(date).toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      return <span>{formatted}</span>;
    },
  },
];

export function LeadTable({
  leads,
  page,
  totalPages,
  onPageChange,
  onLeadClick,
}: LeadTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const table = useReactTable({
    data: leads,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    state: {
      sorting,
      columnFilters,
    },
  });

  const handleRowClick = (lead: Lead) => {
    if (onLeadClick) {
      onLeadClick(lead);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-center py-8 text-gray-500"
                >
                  リードがありません
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => handleRowClick(row.original)}
                >
                  {row.getVisibleCells().map((cell) => {
                    const rendered = flexRender(
                      cell.column.columnDef.cell,
                      cell.getContext()
                    );
                    return (
                      <TableCell key={cell.id}>
                        {rendered}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* ページネーション */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            ページ {page} / {totalPages} (表示: {table.getFilteredRowModel().rows.length} / {leads.length})
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              前へ
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
            >
              次へ
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
