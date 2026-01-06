"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

/**
 * リード一覧を取得（組織でフィルタリング）
 * 
 * @param page ページ番号（1から開始）
 * @param pageSize 1ページあたりの件数
 * @param query 検索クエリ（店舗名、電話番号、住所に対する部分一致検索）
 * @param statuses ステータス配列（完全一致）
 * @returns リード一覧と総件数
 */
export async function getLeads(
  page: number = 1,
  pageSize: number = 20,
  query?: string,
  statuses?: string[]
) {
  const session = await auth();

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const { tenantId } = session.user;

  // ユーザーの主所属組織を取得
  const userOrg = await prisma.userOrganization.findFirst({
    where: {
      userId: session.user.id,
      isPrimary: true,
    },
    select: {
      organizationId: true,
    },
  });

  if (!userOrg) {
    // 組織が設定されていない場合は空の結果を返す
    return {
      leads: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0,
    };
  }

  const skip = (page - 1) * pageSize;

  // where条件を動的に構築
  const whereCondition: Prisma.LeadWhereInput = {
    tenantId,
    organizationId: userOrg.organizationId,
  };

  // ステータスフィルター (IN条件)
  if (statuses && statuses.length > 0) {
    whereCondition.status = {
      in: statuses,
    };
  }

  // キーワード検索がある場合は、生のSQLを使用してJSONBフィールドを検索
  if (query && query.trim().length > 0) {
    try {
      const searchQuery = query.trim();
      const searchPattern = `%${searchQuery}%`;

      // PostgreSQLのJSONB演算子を使用した生のSQLクエリ
      // data->>'name' などでJSONから文字列を取得し、ILIKEで部分一致検索
      const sqlWhere = Prisma.sql`
        (
          (data->>'name')::text ILIKE ${searchPattern}
          OR (data->>'store_name')::text ILIKE ${searchPattern}
          OR (data->>'店舗名')::text ILIKE ${searchPattern}
          OR (data->>'phone')::text ILIKE ${searchPattern}
          OR (data->>'phone_number')::text ILIKE ${searchPattern}
          OR (data->>'電話番号')::text ILIKE ${searchPattern}
          OR (data->>'address')::text ILIKE ${searchPattern}
          OR (data->>'詳細住所')::text ILIKE ${searchPattern}
          OR (data->>'住所')::text ILIKE ${searchPattern}
        )
      `;

      // ステータスフィルターのSQL条件
      const statusCondition = statuses && statuses.length > 0
        ? Prisma.sql`AND status IN (${Prisma.join(statuses.map(s => Prisma.sql`${s}`), ', ')})`
        : Prisma.sql``;

      // 生のSQLクエリで検索
      const leadsResult = await prisma.$queryRaw<Array<{
        id: string;
        tenantId: string;
        scrapingJobId: string | null;
        source: string;
        data: any;
        status: string;
        notes: string | null;
        createdAt: Date;
        updatedAt: Date;
        createdBy: string | null;
        updatedBy: string | null;
        organizationId: string | null;
      }>>`
        SELECT * FROM leads
        WHERE "tenantId" = ${tenantId}
          AND "organizationId" = ${userOrg.organizationId}
          ${statusCondition}
          AND ${sqlWhere}
        ORDER BY "createdAt" DESC
        LIMIT ${pageSize} OFFSET ${skip}
      `;

      const totalResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::int as count FROM leads
        WHERE "tenantId" = ${tenantId}
          AND "organizationId" = ${userOrg.organizationId}
          ${statusCondition}
          AND ${sqlWhere}
      `;

      const leads = leadsResult.map((lead) => ({
        ...lead,
        createdAt: new Date(lead.createdAt),
        updatedAt: new Date(lead.updatedAt),
      }));

      const total = Number(totalResult[0]?.count || 0);

      return {
        leads,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    } catch (error) {
      console.error("getLeads: SQL query error:", error);
      // SQLエラーの場合は通常のPrismaクエリにフォールバック
      console.warn("getLeads: Falling back to Prisma query");
    }
  }

  // 検索クエリがない場合は通常のPrismaクエリを使用
  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where: whereCondition,
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: pageSize,
    }),
    prisma.lead.count({
      where: whereCondition,
    }),
  ]);

  return {
    leads,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * CSVデータからリードをインポート
 * 
 * @param csvData CSVデータの文字列
 * @returns インポート結果
 */
export async function importLeads(csvData: string) {
  const session = await auth();

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const { tenantId } = session.user;

  // ユーザーの主所属組織を取得
  const userOrg = await prisma.userOrganization.findFirst({
    where: {
      userId: session.user.id,
      isPrimary: true,
    },
    select: {
      organizationId: true,
    },
  });

  if (!userOrg) {
    throw new Error("Organization not found");
  }

  // CSVをパース
  const Papa = (await import("papaparse")).default;
  const parseResult = Papa.parse(csvData, {
    header: true,
    skipEmptyLines: true,
  });

  if (parseResult.errors.length > 0) {
    throw new Error(`CSV parse error: ${parseResult.errors[0].message}`);
  }

  const rows = parseResult.data as any[];

  if (rows.length === 0) {
    throw new Error("CSV file is empty");
  }

  // 既存のリードを取得（重複チェック用）
  // URLをキーに重複チェック
  const existingLeads = await prisma.lead.findMany({
    where: {
      tenantId,
      organizationId: userOrg.organizationId,
    },
    select: {
      id: true,
      source: true,
    },
  });

  const existingUrls = new Set(existingLeads.map((lead) => lead.source));

  // リードデータを準備
  const leadsToCreate: Array<{
    tenantId: string;
    organizationId: string;
    source: string;
    data: any;
    status: string;
    createdBy: string;
  }> = [];

  for (const row of rows) {
    // URLを取得（複数の列名に対応）
    const url =
      row["URL"] ||
      row["url"] ||
      row["source"] ||
      row["リンク"] ||
      "";

    if (!url) {
      continue; // URLがない行はスキップ
    }

    // 重複チェック
    if (existingUrls.has(url)) {
      continue;
    }

    // 店舗名を取得
    const storeName =
      row["店舗名"] ||
      row["店名"] ||
      row["name"] ||
      row["store_name"] ||
      "";

    // 電話番号を取得
    const phone =
      row["電話番号"] ||
      row["phone"] ||
      row["phone_number"] ||
      row["tel"] ||
      "";

    // 住所を取得
    const address =
      row["詳細住所"] ||
      row["住所"] ||
      row["address"] ||
      row["addr"] ||
      "";

    // データオブジェクトを作成
    const data: any = {
      name: storeName,
      phone,
      address,
      url,
    };

    // その他の列もデータに含める
    for (const [key, value] of Object.entries(row)) {
      if (
        !["URL", "url", "source", "リンク", "店舗名", "店名", "name", "store_name", "電話番号", "phone", "phone_number", "tel", "詳細住所", "住所", "address", "addr"].includes(
          key
        )
      ) {
        data[key] = value;
      }
    }

    leadsToCreate.push({
      tenantId,
      organizationId: userOrg.organizationId,
      source: url,
      data,
      status: "new",
      createdBy: session.user.id,
    });

    // 重複チェック用セットに追加
    existingUrls.add(url);
  }

  if (leadsToCreate.length === 0) {
    return {
      success: true,
      imported: 0,
      skipped: rows.length,
      message: "すべてのリードが既に存在するか、URLがありませんでした。",
    };
  }

  // 一括登録
  await prisma.lead.createMany({
    data: leadsToCreate,
    skipDuplicates: true,
  });

  return {
    success: true,
    imported: leadsToCreate.length,
    skipped: rows.length - leadsToCreate.length,
    message: `${leadsToCreate.length}件のリードをインポートしました。`,
  };
}

/**
 * リードを更新
 * 
 * @param id リードID
 * @param data 更新データ（status, notes）
 * @returns 更新結果
 */
export async function updateLead(
  id: string,
  data: {
    status?: string;
    notes?: string;
  }
) {
  const session = await auth();

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const { tenantId } = session.user;

  // リードが存在し、同じテナントに属しているか確認
  const lead = await prisma.lead.findFirst({
    where: {
      id,
      tenantId,
    },
  });

  if (!lead) {
    throw new Error("Lead not found");
  }

  // 更新データを準備
  const updateData: {
    status?: string;
    notes?: string;
    updatedBy?: string;
  } = {};

  if (data.status !== undefined) {
    updateData.status = data.status;
  }

  if (data.notes !== undefined) {
    updateData.notes = data.notes;
  }

  updateData.updatedBy = session.user.id;

  // リードを更新
  await prisma.lead.update({
    where: {
      id,
    },
    data: updateData,
  });

  // 一覧ページを再検証
  revalidatePath("/dashboard/leads");

  return {
    success: true,
    message: "リードを更新しました。",
  };
}

