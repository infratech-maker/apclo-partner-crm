import { getDashboardMetrics } from "@/lib/actions/analytics";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function TestDashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // 実装したアクションを呼び出し
  const metrics = await getDashboardMetrics();

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Analytics Data Test</h1>

      <div className="bg-slate-100 p-4 rounded-lg overflow-auto max-h-[500px] border border-slate-200">
        <pre className="text-sm font-mono">
          {JSON.stringify(metrics, null, 2)}
        </pre>
      </div>

      <div className="mt-4 text-sm text-gray-500">
        ※ この画面でデータ構造が正しいことを確認したら、次はグラフUIを作成します。
      </div>
    </div>
  );
}

