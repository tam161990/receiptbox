import type { Prisma } from "@prisma/client";

export const DOCUMENT_SORT_COLUMNS = [
  "uploadedAt",
  "documentDate",
  "vendorName",
  "totalAmount",
  "status",
  "confidenceScore",
] as const;

export type DocumentSortColumn = (typeof DOCUMENT_SORT_COLUMNS)[number];
export type SortDir = "asc" | "desc";

export const DEFAULT_DOCUMENT_SORT: DocumentSortColumn = "uploadedAt";
export const DEFAULT_SORT_DIR: SortDir = "desc";

export function isDocumentSortColumn(value: string | undefined): value is DocumentSortColumn {
  return DOCUMENT_SORT_COLUMNS.includes(value as DocumentSortColumn);
}

export function parseDocumentSort(
  sort?: string,
  dir?: string,
): { column: DocumentSortColumn; dir: SortDir } {
  const column = isDocumentSortColumn(sort) ? sort : DEFAULT_DOCUMENT_SORT;
  const direction: SortDir = dir === "asc" ? "asc" : DEFAULT_SORT_DIR;
  return { column, dir: direction };
}

export function documentListOrderBy(
  column: DocumentSortColumn,
  dir: SortDir,
): Prisma.DocumentOrderByWithRelationInput[] {
  const tieBreaker: Prisma.DocumentOrderByWithRelationInput = { id: "desc" };

  switch (column) {
    case "uploadedAt":
      return [{ uploadedAt: dir }, tieBreaker];
    case "documentDate":
      return [{ documentDate: dir }, { uploadedAt: "desc" }, tieBreaker];
    case "vendorName":
      return [{ vendorName: dir }, { uploadedAt: "desc" }, tieBreaker];
    case "totalAmount":
      return [{ totalAmount: dir }, { uploadedAt: "desc" }, tieBreaker];
    case "status":
      return [{ status: dir }, { uploadedAt: "desc" }, tieBreaker];
    case "confidenceScore":
      return [{ confidenceScore: dir }, { uploadedAt: "desc" }, tieBreaker];
    default:
      return [{ uploadedAt: "desc" }, tieBreaker];
  }
}

export interface DocumentListFilters {
  year?: string;
  quarter?: string;
  category?: string;
  status?: string;
  deductibleStatus?: string;
  sort?: string;
  dir?: string;
}

/** Query string params for document list links (filters + sort). */
export function buildDocumentsQuery(filters: DocumentListFilters): Record<string, string> {
  const q: Record<string, string> = {};
  if (filters.year) q.year = filters.year;
  if (filters.quarter) q.quarter = filters.quarter;
  if (filters.category) q.category = filters.category;
  if (filters.status) q.status = filters.status;
  if (filters.deductibleStatus) q.deductibleStatus = filters.deductibleStatus;

  const { column, dir } = parseDocumentSort(filters.sort, filters.dir);
  if (column !== DEFAULT_DOCUMENT_SORT || dir !== DEFAULT_SORT_DIR) {
    q.sort = column;
    q.dir = dir;
  }

  return q;
}

/** Build `/documents` or `/documents/:id` href preserving list filters. */
export function documentsListHref(
  listQuery: Record<string, string>,
  documentId?: string,
): string {
  const params = new URLSearchParams(listQuery);
  const qs = params.toString();
  const base = documentId ? `/documents/${documentId}` : "/documents";
  return qs ? `${base}?${qs}` : base;
}

export function pickDocumentListFilters(
  searchParams: Record<string, string | undefined>,
): Record<string, string> {
  return buildDocumentsQuery({
    year: searchParams.year,
    quarter: searchParams.quarter,
    category: searchParams.category,
    status: searchParams.status,
    deductibleStatus: searchParams.deductibleStatus,
    sort: searchParams.sort,
    dir: searchParams.dir,
  });
}
