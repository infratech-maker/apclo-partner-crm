"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { MasterLeadTable } from "./master-lead-table";
import { MasterLeadSearch } from "./master-lead-search";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";

interface MasterLead {
  id: string;
  companyName: string;
  phone: string | null;
  address: string | null;
  source: string;
  data: any;
  createdAt: Date;
  updatedAt: Date;
  leadsCount: number;
}

interface MasterLeadsPageClientProps {
  initialMasterLeads: MasterLead[];
  initialTotal: number;
  initialPage: number;
  initialPageSize: number;
  initialTotalPages: number;
  initialQuery?: string;
}

export function MasterLeadsPageClient({
  initialMasterLeads,
  initialTotal,
  initialPage,
  initialPageSize,
  initialTotalPages,
  initialQuery = "",
}: MasterLeadsPageClientProps) {
  
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [masterLeads, setMasterLeads] = useState(initialMasterLeads);
  const [page, setPage] = useState(initialPage);
  const [total, setTotal] = useState(initialTotal);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [isLoading, setIsLoading] = useState(false);
  const [query, setQuery] = useState(initialQuery);

  // URLパラメータを更新する関数
  const updateURL = (updates: {
    page?: number;
    q?: string;
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

    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // マスターリード一覧を再読み込み
  const reloadMasterLeads = async (
    newPage?: number,
    newQuery?: string
  ) => {
    setIsLoading(true);
    try {
      const targetPage = newPage !== undefined ? newPage : page;
      const targetQuery = newQuery !== undefined ? newQuery : query;

      const response = await fetch(
        `/api/master-leads?page=${targetPage}&pageSize=${initialPageSize}${targetQuery ? `&q=${encodeURIComponent(targetQuery)}` : ""}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch master leads");
      }

      const data = await response.json();
      setMasterLeads(data.masterLeads);
      setTotal(data.total);
      setPage(data.page);
      setTotalPages(data.totalPages);
      updateURL({ page: targetPage, q: targetQuery });
    } catch (error) {
      console.error("Error reloading master leads:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // 検索実行
  const handleSearch = (searchQuery: string) => {
    setQuery(searchQuery);
    reloadMasterLeads(1, searchQuery);
  };

  // ページ変更
  const handlePageChange = (newPage: number) => {
    reloadMasterLeads(newPage);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">マスターリード管理</h1>
          <p className="mt-2 text-sm text-gray-600">
            名寄せされたリードのマスターデータを管理します
          </p>
        </div>
      </div>

      {/* 検索バー */}
      <MasterLeadSearch
        initialQuery={query}
        onSearch={handleSearch}
        isLoading={isLoading}
      />

      {/* 統計情報 */}
      <div className="rounded-lg bg-white p-4 border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">
              総マスターリード数: <span className="font-semibold text-gray-900">{total}</span>件
            </p>
            <p className="text-xs text-gray-500 mt-1">
              紐付けリード総数: {masterLeads.reduce((sum, ml) => sum + ml.leadsCount, 0)}件
            </p>
          </div>
        </div>
      </div>

      {/* テーブル */}
      <MasterLeadTable
        masterLeads={masterLeads}
        page={page}
        totalPages={totalPages}
        onPageChange={handlePageChange}
        isLoading={isLoading}
      />
    </div>
  );
}

