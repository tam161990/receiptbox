import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { applyUtilityAddressSplit, serializeDocument } from "@/lib/documents";
import { prisma } from "@/lib/prisma";

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
    include: { userCategory: true },
  });
  if (!doc) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const result = await applyUtilityAddressSplit(doc.id);
  const fresh = await prisma.document.findUnique({
    where: { id: doc.id },
    include: { userCategory: true },
  });
  if (!fresh) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: result.ok,
    error: result.error,
    document: serializeDocument(fresh),
  });
}
