import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Phone, CalendarCheck, TrendingUp } from "lucide-react";
import { DashboardMetrics } from "@/lib/actions/analytics";

interface DashboardKPIsProps {
  data: DashboardMetrics["summary"];
}

export function DashboardKPIs({ data }: DashboardKPIsProps) {
  // データが未定義の場合の安全な処理
  if (!data) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">データ読み込み中...</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">今月の総活動数</CardTitle>
          <Phone className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.totalActivities}</div>
          <p className="text-xs text-muted-foreground">件のアクション</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">総リード数</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.totalLeads}</div>
          <p className="text-xs text-muted-foreground">登録済み顧客</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">平均活動数/社</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.avgActivitiesPerLead}</div>
          <p className="text-xs text-muted-foreground">
            リード1件あたりの接触頻度
          </p>
        </CardContent>
      </Card>

      {/* 将来的に実装するスペース確保 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">今月の訪問数</CardTitle>
          <CalendarCheck className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">--</div>
          <p className="text-xs text-muted-foreground">(目標機能 実装待ち)</p>
        </CardContent>
      </Card>
    </div>
  );
}

