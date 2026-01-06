import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getMasterLeads } from "@/lib/actions/master-leads";
import { MasterLeadsPageClient } from "@/components/master-leads/master-leads-page-client";

interface MasterLeadsPageProps {
  searchParams: Promise<{
    page?: string;
    q?: string;
  }>;
}

export default async function MasterLeadsPage({ searchParams }: MasterLeadsPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);
  const query = params.q || undefined;

  try {
    const { masterLeads, total, page: currentPage, pageSize, totalPages } = await getMasterLeads(
      page,
      20,
      query
    );

    return (
      <MasterLeadsPageClient
        initialMasterLeads={masterLeads}
        initialTotal={total}
        initialPage={currentPage}
        initialPageSize={pageSize}
        initialTotalPages={totalPages}
        initialQuery={query}
      />
    );
  } catch (error) {
    console.error("MasterLeadsPage error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">マスターリード管理</h1>
        </div>
        <div className="rounded-md bg-red-50 p-4 border border-red-200">
          <p className="text-sm font-semibold text-red-800 mb-2">
            エラーが発生しました
          </p>
          <p className="text-sm text-red-700 mb-2">
            {errorMessage}
          </p>
          <p className="text-xs text-red-600 mt-2">
            開発サーバーのログも確認してください。
          </p>
        </div>
      </div>
    );
  }
}

