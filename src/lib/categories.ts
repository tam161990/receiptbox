import type { UserCategory } from "@prisma/client";
import {
  DeductibleStatus,
  ExpenseCategory,
  ExpenseCategoryLabels,
  isDeductibleStatus,
  isExpenseCategory,
} from "./enums";

export interface SerializedUserCategory {
  id: string;
  parentCategory: ExpenseCategory;
  name: string;
  deductibleStatus: DeductibleStatus | null;
  deductiblePercent: number | null;
  sortOrder: number;
}

export function serializeUserCategory(c: UserCategory): SerializedUserCategory {
  const parent: ExpenseCategory = isExpenseCategory(c.parentCategory)
    ? c.parentCategory
    : "unknown";
  const ds = isDeductibleStatus(c.deductibleStatus) ? c.deductibleStatus : null;
  return {
    id: c.id,
    parentCategory: parent,
    name: c.name,
    deductibleStatus: ds,
    deductiblePercent: c.deductiblePercent,
    sortOrder: c.sortOrder,
  };
}

// Parse `User.categoryLabelsJson` into a {categoryCode → custom label} map.
// Invalid entries silently dropped.
export function parseCategoryLabels(
  raw: string | null | undefined,
): Partial<Record<ExpenseCategory, string>> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Partial<Record<ExpenseCategory, string>> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (isExpenseCategory(k) && typeof v === "string" && v.trim().length > 0) {
        out[k] = v.trim().slice(0, 80);
      }
    }
    return out;
  } catch {
    return {};
  }
}

// Pick the user-facing label for a main category code, falling back to the
// built-in Latvian label.
export function categoryLabelOf(
  code: ExpenseCategory,
  customLabels: Partial<Record<ExpenseCategory, string>>,
): string {
  return customLabels[code] ?? ExpenseCategoryLabels[code];
}
