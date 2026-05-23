import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { processAndStoreAnalysis, serializeDocument } from "@/lib/documents";
import { trackUsage, USAGE_EVENT_TYPES } from "@/lib/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const doc = await prisma.document.findFirst({
    where: { id: params.id, userId: user.id },
  });
  if (!doc) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  if (!doc.storedFilePath && !doc.rawExtractedText) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Oriģinālais fails ir dzēsts un PDF teksts nav saglabāts. Augšupielādē dokumentu vēlreiz.",
      },
      { status: 400 },
    );
  }

  await processAndStoreAnalysis(doc.id);
  void trackUsage({
    userId: user.id,
    eventType: USAGE_EVENT_TYPES.DOCUMENT_REANALYZE,
    documentCount: 1,
    metadata: { documentId: doc.id },
  });
  const fresh = await prisma.document.findUnique({
    where: { id: doc.id },
    include: { userCategory: true },
  });
  if (!fresh) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, document: serializeDocument(fresh) });
}
