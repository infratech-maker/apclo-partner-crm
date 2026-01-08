import { NextRequest, NextResponse } from "next/server";
import { getMasterLeads } from "@/lib/actions/master-leads";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
    const query = searchParams.get("q") || undefined;

    const result = await getMasterLeads(page, pageSize, query);

    return NextResponse.json(result);
  } catch (error) {
    console.error("API route error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch master leads",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}




