"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { startOfMonth, endOfMonth, subDays, format } from "date-fns";

// UIコンポーネントで使いやすいように型定義をエクスポート
export type DashboardMetrics = {
  summary: {
    totalActivities: number;
    totalLeads: number;
    avgActivitiesPerLead: string;
  };
  pieChartData: {
    name: string;
    value: number;
  }[];
  trendChartData: {
    date: string;
    count: number;
  }[];
};

/**
 * ダッシュボード用の集計データを取得する
 * - 今月の活動総数
 * - 活動種別ごとの内訳
 * - 過去30日間の日別トレンド
 * - 総リード数
 */
export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  try {
    console.log("getDashboardMetrics: Starting");
    const session = await auth();
    console.log("getDashboardMetrics: Session retrieved", {
      hasUser: !!session?.user,
      userId: session?.user?.id,
      tenantId: session?.user?.tenantId,
    });

    if (!session?.user?.id || !session?.user?.tenantId) {
      console.error("getDashboardMetrics: Unauthorized - missing session or tenantId");
      // エラーを再スローせず、空のデータを返す
      const now = new Date();
      const emptyTrendData: { date: string; count: number }[] = [];
      for (let i = 0; i <= 30; i++) {
        const date = subDays(now, 30 - i);
        const dateStr = format(date, "yyyy-MM-dd");
        emptyTrendData.push({ date: dateStr, count: 0 });
      }
      return {
        summary: {
          totalActivities: 0,
          totalLeads: 0,
          avgActivitiesPerLead: "0",
        },
        pieChartData: [],
        trendChartData: emptyTrendData,
      };
    }

    const tenantId = session.user.tenantId;
    const now = new Date();

    // 期間設定
    const startOfCurrentMonth = startOfMonth(now);
    const endOfCurrentMonth = endOfMonth(now);
    const thirtyDaysAgo = subDays(now, 30); // トレンドグラフは過去30日分を表示

    // ユーザーの主所属組織を取得
    let userOrg;
    try {
      console.log("getDashboardMetrics: Fetching userOrg for userId:", session.user.id);
      userOrg = await prisma.userOrganization.findFirst({
        where: {
          userId: session.user.id,
          isPrimary: true,
        },
        select: {
          organizationId: true,
        },
      });
      console.log("getDashboardMetrics: userOrg retrieved", {
        hasOrg: !!userOrg,
        organizationId: userOrg?.organizationId,
      });
    } catch (error) {
      console.error("getDashboardMetrics: Error fetching userOrg:", error);
      // エラー時は空のデータを返す
      const now = new Date();
      const emptyTrendData: { date: string; count: number }[] = [];
      for (let i = 0; i <= 30; i++) {
        const date = subDays(now, 30 - i);
        const dateStr = format(date, "yyyy-MM-dd");
        emptyTrendData.push({ date: dateStr, count: 0 });
      }
      return {
        summary: {
          totalActivities: 0,
          totalLeads: 0,
          avgActivitiesPerLead: "0",
        },
        pieChartData: [],
        trendChartData: emptyTrendData,
      };
    }

    if (!userOrg || !userOrg.organizationId) {
      // 組織が設定されていない場合は空のデータを返す
      console.warn("getDashboardMetrics: No organization found for user:", session.user.id);
      // トレンドグラフ用の30日分の日付を生成
      const emptyTrendData: { date: string; count: number }[] = [];
      for (let i = 0; i <= 30; i++) {
        const date = subDays(now, 30 - i);
        const dateStr = format(date, "yyyy-MM-dd");
        emptyTrendData.push({ date: dateStr, count: 0 });
      }

      return {
        summary: {
          totalActivities: 0,
          totalLeads: 0,
          avgActivitiesPerLead: "0",
        },
        pieChartData: [],
        trendChartData: emptyTrendData,
      };
    }

  // データベースへのクエリを並列実行して高速化
  // organizationIdは既にnullチェック済みだが、念のため安全に処理
  const activityLogWhere = {
    tenantId,
    organizationId: userOrg.organizationId,
  };

  const leadWhere = {
    tenantId,
    organizationId: userOrg.organizationId,
  };

  let monthActivitiesCount, activitiesByType, recentActivities, totalLeadsCount;
  
  try {
    console.log("getDashboardMetrics: Starting database queries", {
      tenantId,
      organizationId: userOrg.organizationId,
    });
    
    // 各クエリを個別に実行してエラーを特定しやすくする
    try {
      console.log("getDashboardMetrics: Query 1 - monthActivitiesCount");
      monthActivitiesCount = await prisma.activityLog.count({
        where: {
          ...activityLogWhere,
          createdAt: { gte: startOfCurrentMonth, lte: endOfCurrentMonth },
        },
      });
      console.log("getDashboardMetrics: Query 1 completed:", monthActivitiesCount);
    } catch (error) {
      console.error("getDashboardMetrics: Query 1 error:", error);
      throw new Error(`Failed to count activities: ${error instanceof Error ? error.message : String(error)}`);
    }

    try {
      console.log("getDashboardMetrics: Query 2 - activitiesByType");
      activitiesByType = await prisma.activityLog.findMany({
        where: {
          ...activityLogWhere,
          createdAt: { gte: startOfCurrentMonth, lte: endOfCurrentMonth },
        },
        select: {
          type: true,
        },
      });
      console.log("getDashboardMetrics: Query 2 completed:", activitiesByType.length);
    } catch (error) {
      console.error("getDashboardMetrics: Query 2 error:", error);
      throw new Error(`Failed to fetch activities by type: ${error instanceof Error ? error.message : String(error)}`);
    }

    try {
      console.log("getDashboardMetrics: Query 3 - recentActivities");
      recentActivities = await prisma.activityLog.findMany({
        where: {
          ...activityLogWhere,
          createdAt: { gte: thirtyDaysAgo },
        },
        select: {
          createdAt: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      });
      console.log("getDashboardMetrics: Query 3 completed:", recentActivities.length);
    } catch (error) {
      console.error("getDashboardMetrics: Query 3 error:", error);
      throw new Error(`Failed to fetch recent activities: ${error instanceof Error ? error.message : String(error)}`);
    }

    try {
      console.log("getDashboardMetrics: Query 4 - totalLeadsCount");
      totalLeadsCount = await prisma.lead.count({
        where: leadWhere,
      });
      console.log("getDashboardMetrics: Query 4 completed:", totalLeadsCount);
    } catch (error) {
      console.error("getDashboardMetrics: Query 4 error:", error);
      throw new Error(`Failed to count leads: ${error instanceof Error ? error.message : String(error)}`);
    }

    console.log("getDashboardMetrics: All database queries completed", {
      monthActivitiesCount,
      activitiesByTypeCount: activitiesByType.length,
      recentActivitiesCount: recentActivities.length,
      totalLeadsCount,
    });
  } catch (error) {
    console.error("getDashboardMetrics: Database query error:", error);
    console.error("Error details:", {
      tenantId,
      organizationId: userOrg?.organizationId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    // エラーを再スローせず、空データを返す
    const now = new Date();
    const emptyTrendData: { date: string; count: number }[] = [];
    for (let i = 0; i <= 30; i++) {
      const date = subDays(now, 30 - i);
      const dateStr = format(date, "yyyy-MM-dd");
      emptyTrendData.push({ date: dateStr, count: 0 });
    }
    return {
      summary: {
        totalActivities: 0,
        totalLeads: 0,
        avgActivitiesPerLead: "0",
      },
      pieChartData: [],
      trendChartData: emptyTrendData,
    };
  }

  // --- データの整形処理 ---

  // A. トレンドデータの整形 (日付ごとの件数を集計し、活動がない日も0件として埋める)
  const dailyStats = new Map<string, number>();

  // グラフが歯抜けにならないよう、過去30日分の日付を0で初期化
  for (let i = 0; i <= 30; i++) {
    // 30日前から今日までループ
    const date = subDays(now, 30 - i);
    const dateStr = format(date, "yyyy-MM-dd");
    dailyStats.set(dateStr, 0);
  }

  // 実際のデータをカウントアップ
  recentActivities.forEach((log) => {
    const dateStr = format(log.createdAt, "yyyy-MM-dd");
    // NOTE: サーバーのタイムゾーンがUTCの場合、日付の境界が日本時間とずれる可能性があります。
    // 本格運用の際は date-fns-tz などでJST変換を挟むことを推奨しますが、まずは標準動作で進めます。
    if (dailyStats.has(dateStr)) {
      dailyStats.set(dateStr, (dailyStats.get(dateStr) || 0) + 1);
    }
  });

  const trendChartData = Array.from(dailyStats.entries()).map(
    ([date, count]) => ({
      date,
      count,
    })
  );

  // B. 活動種別ごとの集計（JavaScriptで集計）
  const activityTypeCounts = new Map<string, number>();
  activitiesByType.forEach((log) => {
    const type = log.type as string;
    const count = activityTypeCounts.get(type) || 0;
    activityTypeCounts.set(type, count + 1);
  });

  // 活動種別のラベル変換（日本語表示用）
  const activityTypeLabels: Record<string, string> = {
    CALL: "架電",
    VISIT: "訪問",
    EMAIL: "メール",
    CHAT: "チャット/SNS",
    OTHER: "その他",
  };

  // C. 戻り値の構築
  return {
    summary: {
      totalActivities: monthActivitiesCount,
      totalLeads: totalLeadsCount,
      // リード1件あたりの平均活動数 (0除算回避)
      avgActivitiesPerLead:
        totalLeadsCount > 0
          ? (monthActivitiesCount / totalLeadsCount).toFixed(1)
          : "0",
    },
    // PieChart用にデータを整形
    pieChartData: Array.from(activityTypeCounts.entries()).map(
      ([type, count]) => ({
        name: activityTypeLabels[type] || type, // 日本語ラベルに変換
        value: count,
      })
    ),
    trendChartData,
  };
  } catch (error) {
    console.error("getDashboardMetrics error:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");
    console.error("Error name:", error instanceof Error ? error.name : "Unknown");
    console.error("Error message:", error instanceof Error ? error.message : String(error));
    
    // エラーを再スローして、APIルートでキャッチできるようにする
    throw error;
  }
}

