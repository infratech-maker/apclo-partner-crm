import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getMasterLeadsAsLeads } from "@/lib/actions/master-leads";
import { LeadsPageClient } from "@/components/leads/leads-page-client";

interface CustomersPageProps {
  searchParams: Promise<{
    page?: string;
    q?: string;
    status?: string;
  }>;
}

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);
  const query = params.q || undefined;
  const statuses = params.status
    ? params.status.split(",").filter((s) => s.trim().length > 0)
    : undefined;

  // マスターリードから取得（既存のUIコンポーネントとの互換性のため）
  const { leads, total, page: currentPage, pageSize, totalPages } = await getMasterLeadsAsLeads(
    page,
    20,
    query,
    statuses
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Customers</h1>
        <p className="mt-2 text-sm text-gray-600">
          顧客管理 - スクレイピングで収集したリードデータを表示します
        </p>
      </div>

      <LeadsPageClient
        initialLeads={leads}
        initialTotal={total}
        initialPage={currentPage}
        initialPageSize={pageSize}
        initialTotalPages={totalPages}
        initialQuery={query}
        initialStatuses={statuses || []}
      />
    </div>
  );
}

