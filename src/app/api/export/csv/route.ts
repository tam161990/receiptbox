import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { parseQuarter } from "@/lib/dates";
import { buildReport } from "@/lib/reports";
import { buildCsv, exportFileName } from "@/lib/export";
import { trackUsage, USAGE_EVENT_TYPES } from "@/lib/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const yearParam = Number(searchParams.get("year"));
  const year = Number.isFinite(yearParam) && yearParam > 1990 ? yearParam : new Date().getUTCFullYear();
  const quarter = parseQuarter(searchParams.get("quarter"));

  const report = await buildReport(user.id, year, quarter);
  void trackUsage({
    userId: user.id,
    eventType: USAGE_EVENT_TYPES.CSV_EXPORT,
    metadata: { year, quarter, documentCount: report.documents.length },
  });
  const csv = buildCsv(report.documents);
  const fileName = exportFileName("receiptbox", year, quarter, "csv");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
