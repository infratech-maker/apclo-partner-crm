import { getDashboardMetrics } from "@/lib/actions/analytics";
import { DashboardKPIs } from "@/components/dashboard/dashboard-kpis";
import { ActivityCharts } from "@/components/dashboard/activity-charts";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  try {
    const metrics = await getDashboardMetrics();

    // metricsが未定義の場合の安全な処理
    if (!metrics) {
      throw new Error("Failed to load dashboard metrics");
    }

    // summaryが未定義の場合の安全な処理
    if (!metrics.summary) {
      throw new Error("Dashboard summary data is missing");
    }

    return (
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        </div>

        <div className="space-y-4">
          {/* KPIカードセクション */}
          <DashboardKPIs data={metrics.summary} />

          {/* グラフセクション */}
          <ActivityCharts
            pieData={metrics.pieChartData || []}
            trendData={metrics.trendChartData || []}
          />
        </div>
      </div>
    );
  } catch (error) {
    console.error("Dashboard error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    return (
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        </div>
        <div className="rounded-md bg-red-50 p-4 border border-red-200">
          <p className="text-sm font-semibold text-red-800 mb-2">
            エラーが発生しました
          </p>
          <p className="text-sm text-red-700 mb-2">
            {errorMessage}
          </p>
          {errorStack && (
            <details className="mt-2">
              <summary className="text-xs text-red-600 cursor-pointer">
                詳細を表示
              </summary>
              <pre className="text-xs text-red-600 mt-2 p-2 bg-red-100 rounded overflow-auto max-h-40">
                {errorStack}
              </pre>
            </details>
          )}
          <p className="text-xs text-red-600 mt-2">
            開発サーバーのログも確認してください。
          </p>
        </div>
      </div>
    );
  }
}

