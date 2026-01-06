"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { LeadTable } from "./lead-table";
import { LeadDetailSheet } from "./lead-detail-sheet";
import { LeadSearch } from "./lead-search";
import { LeadFilter } from "./lead-filter";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";

interface Lead {
  id: string;
  source: string;
  data: any;
  status: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface LeadsPageClientProps {
  initialLeads: Lead[];
  initialTotal: number;
  initialPage: number;
  initialPageSize: number;
  initialTotalPages: number;
  initialQuery?: string;
  initialStatuses?: string[];
}

export function LeadsPageClient({
  initialLeads,
  initialTotal,
  initialPage,
  initialPageSize,
  initialTotalPages,
  initialQuery = "",
  initialStatuses = [],
}: LeadsPageClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [leads, setLeads] = useState(initialLeads);
  const [page, setPage] = useState(initialPage);
  const [total, setTotal] = useState(initialTotal);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const [statuses, setStatuses] = useState<string[]>(initialStatuses);

  // URLパラメータを更新する関数
  const updateURL = (updates: {
    page?: number;
    q?: string;
    status?: string;
  }) => {
    const params = new URLSearchParams(searchParams.toString());

    if (updates.page !== undefined) {
      if (updates.page === 1) {
        params.delete("page");
      } else {
        params.set("page", updates.page.toString());
      }
    }

    if (updates.q !== undefined) {
      if (updates.q === "") {
        params.delete("q");
      } else {
        params.set("q", updates.q);
      }
    }

    if (updates.status !== undefined) {
      if (updates.status === "") {
        params.delete("status");
      } else {
        params.set("status", updates.status);
      }
    }

    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // リード一覧を再読み込み
  const reloadLeads = async (
    newPage: number = page,
    newQuery: string = query,
    newStatuses: string[] = statuses
  ) => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      const { getLeads } = await import("@/lib/actions/leads");
      const result = await getLeads(
        newPage,
        initialPageSize,
        newQuery || undefined,
        newStatuses.length > 0 ? newStatuses : undefined
      );

      setLeads(result.leads);
      setPage(result.page);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (error) {
      console.error("Failed to load leads:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePageChange = async (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || isLoading) return;

    updateURL({ page: newPage });
    await reloadLeads(newPage, query, statuses);
  };

  const handleQueryChange = (newQuery: string) => {
    setQuery(newQuery);
    updateURL({ q: newQuery, page: 1 });
    reloadLeads(1, newQuery, statuses);
  };

  const handleQueryClear = () => {
    setQuery("");
    updateURL({ q: "", page: 1 });
    reloadLeads(1, "", statuses);
  };

  const handleStatusesChange = (newStatuses: string[]) => {
    setStatuses(newStatuses);
    const statusParam = newStatuses.length > 0 ? newStatuses.join(",") : "";
    updateURL({ status: statusParam, page: 1 });
    reloadLeads(1, query, newStatuses);
  };

  const handleStatusesClear = () => {
    setStatuses([]);
    updateURL({ status: "", page: 1 });
    reloadLeads(1, query, []);
  };

  const handleLeadClick = (lead: Lead) => {
    setSelectedLead(lead);
    setIsSheetOpen(true);
  };

  const handleSheetClose = (open: boolean) => {
    setIsSheetOpen(open);
    if (!open) {
      // シートが閉じられたら、リード一覧を再読み込み
      router.refresh();
    }
  };

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">リード管理</h1>
          <p className="text-gray-600 mt-1">
            合計 {total} 件のリード
          </p>
        </div>
        <Link href="/dashboard/leads/import">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            CSVインポート
          </Button>
        </Link>
      </div>

      {/* 検索・フィルター */}
      <div className="flex items-center gap-4">
        <LeadSearch
          value={query}
          onChange={handleQueryChange}
          onClear={handleQueryClear}
        />
        <LeadFilter
          selectedStatuses={statuses}
          onChange={handleStatusesChange}
          onClear={handleStatusesClear}
        />
      </div>

      {/* リードテーブル */}
      <LeadTable
        leads={leads}
        page={page}
        totalPages={totalPages}
        onPageChange={handlePageChange}
        onLeadClick={handleLeadClick}
      />

      {/* リード詳細Sheet */}
      <LeadDetailSheet
        lead={selectedLead}
        open={isSheetOpen}
        onOpenChange={handleSheetClose}
      />
    </div>
  );
}

