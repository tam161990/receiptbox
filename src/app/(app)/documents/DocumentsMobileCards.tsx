import Link from "next/link";
import type { SerializedDocument } from "@/lib/documents";
import { formatLvDate, formatLvMoney } from "@/lib/dates";
import { DeductibleBadge, DocumentStatusBadge } from "@/components/StatusBadge";
import { DeleteDocumentButton } from "@/components/DeleteDocumentButton";
import { documentsListHref } from "@/lib/documentListSort";

function compactFileName(name: string, max = 36): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

export function DocumentsMobileCards({
  documents,
  listQuery = {},
}: {
  documents: SerializedDocument[];
  listQuery?: Record<string, string>;
}) {
  if (documents.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 md:hidden">
        Nav neviena dokumenta atbilstoši filtriem.
      </div>
    );
  }

  return (
    <ul className="space-y-3 md:hidden">
      {documents.map((doc) => {
        const currency = doc.currency ?? "EUR";
        const vat = doc.effectiveVatAmount;
        const showVat = vat !== null && vat !== undefined && Math.abs(vat) > 0.005;
        const deleteLabel = doc.vendorName ?? doc.originalFileName;

        return (
          <li key={doc.id}>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-2">
                <Link
                  href={documentsListHref(listQuery, doc.id)}
                  className="min-w-0 flex-1 active:opacity-80"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-900">
                        {doc.vendorName ?? "—"}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-slate-500">
                        {[doc.documentNumber, compactFileName(doc.originalFileName)]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </div>
                    <DocumentStatusBadge status={doc.status} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-slate-500">Dok. datums</div>
                      <div className="font-medium text-slate-800">
                        {doc.documentDate ? formatLvDate(doc.documentDate) : "—"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-slate-500">Summa</div>
                      <div className="font-medium text-slate-900">
                        {formatLvMoney(doc.effectiveTotalAmount, currency)}
                      </div>
                      {showVat ? (
                        <div className="text-[10px] text-slate-500">
                          PVN {formatLvMoney(vat, currency)}
                        </div>
                      ) : null}
                    </div>
                    <div>
                      <div className="text-slate-500">Kategorija</div>
                      <div className="truncate font-medium text-slate-800">
                        {doc.categoryLabel ?? "—"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-slate-500">Atskaitāms</div>
                      <div className="font-medium text-slate-900">
                        {formatLvMoney(doc.effectiveDeductibleAmount, currency)}
                      </div>
                      <div className="mt-1 flex justify-end">
                        <DeductibleBadge status={doc.deductibleStatus} />
                      </div>
                    </div>
                  </div>
                  {doc.retrievalDisplayLine ? (
                    <div className="mt-2 truncate text-[11px] text-slate-500">
                      {doc.retrievalDisplayLine}
                    </div>
                  ) : null}
                </Link>
                <DeleteDocumentButton documentId={doc.id} label={deleteLabel} compact />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
