import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { quarterRange, parseQuarter } from "@/lib/dates";
import { serializeDocument } from "@/lib/documents";
import {
  DEDUCTIBLE_STATUSES,
  DOCUMENT_STATUSES,
  DeductibleStatusLabels,
  DocumentStatusLabels,
  EXPENSE_CATEGORIES,
  ExpenseCategoryLabels,
  isDeductibleStatus,
  isDocumentStatus,
  isExpenseCategory,
  type Quarter,
} from "@/lib/enums";
import { UploadDropzone } from "./UploadDropzone";
import { DocumentsTable } from "./DocumentsTable";
import { DocumentsMobileCards } from "./DocumentsMobileCards";
import { parseCategoryLabels } from "@/lib/categories";
import { getUploadRetrievalHints } from "@/lib/uploadDefaults";
import {
  buildDocumentsQuery,
  documentListOrderBy,
  documentsListHref,
  parseDocumentSort,
} from "@/lib/documentListSort";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: {
    year?: string;
    quarter?: string;
    category?: string;
    status?: string;
    deductibleStatus?: string;
    sort?: string;
    dir?: string;
  };
}

const QUARTER_OPTIONS: { value: Quarter; label: string }[] = [
  { value: "ALL", label: "Viss gads" },
  { value: "Q1", label: "Q1 (jan–mar)" },
  { value: "Q2", label: "Q2 (apr–jūn)" },
  { value: "Q3", label: "Q3 (jūl–sep)" },
  { value: "Q4", label: "Q4 (okt–dec)" },
];

export default async function DocumentsPage({ searchParams }: PageProps) {
  const user = (await getSessionUser())!;

  const currentYear = new Date().getUTCFullYear();
  const yearNum = Number(searchParams.year);
  const selectedYear =
    Number.isFinite(yearNum) && yearNum > 1990 ? yearNum : currentYear;
  const quarter = parseQuarter(searchParams.quarter);
  const category = isExpenseCategory(searchParams.category) ? searchParams.category : null;
  const status = isDocumentStatus(searchParams.status) ? searchParams.status : null;
  const deductibleStatus = isDeductibleStatus(searchParams.deductibleStatus)
    ? searchParams.deductibleStatus
    : null;
  const sortState = parseDocumentSort(searchParams.sort, searchParams.dir);
  const listQuery = buildDocumentsQuery(searchParams);

  const where: Prisma.DocumentWhereInput = { userId: user.id };
  if (searchParams.year || searchParams.quarter) {
    const { start, end } = quarterRange(selectedYear, quarter);
    where.documentDate = { gte: start, lt: end };
  }
  if (category) where.category = category;
  if (status) where.status = status;
  if (deductibleStatus) where.deductibleStatus = deductibleStatus;

  const [docs, fullUser, retrievalHints] = await Promise.all([
    prisma.document.findMany({
      where,
      orderBy: documentListOrderBy(sortState.column, sortState.dir),
      take: 500,
      include: { userCategory: true },
    }),
    prisma.user.findUnique({ where: { id: user.id } }),
    getUploadRetrievalHints(user.id),
  ]);
  const customLabels = parseCategoryLabels(fullUser?.categoryLabelsJson);
  const serialized = docs.map((d) => serializeDocument(d, { customLabels }));

  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Dokumenti</h1>
        <p className="text-sm text-slate-600">
          Izdevumu ieraksti — oriģinālos failus ReceiptBox neglabā pēc apstrādes; šeit redzami tikai
          izvilktie dati.
        </p>
      </header>

      <UploadDropzone retrievalHints={retrievalHints} />

      <form className="card grid gap-3 md:grid-cols-5" method="get">
        <input type="hidden" name="sort" value={sortState.column} />
        <input type="hidden" name="dir" value={sortState.dir} />
        <div>
          <label className="label">Gads</label>
          <select name="year" defaultValue={searchParams.year ?? ""} className="input">
            <option value="">Visi gadi</option>
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Ceturksnis</label>
          <select name="quarter" defaultValue={quarter} className="input">
            {QUARTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Kategorija</label>
          <select name="category" defaultValue={category ?? ""} className="input">
            <option value="">Visas kategorijas</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {customLabels[c] ?? ExpenseCategoryLabels[c]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Statuss</label>
          <select name="status" defaultValue={status ?? ""} className="input">
            <option value="">Visi statusi</option>
            {DOCUMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {DocumentStatusLabels[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Atskaitāms</label>
          <select
            name="deductibleStatus"
            defaultValue={deductibleStatus ?? ""}
            className="input"
          >
            <option value="">Visi</option>
            {DEDUCTIBLE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {DeductibleStatusLabels[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-5 flex justify-end gap-2">
          <Link href="/documents" className="btn-secondary">
            Notīrīt
          </Link>
          <button type="submit" className="btn-primary">
            Filtrēt
          </button>
        </div>
      </form>

      <DocumentsMobileCards documents={serialized} listQuery={listQuery} />
      <div className="hidden md:block">
        <DocumentsTable
          documents={serialized}
          sortState={sortState}
          listQuery={listQuery}
        />
      </div>
    </div>
  );
}
