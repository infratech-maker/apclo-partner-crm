import { getDashboardMetrics } from "@/lib/actions/analytics";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    console.log("API route: Starting request");
    
    let session;
    try {
      session = await auth();
      console.log("API route: Session retrieved", {
        hasUser: !!session?.user,
        userId: session?.user?.id,
        tenantId: session?.user?.tenantId,
      });
    } catch (authError) {
      console.error("API route: Auth error:", authError);
      return NextResponse.json(
        {
          success: false,
          error: "Authentication failed",
          details: authError instanceof Error ? authError.message : String(authError),
        },
        { status: 500 }
      );
    }

    if (!session?.user) {
      console.log("API route: Unauthorized - no session");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log("API route: Calling getDashboardMetrics");
    let metrics;
    try {
      metrics = await getDashboardMetrics();
      console.log("API route: Metrics retrieved successfully");
    } catch (metricsError) {
      console.error("API route: getDashboardMetrics error:", metricsError);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to get dashboard metrics",
          details: metricsError instanceof Error ? metricsError.message : String(metricsError),
          stack: metricsError instanceof Error ? metricsError.stack : undefined,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error("API route: Unexpected error:", error);
    const errorDetails = {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : undefined,
      stack: error instanceof Error ? error.stack : undefined,
      cause: error instanceof Error ? (error as any).cause : undefined,
    };
    console.error("API route error details:", errorDetails);
    
    // エラーの詳細を返す（開発環境のみ）
    return NextResponse.json(
      {
        success: false,
        error: errorDetails.message,
        errorName: errorDetails.name,
        stack: errorDetails.stack,
        cause: errorDetails.cause,
      },
      { status: 500 }
    );
  }
}

