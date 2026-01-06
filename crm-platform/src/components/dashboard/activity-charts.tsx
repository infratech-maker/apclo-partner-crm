"use client"; // Rechartsはクライアントコンポーネントである必要があります

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardMetrics } from "@/lib/actions/analytics";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface ActivityChartsProps {
  pieData: DashboardMetrics["pieChartData"];
  trendData: DashboardMetrics["trendChartData"];
}

// グラフの色定義（Tailwindの色味に合わせると綺麗です）
const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export function ActivityCharts({
  pieData,
  trendData,
}: ActivityChartsProps) {
  // 空データの場合の処理
  const hasPieData = pieData && pieData.length > 0;
  const hasTrendData = trendData && trendData.length > 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
      {/* 棒グラフ：活動トレンド（幅広） */}
      <Card className="col-span-4">
        <CardHeader>
          <CardTitle>過去30日間の活動推移</CardTitle>
        </CardHeader>
        <CardContent className="pl-2">
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hasTrendData ? trendData : []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="#888888"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => {
                    // "2024-01-01" -> "01/01" に簡易フォーマット
                    const date = new Date(value);
                    return `${date.getMonth() + 1}/${date.getDate()}`;
                  }}
                />
                <YAxis
                  stroke="#888888"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${value}`}
                  allowDecimals={false} // 整数のみ表示
                />
                <Tooltip
                  cursor={{ fill: "transparent" }}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "none",
                    boxShadow:
                      "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                />
                <Bar
                  dataKey="count"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* 円グラフ：活動内訳 */}
      <Card className="col-span-3">
        <CardHeader>
          <CardTitle>活動タイプ別構成比</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={hasPieData ? pieData : [{ name: "データなし", value: 1 }]}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {(hasPieData ? pieData : [{ name: "データなし", value: 1 }]).map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={hasPieData ? COLORS[index % COLORS.length] : "#e5e7eb"}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

