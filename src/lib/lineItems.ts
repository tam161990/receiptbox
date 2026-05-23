// Line items: per-position breakdown for multi-line invoices (e.g. LMT bill
// for 3 phone numbers, Latvenergo bill for 2 meters, etc.).

export interface LineItem {
  // Stable client-side id (not stored separately, just enables React keys
  // and PATCH targeting). Generated server-side when AI returns items.
  id: string;
  description: string;
  // Free-text identifier extracted from the line, when present: phone
  // number, IBAN, meter number, license plate, customer id, etc. We
  // intentionally do not constrain the shape — the user can put any
  // canonical token in their profile and we match by normalised string.
  identifier: string | null;
  netAmount: number | null;
  vatAmount: number | null;
  totalAmount: number | null;
  // Whether this line counts toward attributed totals. Defaults to the
  // result of identifier matching, but the user can toggle on the doc page.
  included: boolean;
  // True when VAT was inferred (e.g. at 21%) rather than read from the doc.
  vatAssumed: boolean;
  // True when the AI thinks this line belongs to the user (based on the
  // identifiers passed in the prompt). Independent of `included` — the
  // user can override either way.
  belongsToUser: boolean;
}

// Strip everything but digits + uppercase letters, lowercase the result.
// Phone numbers may come with spaces, dashes, plus, country codes — we
// keep only the last 8 digits which is the LV mobile/landline portion.
// IBANs have spaces in some renderings; we strip them and uppercase.
export function normalizeIdentifier(raw: string | null | undefined): string {
  if (!raw) return "";
  const cleaned = raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  // If it looks like a phone (8+ digits, mostly digits), keep last 8.
  const digits = cleaned.replace(/[^0-9]/g, "");
  if (digits.length >= 8 && digits.length === cleaned.length) {
    return digits.slice(-8);
  }
  return cleaned;
}

/** Loose text normalisation for addresses / free-form identifiers in line descriptions. */
export function normalizeMatchText(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\b(latvija|latvijas|lv|e-mail|email)\b/g, " ")
    .replace(/[^a-z0-9āčēģīķļņšūž]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeForMatch(raw: string): string[] {
  const norm = normalizeMatchText(raw);
  if (!norm) return [];
  return norm.split(" ").filter((t) => t.length >= 3);
}

export function identifierMatches(
  candidate: string | null | undefined,
  myIdentifiers: readonly string[],
): boolean {
  if (!candidate) return false;
  const norm = normalizeIdentifier(candidate);
  const textNorm = normalizeMatchText(candidate);
  if (!norm && !textNorm) return false;
  for (const mine of myIdentifiers) {
    const m = normalizeIdentifier(mine);
    const mineText = normalizeMatchText(mine);
    if (m && norm && (m === norm || norm.includes(m) || m.includes(norm))) {
      return true;
    }
    if (mineText.length >= 4 && textNorm.includes(mineText)) return true;
    if (mineText.length >= 4 && mineText.includes(textNorm) && textNorm.length >= 4) {
      return true;
    }
    const mineTokens = tokenizeForMatch(mine);
    if (mineTokens.length >= 2 && mineTokens.every((t) => textNorm.includes(t))) {
      return true;
    }
  }
  return false;
}

/** Match a line item against profile identifiers (meter, phone, address fragment, etc.). */
export function lineItemMatchesIdentifiers(
  identifier: string | null | undefined,
  description: string | null | undefined,
  myIdentifiers: readonly string[],
): boolean {
  if (myIdentifiers.length === 0) return false;
  if (identifierMatches(identifier, myIdentifiers)) return true;
  const desc = description ?? "";
  if (identifierMatches(desc, myIdentifiers)) return true;
  const combined = [identifier, desc].filter(Boolean).join(" ");
  return identifierMatches(combined, myIdentifiers);
}

export function parseLineItems(raw: string | null | undefined): LineItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: LineItem[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") continue;
      const e = entry as Record<string, unknown>;
      out.push({
        id: typeof e.id === "string" ? e.id : crypto.randomUUID(),
        description: typeof e.description === "string" ? e.description : "",
        identifier: typeof e.identifier === "string" ? e.identifier : null,
        netAmount: numOrNull(e.netAmount),
        vatAmount: numOrNull(e.vatAmount),
        totalAmount: numOrNull(e.totalAmount),
        included: e.included === undefined ? true : Boolean(e.included),
        vatAssumed: Boolean(e.vatAssumed),
        belongsToUser: Boolean(e.belongsToUser),
      });
    }
    return out;
  } catch {
    return [];
  }
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function parseMyIdentifiers(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((v): v is string => typeof v === "string")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .slice(0, 50);
  } catch {
    return [];
  }
}

export function serializeMyIdentifiers(list: readonly string[]): string | null {
  const clean = list
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter((s) => s.length > 0 && s.length <= 80)
    .slice(0, 50);
  if (clean.length === 0) return null;
  return JSON.stringify(clean);
}

// Latvia standard VAT.
export const LV_VAT_RATE = 0.21;

export interface VatTriple {
  netAmount: number | null;
  vatAmount: number | null;
  totalAmount: number | null;
}

export interface InferredVat extends VatTriple {
  vatAssumed: boolean;
}

// Given any subset of {net, vat, total} fill the missing pieces.
// - If all three are present, return as-is.
// - If two are present (or just net+vat / net+total / vat+total) — compute
//   the third exactly. vatAssumed=false.
// - If only `net` is present — assume LV_VAT_RATE → fill vat and total.
//   vatAssumed=true.
// - If only `total` is present — assume LV_VAT_RATE → reverse-compute
//   net and vat. vatAssumed=true.
// - If only `vat` is present — we cannot infer net/total safely; return
//   as-is with vatAssumed=false.
// - If nothing is present — return as-is.
//
// The 21% assumption is documented to the user via `vatAssumed=true`.
export interface InferVatOptions {
  /** When true, lone `totalAmount` is Kopā ar PVN (Enefit), not bez PVN (Elektrum). */
  totalIsGross?: boolean;
}

/** Canonical LV VAT from net (bez PVN): PVN = round(net×21%), Kopā = net + PVN. */
export function vatTripleFromNet(net: number, rate = LV_VAT_RATE): InferredVat {
  const vatAmount = round2(net * rate);
  const totalAmount = round2(net + vatAmount);
  return { netAmount: net, vatAmount, totalAmount, vatAssumed: true };
}

/**
 * When net is bez PVN, use round(net×rate) instead of total−net so identical nets
 * (e.g. LMT 11,55) always yield the same PVN/total (2,43 / 13,98), not 2,42 / 13,97.
 */
function preferCanonicalFromNet(
  n: number,
  v: number | null | undefined,
  t: number | null | undefined,
  rate: number,
): InferredVat | null {
  const canon = vatTripleFromNet(n, rate);
  const hasV = v !== null && v !== undefined && Number.isFinite(v);
  const hasT = t !== null && t !== undefined && Number.isFinite(t);
  if (!hasV && !hasT) return canon;

  const vOk = !hasV || Math.abs(v! - canon.vatAmount!) <= 0.02;
  const tOk = !hasT || Math.abs(t! - canon.totalAmount!) <= 0.02;
  if (vOk && tOk) return canon;

  // AI total/vat differ by a cent but net + vat ≈ total — normalize to 21% on net.
  if (hasV && hasT && Math.abs(round2(n + v!) - t!) <= 0.01 && (vOk || tOk)) {
    return canon;
  }
  return null;
}

export function inferVat(
  input: VatTriple,
  rate = LV_VAT_RATE,
  opts?: InferVatOptions,
): InferredVat {
  const { netAmount: n, vatAmount: v, totalAmount: t } = input;
  const has = (x: number | null) => x !== null && x !== undefined && Number.isFinite(x);

  // Document shows a total but PVN = 0 / missing — common on Latvenergo splits; treat total as net ex-VAT.
  if (has(t) && !has(n) && (!has(v) || v === 0) && !opts?.totalIsGross) {
    return vatTripleFromNet(t!, rate);
  }

  if (has(n) && has(v) && has(t)) {
    if (Math.abs(round2(n! + v!) - t!) <= 0.01) {
      const canonical = preferCanonicalFromNet(n!, v, t, rate);
      if (canonical) return canonical;
      return { ...input, vatAssumed: false };
    }
    // Gross stored as net (common on LMT / telecom rows): total ≈ net, VAT is separate.
    if (v! > 0 && t! > v! && Math.abs(n! - t!) <= 0.05) {
      const fixedNet = round2(t! - v!);
      if (fixedNet > 0) {
        return { ...vatTripleFromNet(fixedNet, rate), vatAssumed: false };
      }
    }
    if (v === 0 && n === t) {
      return vatTripleFromNet(n!, rate);
    }
    return { ...input, vatAssumed: false };
  }

  if (has(n)) {
    const canonical = preferCanonicalFromNet(n!, v, t, rate);
    if (canonical) return canonical;
  }

  if (has(n) && has(t)) {
    return { netAmount: n, vatAmount: round2(t! - n!), totalAmount: t, vatAssumed: false };
  }
  if (has(n) && has(v)) {
    return { netAmount: n, vatAmount: v, totalAmount: round2(n! + v!), vatAssumed: false };
  }
  if (has(t) && has(v)) {
    return { netAmount: round2(t! - v!), vatAmount: v, totalAmount: t, vatAssumed: false };
  }
  if (has(n)) {
    return vatTripleFromNet(n!, rate);
  }
  if (has(t)) {
    const net = round2(t! / (1 + rate));
    return {
      netAmount: net,
      vatAmount: round2(t! - net),
      totalAmount: t,
      vatAssumed: true,
    };
  }
  return { netAmount: n, vatAmount: v, totalAmount: t, vatAssumed: false };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export { round2 };

// Sum totals of included lines. Returns null if there are zero included
// items (so callers can fall back to top-level total).
export function attributedTotal(items: LineItem[]): number | null {
  const included = items.filter((i) => i.included);
  if (included.length === 0) return null;
  let sum = 0;
  for (const it of included) {
    if (it.totalAmount !== null) sum += it.totalAmount;
  }
  return round2(sum);
}

/** Per-component sums over included lines (for summary / exports). */
export interface AttributedMoneyBreakdown {
  netAmount: number | null;
  vatAmount: number | null;
  totalAmount: number | null;
}

/**
 * Sum Bez PVN / PVN / Kopā across lines the user marked as included.
 * Returns null when nothing is included. Omits a component if every
 * included line has that amount missing (then show “—” in the UI).
 */
export function attributedMoneyBreakdown(items: LineItem[]): AttributedMoneyBreakdown | null {
  const included = items.filter((i) => i.included);
  if (included.length === 0) return null;

  let netSum = 0;
  let vatSum = 0;
  let totalSum = 0;
  let anyNet = false;
  let anyVat = false;
  let anyTotal = false;

  for (const it of included) {
    if (it.netAmount !== null && Number.isFinite(it.netAmount)) {
      netSum += it.netAmount;
      anyNet = true;
    }
    if (it.vatAmount !== null && Number.isFinite(it.vatAmount)) {
      vatSum += it.vatAmount;
      anyVat = true;
    }
    if (it.totalAmount !== null && Number.isFinite(it.totalAmount)) {
      totalSum += it.totalAmount;
      anyTotal = true;
    }
  }

  return {
    netAmount: anyNet ? round2(netSum) : null,
    vatAmount: anyVat ? round2(vatSum) : null,
    totalAmount: anyTotal ? round2(totalSum) : null,
  };
}

// Reconcile a user-edited triple. Used when the user typed a new value in
// one of {net, vat, total} but did not update the others, leaving them
// inconsistent with the new value. If the three numbers don't satisfy
// net + vat ≈ total (within 0.01 EUR rounding), we trust the most likely
// "primary" field — preferring net, then total — and recompute the others
// at the given VAT rate. Returns `vatAssumed: true` in that case.
//
// If all three are absent or self-consistent, we just delegate to inferVat.
export function reconcileVat(input: VatTriple, rate = LV_VAT_RATE): InferredVat {
  const { netAmount: n, vatAmount: v, totalAmount: t } = input;
  const has = (x: number | null) => x !== null && x !== undefined && Number.isFinite(x);

  if (has(n) && has(v) && has(t)) {
    if (Math.abs(round2(n! + v!) - t!) <= 0.01) {
      const canonical = preferCanonicalFromNet(n!, v, t, rate);
      if (canonical) return canonical;
      return { ...input, vatAssumed: false };
    }
    return { ...vatTripleFromNet(n!, rate), vatAssumed: true };
  }
  return inferVat(input, rate);
}
