'use server'

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { generateEmbedding } from "@/lib/ai/embedding"
import { Prisma } from "@prisma/client"

/**
 * AI検索（ベクトル検索）でMasterLeadを検索
 * 
 * @param query 検索クエリ
 * @param limit 取得件数（デフォルト: 20）
 * @returns 検索結果のMasterLeadリスト
 */
export async function searchMasterLeadsByAI(
  query: string,
  limit: number = 20
) {
  try {
    // セッション確認
    const session = await auth();
    if (!session?.user) {
      throw new Error("認証が必要です");
    }

    if (!query || query.trim().length === 0) {
      return { success: true, results: [], count: 0 };
    }

    // 1. 検索クエリをベクトル化
    const queryVector = await generateEmbedding(query.trim());

    // 2. ベクトル類似度検索（コサイン類似度）
    // pgvectorの <=> 演算子を使用（コサイン距離、1に近いほど類似）
    const results = await prisma.$queryRaw<Array<{
      id: string;
      companyName: string;
      phone: string | null;
      address: string | null;
      source: string;
      data: Prisma.JsonValue;
      similarity: number;
    }>>`
      SELECT 
        ml.id,
        ml.company_name as "companyName",
        ml.phone,
        ml.address,
        ml.source,
        ml.data,
        1 - (lv.embedding <=> ${queryVector}::vector) as similarity
      FROM master_leads ml
      INNER JOIN lead_vectors lv ON lv."masterLeadId" = ml.id
      WHERE lv.embedding <=> ${queryVector}::vector < 1.0
      ORDER BY lv.embedding <=> ${queryVector}::vector ASC
      LIMIT ${limit}
    `;

    return {
      success: true,
      results: results.map(r => ({
        id: r.id,
        companyName: r.companyName,
        phone: r.phone,
        address: r.address,
        source: r.source,
        data: r.data,
        similarity: r.similarity,
      })),
      count: results.length,
    };

  } catch (error) {
    console.error("AI search error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "検索に失敗しました",
      results: [],
      count: 0,
    };
  }
}
