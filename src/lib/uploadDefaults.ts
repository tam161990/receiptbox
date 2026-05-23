import { prisma } from "./prisma";
import {
  isKnownRetrievalLocation,
  normalizeRetrievalLocation,
  type DocumentRetrievalLocation,
} from "./enums";
import { parseCategoryRetrievalDefaults } from "./categoryRetrievalDefaults";

/** Normalise vendor name to a stable map key (latvenergo, elektrum, …). */
export function normalizeVendorKey(vendorName: string | null | undefined): string | null {
  if (!vendorName) return null;
  const s = vendorName.toLowerCase();
  if (s.includes("latvenergo")) return "latvenergo";
  if (s.includes("elektrum")) return "elektrum";
  if (s.includes("lmt") || s.includes("tele2") || s.includes("bite") || s.includes("tet"))
    return "telecom";
  if (s.includes("lattelecom")) return "internet";
  return s
    .replace(/[^a-z0-9āčēģīķļņšūž]+/gi, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join("_")
    .slice(0, 40) || null;
}

export function guessVendorKeyFromFileName(fileName: string): string | null {
  const n = fileName.toLowerCase();
  if (n.includes("latvenergo") || n.includes("energo")) return "latvenergo";
  if (n.includes("elektrum")) return "elektrum";
  if (n.includes("lmt") || n.includes("tele2") || n.includes("bite")) return "telecom";
  if (
    n.includes("luminor") ||
    n.includes("swedbank") ||
    n.includes("seb") ||
    n.includes("citadele") ||
    n.includes("bank") ||
    n.includes("konta") ||
    n.includes("pārskats") ||
    n.includes("parskats") ||
    n.includes("izdruk")
  ) {
    return "bank";
  }
  return null;
}

export interface UploadRetrievalHints {
  categoryDefaults: Partial<Record<string, DocumentRetrievalLocation>>;
  vendorDefaults: Record<string, DocumentRetrievalLocation>;
  /** Last retrieval used on any document (for generic filenames like rekins.pdf). */
  lastRetrieval: DocumentRetrievalLocation | null;
  /** Last retrieval on an electricity bill. */
  lastElectricityRetrieval: DocumentRetrievalLocation | null;
}

function retrievalVendorKey(doc: {
  vendorName: string | null;
  category: string | null;
  sourceHint: string | null;
}): string | null {
  const fromVendor = normalizeVendorKey(doc.vendorName);
  if (fromVendor) return fromVendor;
  if (doc.category === "electricity") return "electricity";
  const vendor = (doc.vendorName ?? "").toLowerCase();
  const hint = (doc.sourceHint ?? "").toLowerCase();
  if (hint.includes("bank") || vendor.includes("valsts bud")) return "bank";
  return null;
}

export async function getUploadRetrievalHints(userId: string): Promise<UploadRetrievalHints> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const categoryDefaults = parseCategoryRetrievalDefaults(user?.categoryRetrievalDefaultsJson);

  const vendorDefaults: Record<string, DocumentRetrievalLocation> = {};
  const recent = await prisma.document.findMany({
    where: { userId, retrievalLocation: { not: null } },
    orderBy: { uploadedAt: "desc" },
    take: 40,
    select: { vendorName: true, retrievalLocation: true, category: true, sourceHint: true },
  });

  for (const d of recent) {
    const loc = normalizeRetrievalLocation(d.retrievalLocation);
    if (!loc) continue;
    const key = retrievalVendorKey(d);
    if (key && !vendorDefaults[key]) {
      vendorDefaults[key] = loc;
    }
  }

  if (categoryDefaults.electricity && !vendorDefaults.latvenergo) {
    vendorDefaults.latvenergo = categoryDefaults.electricity;
  }
  if (categoryDefaults.electricity && !vendorDefaults.elektrum) {
    vendorDefaults.elektrum = categoryDefaults.electricity;
  }
  if (categoryDefaults.electricity && !vendorDefaults.electricity) {
    vendorDefaults.electricity = categoryDefaults.electricity;
  }
  if (categoryDefaults.bank_fees && !vendorDefaults.bank) {
    vendorDefaults.bank = categoryDefaults.bank_fees;
  }

  let lastRetrieval: DocumentRetrievalLocation | null = null;
  let lastElectricityRetrieval: DocumentRetrievalLocation | null = null;
  for (const d of recent) {
    const loc = normalizeRetrievalLocation(d.retrievalLocation);
    if (!loc) continue;
    if (!lastRetrieval) lastRetrieval = loc;
    if (
      !lastElectricityRetrieval &&
      (d.category === "electricity" ||
        normalizeVendorKey(d.vendorName) === "latvenergo" ||
        normalizeVendorKey(d.vendorName) === "elektrum")
    ) {
      lastElectricityRetrieval = loc;
    }
  }

  return {
    categoryDefaults,
    vendorDefaults,
    lastRetrieval,
    lastElectricityRetrieval:
      lastElectricityRetrieval ??
      vendorDefaults.electricity ??
      categoryDefaults.electricity ??
      null,
  };
}

export function resolveRetrievalForNewFile(
  fileName: string,
  hints: UploadRetrievalHints,
  globalDefault: DocumentRetrievalLocation | null,
): DocumentRetrievalLocation | null {
  const vendorKey = guessVendorKeyFromFileName(fileName);
  // Bank files always prefer internetbank — even when a global default (e.g. Elektrum app) is set.
  if (vendorKey === "bank") {
    return (
      hints.vendorDefaults.bank ??
      hints.categoryDefaults.bank_fees ??
      "internetbank"
    );
  }
  if (globalDefault) return globalDefault;
  if (vendorKey && hints.vendorDefaults[vendorKey]) {
    return hints.vendorDefaults[vendorKey]!;
  }
  if (vendorKey === "latvenergo" || vendorKey === "elektrum") {
    return (
      hints.lastElectricityRetrieval ??
      hints.vendorDefaults.electricity ??
      hints.categoryDefaults.electricity ??
      null
    );
  }
  if (vendorKey === "telecom") {
    return hints.categoryDefaults.telecom ?? null;
  }
  // Generic PDF names (rekins.pdf, scan.pdf) — use last electricity or any last source
  return (
    hints.lastElectricityRetrieval ??
    hints.lastRetrieval ??
    hints.vendorDefaults.electricity ??
    hints.categoryDefaults.electricity ??
    null
  );
}

/** Bank statement documents → internetbank (keep Cits + custom note if user chose it). */
export function resolveRetrievalForBankStatement(
  uploaded: string | null | undefined,
  customNote: string | null | undefined,
): DocumentRetrievalLocation {
  const canon = normalizeRetrievalLocation(uploaded);
  if (canon === "other" && customNote?.trim()) return "other";
  return "internetbank";
}

/** Pre-fill the upload form default picker from history. */
export function initialUploadRetrievalDefault(
  hints: UploadRetrievalHints,
): DocumentRetrievalLocation | null {
  return (
    hints.vendorDefaults.latvenergo ??
    hints.vendorDefaults.elektrum ??
    hints.lastElectricityRetrieval ??
    hints.lastRetrieval ??
    hints.categoryDefaults.electricity ??
    null
  );
}
