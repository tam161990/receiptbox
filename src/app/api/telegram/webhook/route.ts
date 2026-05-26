import { NextRequest, NextResponse } from "next/server";
import { isDatabaseReachable, prisma } from "@/lib/prisma";
import { upsertUserByTelegramId } from "@/lib/founders";
import { saveBufferForUser } from "@/lib/storage";
import {
  downloadTelegramFile,
  formatAnalysisMessage,
  formatBankStatementSplitMessage,
  getTelegramFileInfo,
  handleTelegramStartCallback,
  helpMessage,
  sendTelegramMessage,
  sendTelegramStartOnboarding,
  type TelegramDocument,
  type TelegramMessage,
  type TelegramPhotoSize,
  type TelegramUpdate,
  type TelegramUser,
} from "@/lib/telegram";
import { ingestUploadedFile } from "@/lib/documents";
import { isDeductibleStatus, isDocumentStatus, isExpenseCategory } from "@/lib/enums";
import { trackUsage, USAGE_EVENT_TYPES } from "@/lib/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_MIME_PREFIXES = ["image/"];
const ALLOWED_MIME_TYPES = ["application/pdf"];

function isMimeAllowed(mime: string | undefined, fileName: string | undefined): boolean {
  const lowerMime = (mime || "").toLowerCase();
  const lowerName = (fileName || "").toLowerCase();
  if (ALLOWED_MIME_PREFIXES.some((p) => lowerMime.startsWith(p))) return true;
  if (ALLOWED_MIME_TYPES.includes(lowerMime)) return true;
  if (/\.(jpg|jpeg|png|pdf)$/.test(lowerName)) return true;
  return false;
}

function verifyWebhookSecret(req: NextRequest): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!expected) return true;
  const received = req.headers.get("x-telegram-bot-api-secret-token")?.trim();
  return received === expected;
}

function messageCommand(text: string | undefined): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  const match = trimmed.match(/^\/([a-zA-Z0-9_]+)(?:@\w+)?(?:\s|$)/);
  return match ? match[1].toLowerCase() : null;
}

async function ensureUser(tgUser: TelegramUser) {
  return upsertUserByTelegramId(String(tgUser.id), {
    telegramUsername: tgUser.username ?? null,
    firstName: tgUser.first_name ?? null,
    lastName: tgUser.last_name ?? null,
  });
}

interface IncomingFile {
  fileId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}

function pickLargestPhoto(photos: TelegramPhotoSize[]): TelegramPhotoSize | undefined {
  if (!photos.length) return undefined;
  return [...photos].sort((a, b) => (b.file_size ?? 0) - (a.file_size ?? 0))[0];
}

function fileFromDocument(doc: TelegramDocument): IncomingFile {
  return {
    fileId: doc.file_id,
    fileName: doc.file_name || `${doc.file_unique_id}.bin`,
    mimeType: doc.mime_type || "application/octet-stream",
    fileSize: doc.file_size ?? 0,
  };
}

function fileFromPhoto(photo: TelegramPhotoSize): IncomingFile {
  return {
    fileId: photo.file_id,
    fileName: `${photo.file_unique_id}.jpg`,
    mimeType: "image/jpeg",
    fileSize: photo.file_size ?? 0,
  };
}

function parseReviewReasons(raw: string | null): string[] {
  try {
    const parsed = JSON.parse(raw ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

function docToAnalysisSummary(doc: {
  id: string;
  status: string;
  documentDate: Date | null;
  vendorName: string | null;
  documentNumber: string | null;
  totalAmount: number | null;
  vatAmount: number | null;
  currency: string | null;
  category: string | null;
  deductibleStatus: string | null;
  confidenceScore: number | null;
  explanation: string | null;
  needsReviewReasons: string | null;
}) {
  return {
    documentId: doc.id,
    status: isDocumentStatus(doc.status) ? doc.status : ("processed" as const),
    documentDate: doc.documentDate,
    vendorName: doc.vendorName,
    documentNumber: doc.documentNumber,
    totalAmount: doc.totalAmount,
    vatAmount: doc.vatAmount,
    currency: doc.currency,
    category: isExpenseCategory(doc.category) ? doc.category : null,
    deductibleStatus: isDeductibleStatus(doc.deductibleStatus) ? doc.deductibleStatus : null,
    confidenceScore: doc.confidenceScore,
    explanation: doc.explanation,
    needsReviewReasons: parseReviewReasons(doc.needsReviewReasons),
  };
}

async function handleIncomingFile(
  message: TelegramMessage,
  user: Awaited<ReturnType<typeof ensureUser>>,
  file: IncomingFile,
): Promise<void> {
  const chatId = message.chat.id;

  if (!isMimeAllowed(file.mimeType, file.fileName)) {
    await sendTelegramMessage(
      chatId,
      "Diemžēl šis faila tips nav atbalstīts. Lūdzu sūti JPG, PNG vai PDF.",
    );
    return;
  }

  await sendTelegramMessage(chatId, "Dokuments saņemts. Tiek apstrādāts…");

  let fallbackDocumentId: string | null = null;
  try {
    const info = await getTelegramFileInfo(file.fileId);
    const buffer = await downloadTelegramFile(info.file_path);
    const saved = await saveBufferForUser(user.id, file.fileName, buffer);

    const result = await ingestUploadedFile({
      userId: user.id,
      originalFileName: file.fileName,
      storedFilePath: saved.storedFilePath,
      mimeType: file.mimeType,
      fileSize: buffer.length,
      sourceType: "telegram",
      sourceHint: "Telegram bots",
      telegramFileId: file.fileId,
    });

    if (result.kind === "bank_statement") {
      const docs = await prisma.document.findMany({
        where: { id: { in: result.documentIds }, userId: user.id },
        orderBy: [{ paymentDate: "asc" }, { uploadedAt: "asc" }],
      });
      void trackUsage({
        userId: user.id,
        eventType: USAGE_EVENT_TYPES.DOCUMENT_UPLOAD_TELEGRAM,
        documentCount: result.documentIds.length,
        metadata: { source: "telegram", bankStatementSplit: true, fileName: file.fileName },
      });
      await sendTelegramMessage(
        chatId,
        formatBankStatementSplitMessage(
          file.fileName,
          docs.map(docToAnalysisSummary),
        ),
      );
      return;
    }

    fallbackDocumentId = result.documentId;
    const fresh = await prisma.document.findUnique({ where: { id: result.documentId } });
    if (!fresh) return;

    void trackUsage({
      userId: user.id,
      eventType: USAGE_EVENT_TYPES.DOCUMENT_UPLOAD_TELEGRAM,
      documentCount: 1,
      metadata: { source: "telegram", documentId: result.documentId, fileName: file.fileName },
    });

    await sendTelegramMessage(chatId, formatAnalysisMessage(docToAnalysisSummary(fresh)));
  } catch (error) {
    console.error("[telegram] handleIncomingFile failed:", error);
    if (fallbackDocumentId) {
      await prisma.document
        .update({
          where: { id: fallbackDocumentId },
          data: { status: "failed" },
        })
        .catch(() => undefined);
    }
    await sendTelegramMessage(chatId, "Neizdevās apstrādāt dokumentu. Mēģini vēlreiz vēlāk.");
  }
}

async function handleMessage(message: TelegramMessage): Promise<void> {
  if (!message.from) return;
  const chatId = message.chat.id;

  let user: Awaited<ReturnType<typeof ensureUser>>;
  try {
    user = await ensureUser(message.from);
  } catch (error) {
    console.error("[telegram] ensureUser failed:", error);
    await sendTelegramMessage(
      chatId,
      "⚠️ Pagaidām nevar pieslēgties serverim (datubāze). Pārbaudi Railway: Volume /data un DATABASE_URL=file:/data/prod.db, tad deploy no jauna.",
    );
    return;
  }
  const text = (message.text || "").trim();
  const command = messageCommand(text);

  if (command === "start") {
    await sendTelegramStartOnboarding(chatId, message.from.first_name);
    return;
  }
  if (command === "help") {
    await sendTelegramMessage(chatId, helpMessage(process.env.APP_URL));
    return;
  }
  if (command === "id") {
    await sendTelegramMessage(
      chatId,
      `Tavs Telegram ID: <code>${user.telegramUserId}</code>\nIzmanto šo ID, lai pieslēgtos vadības panelim.`,
    );
    return;
  }

  if (message.document) {
    await handleIncomingFile(message, user, fileFromDocument(message.document));
    return;
  }

  if (message.photo && message.photo.length > 0) {
    const photo = pickLargestPhoto(message.photo);
    if (photo) {
      await handleIncomingFile(message, user, fileFromPhoto(photo));
      return;
    }
  }

  if (text) {
    await sendTelegramMessage(
      chatId,
      "Sūti man čeku, rēķinu vai PDF dokumentu. Komanda /help parādīs palīdzību.",
    );
  }
}

async function handleCallbackQuery(query: NonNullable<TelegramUpdate["callback_query"]>): Promise<void> {
  if (!query.message || !query.data) return;
  const chatId = query.message.chat.id;
  if (query.data.startsWith("start:")) {
    await handleTelegramStartCallback(chatId, query.id, query.data);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!verifyWebhookSecret(req)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (update.callback_query) {
    try {
      await handleCallbackQuery(update.callback_query);
    } catch (error) {
      console.error("[telegram] callback handler failed:", error);
    }
    return NextResponse.json({ ok: true });
  }

  const message = update.message ?? update.edited_message;
  if (!message) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  try {
    await handleMessage(message);
  } catch (error) {
    console.error("[telegram] webhook handler failed:", error);
  }

  return NextResponse.json({ ok: true });
}

async function fetchTelegramWebhookStatus(): Promise<{
  pendingUpdateCount?: number;
  lastErrorMessage?: string;
} | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    const data = (await res.json()) as {
      ok?: boolean;
      result?: { pending_update_count?: number; last_error_message?: string };
    };
    if (!data.ok || !data.result) return null;
    return {
      pendingUpdateCount: data.result.pending_update_count,
      lastErrorMessage: data.result.last_error_message,
    };
  } catch {
    return null;
  }
}

export async function GET(): Promise<NextResponse> {
  const { isTelegramBotTokenValid } = await import("@/lib/telegram");
  const tokenSet = Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim());
  const secretSet = Boolean(process.env.TELEGRAM_WEBHOOK_SECRET?.trim());
  const tokenValid = tokenSet ? await isTelegramBotTokenValid() : false;
  const databaseOk = await isDatabaseReachable();
  const telegramWebhook = await fetchTelegramWebhookStatus();

  return NextResponse.json({
    ok: true,
    service: "ReceiptBox LV Telegram webhook",
    config: {
      botTokenSet: tokenSet,
      botTokenValid: tokenValid,
      webhookSecretSet: secretSet,
      databaseOk,
      dataDir: process.env.DATA_DIR ?? null,
      databaseUrl: process.env.DATABASE_URL?.replace(/\/[^/]+$/, "/…") ?? null,
    },
    telegramWebhook,
  });
}
