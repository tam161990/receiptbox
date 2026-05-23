import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { buildReport } from "@/lib/reports";
import { parseQuarter, formatLvDate, formatLvMoney } from "@/lib/dates";
import { DeductibleBadge, DocumentStatusBadge } from "@/components/StatusBadge";
import { Disclaimer } from "@/components/Disclaimer";
import { QUARTER_LABELS, type Quarter } from "@/lib/enums";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: { year?: string; quarter?: string };
}

const QUARTER_OPTIONS: Quarter[] = ["ALL", "Q1", "Q2", "Q3", "Q4"];

export default async function ReportsPage({ searchParams }: PageProps) {
  const user = (await getSessionUser())!;
  const currentYear = new Date().getUTCFullYear();
  const yearNum = Number(searchParams.year);
  const selectedYear =
    Number.isFinite(yearNum) && yearNum > 1990 ? yearNum : currentYear;
  const quarter = parseQuarter(searchParams.quarter);

  const report = await buildReport(user.id, selectedYear, quarter);
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const exportQuery = `year=${selectedYear}&quarter=${quarter}`;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Pārskats</h1>
          <p className="text-sm text-slate-600">
            Sagatavo izdevumu apkopojumu deklarācijai un eksportē CSV vai XLSX.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <a
            href={`/api/export/csv?${exportQuery}`}
            className="btn-secondary w-full sm:w-auto"
            download
          >
            Eksportēt CSV
          </a>
          <a
            href={`/api/export/xlsx?${exportQuery}`}
            className="btn-primary w-full sm:w-auto"
            download
          >
            Eksportēt XLSX
          </a>
        </div>
      </header>

      <form className="card grid gap-3 md:grid-cols-3" method="get">
        <div>
          <label className="label">Gads</label>
          <select name="year" defaultValue={selectedYear} className="input">
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
            {QUARTER_OPTIONS.map((q) => (
              <option key={q} value={q}>
                {QUARTER_LABELS[q]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button type="submit" className="btn-primary">
            Atjaunot pārskatu
          </button>
        </div>
      </form>

      <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
        <SummaryCard label="Kopējie izdevumi" value={formatLvMoney(report.totalExpenses)} />
        <SummaryCard
          label="Atskaitāmie izdevumi"
          value={formatLvMoney(report.deductibleExpenses)}
          accent="emerald"
        />
        <SummaryCard
          label="Daļēji atskaitāmie"
          value={formatLvMoney(report.partialDeductibleExpenses)}
          accent="sky"
        />
        <SummaryCard
          label="Neatbilstošie"
          value={formatLvMoney(report.nonDeductibleExpenses)}
          accent="rose"
        />
        <SummaryCard
          label="Jāpārbauda"
          value={String(report.needsReviewCount)}
          accent="orange"
        />
      </section>

      {report.hasWarnings ? (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900">
          Šajā pārskatā ir {report.needsReviewCount} dokumenti, kas jāpārbauda
          pirms eksportēšanas. Tie joprojām ir iekļauti pārskatā un eksportā,
          bet atskaitāmais statuss var būt nepilnīgs.
        </div>
      ) : null}

      <section className="card">
        <h2 className="text-base font-semibold text-slate-900">
          Kopsavilkums pa kategorijām
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Kategorija</th>
                <th className="px-4 py-2 text-right">Dokumenti</th>
                <th className="px-4 py-2 text-right">Kopā</th>
                <th className="px-4 py-2 text-right">Atskaitāmā summa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {report.byCategory.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                    Šajā periodā nav datu.
                  </td>
                </tr>
              ) : null}
              {report.byCategory.map((c) => (
                <tr key={c.category}>
                  <td className="px-4 py-2 text-slate-900">{c.categoryLabel}</td>
                  <td className="px-4 py-2 text-right">{c.count}</td>
                  <td className="px-4 py-2 text-right">{formatLvMoney(c.total)}</td>
                  <td className="px-4 py-2 text-right">
                    {formatLvMoney(c.deductibleTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
            {report.byCategory.length > 0 ? (
              <tfoot className="bg-slate-50 text-sm font-medium text-slate-700">
                <tr>
                  <td className="px-4 py-2">Kopā</td>
                  <td className="px-4 py-2 text-right">{report.totalCount}</td>
                  <td className="px-4 py-2 text-right">
                    {formatLvMoney(report.totalExpenses)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {formatLvMoney(report.deductibleExpenses + report.partialDeductibleExpenses)}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </section>

      <section className="card">
        <h2 className="text-base font-semibold text-slate-900">
          Iekļautie dokumenti
        </h2>
        <ul className="mt-3 space-y-3 md:hidden">
          {report.documents.length === 0 ? (
            <li className="py-6 text-center text-sm text-slate-500">Šajā periodā nav dokumentu.</li>
          ) : null}
          {report.documents.map((d) => (
            <li key={d.id}>
              <Link
                href={`/documents/${d.id}`}
                className="block rounded-lg border border-slate-200 p-3 active:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 font-medium text-slate-900">
                    {d.vendorName ?? "—"}
                  </div>
                  <DocumentStatusBadge status={d.status} />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500">Datums </span>
                    {formatLvDate(d.documentDate ?? d.uploadedAt)}
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500">Summa </span>
                    {formatLvMoney(d.effectiveTotalAmount, d.currency ?? "EUR")}
                  </div>
                  <div className="col-span-2 truncate text-slate-600">{d.categoryLabel ?? "—"}</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-3 hidden overflow-x-auto md:block">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Datums</th>
                <th className="px-4 py-2">Kur meklēt</th>
                <th className="px-4 py-2">Piegādātājs</th>
                <th className="px-4 py-2">Kategorija</th>
                <th className="px-4 py-2 text-right">Summa</th>
                <th className="px-4 py-2 text-right">Atskaitāmā</th>
                <th className="px-4 py-2">Statuss</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {report.documents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                    Šajā periodā nav dokumentu.
                  </td>
                </tr>
              ) : null}
              {report.documents.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-2 text-slate-700">
                    {formatLvDate(d.documentDate ?? d.uploadedAt)}
                  </td>
                  <td className="max-w-[10rem] whitespace-normal px-4 py-2 text-xs text-slate-600">
                    <div className="font-medium text-slate-800">
                      {d.retrievalDisplayLine ?? "—"}
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-500">{d.sourceTypeLabel}</div>
                    {d.sourceHint ? (
                      <div className="mt-0.5 text-[10px] text-slate-500">{d.sourceHint}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-2 text-slate-900">{d.vendorName ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-700">
                    <div>{d.categoryLabel ?? "—"}</div>
                    {d.userCategoryName ? (
                      <div className="mt-0.5 text-xs text-slate-500">
                        {d.userCategoryName}
                      </div>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-right">
                    <div>{formatLvMoney(d.effectiveTotalAmount, d.currency ?? "EUR")}</div>
                    {d.totalAmountAttributed !== null &&
                    d.totalAmount !== null &&
                    Math.abs(d.totalAmountAttributed - d.totalAmount) > 0.005 ? (
                      <div className="mt-0.5 text-xs text-slate-400">
                        no {formatLvMoney(d.totalAmount, d.currency ?? "EUR")}
                      </div>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-right">
                    <div>{formatLvMoney(d.effectiveDeductibleAmount, d.currency ?? "EUR")}</div>
                    <div className="mt-1">
                      <DeductibleBadge status={d.deductibleStatus} />
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <DocumentStatusBadge status={d.status} />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/documents/${d.id}`}
                      className="text-sm font-medium text-brand-700 hover:underline"
                    >
                      Atvērt →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Disclaimer />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "emerald" | "sky" | "rose" | "orange";
}) {
  const accentClass =
    accent === "emerald"
      ? "text-emerald-600"
      : accent === "sky"
        ? "text-sky-600"
        : accent === "rose"
          ? "text-rose-600"
          : accent === "orange"
            ? "text-orange-600"
            : "text-slate-900";
  return (
    <div className="card">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className={`mt-2 text-xl font-semibold ${accentClass}`}>{value}</div>
    </div>
  );
}
