/** Parse Latvian bank account statements (Luminor and similar layouts). */

export interface BankStatementPayment {
  paymentDate: Date;
  paymentNumber: string;
  recipient: string;
  details: string;
  amount: number;
  currency: "EUR";
}

const DATE_PAYMENT_RE = /^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{6,12})\b/;
const FLAT_TX_START_RE =
  /(\d{2})\.(\d{2})\.(\d{4})\s+(\d{6,12})\s+(?=[^0-9]|$)/g;
const SUMMARY_LINE_RE =
  /^(kopā\s+(izejošie|ienākošie|komisijas)|sākuma\s+atlikums|beigu\s+atlikums|pieejamais\s+atlikums|iesaldēts)/i;
const VALSTS_BUDZETS_RE = /valsts\s*bud[žz]ets/i;
const VID_ACCOUNT_RE = /\b90000010008\b/;
const AMOUNT_TOKEN_RE = /(?<![\d.])(\d{1,5})[.,](\d{2})(?!\d|\.\d{2,4})/g;
const BLOCK_END_MARKERS = [
  " Kopā izejošie",
  " Kopā ienākošie",
  " Beigu atlikums",
  " Konta pārskats ar filtru",
  " Konta pārskats ",
];

function parseLvDateParts(dd: string, mm: string, yyyy: string): Date | null {
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return null;
  }
  return d;
}

function trimBlockAtSummary(block: string): string {
  let end = block.length;
  for (const marker of BLOCK_END_MARKERS) {
    const idx = block.indexOf(marker);
    if (idx >= 0) end = Math.min(end, idx);
  }
  return block.slice(0, end).trim();
}

function recipientMatchesBlock(blockText: string): boolean {
  return VALSTS_BUDZETS_RE.test(blockText) || VID_ACCOUNT_RE.test(blockText);
}

function extractLastAmount(text: string): number | null {
  const amounts: number[] = [];
  for (const m of text.matchAll(AMOUNT_TOKEN_RE)) {
    const value = Number(`${m[1]}.${m[2]}`);
    if (Number.isFinite(value) && value > 0 && value < 1_000_000) {
      amounts.push(value);
    }
  }
  return amounts.length > 0 ? amounts[amounts.length - 1]! : null;
}

function extractPaymentDetails(tail: string): string {
  const trimmed = trimBlockAtSummary(tail);
  const eds = /(EDS\d+[A-Z0-9]*(?:\s+IIN[^/]+(?:\/[^/]*)*)?)/i.exec(trimmed);
  if (eds?.[1]) {
    return eds[1]
      .replace(/\b\d{1,5}[.,]\d{2}\s*$/, "")
      .trim()
      .slice(0, 300);
  }

  const iin = /(IIN[^/]+(?:\/[^/]*)*)/i.exec(trimmed);
  if (iin?.[1]) {
    return iin[1]
      .replace(/\b\d{1,5}[.,]\d{2}\s*$/, "")
      .trim()
      .slice(0, 300);
  }

  const cleaned = trimmed
    .replace(/LV\d{2}[A-Z0-9]+/gi, " ")
    .replace(/\b[A-Z]{4}[A-Z]{2}[A-Z0-9]{2,}\b/g, " ")
    .replace(/\bTRF\s+[A-Z0-9]+\b/gi, " ")
    .replace(/\bB0[A-Z0-9]+\b/gi, " ")
    .replace(/\b90000010008\b/g, " ")
    .replace(/valsts\s*bud[žz]ets\s*\(vid\)/gi, " ")
    .replace(/\b\d{1,5}[.,]\d{2}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned.slice(0, 300) || "Valsts budžets (VID)";
}

function parseFlatBankStatement(text: string): BankStatementPayment[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  const starts: Array<{ index: number; dd: string; mm: string; yyyy: string; nr: string }> = [];

  for (const m of normalized.matchAll(FLAT_TX_START_RE)) {
    if (m.index === undefined) continue;
    starts.push({
      index: m.index,
      dd: m[1]!,
      mm: m[2]!,
      yyyy: m[3]!,
      nr: m[4]!,
    });
  }

  const payments: BankStatementPayment[] = [];
  for (let i = 0; i < starts.length; i += 1) {
    const start = starts[i]!;
    const end = starts[i + 1]?.index ?? normalized.length;
    let block = normalized.slice(start.index, end).trim();
    block = trimBlockAtSummary(block);
    if (!recipientMatchesBlock(block)) continue;

    const paymentDate = parseLvDateParts(start.dd, start.mm, start.yyyy);
    const tail = block.replace(
      /^\d{2}\.\d{2}\.\d{4}\s+\d{6,12}\s+/,
      "",
    );
    const amount = extractLastAmount(tail);
    if (!paymentDate || amount === null) continue;

    payments.push({
      paymentDate,
      paymentNumber: start.nr,
      recipient: "Valsts budžets (VID)",
      details: extractPaymentDetails(tail),
      amount,
      currency: "EUR",
    });
  }

  return payments;
}

function parseLineBasedBankStatement(text: string): BankStatementPayment[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const payments: BankStatementPayment[] = [];
  let i = 0;

  while (i < lines.length) {
    const start = DATE_PAYMENT_RE.exec(lines[i]!);
    if (!start) {
      i += 1;
      continue;
    }

    const blockLines: string[] = [lines[i]!];
    i += 1;
    while (i < lines.length) {
      const next = lines[i]!;
      if (DATE_PAYMENT_RE.test(next)) break;
      if (SUMMARY_LINE_RE.test(next)) break;
      blockLines.push(next);
      i += 1;
    }

    const blockText = trimBlockAtSummary(blockLines.join("\n"));
    if (!recipientMatchesBlock(blockText)) continue;

    const paymentDate = parseLvDateParts(start[1]!, start[2]!, start[3]!);
    const tail = blockLines.slice(1).join(" ");
    const amount = extractLastAmount(trimBlockAtSummary(tail));
    if (!paymentDate || amount === null) continue;

    payments.push({
      paymentDate,
      paymentNumber: start[4]!,
      recipient: "Valsts budžets (VID)",
      details: extractPaymentDetails(tail),
      amount,
      currency: "EUR",
    });
  }

  return payments;
}

/** Detect bank account statement PDF text (Luminor-style layout). */
export function shouldApplyBankStatementHeuristic(text: string | null | undefined): boolean {
  if (!text?.trim()) return false;
  const n = text.toLowerCase();
  const hasStatementMarkers =
    n.includes("konta pārskats") ||
    n.includes("konta pārskats ar filtru") ||
    (n.includes("sākuma atlikums") && n.includes("kopā izejošie"));
  const hasTableHeader =
    n.includes("datums") &&
    n.includes("maksājuma") &&
    (n.includes("saņēmējs") || n.includes("sanemejs"));
  const hasBankName =
    n.includes("luminor") ||
    n.includes("swedbank") ||
    n.includes("seb bank") ||
    n.includes("citadele") ||
    n.includes("rikolv2x");
  return hasStatementMarkers && (hasTableHeader || hasBankName);
}

/** Extract outgoing payments to Valsts budžets / account 90000010008. */
export function parseValstsBudzetsPayments(text: string): BankStatementPayment[] {
  const lineBased = parseLineBasedBankStatement(text);
  if (lineBased.length > 0) return lineBased;
  return parseFlatBankStatement(text);
}

export function detectBankName(text: string): string | null {
  const n = text.toLowerCase();
  if (n.includes("luminor")) return "Luminor Bank";
  if (n.includes("swedbank")) return "Swedbank";
  if (n.includes("seb bank") || n.includes("seb latvija")) return "SEB banka";
  if (n.includes("citadele")) return "Citadele banka";
  return null;
}

export type ValstsBudzetsTaxKind = "iin" | "vsaoi" | "other";

export interface ValstsBudzetsPaymentMeta {
  category: "taxes";
  taxKind: ValstsBudzetsTaxKind;
  explanationLine: string;
  servicePeriodStart: Date | null;
  servicePeriodEnd: Date | null;
}

function quarterUtcRange(year: number, quarter: number): { start: Date; end: Date } {
  const q = Math.max(1, Math.min(4, quarter));
  const startMonth = (q - 1) * 3;
  return {
    start: new Date(Date.UTC(year, startMonth, 1)),
    end: new Date(Date.UTC(year, startMonth + 3, 1)),
  };
}

/** Classify Valsts budžets (VID) payment text — IIN quarter, annual declaration, VSAOI, etc. */
export function classifyValstsBudzetsPayment(details: string): ValstsBudzetsPaymentMeta {
  const quarterMatch = /\biin\b[^.]*?(\d)\.?\s*cet\.?\s*(\d{4})/i.exec(details);
  if (quarterMatch) {
    const q = Number(quarterMatch[1]);
    const year = Number(quarterMatch[2]);
    if (Number.isFinite(q) && Number.isFinite(year) && q >= 1 && q <= 4) {
      const range = quarterUtcRange(year, q);
      return {
        category: "taxes",
        taxKind: "iin",
        explanationLine: `IIN ${q}. ceturksnis ${year}`,
        servicePeriodStart: range.start,
        servicePeriodEnd: range.end,
      };
    }
  }

  if (/\biin\b/i.test(details)) {
    const yearDecl = /(\d{4})\s*gada\s*deklar/i.exec(details);
    if (yearDecl) {
      const year = Number(yearDecl[1]);
      if (Number.isFinite(year)) {
        return {
          category: "taxes",
          taxKind: "iin",
          explanationLine: `IIN ${year} gada deklarācija`,
          servicePeriodStart: new Date(Date.UTC(year, 0, 1)),
          servicePeriodEnd: new Date(Date.UTC(year + 1, 0, 1)),
        };
      }
    }
    return {
      category: "taxes",
      taxKind: "iin",
      explanationLine: "IIN maksājums (VID)",
      servicePeriodStart: null,
      servicePeriodEnd: null,
    };
  }

  if (/\bvsaoi\b|sociāl/i.test(details)) {
    return {
      category: "taxes",
      taxKind: "vsaoi",
      explanationLine: "VSAOI maksājums (VID)",
      servicePeriodStart: null,
      servicePeriodEnd: null,
    };
  }

  return {
    category: "taxes",
    taxKind: "other",
    explanationLine: "Valsts budžeta maksājums (VID)",
    servicePeriodStart: null,
    servicePeriodEnd: null,
  };
}
