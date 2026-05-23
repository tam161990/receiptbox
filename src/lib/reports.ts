import { prisma } from "./prisma";
import { quarterRange } from "./dates";
import { serializeDocument, type SerializedDocument } from "./documents";
import { parseCategoryLabels } from "./categories";
import {
  ExpenseCategoryLabels,
  type ExpenseCategory,
  type Quarter,
} from "./enums";

export interface CategorySummary {
  category: ExpenseCategory | "unknown";
  categoryLabel: string;
  count: number;
  total: number;
  deductibleTotal: number;
}

export interface ReportSummary {
  year: number;
  quarter: Quarter;
  totalCount: number;
  totalExpenses: number;
  deductibleExpenses: number;
  partialDeductibleExpenses: number;
  nonDeductibleExpenses: number;
  needsReviewCount: number;
  byCategory: CategorySummary[];
  documents: SerializedDocument[];
  hasWarnings: boolean;
}

export async function buildReport(
  userId: string,
  year: number,
  quarter: Quarter,
): Promise<ReportSummary> {
  const { start, end } = quarterRange(year, quarter);
  const [docs, user] = await Promise.all([
    prisma.document.findMany({
      where: {
        userId,
        OR: [
          { documentDate: { gte: start, lt: end } },
          // Include documents needing review uploaded in the same range even
          // when documentDate is missing.
          {
            documentDate: null,
            uploadedAt: { gte: start, lt: end },
            status: "needs_review",
          },
        ],
      },
      orderBy: [{ documentDate: "asc" }, { uploadedAt: "asc" }],
      include: { userCategory: true },
    }),
    prisma.user.findUnique({ where: { id: userId } }),
  ]);

  const customLabels = parseCategoryLabels(user?.categoryLabelsJson);
  const serialized = docs.map((d) => serializeDocument(d, { customLabels }));

  let totalExpenses = 0;
  let deductibleExpenses = 0;
  let partialDeductibleExpenses = 0;
  let nonDeductibleExpenses = 0;
  let needsReviewCount = 0;

  const categoryMap = new Map<string, CategorySummary>();

  for (const d of serialized) {
    // Use attributed totals when present (multi-line invoices with line-item
    // filtering). Falls back to the document's top-level total.
    const total = d.effectiveTotalAmount ?? d.totalAmount ?? 0;
    const deductible = d.effectiveDeductibleAmount ?? d.deductibleAmount ?? 0;
    totalExpenses += total;

    switch (d.deductibleStatus) {
      case "yes":
        deductibleExpenses += deductible;
        break;
      case "partial":
        partialDeductibleExpenses += deductible;
        break;
      case "no":
        nonDeductibleExpenses += total;
        break;
      default:
        break;
    }

    if (d.status === "needs_review") needsReviewCount += 1;

    const catKey: ExpenseCategory | "unknown" = d.category ?? "unknown";
    const existing = categoryMap.get(catKey);
    if (existing) {
      existing.count += 1;
      existing.total += total;
      existing.deductibleTotal += deductible;
    } else {
      const builtinLabel =
        ExpenseCategoryLabels[catKey as ExpenseCategory] ?? "Nezināms";
      const label = customLabels[catKey as ExpenseCategory] ?? builtinLabel;
      categoryMap.set(catKey, {
        category: catKey,
        categoryLabel: label,
        count: 1,
        total,
        deductibleTotal: deductible,
      });
    }
  }

  const byCategory = [...categoryMap.values()].sort((a, b) => b.total - a.total);

  return {
    year,
    quarter,
    totalCount: serialized.length,
    totalExpenses: round2(totalExpenses),
    deductibleExpenses: round2(deductibleExpenses),
    partialDeductibleExpenses: round2(partialDeductibleExpenses),
    nonDeductibleExpenses: round2(nonDeductibleExpenses),
    needsReviewCount,
    byCategory: byCategory.map((c) => ({
      ...c,
      total: round2(c.total),
      deductibleTotal: round2(c.deductibleTotal),
    })),
    documents: serialized,
    hasWarnings: needsReviewCount > 0,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
