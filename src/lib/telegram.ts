import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  DeductibleStatusLabels,
  DocumentStatusLabels,
  ExpenseCategoryLabels,
  type DeductibleStatus,
  type ExpenseCategory,
  type DocumentStatus,
} from "./enums";
import { formatLvDate, formatLvMoney } from "./dates";
import { PROFILE_TIP } from "./userEducation";

export interface TelegramUser {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
}

export interface TelegramChat {
  id: number;
  type: string;
}

export interface TelegramPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

export interface TelegramDocument {
  file_id: string;
  file_unique_id: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
  thumbnail?: TelegramPhotoSize;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  caption?: string;
  document?: TelegramDocument;
  photo?: TelegramPhotoSize[];
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

export interface TelegramFileInfo {
  file_id: string;
  file_path: string;
  file_size?: number;
}

function botToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN nav konfigurēts.");
  }
  if (!/^\d+:[A-Za-z0-9_-]+$/.test(token)) {
    throw new Error(
      "TELEGRAM_BOT_TOKEN formāts nav derīgs — jābūt pilnam tokenam no BotFather (piem. 123456789:ABCdef...).",
    );
  }
  return token;
}

const TELEGRAM_BOT_PHOTO_CANDIDATES = [
  join(process.cwd(), "public/icons/telegram-bot-photo.png"),
  join(process.cwd(), "public/icons/icon-512.png"),
];

let cachedBotPhoto: Buffer | null | undefined;

function getBotPhotoBuffer(): Buffer | null {
  if (cachedBotPhoto !== undefined) return cachedBotPhoto;
  for (const path of TELEGRAM_BOT_PHOTO_CANDIDATES) {
    if (existsSync(path)) {
      cachedBotPhoto = readFileSync(path);
      return cachedBotPhoto;
    }
  }
  cachedBotPhoto = null;
  return null;
}

async function telegramApiMultipart<T>(method: string, form: FormData): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${botToken()}/${method}`, {
    method: "POST",
    body: form,
  });
  const data = (await res.json()) as { ok: boolean; result?: T; description?: string };
  if (!data.ok || data.result === undefined) {
    throw new Error(`Telegram API kļūda (${method}): ${data.description || "nezināma"}`);
  }
  return data.result;
}

type TelegramApiResponse<T> = { ok: boolean; result?: T; description?: string };

async function telegramApi<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${botToken()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as TelegramApiResponse<T>;
  if (!data.ok) {
    throw new Error(`Telegram API kļūda (${method}): ${data.description || "nezināma"}`);
  }
  if (data.result === undefined) {
    throw new Error(`Telegram API kļūda (${method}): tukša atbilde`);
  }
  return data.result;
}

export async function sendTelegramMessage(
  chatId: number,
  text: string,
  options?: {
    replyMarkup?: {
      inline_keyboard: Array<Array<{ text: string; url?: string; callback_data?: string }>>;
    };
  },
): Promise<void> {
  const payload = {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    ...(options?.replyMarkup ? { reply_markup: options.replyMarkup } : {}),
  };

  try {
    await telegramApi("sendMessage", { ...payload, parse_mode: "HTML" });
    return;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const htmlParseFailed = message.includes("can't parse entities");
    console.error("[telegram] sendMessage (HTML) failed:", message);

    if (!htmlParseFailed) return;

    try {
      await telegramApi("sendMessage", payload);
    } catch (fallbackError) {
      const fallbackMessage =
        fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      console.error("[telegram] sendMessage (plain) failed:", fallbackMessage);
    }
  }
}

/** True when TELEGRAM_BOT_TOKEN is set and accepted by Telegram getMe. */
export async function isTelegramBotTokenValid(): Promise<boolean> {
  try {
    botToken();
  } catch {
    return false;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken()}/getMe`);
    const data = (await res.json()) as { ok?: boolean };
    return data.ok === true;
  } catch {
    return false;
  }
}

export async function answerTelegramCallbackQuery(
  callbackQueryId: string,
  text?: string,
): Promise<void> {
  try {
    await telegramApi("answerCallbackQuery", {
      callback_query_id: callbackQueryId,
      ...(text ? { text, show_alert: false } : {}),
    });
  } catch (error) {
    console.error("[telegram] answerCallbackQuery failed:", error);
  }
}

const START_PRIVACY_DELAY_MS = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function appBaseUrl(): string | undefined {
  return process.env.APP_URL?.replace(/\/$/, "");
}

export function telegramStartWelcomeMessage(firstName?: string | null): string {
  const greeting = firstName?.trim()
    ? `👋 Sveiks, ${escapeHtml(firstName.trim())}! Es esmu ReceiptBox.`
    : "👋 Sveiks! Es esmu ReceiptBox.";

  const profileLines = PROFILE_TIP.telegramItems
    .map((item) => `✓ ${escapeHtml(item)}`)
    .join("\n");

  return [
    `<b>${greeting}</b>`,
    "",
    "Sūti:",
    "",
    "📄 čekus",
    "📄 PDF",
    "📄 rēķinus",
    "📷 screenshotus",
    "",
    "Es palīdzēšu tos sakārtot 😄",
    "",
    `<i>${escapeHtml(PROFILE_TIP.intro)}</i>`,
    "",
    escapeHtml(PROFILE_TIP.detail),
    "",
    profileLines,
  ].join("\n");
}

export function telegramStartPrivacyMessage(): string {
  return [
    "🔒 <b>Mēs neglabājam tavu dokumentu arhīvu.</b>",
    "",
    "Oriģinālie faili pēc apstrādes tiek dzēsti.",
    "",
    "Tavi dati pieder tev.",
  ].join("\n");
}

export function telegramStartWelcomeKeyboard(): {
  inline_keyboard: Array<Array<{ text: string; url?: string; callback_data?: string }>>;
} {
  const appUrl = appBaseUrl();
  const profileButton = appUrl
    ? { text: "⚙️ Atvērt profilu", url: `${appUrl}/profile` }
    : { text: "⚙️ Atvērt profilu", callback_data: "start:profile" };

  return {
    inline_keyboard: [
      [profileButton],
      [{ text: "📄 Nosūtīt pirmo dokumentu", callback_data: "start:send_doc" }],
    ],
  };
}

export async function sendTelegramStartOnboarding(
  chatId: number,
  firstName?: string | null,
): Promise<void> {
  await sendTelegramMessage(chatId, telegramStartWelcomeMessage(firstName), {
    replyMarkup: telegramStartWelcomeKeyboard(),
  });
  await sleep(START_PRIVACY_DELAY_MS);
  await sendTelegramMessage(chatId, telegramStartPrivacyMessage());
}

export async function handleTelegramStartCallback(
  chatId: number,
  callbackQueryId: string,
  data: string,
): Promise<void> {
  if (data === "start:send_doc") {
    await answerTelegramCallbackQuery(callbackQueryId, "Sūti dokumentu šim čatam 👇");
    await sendTelegramMessage(
      chatId,
      "Vienkārši pievieno čeku, PDF vai screenshot šim čatam — es to apstrādāšu 😄",
    );
    return;
  }

  if (data === "start:profile") {
    const appUrl = appBaseUrl();
    await answerTelegramCallbackQuery(callbackQueryId);
    if (appUrl) {
      await sendTelegramMessage(
        chatId,
        `Profils pieejams vadības panelī:\n<a href="${escapeHtml(`${appUrl}/profile`)}">${escapeHtml(`${appUrl}/profile`)}</a>`,
      );
    } else {
      await sendTelegramMessage(chatId, "Vadības panelis nav konfigurēts (APP_URL).");
    }
  }
}

export async function sendTelegramPhoto(
  chatId: number,
  caption: string,
  photo?: Buffer | null,
): Promise<void> {
  const buffer = photo ?? getBotPhotoBuffer();
  if (!buffer) {
    await sendTelegramMessage(chatId, caption);
    return;
  }

  try {
    const form = new FormData();
    form.append("chat_id", String(chatId));
    form.append("caption", caption);
    form.append("parse_mode", "HTML");
    form.append(
      "photo",
      new Blob([new Uint8Array(buffer)], { type: "image/png" }),
      "receiptbox.png",
    );
    await telegramApiMultipart("sendPhoto", form);
  } catch (error) {
    console.error("[telegram] sendPhoto failed, falling back to text:", error);
    await sendTelegramMessage(chatId, caption);
  }
}

export async function getTelegramFileInfo(fileId: string): Promise<TelegramFileInfo> {
  return telegramApi<TelegramFileInfo>("getFile", { file_id: fileId });
}

export async function downloadTelegramFile(filePath: string): Promise<Buffer> {
  const url = `https://api.telegram.org/file/bot${botToken()}/${filePath}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Neizdevās lejupielādēt Telegram failu (${res.status}).`);
  }
  const arr = await res.arrayBuffer();
  return Buffer.from(arr);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function statusMessage(status: DocumentStatus): string {
  switch (status) {
    case "uploaded":
      return "Dokuments saņemts.";
    case "processing":
      return "Dokuments tiek apstrādāts…";
    case "processed":
      return "Dokuments apstrādāts.";
    case "failed":
      return "Neizdevās apstrādāt dokumentu.";
    case "needs_review":
      return "Nepieciešama manuāla pārbaude.";
    default:
      return DocumentStatusLabels[status as DocumentStatus] ?? "Statuss atjaunots.";
  }
}

export interface AnalysisSummary {
  documentId: string;
  status: DocumentStatus;
  documentDate: Date | null;
  vendorName: string | null;
  documentNumber: string | null;
  totalAmount: number | null;
  vatAmount: number | null;
  currency: string | null;
  category: ExpenseCategory | null;
  deductibleStatus: DeductibleStatus | null;
  confidenceScore: number | null;
  needsReviewReasons: string[];
  explanation?: string | null;
}

export function formatAnalysisMessage(summary: AnalysisSummary): string {
  const lines: string[] = [];
  lines.push(`<b>${escapeHtml(statusMessage(summary.status))}</b>`);
  lines.push("");
  lines.push(`📋 ReceiptBox ID: <code>${escapeHtml(summary.documentId)}</code>`);
  lines.push(`📅 Datums: ${escapeHtml(formatLvDate(summary.documentDate))}`);
  lines.push(`🏢 Piegādātājs: ${escapeHtml(summary.vendorName ?? "—")}`);
  if (summary.documentNumber) {
    lines.push(`🔖 Dokumenta nr.: ${escapeHtml(summary.documentNumber)}`);
  }
  lines.push(
    `💶 Summa: ${escapeHtml(formatLvMoney(summary.totalAmount, summary.currency ?? "EUR"))}`,
  );
  lines.push(
    `🧾 PVN: ${escapeHtml(formatLvMoney(summary.vatAmount, summary.currency ?? "EUR"))}`,
  );
  lines.push(
    `📂 Kategorija: ${escapeHtml(
      summary.category ? ExpenseCategoryLabels[summary.category] : "—",
    )}`,
  );
  lines.push(
    `✅ Izdevumu statuss: ${escapeHtml(
      summary.deductibleStatus ? DeductibleStatusLabels[summary.deductibleStatus] : "—",
    )}`,
  );
  if (summary.confidenceScore !== null && summary.confidenceScore !== undefined) {
    lines.push(
      `🎯 Pārliecības līmenis: ${Math.round(summary.confidenceScore * 100)}%`,
    );
  }
  if (summary.explanation) {
    lines.push("");
    lines.push(`📝 ${escapeHtml(summary.explanation.slice(0, 400))}`);
  }
  if (summary.status === "needs_review") {
    lines.push("");
    lines.push("⚠️ <b>Lūdzu pārbaudi šo dokumentu vadības panelī.</b>");
    if (summary.needsReviewReasons.length > 0) {
      lines.push("Iemesli:");
      for (const r of summary.needsReviewReasons.slice(0, 5)) {
        lines.push(`• ${escapeHtml(r)}`);
      }
    }
  }
  lines.push("");
  lines.push(
    "🔒 <b>Oriģinālais dokuments ir dzēsts</b> no ReceiptBox servera pēc izvilkšanas.",
  );
  lines.push(
    "Tavs kontā saglabāti tikai struktūras lauki (summa, kategorija, piegādātājs utt.).",
  );
  lines.push("");
  lines.push(
    "❓ <b>Kur glabāt oriģinālu?</b> Rēķina kopiju glabā tu pie sevis — piemēram, telefonā, e-pastā, bankā vai mākoņuzglabātuvē.",
  );
  const appUrl = process.env.APP_URL?.replace(/\/$/, "");
  if (appUrl) {
    lines.push("");
    lines.push(`<a href="${escapeHtml(`${appUrl}/documents/${summary.documentId}`)}">Atvērt vadības paneli</a>`);
  }
  return lines.join("\n");
}

export function formatBankStatementSplitMessage(
  fileName: string,
  summaries: AnalysisSummary[],
): string {
  const lines: string[] = [];
  lines.push("<b>Bankas izdruka apstrādāta.</b>");
  lines.push("");
  lines.push(
    `No «${escapeHtml(fileName)}» izveidoti <b>${summaries.length}</b> maksājumi Valsts budžetam:`,
  );
  lines.push("");
  for (const s of summaries) {
    lines.push(
      `• ${escapeHtml(formatLvDate(s.documentDate))} — ${escapeHtml(
        formatLvMoney(s.totalAmount, s.currency ?? "EUR"),
      )} — ${escapeHtml(s.category ? ExpenseCategoryLabels[s.category] : "—")}`,
    );
    if (s.explanation) {
      lines.push(`  <i>${escapeHtml(s.explanation.slice(0, 120))}</i>`);
    }
  }
  lines.push("");
  lines.push("📋 Visi maksājumi pieejami vadības panelī sadaļā Dokumenti.");
  lines.push("");
  lines.push(
    "🔒 <b>Oriģinālais fails ir dzēsts</b> no ReceiptBox servera pēc izvilkšanas.",
  );
  const appUrl = process.env.APP_URL?.replace(/\/$/, "");
  if (appUrl) {
    lines.push("");
    lines.push(`<a href="${escapeHtml(`${appUrl}/documents`)}">Atvērt vadības paneli</a>`);
  }
  return lines.join("\n");
}

export function welcomeMessage(): string {
  return telegramStartWelcomeMessage();
}

export function helpMessage(appUrl: string | undefined): string {
  const lines = [
    "<b>ReceiptBox LV — palīdzība</b>",
    "",
    "/start — sākt darbu",
    "/help — šī palīdzība",
    "/id — parādīt savu Telegram lietotāja ID",
    "",
    "Sūti man dokumentu — es izvilku datus un dzēšu oriģinālu no servera.",
    "",
    "<b>Tavi dati pieder tev.</b> Saglabā oriģinālos dokumentus pie sevis.",
  ];
  if (appUrl) {
    lines.push("");
    lines.push(`Vadības panelis: ${appUrl}`);
  }
  return lines.join("\n");
}
