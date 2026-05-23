import Link from "next/link";
import type { SerializedDocument } from "@/lib/documents";
import { formatLvDate, formatLvMoney } from "@/lib/dates";
import type { DocumentSortColumn, SortDir } from "@/lib/documentListSort";
import { SortableTh } from "@/components/SortableTh";
import { DeductibleBadge, DocumentStatusBadge } from "@/components/StatusBadge";
import { DeleteDocumentButton } from "@/components/DeleteDocumentButton";
import { documentsListHref } from "@/lib/documentListSort";

const TH = "px-2 py-2";
const TD = "px-2 py-2 align-top";

interface DocumentsTableProps {
  documents: SerializedDocument[];
  sortState: { column: DocumentSortColumn; dir: SortDir };
  listQuery: Record<string, string>;
}

function compactFileName(name: string, max = 28): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

export function DocumentsTable({ documents, sortState, listQuery }: DocumentsTableProps) {
  return (
    <div className="card overflow-hidden p-0">
      <table className="w-full table-fixed divide-y divide-slate-200 text-xs">
        <colgroup>
          <col className="w-[4.5rem]" />
          <col className="w-[4.5rem]" />
          <col className="w-[26%]" />
          <col className="w-[11%]" />
          <col className="w-[10%]" />
          <col className="w-[10%]" />
          <col className="w-[13%]" />
          <col className="w-[9%]" />
          <col className="w-[4rem]" />
        </colgroup>
        <thead className="bg-slate-50 text-left text-[10px] uppercase tracking-wide text-slate-500">
          <tr>
            <SortableTh
              label="Piev."
              column="uploadedAt"
              currentSort={sortState.column}
              currentDir={sortState.dir}
              queryBase={listQuery}
              compact
              className={TH}
            />
            <SortableTh
              label="Dok."
              column="documentDate"
              currentSort={sortState.column}
              currentDir={sortState.dir}
              queryBase={listQuery}
              compact
              className={TH}
            />
            <SortableTh
              label="Piegādātājs"
              column="vendorName"
              currentSort={sortState.column}
              currentDir={sortState.dir}
              queryBase={listQuery}
              compact
              className={TH}
            />
            <th className={TH}>Avots</th>
            <th className={TH}>Kat.</th>
            <SortableTh
              label="Summa"
              column="totalAmount"
              currentSort={sortState.column}
              currentDir={sortState.dir}
              queryBase={listQuery}
              align="right"
              compact
              className={`${TH} text-right`}
            />
            <th className={`${TH} text-right`}>Atsk.</th>
            <SortableTh
              label="St."
              column="status"
              currentSort={sortState.column}
              currentDir={sortState.dir}
              queryBase={listQuery}
              compact
              className={TH}
            />
            <th className={TH} aria-label="Darbības" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white text-xs">
          {documents.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-2 py-10 text-center text-sm text-slate-500">
                Nav neviena dokumenta atbilstoši filtriem.
              </td>
            </tr>
          ) : null}
          {documents.map((doc) => {
            const currency = doc.currency ?? "EUR";
            const vat = doc.effectiveVatAmount;
            const showVat = vat !== null && vat !== undefined && Math.abs(vat) > 0.005;
            const retrievalTitle = [doc.retrievalDisplayLine, doc.sourceHint]
              .filter(Boolean)
              .join(" · ");
            const vendorTitle = [
              doc.vendorName,
              doc.documentNumber ? `Nr. ${doc.documentNumber}` : null,
              doc.originalFileName,
            ]
              .filter(Boolean)
              .join(" · ");

            return (
              <tr key={doc.id} className="hover:bg-slate-50">
                <td className={`${TD} whitespace-nowrap tabular-nums text-slate-600`}>
                  {formatLvDate(doc.uploadedAt)}
                </td>
                <td className={`${TD} whitespace-nowrap tabular-nums text-slate-800`}>
                  {doc.documentDate ? formatLvDate(doc.documentDate) : "—"}
                </td>
                <td className={`${TD} min-w-0 text-slate-900`} title={vendorTitle}>
                  <div className="truncate font-medium">{doc.vendorName ?? "—"}</div>
                  <div className="mt-0.5 truncate text-[10px] text-slate-500">
                    {[doc.documentNumber, compactFileName(doc.originalFileName)]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </td>
                <td className={`${TD} min-w-0 text-slate-700`} title={retrievalTitle || undefined}>
                  <div className="truncate">{doc.retrievalDisplayLine ?? "—"}</div>
                </td>
                <td className={`${TD} min-w-0 text-slate-700`} title={doc.userCategoryName ?? undefined}>
                  <div className="truncate">{doc.categoryLabel ?? "—"}</div>
                </td>
                <td className={`${TD} whitespace-nowrap text-right tabular-nums`}>
                  <div className="font-medium text-slate-900">
                    {formatLvMoney(doc.effectiveTotalAmount, currency)}
                  </div>
                  {showVat ? (
                    <div className="text-[10px] text-slate-500">
                      PVN {formatLvMoney(vat, currency)}
                    </div>
                  ) : null}
                </td>
                <td className={`${TD} whitespace-nowrap text-right tabular-nums`}>
                  <div className="text-slate-900">
                    {formatLvMoney(doc.effectiveDeductibleAmount, currency)}
                  </div>
                  <div className="mt-0.5 flex justify-end scale-[0.85] origin-right">
                    <DeductibleBadge status={doc.deductibleStatus} />
                  </div>
                </td>
                <td className={TD}>
                  <div className="scale-[0.85] origin-left">
                    <DocumentStatusBadge status={doc.status} />
                  </div>
                </td>
                <td className={`${TD} text-right`}>
                  <div className="flex items-center justify-end gap-0.5">
                    <Link
                      href={documentsListHref(listQuery, doc.id)}
                      className="inline-flex min-h-8 min-w-8 items-center justify-center px-1 font-medium text-brand-700 hover:text-brand-800"
                      title="Atvērt"
                      aria-label="Atvērt dokumentu"
                    >
                      →
                    </Link>
                    <DeleteDocumentButton
                      documentId={doc.id}
                      label={doc.vendorName ?? doc.originalFileName}
                      compact
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
