import type { RawAiLineItem } from "./ai";
import { identifiersForUtilityVendor } from "./identifierHints";
import { inferVat, normalizeMatchText } from "./lineItems";

// Amounts may be "26,15" in PDF or "26 15" after normalizeMatchText.
const KOPA_AMOUNT = /(\d{1,7})(?:\s*[,.]\s*|\s+)(\d{2})\b/;
const KOPA_RE = new RegExp(`\\bkopa\\b\\s*:?\\s*${KOPA_AMOUNT.source}`, "gi");
/** Per-address footer on Elektrum/Latvenergo detail page: «Kopā: 22,40» (colon required). */
const KOPA_ADDRESS_FOOTER_RE = new RegExp(
  `\\bkopa\\s*:\\s*${KOPA_AMOUNT.source}`,
  "gi",
);
const KOPA_ADDRESS_FOOTER_RAW_RE = new RegExp(
  `Kop[aā]\\s*:\\s*${KOPA_AMOUNT.source}`,
  "gi",
);
/** After normalizeMatchText colons vanish: «Kopā: 22.40» → «kopa 22 40». */
const KOPA_ADDRESS_FOOTER_NORM_RE = new RegExp(
  `\\bkopa\\s+${KOPA_AMOUNT.source}(?=\\s+(?:katrinas|ieriku|[a-z]{3,}\\s+(?:iela|dambis)|ar\\s+pvn))`,
  "gi",
);
const KOPA_AR_PVN_RE = new RegExp(
  `\\bkopa\\s+ar\\s+pvn\\b\\s*:?\\s*${KOPA_AMOUNT.source}`,
  "gi",
);
// Tight: amount on same line or within a few chars (not an address «iela 58-52» further out).
const KOPA_AR_PVN_LOOSE_RE = new RegExp(
  `\\bkopa\\s+ar\\s+pvn\\b[^0-9]{0,28}${KOPA_AMOUNT.source}`,
  "gi",
);
const APT_AFTER_IELA_RE = /iela\s+(\d{1,4})(?:\s*[-–]\s*|\s+)(\d{2,3})\b/gi;
// Some layouts: "Kopā" / "Kopā EUR" without "ar PVN" on the address footer.
const KOPA_SECTION_TOTAL_LOOSE_RE = new RegExp(
  `\\bkopa\\b(?:\\s+eur)?\\b[^0-9]{0,100}${KOPA_AMOUNT.source}`,
  "gi",
);
// PDF text often has "58-52" or "58 52" after normalisation.
const STREET_BLOCK_RE = /\b([a-z]+)\s+iela\s+(\d+(?:\s*[-–]?\s*\d+)*)/gi;
const ENEFIT_SECTION_RE = /\bpiesleguma\s+viet\w*/gi;
const ENEFIT_POINT_RE = /\b\d{2}[a-z]-[a-z0-9]{6,}\b/gi;
const METER_RE = /\bskaititajs\s+(\d{6,12})\b/gi;

export function isUtilityVendor(vendorName: string | null | undefined): boolean {
  if (!vendorName) return false;
  const s = vendorName.toLowerCase();
  return (
    s.includes("latvenergo") ||
    s.includes("elektrum") ||
    s.includes("enefit") ||
    s.includes("enefo") ||
    s.includes("aj power")
  );
}

/** Detect Elektrum/Latvenergo/Enefit-style bills from PDF text alone. */
export function looksLikeUtilityBillText(text: string | null | undefined): boolean {
  if (!text?.trim()) return false;
  const n = normalizeMatchText(text);
  return (
    n.includes("latvenergo") ||
    n.includes("elektrum") ||
    n.includes("enefit") ||
    n.includes("piesleguma vieta") ||
    n.includes("elektroenerg") ||
    (/\bkopa\s+ar\s+pvn\b/.test(n) &&
      (n.includes("piesleguma") || n.includes("skaititajs")))
  );
}

/**
 * Utility address-split may run only for real electricity vendors / layouts.
 * Avoids false positives on hotel, shop, telco bills with «iela» + «kopā».
 */
export function shouldApplyUtilityHeuristic(
  vendorName: string | null | undefined,
  category: string | null | undefined,
  text: string | null | undefined,
): boolean {
  if (isUtilityVendor(vendorName)) return true;
  if (category === "electricity" && looksLikeUtilityBillText(text)) return true;
  if (!text?.trim()) return false;
  if (countKopaArPvnInText(text) >= 2 && looksLikeUtilityBillText(text)) return true;
  return false;
}

/** Heuristic row must reference text in THIS pdf and a plausible per-address total. */
export function heuristicResultMatchesDocument(
  items: RawAiLineItem[],
  pdfText: string,
  invoiceGrandTotal: number | null | undefined,
  myIdentifiers: readonly string[],
): boolean {
  if (items.length === 0 || !pdfText.trim()) return false;

  const normPdf = normalizeMatchText(pdfText);
  const rawLow = pdfText.toLowerCase();
  const item = items[0]!;
  const id = item.identifier?.trim() ?? "";

  if (id.length >= 4) {
    const keys = identifierSearchKeys(id);
    const inText = keys.some((k) => {
      if (k.length < 4) return false;
      if (normPdf.includes(k)) return true;
      return rawLow.includes(k.toLowerCase().replace(/\s+/g, ""));
    });
    if (!inText) return false;
  }

  const attr = item.totalAmount ?? item.netAmount;
  if (attr == null || invoiceGrandTotal == null) return true;

  if (Math.abs(attr - invoiceGrandTotal) <= Math.max(2, invoiceGrandTotal * 0.01)) {
    return countKopaArPvnInText(pdfText) >= 2;
  }

  if (attr < invoiceGrandTotal * 0.85) {
    return (
      countKopaArPvnInText(pdfText) >= 2 ||
      countIdentifierSectionsInText(pdfText, myIdentifiers) >= 2
    );
  }

  return Math.abs(attr - invoiceGrandTotal) <= Math.max(5, invoiceGrandTotal * 0.05);
}

function splitPdfPages(text: string): string[] {
  const parts = text.split(/---\s*Lapa\s+\d+\s*---/i).map((p) => p.trim());
  return parts.filter((p) => p.length > 20);
}

function normalizeCorpus(text: string): string {
  const pages = splitPdfPages(text);
  return normalizeMatchText(pages.length > 0 ? pages.join(" ") : text);
}

/** Search keys for an address identifier (full string + street + apt). */
export function identifierSearchKeys(id: string): string[] {
  const keys = new Set<string>();
  const full = normalizeMatchText(id);
  if (full.length >= 4) keys.add(full);
  const streetMatch = id.match(/([a-zāčēģīķļņšūžA-ZĀČĒĢĪĶĻŅŠŪŽ]+\s+iela\s*\d+[-\d]*)/i);
  if (streetMatch) keys.add(normalizeMatchText(streetMatch[1]));
  const aptMatch = id.match(/(\d+\s*-\s*\d+|\d+[-\d]+)/);
  if (streetMatch && aptMatch) {
    keys.add(normalizeMatchText(`${streetMatch[1]} ${aptMatch[1].replace(/\s+/g, "")}`));
  }
  if (aptMatch) {
    const apt = aptMatch[1].replace(/\s+/g, "");
    if (apt.length >= 3) keys.add(normalizeMatchText(apt));
    const aptParts = apt.split("-").filter((p) => p.length >= 2);
    for (const p of aptParts) keys.add(normalizeMatchText(p));
  }
  // Enefit pieslēguma punkta kods (43Z-ST0003668650) vai līguma nr.
  const pointCode = id.match(/\b(\d{2}[A-Za-z]-[A-Za-z0-9]+)\b/);
  if (pointCode) keys.add(normalizeMatchText(pointCode[1]));
  const contract = id.match(/\b(EL\d{10,}[A-Z]{0,4})\b/i);
  if (contract) keys.add(normalizeMatchText(contract[1]));
  const meter = id.match(/\b(\d{8,12})\b/);
  if (meter) keys.add(normalizeMatchText(meter[1]));
  return [...keys].filter((k) => k.length >= 4);
}

function sectionMatchesIdentifier(sectionNorm: string, keys: string[]): boolean {
  for (const key of keys) {
    if (key.length >= 6 && sectionNorm.includes(key)) return true;
    const keyParts = key.split(" ").filter((t) => t.length >= 3);
    if (keyParts.length >= 2 && keyParts.every((p) => sectionNorm.includes(p))) {
      return true;
    }
  }
  return false;
}

function rawSearchVariants(key: string): string[] {
  const variants = new Set<string>();
  variants.add(key);
  variants.add(key.replace(/\s+/g, ""));
  variants.add(key.replace(/-/g, ""));
  variants.add(key.replace(/-/g, " "));
  return [...variants].filter((v) => v.length >= 4);
}

/** Search original PDF text (keeps hyphens in 43Z-ST…, 58-52). */
function sliceNearIdentifierRaw(original: string, keys: string[]): string | null {
  const rawLower = original.toLowerCase();
  let bestIdx = -1;
  let bestLen = 0;
  for (const key of keys) {
    for (const variant of rawSearchVariants(key)) {
      const idx = rawLower.indexOf(variant.toLowerCase());
      if (idx >= 0 && variant.length > bestLen) {
        bestIdx = idx;
        bestLen = variant.length;
      }
    }
  }
  if (bestIdx < 0) return null;
  return original.slice(bestIdx, bestIdx + 4500);
}

function scoreSectionMatchRaw(original: string, keys: string[]): number {
  const rawLower = original.toLowerCase();
  let best = 0;
  for (const key of keys) {
    for (const variant of rawSearchVariants(key)) {
      if (rawLower.includes(variant.toLowerCase())) {
        best = Math.max(best, variant.length + 10);
      }
    }
  }
  return best;
}

/** Slice ~2.5k chars starting at the best identifier hit (not the whole invoice). */
function sliceNearIdentifier(normText: string, keys: string[]): string | null {
  let bestIdx = -1;
  let bestLen = 0;
  for (const key of keys) {
    const idx = normText.indexOf(key);
    if (idx >= 0 && key.length > bestLen) {
      bestIdx = idx;
      bestLen = key.length;
    }
  }
  if (bestIdx < 0) {
    for (const key of keys) {
      const parts = key.split(" ").filter((t) => t.length >= 4);
      if (parts.length < 2) continue;
      const idx = normText.indexOf(parts[0]!);
      if (idx >= 0 && parts.every((p) => normText.slice(idx, idx + 3000).includes(p))) {
        bestIdx = idx;
        break;
      }
    }
  }
  if (bestIdx < 0) return null;
  return normText.slice(bestIdx, bestIdx + 2800);
}

function splitByMarkers(
  normText: string,
  re: RegExp,
): Array<{ section: string }> {
  const markers: { index: number }[] = [];
  for (const m of normText.matchAll(re)) {
    if (m.index !== undefined) markers.push({ index: m.index });
  }
  if (markers.length === 0) return [{ section: normText }];

  const sections: Array<{ section: string }> = [];
  for (let i = 0; i < markers.length; i++) {
    const start = markers[i]!.index;
    const end = i + 1 < markers.length ? markers[i + 1]!.index : normText.length;
    sections.push({ section: normText.slice(start, end) });
  }
  return sections;
}

/** Enefit: one section per "Pieslēguma vieta" (green header block). */
function splitEnefitSections(normText: string): Array<{ section: string }> {
  return splitByMarkers(normText, ENEFIT_SECTION_RE);
}

/** Split Elektrum/Latvenergo PDF text into per-address sections (on normalised text). */
function splitAddressSections(normText: string): Array<{ section: string }> {
  return splitByMarkers(normText, STREET_BLOCK_RE);
}

export function isEnefitLayout(
  normText: string,
  vendorHint?: string | null,
): boolean {
  if (vendorHint && /enefit/i.test(vendorHint)) return true;
  return normText.includes("enefit") || normText.includes("piesleguma vieta");
}

function kopaArPvnEndIndexes(normText: string): number[] {
  const ends = new Set<number>();
  for (const re of [KOPA_AR_PVN_RE, KOPA_AR_PVN_LOOSE_RE, KOPA_SECTION_TOTAL_LOOSE_RE]) {
    for (const m of normText.matchAll(re)) {
      if (m.index !== undefined) ends.add(m.index + m[0].length);
    }
  }
  return [...ends].sort((a, b) => a - b);
}

/** All per-section totals (Kopā ar PVN / Kopā) found in the bill. */
export function listSectionTotalsInText(text: string): number[] {
  return collectValidKopaArPvn(normalizeCorpus(text));
}

/** Windows ending at each "Kopā ar PVN" (Enefit per-connection totals). */
function splitByKopaArPvnWindows(normText: string): Array<{ section: string }> {
  const ends = kopaArPvnEndIndexes(normText);
  if (ends.length === 0) return [];
  return ends.map((end) => ({
    section: normText.slice(Math.max(0, end - 3500), end),
  }));
}

export function countKopaArPvnInText(text: string): number {
  const norm = normalizeCorpus(text);
  let n = 0;
  for (const _m of norm.matchAll(KOPA_AR_PVN_RE)) n++;
  return n;
}

function pickSections(
  normText: string,
  vendorHint?: string | null,
): Array<{ section: string }> {
  const enefit = isEnefitLayout(normText, vendorHint);

  if (enefit) {
    const byPiesleg = splitEnefitSections(normText);
    if (byPiesleg.length > 1) return byPiesleg;
    const byKopa = splitByKopaArPvnWindows(normText);
    if (byKopa.length > 1) return byKopa;
    if (byKopa.length === 1) return byKopa;
  }

  const byStreet = splitAddressSections(normText);
  if (byStreet.length > 1) return byStreet;

  const byKopa = splitByKopaArPvnWindows(normText);
  if (byKopa.length > 1) return byKopa;

  if (enefit) {
    const byPiesleg = splitEnefitSections(normText);
    if (byPiesleg.length > 0) return byPiesleg;
  }
  return byStreet;
}

function scoreSectionMatch(sectionNorm: string, keys: string[]): number {
  let best = 0;
  for (const key of keys) {
    if (key.length >= 5 && sectionNorm.includes(key)) {
      best = Math.max(best, key.length + 20);
      continue;
    }
    const parts = key.split(" ").filter((t) => t.length >= 3);
    const matched = parts.filter((p) => sectionNorm.includes(p)).length;
    if (matched >= 2) best = Math.max(best, matched * 15 + parts.length);
    else if (matched === 1 && parts[0]!.length >= 6) best = Math.max(best, 8);
  }
  return best;
}

function findBestSection(
  candidates: Array<{ section: string }>,
  keys: string[],
  normText: string,
): string | null {
  let bestSection: string | null = null;
  let bestScore = 0;
  const seen = new Set<string>();
  const all = [
    ...candidates,
    ...splitByKopaArPvnWindows(normText),
    ...splitAddressSections(normText),
  ];
  for (const { section } of all) {
    if (seen.has(section)) continue;
    seen.add(section);
    const score = scoreSectionMatch(section, keys);
    if (score > bestScore) {
      bestScore = score;
      bestSection = section;
    }
  }
  return bestScore >= 3 ? bestSection : null;
}

/** Last «Kopā: X.XX» address footer (bez PVN), not line subtotals «elektroenerģija kopā». */
function extractAddressKopaBezPvnFromBlock(block: string): number | null {
  if (!block.trim()) return null;
  let last: number | null = null;
  for (const re of [KOPA_ADDRESS_FOOTER_RAW_RE, KOPA_ADDRESS_FOOTER_RE, KOPA_ADDRESS_FOOTER_NORM_RE]) {
    re.lastIndex = 0;
    for (const m of block.matchAll(re)) {
      const n = Number(`${m[1]}.${m[2]}`);
      if (Number.isFinite(n) && n > 0 && n < 500_000) last = n;
    }
    if (last !== null) return last;
  }
  return null;
}

/** Last "Kopā" in section = Summa bez PVN for that address (e.g. 26.15). */
export function extractKopaBezPvnFromBlock(block: string): number | null {
  if (!block.trim()) return null;

  const addressFooter = extractAddressKopaBezPvnFromBlock(block);
  if (addressFooter !== null) return addressFooter;

  let last: number | null = null;
  for (const m of block.matchAll(KOPA_RE)) {
    const n = Number(`${m[1]}.${m[2]}`);
    if (Number.isFinite(n) && n > 0 && n < 500_000) last = n;
  }
  if (last !== null) return last;

  // Elektrum subtotals: Elektroenerģija kopā 14,94 + Pārvades kopā 11,21
  let elek: number | null = null;
  let pak: number | null = null;
  const elekM = block.match(
    new RegExp(`elektroenerg\\w*\\s+kop\\w*\\s*${KOPA_AMOUNT.source}`, "i"),
  );
  const pakM = block.match(
    new RegExp(`parvad\\w*\\s+un\\s+sadal\\w*[^0-9]{0,40}kop\\w*\\s*${KOPA_AMOUNT.source}`, "i"),
  );
  if (elekM) elek = Number(`${elekM[1]}.${elekM[2]}`);
  if (pakM) pak = Number(`${pakM[1]}.${pakM[2]}`);
  if (elek !== null && pak !== null) return Math.round((elek + pak) * 100) / 100;

  return null;
}

/** Enefit: "Kopā ar PVN" for the connection point (e.g. 26.15). */
function parseKopaAmountMatch(m: RegExpMatchArray): number | null {
  const n = Number(`${m[1]}.${m[2]}`);
  if (Number.isFinite(n) && n > 0 && n < 500_000) return n;
  return null;
}

/** «iela 58-52» → 58.52 — must not be treated as «Kopā ar PVN». */
function apartmentFalseAmountsFromBlock(block: string): Set<number> {
  const set = new Set<number>();
  for (const m of block.matchAll(APT_AFTER_IELA_RE)) {
    const dec = m[2]!.length >= 2 ? m[2]!.slice(0, 2) : m[2]!;
    const n = Number(`${m[1]}.${dec}`);
    if (Number.isFinite(n) && n > 10 && n < 300) set.add(Math.round(n * 100) / 100);
  }
  return set;
}

function amountMatchesApartmentNumber(amount: number, block: string): boolean {
  for (const a of apartmentFalseAmountsFromBlock(block)) {
    if (Math.abs(a - amount) < 0.01) return true;
  }
  return false;
}

function kopaMatchIsSpurious(block: string, m: RegExpMatchArray): boolean {
  const n = parseKopaAmountMatch(m);
  if (n === null) return true;
  if (amountMatchesApartmentNumber(n, block)) return true;

  const idx = m.index ?? 0;
  const gap = m[0];
  if (/iela\s+\d/.test(gap)) return true;

  const before = block.slice(Math.max(0, idx - 90), idx);
  if (/iela\s+\d+(?:\s*[-–]?\s*)?\d{0,3}\s*$/i.test(before)) return true;

  return false;
}

function collectValidKopaArPvn(block: string): number[] {
  const found: number[] = [];
  const strictRes = [KOPA_AR_PVN_RE];
  const looseRes = [KOPA_AR_PVN_LOOSE_RE, KOPA_SECTION_TOTAL_LOOSE_RE];

  const scan = (patterns: RegExp[]) => {
    for (const re of patterns) {
      for (const m of block.matchAll(re)) {
        if (kopaMatchIsSpurious(block, m)) continue;
        const n = parseKopaAmountMatch(m);
        if (n !== null) found.push(n);
      }
    }
  };

  scan(strictRes);
  if (found.length === 0) scan(looseRes);
  return found;
}

export function extractKopaArPvnFromBlock(
  block: string,
  which: "first" | "last" = "last",
): number | null {
  if (!block.trim()) return null;
  const found = collectValidKopaArPvn(block);
  if (found.length === 0) return null;
  return which === "first" ? found[0]! : found[found.length - 1]!;
}

function listKopaArPvnTotalsInBlock(block: string): number[] {
  return collectValidKopaArPvn(block);
}

function tryParseEnefitFooterForTotal(
  block: string,
  total: number,
): {
  netAmount: number;
  vatAmount: number;
  totalAmount: number;
} | null {
  const taxableM = block.match(
    new RegExp(`ar\\s+pvn\\s+21\\w*\\s+apliekama\\s+summa\\s*${KOPA_AMOUNT.source}`, "i"),
  );
  const exemptM = block.match(
    new RegExp(`ar\\s+pvn\\s+neapliekama\\s+summa\\s*${KOPA_AMOUNT.source}`, "i"),
  );
  const vatM = block.match(new RegExp(`\\bpvn\\s+21\\w*\\s*${KOPA_AMOUNT.source}`, "i"));

  if (!taxableM || !vatM) return null;

  const taxable = Number(`${taxableM[1]}.${taxableM[2]}`);
  const vat = Number(`${vatM[1]}.${vatM[2]}`);
  const exempt = exemptM ? Number(`${exemptM[1]}.${exemptM[2]}`) : 0;
  if (
    Number.isFinite(taxable) &&
    Number.isFinite(vat) &&
    Math.abs(taxable + exempt + vat - total) < 0.06
  ) {
    return {
      netAmount: Math.round((taxable + exempt) * 100) / 100,
      vatAmount: vat,
      totalAmount: total,
    };
  }
  return null;
}

/** Enefit footer trio: apliekama + PVN + «Kopā ar PVN» (ignores orphan 118.34-style subtotals). */
const ENEFIT_FOOTER_TRIO_RE = new RegExp(
  `ar\\s+pvn\\s+21\\w*\\s+apliekama\\s+summa\\s*${KOPA_AMOUNT.source}` +
    `[\\s\\S]{0,220}?\\bpvn\\s+21\\w*\\s*${KOPA_AMOUNT.source}` +
    `[\\s\\S]{0,220}?\\bkopa\\s+ar\\s+pvn\\b\\s*:?\\s*${KOPA_AMOUNT.source}`,
  "gi",
);

function extractEnefitConfirmedFooters(block: string): BlockAmount[] {
  const out: BlockAmount[] = [];
  for (const m of block.matchAll(ENEFIT_FOOTER_TRIO_RE)) {
    const chunk = m[0];
    const kopaM = chunk.match(
      new RegExp(`\\bkopa\\s+ar\\s+pvn\\b\\s*:?\\s*${KOPA_AMOUNT.source}`, "i"),
    );
    if (!kopaM) continue;
    const total = parseKopaAmountMatch(kopaM);
    if (total === null || amountMatchesApartmentNumber(total, block)) continue;
    const parsed = tryParseEnefitFooterForTotal(chunk, total);
    if (parsed) out.push(parsed);
  }
  return out;
}

/** Parse each «Kopā ar PVN» with VAT lines only in a tight window (not whole block). */
function extractEnefitPerKopaFooters(block: string): BlockAmount[] {
  const out: BlockAmount[] = [];
  for (const m of block.matchAll(new RegExp(KOPA_AR_PVN_RE.source, "gi"))) {
    if (kopaMatchIsSpurious(block, m)) continue;
    const total = parseKopaAmountMatch(m);
    if (total === null) continue;
    const start = Math.max(0, (m.index ?? 0) - 320);
    const end = (m.index ?? 0) + m[0].length + 40;
    const window = block.slice(start, end);
    const parsed = tryParseEnefitFooterForTotal(window, total);
    if (parsed) out.push(parsed);
  }
  return out;
}

function pickBestEnefitFooterAmount(candidates: BlockAmount[]): BlockAmount | null {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0]!;
  return candidates.reduce((a, b) =>
    (a.totalAmount ?? Infinity) < (b.totalAmount ?? Infinity) ? a : b,
  );
}

/** Parse Enefit footer when «ar PVN apliekama» + «PVN 21%» sum to «Kopā ar PVN». */
function parseEnefitTotalsFromBlock(
  block: string,
  which: "first" | "last" = "last",
): {
  netAmount: number;
  vatAmount: number;
  totalAmount: number;
} | null {
  const totals = collectValidKopaArPvn(block);
  if (totals.length === 0) return null;

  const order = which === "first" ? totals : [...totals].reverse();
  for (const total of order) {
    const parsed = tryParseEnefitFooterForTotal(block, total);
    if (parsed) return parsed;
  }

  const fallback = which === "first" ? totals[0]! : totals[totals.length - 1]!;
  return tryParseEnefitFooterForTotal(block, fallback);
}

/**
 * Enefit: one block may have an early «Kopā ar PVN» (period subtotal) and a final footer
 * with PVN lines (true per-connection total, e.g. 26.15 not 118.34).
 */
function extractEnefitAmountsFromBlock(block: string): BlockAmount | null {
  const trio = pickBestEnefitFooterAmount(extractEnefitConfirmedFooters(block));
  if (trio) return trio;

  const perKopa = pickBestEnefitFooterAmount(extractEnefitPerKopaFooters(block));
  if (perKopa) return perKopa;

  const withBreakdown = parseEnefitTotalsFromBlock(block, "last");
  if (withBreakdown) return withBreakdown;

  const totals = listKopaArPvnTotalsInBlock(block);
  if (totals.length >= 2) {
    const min = Math.min(...totals);
    return { netAmount: null, vatAmount: null, totalAmount: min };
  }

  return null;
}

type BlockAmount = { netAmount: number | null; vatAmount: number | null; totalAmount: number | null };

function extractAmountsFromBlock(
  block: string,
  enefit: boolean,
  kopaPick: "first" | "last" = "last",
): BlockAmount | null {
  if (enefit) {
    const smart = extractEnefitAmountsFromBlock(block);
    if (smart) return smart;
    const parsed = parseEnefitTotalsFromBlock(block, kopaPick);
    if (parsed) return parsed;
    const withVat = extractKopaArPvnFromBlock(block, kopaPick);
    if (withVat !== null) {
      return { netAmount: null, vatAmount: null, totalAmount: withVat };
    }
    return null;
  }
  const bezPvn = extractKopaBezPvnFromBlock(block);
  if (bezPvn !== null) {
    return { netAmount: bezPvn, vatAmount: null, totalAmount: null };
  }
  if (!enefit) {
    const withVat = extractKopaArPvnFromBlock(block, kopaPick);
    if (withVat !== null) {
      return { netAmount: null, vatAmount: null, totalAmount: withVat };
    }
  }
  return null;
}

/** Count pages/sections where a profile identifier appears. */
export function countIdentifierSectionsInText(
  text: string,
  myIdentifiers: readonly string[],
): number {
  const norm = normalizeCorpus(text);
  const sections = pickSections(norm, null);
  let hits = 0;
  for (const sec of sections) {
    for (const id of myIdentifiers) {
      if (sectionMatchesIdentifier(sec.section, identifierSearchKeys(id))) {
        hits++;
        break;
      }
    }
  }
  return hits;
}

/** Higher = more specific (meter beats bare "58-52"). */
function identifierSpecificity(id: string): number {
  if (/\b\d{8,12}\b/.test(id)) return 100;
  if (/\b\d{2}[A-Za-z]-[A-Za-z0-9]+\b/.test(id)) return 90;
  if (/\bEL\d{10,}/i.test(id)) return 85;
  const n = normalizeMatchText(id);
  if (n.includes("dzivokl")) return 75;
  if (n.includes("iela") && /\d+\s*-\s*\d+/.test(id)) return 65;
  if (n.includes("iela")) return 55;
  if (/^\d+\s*-\s*\d+$/.test(id.trim()) || /^\d+-\d+$/.test(id.trim())) return 20;
  return 35;
}

function isStrongIdentifier(id: string): boolean {
  return identifierSpecificity(id) >= 55;
}

function countKopaArPvnInNormBlock(normText: string): number {
  let n = 0;
  for (const _ of normText.matchAll(/kopa\s+ar\s+pvn/gi)) n++;
  return n;
}

function countAddressKopaFootersInNormBlock(normText: string): number {
  let n = 0;
  for (const _ of normText.matchAll(KOPA_ADDRESS_FOOTER_NORM_RE)) n++;
  if (n > 0) return n;
  for (const _ of normText.matchAll(KOPA_ADDRESS_FOOTER_RE)) n++;
  return n;
}

function countAddressKopaFootersInRaw(raw: string): number {
  let n = 0;
  for (const _ of raw.matchAll(KOPA_ADDRESS_FOOTER_RAW_RE)) n++;
  return n;
}

/** True when PDF already has per-address «Kopā: XX.XX» footers (Elektrum/Latvenergo page 2). */
export function hasPerAddressUtilityFooters(text: string | null | undefined): boolean {
  if (!text?.trim()) return false;
  if (countAddressKopaFootersInRaw(text) >= 2) return true;
  return countAddressKopaFootersInNormBlock(normalizeMatchText(text)) >= 2;
}

/** Prefer clean PDF text for address split; vision OCR can duplicate blocks and pick wrong totals. */
export function utilityTextForAddressSplit(
  pdfText: string | null | undefined,
  fallback: string | null | undefined,
): string {
  if (pdfText?.trim() && hasPerAddressUtilityFooters(pdfText)) return pdfText;
  return fallback?.trim() || pdfText?.trim() || "";
}

/** End slice before the next «Pieslēguma vieta» / other address (keep full connection footer). */
function trimRawSliceAtNextConnection(raw: string, skipChars = 80): string {
  const tail = raw.slice(skipChars);
  const nextPiesleg = tail.search(/piesl[eē]guma\s+vieta/i);
  if (nextPiesleg >= 40) {
    return raw.slice(0, skipChars + nextPiesleg);
  }

  const streetRe =
    /\b([A-Za-zĀČĒĢĪĶĻŅŠŪŽāčēģīķļņšūž][\w\s.-]*\s+iela\s*\d[\d\s/-]*)/gi;
  let secondStreet: RegExpExecArray | null = null;
  let first = true;
  for (const m of raw.matchAll(streetRe)) {
    if (first) {
      first = false;
      continue;
    }
    if (m.index !== undefined && m.index >= skipChars) {
      secondStreet = m;
      break;
    }
  }
  if (secondStreet?.index !== undefined) {
    return raw.slice(0, secondStreet.index);
  }

  // Elektrum/Latvenergo: next «Dzīvoklis» section (e.g. Katrīnas dambis after Ieriķu iela).
  let dzAfterSkip = 0;
  for (const m of raw.matchAll(/dz[iī]?vokl/gi)) {
    if (m.index === undefined || m.index < skipChars) continue;
    dzAfterSkip++;
    if (dzAfterSkip >= 2) {
      const before = raw.slice(skipChars, m.index);
      const dambisIdx = before.search(/\b[A-Za-zĀČĒĢĪĶĻŅŠŪŽāčēģīķļņšūž][\w\s.-]*\s+dambis\s+\d/i);
      if (dambisIdx >= 0) return raw.slice(0, skipChars + dambisIdx);
      const ielaIdx = before.lastIndexOf("iela");
      if (ielaIdx >= 20) {
        const streetStart = before.lastIndexOf(" ", ielaIdx - 2);
        return raw.slice(0, skipChars + Math.max(0, streetStart + 1));
      }
      return raw.slice(0, m.index);
    }
  }

  const secondKopaColon = (() => {
    let hits = 0;
    for (const m of raw.matchAll(/Kop[aā]\s*:/g)) {
      if (m.index === undefined || m.index < skipChars) continue;
      hits++;
      if (hits >= 2) return m.index;
    }
    return -1;
  })();
  if (secondKopaColon >= skipChars + 30) {
    const before = raw.slice(skipChars, secondKopaColon);
    const dambisIdx = before.search(/\bdambis\s+\d/i);
    if (dambisIdx >= 0) return raw.slice(0, skipChars + dambisIdx);
    return raw.slice(0, secondKopaColon);
  }

  return raw;
}

/** Shrink an oversized block to the identifier's connection point; use first footer total. */
function narrowBlockAroundIdentifier(
  block: ParsedAddressBlock,
  keys: string[],
  enefit: boolean,
): ParsedAddressBlock {
  const multiFooter =
    countKopaArPvnInNormBlock(block.normText) > 1 ||
    countAddressKopaFootersInNormBlock(block.normText) > 1 ||
    countAddressKopaFootersInRaw(block.rawText) > 1 ||
    (block.normText.match(/piesleguma\s+viet/g) ?? []).length > 1;

  let rawSlice = sliceNearIdentifierRaw(block.rawText, keys);
  if (!rawSlice || (!multiFooter && rawSlice.length >= block.rawText.length * 0.85)) {
    if (!multiFooter) return block;
    rawSlice = block.rawText;
  }

  rawSlice = trimRawSliceAtNextConnection(rawSlice);
  const normText = normalizeMatchText(rawSlice);
  const amounts = extractAmountsFromBlock(normText, enefit, "last");
  if (!amounts) return block;

  return {
    ...block,
    rawText: rawSlice,
    normText,
    amounts,
    totalDisplay: amounts.totalAmount ?? amounts.netAmount ?? null,
  };
}

function filterBlocksByStrongIdentifiers(
  blocks: ParsedAddressBlock[],
  myIdentifiers: readonly string[],
  text: string,
): ParsedAddressBlock[] {
  const strong = myIdentifiers.filter(isStrongIdentifier);
  if (strong.length === 0) return blocks;

  const matched = blocks.filter((block) =>
    strong.some((id) => {
      const keys = identifierSearchKeys(id);
      return scoreBlockForIdentifiers(block, keys, text) >= 3;
    }),
  );
  return matched.length > 0 ? matched : blocks;
}

function pushUtilityLineItem(
  out: RawAiLineItem[],
  id: string,
  amounts: BlockAmount,
  enefit: boolean,
  vendorHint?: string | null,
): void {
  const vat = inferVat(
    {
      netAmount: amounts.netAmount,
      vatAmount: amounts.vatAmount,
      totalAmount: amounts.totalAmount,
    },
    undefined,
    {
      totalIsGross:
        enefit &&
        amounts.totalAmount !== null &&
        amounts.netAmount === null &&
        amounts.vatAmount === null,
    },
  );
  const vendor = vendorHint?.trim();
  const label =
    vendor && vendor.length >= 2
      ? vendor.slice(0, 60)
      : enefit
        ? "Enefit"
        : "Elektrība";
  out.push({
    description: `${label} — ${id.trim().slice(0, 80)}`,
    identifier: id.trim().slice(0, 80),
    netAmount: vat.netAmount,
    vatAmount: vat.vatAmount,
    totalAmount: vat.totalAmount,
    belongsToUser: true,
  });
}

function buildUtilityLineItemsCore(
  text: string,
  myIdentifiers: readonly string[],
  vendorHint?: string | null,
): RawAiLineItem[] {
  const normText = normalizeCorpus(text);
  const enefit = isEnefitLayout(normText, vendorHint);
  const sections = pickSections(normText, vendorHint);
  const out: RawAiLineItem[] = [];

  for (const id of myIdentifiers) {
    const keys = identifierSearchKeys(id);
    let matchedSection: string | null = null;

    for (const { section } of sections) {
      if (sectionMatchesIdentifier(section, keys)) {
        matchedSection = section;
        break;
      }
    }

    if (!matchedSection) {
      matchedSection = findBestSection(sections, keys, normText);
    }

    if (!matchedSection) {
      matchedSection = sliceNearIdentifierRaw(text, keys);
    }
    if (!matchedSection) {
      matchedSection = sliceNearIdentifier(normText, keys);
    }

    if (!matchedSection) continue;

    const rawSlice = sliceNearIdentifierRaw(text, keys);
    const fromIdentifierSlice =
      Boolean(rawSlice && matchedSection === rawSlice) ||
      matchedSection === sliceNearIdentifier(normText, keys);
    const kopaPick: "first" | "last" = fromIdentifierSlice ? "first" : "last";
    const extractBlock =
      rawSlice && matchedSection === rawSlice
        ? normalizeMatchText(matchedSection)
        : matchedSection;
    let amounts = extractAmountsFromBlock(extractBlock, enefit, kopaPick);

    if (!amounts && enefit) {
      if (rawSlice) {
        amounts = extractAmountsFromBlock(normalizeMatchText(rawSlice), true, "first");
      }
      if (!amounts) {
        const idx = normText.indexOf(keys[0] ?? "");
        if (idx >= 0) {
          amounts = extractAmountsFromBlock(normText.slice(idx, idx + 4500), true, "first");
        }
      }
    }
    if (!amounts) continue;

    pushUtilityLineItem(out, id, amounts, enefit);
  }

  return out;
}

/** Score every per-address window and pick the best match (when headers are images). */
function buildUtilityLineItemsAggressive(
  text: string,
  myIdentifiers: readonly string[],
  vendorHint?: string | null,
): RawAiLineItem[] {
  const normText = normalizeCorpus(text);
  const enefit = isEnefitLayout(normText, vendorHint);
  const windows = splitByKopaArPvnWindows(normText);
  if (windows.length === 0) return [];

  const out: RawAiLineItem[] = [];
  for (const id of myIdentifiers) {
    const keys = identifierSearchKeys(id);
    let bestSection: string | null = null;
    let bestAmounts: BlockAmount | null = null;
    let bestScore = 0;

    for (const { section } of windows) {
      const score = Math.max(
        scoreSectionMatch(section, keys),
        scoreSectionMatchRaw(text, keys),
      );
      const amounts = extractAmountsFromBlock(section, enefit, "last");
      if (amounts && score > bestScore) {
        bestScore = score;
        bestSection = section;
        bestAmounts = amounts;
      }
    }

    if (!bestAmounts || bestScore < 3) continue;
    pushUtilityLineItem(out, id, bestAmounts, enefit);
  }
  return out;
}

/**
 * When AI took the invoice grand total (e.g. 118.34), pick a smaller per-address Kopā
 * that is not the grand total (e.g. 26.15 for the user's connection).
 */
function buildUtilityLineItemsExcludingGrandTotal(
  text: string,
  myIdentifiers: readonly string[],
  vendorHint: string | null | undefined,
  invoiceGrandTotal: number | null | undefined,
): RawAiLineItem[] {
  if (invoiceGrandTotal == null || !Number.isFinite(invoiceGrandTotal)) return [];

  const normText = normalizeCorpus(text);
  const enefit = isEnefitLayout(normText, vendorHint);
  const windows = splitByKopaArPvnWindows(normText);
  if (windows.length < 2) return [];

  const tagged = windows
    .map(({ section }) => ({
      section,
      total: extractKopaArPvnFromBlock(section, "last"),
    }))
    .filter((x): x is { section: string; total: number } => x.total != null);

  if (tagged.length < 2) return [];

  const maxT = Math.max(...tagged.map((t) => t.total));
  if (Math.abs(maxT - invoiceGrandTotal) > 2.5) return [];

  const subTotals = tagged.filter((t) => Math.abs(t.total - invoiceGrandTotal) > 1.5);
  if (subTotals.length === 0) return [];

  const out: RawAiLineItem[] = [];

  for (const id of myIdentifiers) {
    const keys = identifierSearchKeys(id);
    let best: (typeof subTotals)[0] | null = null;
    let bestScore = 0;

    for (const t of subTotals) {
      const score = Math.max(
        scoreSectionMatch(t.section, keys),
        scoreSectionMatchRaw(text, keys),
      );
      if (score > bestScore) {
        bestScore = score;
        best = t;
      }
    }

    if (best && bestScore >= 2) {
      const amounts = extractAmountsFromBlock(best.section, enefit, "last");
      if (amounts) pushUtilityLineItem(out, id, amounts, enefit);
    }
  }

  if (out.length > 0) return out;

  // One address on a multi-address bill — green header often missing from PDF text.
  if (subTotals.length === 1 && myIdentifiers.length >= 1) {
    const amounts = extractAmountsFromBlock(subTotals[0]!.section, enefit, "last");
    if (amounts) {
      pushUtilityLineItem(out, myIdentifiers[0]!, amounts, enefit);
    }
  }

  return out;
}

/** Windows of text ending at each occurrence of a monetary amount in the corpus. */
function windowsAroundAmounts(normText: string, amounts: number[]): Array<{ section: string; total: number }> {
  const out: Array<{ section: string; total: number }> = [];
  const seen = new Set<string>();
  for (const amount of amounts) {
    const [intPart, decPart] = amount.toFixed(2).split(".");
    const re = new RegExp(
      `${intPart.replace(/\B(?=(\d{3})+(?!\d))/g, "")}(?:\\s*[,.]\\s*|\\s+)${decPart}\\b`,
      "gi",
    );
    for (const m of normText.matchAll(re)) {
      if (m.index === undefined) continue;
      const end = m.index + m[0].length;
      const section = normText.slice(Math.max(0, end - 3500), end);
      const key = `${amount}:${section.slice(-80)}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push({ section, total: amount });
      }
    }
  }
  return out;
}

/**
 * Match identifiers to any non–grand-total Kopā amount in the corpus (when section
 * markers are missing from PDF text).
 */
function buildUtilityLineItemsFromAlternateTotals(
  text: string,
  myIdentifiers: readonly string[],
  vendorHint: string | null | undefined,
  invoiceGrandTotal: number | null | undefined,
): RawAiLineItem[] {
  if (invoiceGrandTotal == null || !Number.isFinite(invoiceGrandTotal)) return [];

  const normText = normalizeCorpus(text);
  const enefit = isEnefitLayout(normText, vendorHint);
  const allTotals = listSectionTotalsInText(text);
  if (allTotals.length === 0) return [];

  const maxT = Math.max(...allTotals);
  const grandMatches =
    Math.abs(maxT - invoiceGrandTotal) < Math.max(5, invoiceGrandTotal * 0.02);

  const candidates = allTotals.filter(
    (t) =>
      Math.abs(t - invoiceGrandTotal) > 2 &&
      t < invoiceGrandTotal * 0.98 &&
      t >= 3 &&
      t <= 2500,
  );

  if (candidates.length === 0) return [];

  const windows = windowsAroundAmounts(normText, candidates);
  if (windows.length === 0) return [];

  const out: RawAiLineItem[] = [];

  for (const id of myIdentifiers) {
    const keys = identifierSearchKeys(id);
    let best: (typeof windows)[0] | null = null;
    let bestScore = 0;

    for (const w of windows) {
      const score = Math.max(
        scoreSectionMatch(w.section, keys),
        scoreSectionMatchRaw(text, keys),
      );
      if (score > bestScore) {
        bestScore = score;
        best = w;
      }
    }

    if (best && bestScore >= 2) {
      let amounts = extractAmountsFromBlock(best.section, enefit, "last");
      if (!amounts) {
        amounts = enefit
          ? { netAmount: null, vatAmount: null, totalAmount: best.total }
          : { netAmount: best.total, vatAmount: null, totalAmount: null };
      }
      pushUtilityLineItem(out, id, amounts, enefit);
      continue;
    }

    // Single plausible address amount on a multi-address bill (no text match).
    if (
      grandMatches &&
      candidates.length === 1 &&
      myIdentifiers.length >= 1 &&
      id === myIdentifiers[0]
    ) {
      const amounts = enefit
        ? { netAmount: null, vatAmount: null, totalAmount: candidates[0]! }
        : { netAmount: candidates[0]!, vatAmount: null, totalAmount: null };
      pushUtilityLineItem(out, id, amounts, enefit);
    }
  }

  return out;
}

// ----- Line-by-line parser (primary approach) -----

const STREET_IN_LINE =
  /\b([A-Za-zĀČĒĢĪĶĻŅŠŪŽāčēģīķļņšūž][A-Za-zĀČĒĢĪĶĻŅŠŪŽāčēģīķļņšūž\s.-]*\s+iela\s*\d[\d\s/-]*)/i;

export interface ParsedAddressBlock {
  index: number;
  lines: string[];
  rawText: string;
  normText: string;
  addressLabel: string;
  amounts: BlockAmount | null;
  totalDisplay: number | null;
}

/** Split PDF extract into non-empty trimmed lines (keeps page markers). */
export function textToLogicalLines(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n");
  const chunks = normalized.split(/---\s*Lapa\s+\d+\s*---/i);
  if (chunks.length <= 1) {
    return normalized
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
  }
  const out: string[] = [];
  for (let p = 0; p < chunks.length; p++) {
    const body = chunks[p]!.trim();
    if (!body) continue;
    out.push(`--- Lapa ${p + 1} ---`);
    for (const line of body.split("\n")) {
      const t = line.trim();
      if (t) out.push(t);
    }
  }
  return out;
}

function isSectionStartLine(line: string, norm: string): boolean {
  if (/^piesleguma\s+viet/.test(norm)) return true;
  if (STREET_IN_LINE.test(line) && line.length < 200) return true;
  return false;
}

function extractAddressLabelFromLines(lines: string[]): string {
  for (const line of lines.slice(0, 12)) {
    const street = line.match(STREET_IN_LINE);
    if (street) return street[1]!.replace(/\s+/g, " ").trim().slice(0, 80);
    const point = line.match(/\b(\d{2}[A-Za-z]-[A-Za-z0-9]{6,})\b/);
    if (point) return point[1]!;
    const meter = line.match(/skait[iī]t[aā]j[aā]s?\s*:?\s*(\d{6,12})/i);
    if (meter) return `Skaitītājs ${meter[1]}`;
  }
  return lines[0]?.trim().slice(0, 80) ?? "Adrese";
}

function parseBlocksByKopaFooters(text: string): ParsedAddressBlock[] {
  const lines = textToLogicalLines(text);
  const blocks: ParsedAddressBlock[] = [];
  const footerIdx: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const norm = normalizeMatchText(lines[i]!);
    if (/kopa\s+ar\s+pvn/.test(norm)) footerIdx.push(i);
  }

  if (footerIdx.length === 0) return blocks;

  let prevEnd = 0;
  for (let f = 0; f < footerIdx.length; f++) {
    const end = footerIdx[f]! + 1;
    const slice = lines.slice(prevEnd, end);
    prevEnd = end;
    const sliceNorm = normalizeMatchText(slice.join(" "));
    if (slice.length < 1 || !/kopa\s+ar\s+pvn/.test(sliceNorm)) continue;

    const rawText = slice.join("\n");
    const normText = normalizeMatchText(rawText);
    const enefit = isEnefitLayout(normText, null);
    const amounts = extractAmountsFromBlock(normText, enefit, "last");
    blocks.push({
      index: f,
      lines: slice,
      rawText,
      normText,
      addressLabel: extractAddressLabelFromLines(slice),
      amounts,
      totalDisplay: amounts?.totalAmount ?? amounts?.netAmount ?? null,
    });
  }
  return blocks;
}

/** Split multi-address Elektrum/Latvenergo page-2 rows on «Kopā: 22,40» footers. */
function parseBlocksByAddressKopaFooters(text: string): ParsedAddressBlock[] {
  const raw = text.replace(/\r\n/g, "\n");
  const footerMatches: { start: number; end: number }[] = [];
  for (const m of raw.matchAll(KOPA_ADDRESS_FOOTER_RAW_RE)) {
    if (m.index === undefined) continue;
    footerMatches.push({ start: m.index, end: m.index + m[0].length });
  }

  if (footerMatches.length < 2) {
    const norm = normalizeMatchText(text);
    for (const m of norm.matchAll(KOPA_ADDRESS_FOOTER_NORM_RE)) {
      if (m.index === undefined) continue;
      footerMatches.push({ start: m.index, end: m.index + m[0].length });
    }
    if (footerMatches.length < 2) return [];

    const blocks: ParsedAddressBlock[] = [];
    for (let i = 0; i < footerMatches.length; i++) {
      const { start, end } = footerMatches[i]!;
      const prevEnd = i > 0 ? footerMatches[i - 1]!.end : 0;
      let sliceStart = Math.max(prevEnd, start - 2800);
      const headerWindow = norm.slice(sliceStart, start);
      const headerMatch = headerWindow.match(
        /(?:[a-z]+(?:\s+[a-z]+)*\s+iela\s*\d[\d\s/-]*|[a-z]+(?:\s+[a-z]+)*\s+dambis\s*\d[\d\s/-]*)/,
      );
      if (headerMatch?.index !== undefined) sliceStart += headerMatch.index;
      else if (i > 0) sliceStart = prevEnd;

      const section = norm.slice(sliceStart, end);
      if (section.length < 40 || !/(dzivokl|iela\s+\d|dambis\s+\d)/.test(section)) continue;
      const amounts = extractAmountsFromBlock(section, false, "last");
      blocks.push({
        index: blocks.length,
        lines: [section],
        rawText: section,
        normText: section,
        addressLabel: extractAddressLabelFromLines([section]),
        amounts,
        totalDisplay: amounts?.netAmount ?? amounts?.totalAmount ?? null,
      });
    }
    return blocks;
  }

  const blocks: ParsedAddressBlock[] = [];
  for (let i = 0; i < footerMatches.length; i++) {
    const { start, end } = footerMatches[i]!;
    const prevEnd = i > 0 ? footerMatches[i - 1]!.end : 0;
    let sliceStart = Math.max(prevEnd, start - 3200);
    const headerWindow = raw.slice(sliceStart, start);
    const headerMatch = headerWindow.match(
      /(?:[A-Za-zĀČĒĢĪĶĻŅŠŪŽāčēģīķļņšūž][A-Za-zĀČĒĢĪĶĻŅŠŪŽāčēģīķļņšūž\s.-]*\s+iela\s*\d[\d\s/-]*|[A-Za-zĀČĒĢĪĶĻŅŠŪŽāčēģīķļņšūž][A-Za-zĀČĒĢĪĶĻŅŠŪŽāčēģīķļņšūž\s.-]*\s+dambis\s*\d[\d\s/-]*)/,
    );
    if (headerMatch?.index !== undefined) sliceStart += headerMatch.index;
    else if (i > 0) sliceStart = prevEnd;

    const sectionRaw = raw.slice(sliceStart, end);
    const section = normalizeMatchText(sectionRaw);
    if (section.length < 40 || !/(dzivokl|iela\s+\d|dambis\s+\d)/i.test(sectionRaw)) continue;
    const amounts = extractAmountsFromBlock(section, false, "last");
    blocks.push({
      index: blocks.length,
      lines: [sectionRaw],
      rawText: sectionRaw,
      normText: section,
      addressLabel: extractAddressLabelFromLines([sectionRaw]),
      amounts,
      totalDisplay: amounts?.netAmount ?? amounts?.totalAmount ?? null,
    });
  }
  return blocks;
}

/** Read bill row-by-row; each block = one connection point / address. */
export function parseAddressBlocksFromLines(text: string): ParsedAddressBlock[] {
  const lines = textToLogicalLines(text);
  const blocks: ParsedAddressBlock[] = [];
  let current: string[] = [];
  let blockStartIdx = 0;

  const flush = () => {
    if (current.length === 0) return;
    const rawText = current.join("\n");
    const normText = normalizeMatchText(rawText);
    const enefit = isEnefitLayout(normText, null);
    const amounts = extractAmountsFromBlock(normText, enefit, "last");
    blocks.push({
      index: blockStartIdx,
      lines: [...current],
      rawText,
      normText,
      addressLabel: extractAddressLabelFromLines(current),
      amounts,
      totalDisplay: amounts?.totalAmount ?? amounts?.netAmount ?? null,
    });
    current = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const norm = normalizeMatchText(line);

    if (current.length > 0 && isSectionStartLine(line, norm)) {
      flush();
      blockStartIdx = blocks.length;
    }
    if (current.length === 0 && isSectionStartLine(line, norm)) {
      blockStartIdx = blocks.length;
    }

    current.push(line);

    const next = lines[i + 1];
    if (next && /kopa\s+ar\s+pvn/i.test(line) && /^\d[\d\s,.]*$/.test(next.trim())) {
      current.push(next);
      i++;
    }
  }
  flush();

  if (blocks.length <= 1) {
    const byAddressKopa = parseBlocksByAddressKopaFooters(text);
    if (byAddressKopa.length > 0) return byAddressKopa;
    const byFooters = parseBlocksByKopaFooters(text);
    if (byFooters.length > 0) return byFooters;
  }

  return blocks.filter(
    (b) =>
      b.lines.length >= 2 ||
      (/kopa\s+ar\s+pvn/.test(b.normText) && b.amounts !== null),
  );
}

export function summarizeAddressBlocks(blocks: ParsedAddressBlock[]): string {
  const withTotal = blocks.filter((b) => b.totalDisplay != null);
  if (withTotal.length === 0) {
    return `Atrasti ${blocks.length} teksta bloki, bet nevienam nav «Kopā ar PVN».`;
  }
  const parts = withTotal.map(
    (b) => `${b.addressLabel.slice(0, 36)} → ${b.totalDisplay!.toFixed(2)} EUR`,
  );
  return `Rindās atrastas ${withTotal.length} adreses: ${parts.join("; ")}.`;
}

function scoreBlockForIdentifiers(
  block: ParsedAddressBlock,
  keys: string[],
  _fullText: string,
): number {
  return Math.max(
    scoreSectionMatch(block.normText, keys),
    scoreSectionMatchRaw(block.rawText, keys),
  );
}

type UtilityPick = {
  id: string;
  block: ParsedAddressBlock;
  blockScore: number;
  specificity: number;
};

function rankUtilityPick(p: UtilityPick): number {
  return p.specificity * 10_000 + p.blockScore;
}

/** One line item per bill — best (identifier × address block) pair. */
function pickSingleUtilityLineFromBlocks(
  candidates: ParsedAddressBlock[],
  myIdentifiers: readonly string[],
  text: string,
  enefit: boolean,
  invoiceGrandTotal: number | null | undefined,
  vendorHint?: string | null,
): RawAiLineItem[] {
  let scoped = filterBlocksByStrongIdentifiers(candidates, myIdentifiers, text);
  scoped = filterBlocksExcludingGrandTotal(scoped, invoiceGrandTotal);

  const picks: UtilityPick[] = [];

  for (const id of myIdentifiers) {
    const keys = identifierSearchKeys(id);
    const specificity = identifierSpecificity(id);

    for (const block of scoped) {
      const refined = narrowBlockAroundIdentifier(block, keys, enefit);
      if (!refined.amounts) continue;
      if (amountMatchesInvoiceGrand(refined.totalDisplay, invoiceGrandTotal)) continue;

      const blockScore = scoreBlockForIdentifiers(refined, keys, text);
      if (blockScore < 3) continue;

      picks.push({ id, block: refined, blockScore, specificity });
    }
  }

  let best: UtilityPick | null = null;
  if (picks.length > 0) {
    const maxRank = Math.max(...picks.map(rankUtilityPick));
    const top = picks.filter((p) => rankUtilityPick(p) >= maxRank - 40);
    best = top.reduce((a, b) => rankUtilityPick(a) >= rankUtilityPick(b) ? a : b);
  }

  if (!best?.block.amounts) {
    const sole = scoped.length === 1 ? scoped[0]! : null;
    if (
      sole?.amounts &&
      !amountMatchesInvoiceGrand(sole.totalDisplay, invoiceGrandTotal)
    ) {
      const out: RawAiLineItem[] = [];
      pushUtilityLineItem(out, myIdentifiers[0]!, sole.amounts, enefit, vendorHint);
      return out;
    }
    return [];
  }

  const out: RawAiLineItem[] = [];
  pushUtilityLineItem(out, best.id, best.block.amounts, enefit, vendorHint);
  return out;
}

/** When several strategies each return a row, keep the most specific identifier. */
function collapseUtilityLineItemsToSingle(
  items: RawAiLineItem[],
  invoiceGrandTotal: number | null | undefined,
): RawAiLineItem[] {
  if (items.length <= 1) return items;

  let best = items[0]!;
  let bestRank = -Infinity;

  for (const item of items) {
    const id = item.identifier ?? item.description ?? "";
    const t = item.totalAmount ?? item.netAmount;
    let rank = identifierSpecificity(id) * 1000;
    if (amountMatchesInvoiceGrand(t, invoiceGrandTotal)) rank -= 1_000_000;
    if (rank > bestRank) {
      bestRank = rank;
      best = item;
    }
  }

  return [best];
}

function amountMatchesInvoiceGrand(
  amount: number | null | undefined,
  invoiceGrandTotal: number | null | undefined,
): boolean {
  if (amount == null || invoiceGrandTotal == null) return false;
  return Math.abs(amount - invoiceGrandTotal) <= Math.max(2, invoiceGrandTotal * 0.01);
}

function filterBlocksExcludingGrandTotal(
  blocks: ParsedAddressBlock[],
  invoiceGrandTotal: number | null | undefined,
): ParsedAddressBlock[] {
  if (invoiceGrandTotal == null || blocks.length < 2) return blocks;
  const totals = blocks
    .map((b) => b.totalDisplay)
    .filter((t): t is number => t != null);
  if (totals.length < 2) return blocks;
  const maxT = Math.max(...totals);
  if (Math.abs(maxT - invoiceGrandTotal) > Math.max(5, invoiceGrandTotal * 0.02)) {
    return blocks;
  }
  return blocks.filter(
    (b) =>
      b.totalDisplay == null ||
      Math.abs(b.totalDisplay - invoiceGrandTotal) > Math.max(2, invoiceGrandTotal * 0.01),
  );
}

/** Line-scan: all addresses → pick best match for each profile identifier. */
export function buildUtilityLineItemsByLineScan(
  text: string,
  myIdentifiers: readonly string[],
  vendorHint?: string | null,
  invoiceGrandTotal?: number | null,
): { items: RawAiLineItem[]; summary: string } {
  if (!text.trim() || myIdentifiers.length === 0) {
    return { items: [], summary: "" };
  }

  const corpusNorm = normalizeCorpus(text);
  const enefit = isEnefitLayout(corpusNorm, vendorHint);
  let allBlocks = parseAddressBlocksFromLines(text);

  if (allBlocks.length === 0 && enefit) {
    const amounts = extractAmountsFromBlock(corpusNorm, true, "last");
    if (amounts) {
      allBlocks = [
        {
          index: 0,
          lines: textToLogicalLines(text),
          rawText: text,
          normText: corpusNorm,
          addressLabel: extractAddressLabelFromLines(textToLogicalLines(text)),
          amounts,
          totalDisplay: amounts.totalAmount ?? amounts.netAmount ?? null,
        },
      ];
    }
  }

  const summary = summarizeAddressBlocks(allBlocks);
  let candidates = allBlocks.filter((b) => b.amounts !== null);
  candidates = filterBlocksExcludingGrandTotal(candidates, invoiceGrandTotal);

  const items = pickSingleUtilityLineFromBlocks(
    candidates,
    myIdentifiers,
    text,
    enefit,
    invoiceGrandTotal,
    vendorHint,
  );

  return { items, summary };
}

let lastLineScanSummary = "";

export function getLastUtilityLineScanSummary(): string {
  return lastLineScanSummary;
}

/**
 * Extract per-address totals from utility bill text (Enefit / Elektrum / Latvenergo).
 */
export function buildUtilityLineItemsFromText(
  text: string,
  myIdentifiers: readonly string[],
  vendorHint?: string | null,
  invoiceGrandTotal?: number | null,
): RawAiLineItem[] {
  if (!text.trim() || myIdentifiers.length === 0) return [];

  const ids = identifiersForUtilityVendor(myIdentifiers, vendorHint);

  const lineScan = buildUtilityLineItemsByLineScan(
    text,
    ids,
    vendorHint,
    invoiceGrandTotal,
  );
  lastLineScanSummary = lineScan.summary;
  if (lineScan.items.length > 0) {
    return collapseUtilityLineItemsToSingle(lineScan.items, invoiceGrandTotal);
  }

  const primary = buildUtilityLineItemsCore(text, ids, vendorHint);
  if (primary.length > 0) {
    return collapseUtilityLineItemsToSingle(primary, invoiceGrandTotal);
  }

  const aggressive = buildUtilityLineItemsAggressive(text, ids, vendorHint);
  if (aggressive.length > 0) {
    return collapseUtilityLineItemsToSingle(aggressive, invoiceGrandTotal);
  }

  const excluding = buildUtilityLineItemsExcludingGrandTotal(
    text,
    ids,
    vendorHint,
    invoiceGrandTotal,
  );
  if (excluding.length > 0) {
    return collapseUtilityLineItemsToSingle(excluding, invoiceGrandTotal);
  }

  return collapseUtilityLineItemsToSingle(
    buildUtilityLineItemsFromAlternateTotals(
      text,
      ids,
      vendorHint,
      invoiceGrandTotal,
    ),
    invoiceGrandTotal,
  );
}

export function pdfSuggestsMultipleAddresses(
  text: string,
  myIdentifiers: readonly string[],
  pageCount: number,
): boolean {
  if (myIdentifiers.length === 0) return false;
  const norm = normalizeCorpus(text);
  const sections = pickSections(norm, null);
  if (sections.length >= 2) return true;
  if (pageCount > 1) return true;
  return countIdentifierSectionsInText(text, myIdentifiers) >= 2;
}

/** True when heuristic found a plausible per-address Kopā for this identifier. */
export function hasUtilityAddressTotal(
  text: string,
  identifier: string,
): boolean {
  const items = buildUtilityLineItemsFromText(text, [identifier]);
  return items.length === 1 && items[0]!.netAmount !== null;
}
