import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { parseQuarter } from "@/lib/dates";
import { buildReport } from "@/lib/reports";
import { buildXlsx, exportFileName } from "@/lib/export";
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
    eventType: USAGE_EVENT_TYPES.XLSX_EXPORT,
    metadata: { year, quarter, documentCount: report.documents.length },
  });
  const buffer = buildXlsx(report);
  const fileName = exportFileName("receiptbox", year, quarter, "xlsx");

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
