import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { saveBufferForUser } from "@/lib/storage";
import { ingestUploadedFile, serializeDocument } from "@/lib/documents";
import { isKnownRetrievalLocation, normalizeRetrievalLocation } from "@/lib/enums";
import { SensitiveDataCleaner } from "@/lib/sensitiveDataCleaner";
import { trackUsage, USAGE_EVENT_TYPES } from "@/lib/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_PREFIXES = ["image/"];
const ALLOWED_TYPES = ["application/pdf"];
const MAX_BYTES = 15 * 1024 * 1024;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_form" }, { status: 400 });
  }

  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Trūkst faila." }, { status: 400 });
  }

  const lowerName = (file.name || "").toLowerCase();
  const lowerType = (file.type || "").toLowerCase();
  const allowed =
    ALLOWED_PREFIXES.some((p) => lowerType.startsWith(p)) ||
    ALLOWED_TYPES.includes(lowerType) ||
    /\.(jpg|jpeg|png|pdf)$/.test(lowerName);

  if (!allowed) {
    return NextResponse.json(
      { ok: false, error: "Neatbalstīts faila tips. Lūdzu, izvēlies JPG, PNG vai PDF." },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length === 0) {
    return NextResponse.json({ ok: false, error: "Tukšs fails." }, { status: 400 });
  }
  if (buffer.length > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: "Fails ir pārāk liels (maks. 15 MB)." },
      { status: 400 },
    );
  }

  const retrievalRaw = form.get("retrievalLocation");
  if (typeof retrievalRaw !== "string" || !isKnownRetrievalLocation(retrievalRaw)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Norādi, kur vēlāk atrast šo dokumentu (izvēlies vienu no opcijām virs augšupielādes).",
      },
      { status: 400 },
    );
  }
  let retrievalCustomNote: string | null = null;
  const noteRaw = form.get("retrievalCustomNote");
  if (typeof noteRaw === "string" && noteRaw.trim()) {
    retrievalCustomNote =
      SensitiveDataCleaner.sanitizePlainText(noteRaw.trim()).slice(0, 300) || null;
  }
  if (retrievalRaw === "other" && !retrievalCustomNote) {
    return NextResponse.json(
      {
        ok: false,
        error: "Ja izvēlējies ‘Cits’, lūdzu, īsi apraksti, kur meklēt oriģinālu.",
      },
      { status: 400 },
    );
  }

  const saved = await saveBufferForUser(user.id, file.name || "document", buffer);
  const mimeType = file.type || "application/octet-stream";

  const result = await ingestUploadedFile({
    userId: user.id,
    originalFileName: file.name || saved.storedFileName,
    storedFilePath: saved.storedFilePath,
    mimeType,
    fileSize: buffer.length,
    sourceType: "web",
    retrievalLocation: normalizeRetrievalLocation(retrievalRaw),
    retrievalCustomNote,
  });

  const docIds =
    result.kind === "bank_statement" ? result.documentIds : [result.documentId];

  const docs = await prisma.document.findMany({
    where: { id: { in: docIds }, userId: user.id },
    include: { userCategory: true },
    orderBy: [{ paymentDate: "desc" }, { uploadedAt: "desc" }],
  });
  const serialized = docs.map((d) => serializeDocument(d));

  void trackUsage({
    userId: user.id,
    eventType: USAGE_EVENT_TYPES.DOCUMENT_UPLOAD_WEB,
    documentCount: docIds.length,
    metadata: {
      source: "web",
      bankStatementSplit: result.kind === "bank_statement",
      documentIds: docIds,
    },
  });

  return NextResponse.json({
    ok: true,
    bankStatementSplit: result.kind === "bank_statement",
    documents: serialized,
    document: serialized[0],
  });
}
