import type { AiAnalysis } from "./ai";

/**
 * Strip sensitive patterns before persisting text fields / serialized aiJson.
 * We never intend to store IBANs, Latvian personas kods, raw addresses, etc.
 */

const LV_IBAN = /\bLV\d{2}[A-Z]{4}[A-Z0-9]{10,}\b/gi;
const PERSONAS_KODS = /\b\d{6}-\d{5}\b/g;
const LV_POSTAL = /\bLV-\d{4}\b/gi;
const EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const STREET_LIKE =
  /\b[A-ZĀČĒĢĪĶĻŅŠŪŽa-zāčēģīķļņšūž]{3,}\s+(?:iela|ielā|bulvāris|bulv\.|prospekts|pr\.|ceļš|pagalms)\b\.?/gi;
  /\b[A-ZĀČĒĢĪĶĻŅŠŪŽa-zāčēģīķļņšūž]{3,}\s+(?:iela|ielā|bulvāris|bulv\.|prospekts|pr\.|ceļš|pagalms)\b\.?/gi;

function stripNoise(s: string): string {
  let out = s;
  out = out.replace(LV_IBAN, "[IBAN]");
  out = out.replace(PERSONAS_KODS, "[pers.k.]");
  out = out.replace(LV_POSTAL, "[pasta indekss]");
  out = out.replace(EMAIL, "[e-pasts]");
  out = out.replace(STREET_LIKE, "[adrese]");
  out = out.replace(/\b(?:bankas\s*konts|konta\s*nr\.|account\s*no\.)\s*[:\s]*[A-Z0-9 ]{8,}\b/gi, "[konts]");
  return out.replace(/\s{2,}/g, " ").trim();
}

export function sanitizePlainText(input: string | null | undefined): string {
  if (input === null || input === undefined) return "";
  return stripNoise(input);
}

/** PDF extract for utility re-split: keep street names, strip IBAN / personas kods only. */
export function sanitizeUtilityExtractText(input: string | null | undefined): string {
  if (input === null || input === undefined) return "";
  let out = input;
  out = out.replace(LV_IBAN, " ");
  out = out.replace(PERSONAS_KODS, " ");
  out = out.replace(EMAIL, " ");
  return out.replace(/\s{2,}/g, " ").trim().slice(0, 40_000);
}

/** Safe display fields extracted from AI — stored in DB after scrubbing. */
export function sanitizeExplanation(input: string | null | undefined): string {
  return sanitizePlainText(input ?? "").slice(0, 800);
}

export function sanitizeAiAnalysisForPersistence(analysis: AiAnalysis): AiAnalysis {
  const reasons = analysis.needsReviewReasons.map((r) =>
    sanitizePlainText(r).slice(0, 200),
  );
  const lineItems = analysis.lineItems.map((li) => ({
    ...li,
    description: sanitizePlainText(li.description).slice(0, 200),
    identifier: sanitizeIdentifier(li.identifier),
  }));
  return {
    ...analysis,
    vendorName: scrubNullable(analysis.vendorName, 300),
    vendorRegistrationNumber: scrubNullable(analysis.vendorRegistrationNumber, 40),
    documentNumber: scrubNullable(analysis.documentNumber, 80),
    explanation: sanitizeExplanation(analysis.explanation),
    needsReviewReasons: reasons.filter((r) => r.length > 0).slice(0, 10),
    lineItems,
  };
}

function scrubNullable(v: string | null, max: number): string | null {
  if (v === null || v === undefined) return null;
  const s = sanitizePlainText(v).slice(0, max);
  return s.length === 0 ? null : s;
}

/** Keep phone-like tokens; strip IBAN/personas blobs from a single identifier cell. */
export function sanitizeIdentifier(id: string | null | undefined): string | null {
  if (id === null || id === undefined) return null;
  let s = sanitizePlainText(id.trim()).slice(0, 80);
  if (!s || s === "[IBAN]" || s === "[pers.k.]") return null;
  return s;
}

/** Produce JSON-safe snapshot without transient PDF text or oversized blobs. */
export function sanitizeAiJsonPayload(analysis: AiAnalysis): string {
  const scrubbed = sanitizeAiAnalysisForPersistence(analysis);
  return JSON.stringify(scrubbed);
}

export const SensitiveDataCleaner = {
  sanitizePlainText,
  sanitizeUtilityExtractText,
  sanitizeExplanation,
  sanitizeAiAnalysisForPersistence,
  sanitizeIdentifier,
  sanitizeAiJsonPayload,
};
