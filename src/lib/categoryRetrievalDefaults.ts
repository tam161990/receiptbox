import {
  EXPENSE_CATEGORIES,
  isExpenseCategory,
  normalizeRetrievalLocation,
  type DocumentRetrievalLocation,
  type ExpenseCategory,
} from "./enums";

export function parseCategoryRetrievalDefaults(
  json: string | null | undefined,
): Partial<Record<ExpenseCategory, DocumentRetrievalLocation>> {
  if (!json) return {};
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Partial<Record<ExpenseCategory, DocumentRetrievalLocation>> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (!isExpenseCategory(k)) continue;
      if (typeof v !== "string") continue;
      const loc = normalizeRetrievalLocation(v);
      if (!loc) continue;
      out[k] = loc;
    }
    return out;
  } catch {
    return {};
  }
}

export function serializeCategoryRetrievalDefaults(
  defaults: Partial<Record<ExpenseCategory, DocumentRetrievalLocation>>,
): string | null {
  const clean: Record<string, string> = {};
  for (const c of EXPENSE_CATEGORIES) {
    const loc = defaults[c];
    if (loc) clean[c] = loc;
  }
  return Object.keys(clean).length > 0 ? JSON.stringify(clean) : null;
}
