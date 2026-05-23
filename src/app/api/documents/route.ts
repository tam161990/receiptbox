import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { quarterRange, parseQuarter } from "@/lib/dates";
import { serializeDocument } from "@/lib/documents";
import {
  isDeductibleStatus,
  isDocumentStatus,
  isExpenseCategory,
} from "@/lib/enums";
import { documentListOrderBy, parseDocumentSort } from "@/lib/documentListSort";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const yearParam = searchParams.get("year");
  const quarterParam = searchParams.get("quarter");
  const category = searchParams.get("category");
  const status = searchParams.get("status");
  const deductibleStatus = searchParams.get("deductibleStatus");
  const sortState = parseDocumentSort(
    searchParams.get("sort") ?? undefined,
    searchParams.get("dir") ?? undefined,
  );

  const where: Prisma.DocumentWhereInput = { userId: user.id };

  if (yearParam) {
    const year = Number(yearParam);
    if (Number.isFinite(year)) {
      const quarter = parseQuarter(quarterParam);
      const { start, end } = quarterRange(year, quarter);
      where.documentDate = { gte: start, lt: end };
    }
  }

  if (category && isExpenseCategory(category)) {
    where.category = category;
  }
  if (status && isDocumentStatus(status)) {
    where.status = status;
  }
  if (deductibleStatus && isDeductibleStatus(deductibleStatus)) {
    where.deductibleStatus = deductibleStatus;
  }

  const documents = await prisma.document.findMany({
    where,
    orderBy: documentListOrderBy(sortState.column, sortState.dir),
    take: 500,
  });

  return NextResponse.json({
    ok: true,
    documents: documents.map((d) => serializeDocument(d)),
  });
}
