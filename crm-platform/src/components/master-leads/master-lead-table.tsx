"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
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

interface MasterLeadTableProps {
  masterLeads: MasterLead[];
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

export function MasterLeadTable({
  masterLeads,
  page,
  totalPages,
  onPageChange,
  isLoading = false,
}: MasterLeadTableProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>店舗名</TableHead>
              <TableHead>電話番号</TableHead>
              <TableHead>住所</TableHead>
              <TableHead>紐付けリード数</TableHead>
              <TableHead>ソース</TableHead>
              <TableHead>更新日時</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  読み込み中...
                </TableCell>
              </TableRow>
            ) : masterLeads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  マスターリードが見つかりませんでした
                </TableCell>
              </TableRow>
            ) : (
              masterLeads.map((ml) => {
                const data = ml.data as any;
                const name = data?.name || data?.店舗名 || ml.companyName || "-";
                const phone = data?.phone || data?.電話番号 || ml.phone || "-";
                const address = data?.address || data?.住所 || ml.address || "-";

                return (
                  <TableRow key={ml.id}>
                    <TableCell className="font-medium">{name}</TableCell>
                    <TableCell>{phone}</TableCell>
                    <TableCell className="max-w-[200px] truncate" title={address}>
                      {address}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{ml.leadsCount}件</Badge>
                    </TableCell>
                    <TableCell>
                      <a
                        href={ml.source}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-sm"
                      >
                        {ml.source.includes("tabelog.com") ? "食べログ" : "その他"}
                      </a>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {new Date(ml.updatedAt).toLocaleString("ja-JP")}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/dashboard/master-leads/${ml.id}`}
                        className="text-blue-600 hover:underline text-sm"
                      >
                        詳細
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* ページネーション */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
          <div className="text-sm text-gray-700">
            {page} / {totalPages} ページ
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(1)}
              disabled={page === 1 || isLoading}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1 || isLoading}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page === totalPages || isLoading}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(totalPages)}
              disabled={page === totalPages || isLoading}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

