import * as XLSX from "xlsx";
import { formatLvDate } from "./dates";
import {
  DeductibleStatusLabels,
  DocumentStatusLabels,
  ExpenseCategoryLabels,
  DocumentSourceLabels,
  type DeductibleStatus,
  type DocumentStatus,
  type ExpenseCategory,
  type DocumentSourceType,
} from "./enums";
import type { ReportSummary } from "./reports";
import type { SerializedDocument } from "./documents";

const CSV_HEADER = [
  "ReceiptBox ID",
  "Ievadu kanāls",
  "Kur meklēt oriģinālu",
  "Tava piezīme (kur glabā oriģinālu)",
  "Datums",
  "Piegādātājs",
  "Reģistrācijas numurs",
  "Dokumenta numurs",
  "Kategorija",
  "Apakškategorija",
  "Summa bez PVN",
  "PVN",
  "Kopējā summa",
  "Mana daļa",
  "Atskaitāmais %",
  "Atskaitāmā summa",
  "Statuss",
  "Pārliecība",
  "Paskaidrojums",
];

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function numberLv(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  return value.toFixed(2).replace(".", ",");
}

function categoryLabel(doc: SerializedDocument): string {
  if (doc.categoryLabel) return doc.categoryLabel;
  if (!doc.category) return ExpenseCategoryLabels.unknown;
  return ExpenseCategoryLabels[doc.category as ExpenseCategory] ?? "—";
}

function statusLabel(status: SerializedDocument["status"]): string {
  return DocumentStatusLabels[status as DocumentStatus] ?? status;
}

function deductibleLabel(status: SerializedDocument["deductibleStatus"]): string {
  if (!status) return DeductibleStatusLabels.unknown;
  return DeductibleStatusLabels[status as DeductibleStatus] ?? "—";
}

function sourceTypeLabel(t: DocumentSourceType): string {
  return DocumentSourceLabels[t] ?? t;
}

export function buildCsv(documents: SerializedDocument[]): string {
  const rows = [CSV_HEADER.join(";")];
  for (const d of documents) {
    rows.push(
      [
        csvEscape(d.id),
        csvEscape(sourceTypeLabel(d.sourceType)),
        csvEscape(d.retrievalDisplayLine ?? ""),
        csvEscape(d.userSourceNote ?? ""),
        csvEscape(formatLvDate(d.documentDate)),
        csvEscape(d.vendorName ?? ""),
        csvEscape(d.vendorRegistrationNumber ?? ""),
        csvEscape(d.documentNumber ?? ""),
        csvEscape(categoryLabel(d)),
        csvEscape(d.userCategoryName ?? ""),
        csvEscape(numberLv(d.effectiveNetAmount ?? d.netAmount)),
        csvEscape(numberLv(d.effectiveVatAmount ?? d.vatAmount)),
        csvEscape(numberLv(d.effectiveTotalAmount ?? d.totalAmount)),
        csvEscape(numberLv(d.effectiveTotalAmount ?? d.totalAmount)),
        csvEscape(numberLv(d.deductiblePercent)),
        csvEscape(numberLv(d.effectiveDeductibleAmount ?? d.deductibleAmount)),
        csvEscape(`${deductibleLabel(d.deductibleStatus)} / ${statusLabel(d.status)}`),
        csvEscape(
          d.confidenceScore !== null && d.confidenceScore !== undefined
            ? `${Math.round(d.confidenceScore * 100)}%`
            : "",
        ),
        csvEscape(d.explanation ?? ""),
      ].join(";"),
    );
  }
  return "\ufeff" + rows.join("\r\n");
}

export function buildXlsx(report: ReportSummary): Buffer {
  const documentsSheet = XLSX.utils.aoa_to_sheet([
    CSV_HEADER,
    ...report.documents.map((d) => [
      d.id,
      sourceTypeLabel(d.sourceType),
      d.retrievalDisplayLine ?? "",
      d.userSourceNote ?? "",
      formatLvDate(d.documentDate),
      d.vendorName ?? "",
      d.vendorRegistrationNumber ?? "",
      d.documentNumber ?? "",
      categoryLabel(d),
      d.userCategoryName ?? "",
      d.effectiveNetAmount ?? d.netAmount ?? "",
      d.effectiveVatAmount ?? d.vatAmount ?? "",
      d.effectiveTotalAmount ?? d.totalAmount ?? "",
      d.effectiveTotalAmount ?? d.totalAmount ?? "",
      d.deductiblePercent ?? "",
      d.effectiveDeductibleAmount ?? d.deductibleAmount ?? "",
      `${deductibleLabel(d.deductibleStatus)} / ${statusLabel(d.status)}`,
      d.confidenceScore !== null && d.confidenceScore !== undefined
        ? `${Math.round(d.confidenceScore * 100)}%`
        : "",
      d.explanation ?? "",
    ]),
  ]);

  const categorySheet = XLSX.utils.aoa_to_sheet([
    ["Kategorija", "Dokumentu skaits", "Kopējā summa", "Atskaitāmā summa"],
    ...report.byCategory.map((c) => [c.categoryLabel, c.count, c.total, c.deductibleTotal]),
    [],
    ["Kopā:", report.totalCount, report.totalExpenses, report.deductibleExpenses],
  ]);

  const reviewDocs = report.documents.filter((d) => d.status === "needs_review");
  const reviewSheet = XLSX.utils.aoa_to_sheet([
    ["ReceiptBox ID", "Datums", "Piegādātājs", "Summa", "Iemesli"],
    ...reviewDocs.map((d) => [
      d.id,
      formatLvDate(d.documentDate),
      d.vendorName ?? "",
      d.effectiveTotalAmount ?? d.totalAmount ?? "",
      d.needsReviewReasons.join("; "),
    ]),
  ]);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, documentsSheet, "Dokumenti");
  XLSX.utils.book_append_sheet(workbook, categorySheet, "Kopsavilkums pa kategorijām");
  XLSX.utils.book_append_sheet(workbook, reviewSheet, "Jāpārbauda");

  const buf = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  return buf as Buffer;
}

export function exportFileName(prefix: string, year: number, quarter: string, ext: string): string {
  const safeQuarter = quarter === "ALL" ? "viss-gads" : quarter.toLowerCase();
  return `${prefix}-${year}-${safeQuarter}.${ext}`;
}
