import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeDocument } from "@/lib/documents";
import { DocumentEditor } from "./DocumentEditor";
import { LineItemsEditor } from "./LineItemsEditor";
import { AskAiPanel } from "./AskAiPanel";
import { Disclaimer } from "@/components/Disclaimer";
import { DocumentStatusBadge } from "@/components/StatusBadge";
import { formatLvDate, formatLvMoney } from "@/lib/dates";
import { parseCategoryLabels, serializeUserCategory } from "@/lib/categories";
import { documentsListHref, pickDocumentListFilters } from "@/lib/documentListSort";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { id: string };
  searchParams: Record<string, string | undefined>;
}

export default async function DocumentDetailPage({ params, searchParams }: PageProps) {
  const listQuery = pickDocumentListFilters(searchParams);
  const backHref = documentsListHref(listQuery);
  const user = (await getSessionUser())!;
  const [doc, fullUser, subRows] = await Promise.all([
    prisma.document.findFirst({
      where: { id: params.id, userId: user.id },
      include: { userCategory: true },
    }),
    prisma.user.findUnique({ where: { id: user.id } }),
    prisma.userCategory.findMany({
      where: { userId: user.id },
      orderBy: [{ parentCategory: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);
  if (!doc) notFound();

  const customLabels = parseCategoryLabels(fullUser?.categoryLabelsJson);
  const serialized = serializeDocument(doc, { customLabels });
  const subcategories = subRows.map(serializeUserCategory);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={backHref} className="text-sm text-brand-700 hover:underline">
            ← Atpakaļ uz dokumentiem
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            {serialized.vendorName ?? serialized.originalFileName}
          </h1>
          <p className="text-sm text-slate-500">
            Augšupielādēts {formatLvDate(serialized.uploadedAt)} ·{" "}
            {serialized.originalFileName}
          </p>
        </div>
        <DocumentStatusBadge status={serialized.status} />
      </header>

      {!serialized.retrievalDisplayLine ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-medium">Norādi, kur vēlāk atrast šī dokumenta oriģinālu.</p>
          <p className="mt-1 text-amber-900/90">
            ReceiptBox neglabā oriģinālo failu — zemāk redaktorā izvēlies vietu (e-pasts, Elektrum,
            čeku mape u.tml.), lai zinātu, kur meklēt pēc dokumenta numura.
          </p>
        </div>
      ) : null}

      {serialized.status === "needs_review" && serialized.needsReviewReasons.length > 0 ? (
        <div className="rounded-lg border border-orange-100 bg-orange-50/40 px-3 py-2.5 text-sm text-orange-900">
          <p className="text-xs font-medium uppercase tracking-wide text-orange-700">Piezīmes</p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-sm">
            {serialized.needsReviewReasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <section className="card">
        <h2 className="text-base font-semibold text-slate-900">Kopsavilkums</h2>
        {serialized.originalFileDeletedAt ? (
          <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            <strong>Oriģinālais fails ir dzēsts</strong> no ReceiptBox servera{' '}
            {serialized.originalFileDeletedAt
              ? `(${new Date(serialized.originalFileDeletedAt).toLocaleString("lv-LV")})`
              : ""}
            . Saglabāti tikai struktūras dati. Oriģinālus glabā tu pie sevis.
          </p>
        ) : null}
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm md:grid-cols-4 lg:grid-cols-6">
          <Field label="Datums" value={formatLvDate(serialized.documentDate)} />
          <Field label="Maksājuma datums" value={formatLvDate(serialized.paymentDate)} />
          <Field
            label="Pakalpojuma periods"
            value={
              serialized.servicePeriodStart || serialized.servicePeriodEnd
                ? `${formatLvDate(serialized.servicePeriodStart)} – ${formatLvDate(
                    serialized.servicePeriodEnd,
                  )}`
                : "—"
            }
          />
          <Field label="Piegādātājs" value={serialized.vendorName ?? "—"} />
          <Field label="Reģ. nr." value={serialized.vendorRegistrationNumber ?? "—"} />
          <Field label="Dokumenta nr." value={serialized.documentNumber ?? "—"} />
          <Field label="ReceiptBox ID" value={serialized.id} />
          <Field
            label="Kur meklēt oriģinālu"
            value={serialized.retrievalDisplayLine ?? "—"}
          />
          <Field label="Ievadu kanāls" value={serialized.sourceTypeLabel} />
          {serialized.sourceHint ? (
            <Field label="Papildu norāde" value={serialized.sourceHint} />
          ) : null}
          {serialized.userSourceNote ? (
            <Field
              label="Mana piezīme"
              value={serialized.userSourceNote}
              wide
            />
          ) : null}
          <Field
            label="Summa bez PVN"
            value={formatLvMoney(serialized.effectiveNetAmount, serialized.currency ?? "EUR")}
          />
          <Field
            label="PVN"
            value={formatLvMoney(serialized.effectiveVatAmount, serialized.currency ?? "EUR")}
          />
          <Field
            label="Kopējā summa"
            value={formatLvMoney(serialized.effectiveTotalAmount, serialized.currency ?? "EUR")}
          />
          <Field
            label="Kategorija"
            value={
              serialized.categoryLabel
                ? serialized.userCategoryName
                  ? `${serialized.categoryLabel} → ${serialized.userCategoryName}`
                  : serialized.categoryLabel
                : "—"
            }
          />
          <Field
            label="Atskaitāmais statuss"
            value={serialized.deductibleStatusLabel ?? "—"}
          />
          <Field
            label="Atskaitāmā summa"
            value={
              serialized.deductiblePercent !== null && serialized.deductiblePercent !== undefined
                ? `${formatLvMoney(serialized.effectiveDeductibleAmount, serialized.currency ?? "EUR")} (${serialized.deductiblePercent}%)`
                : formatLvMoney(serialized.effectiveDeductibleAmount, serialized.currency ?? "EUR")
            }
          />
          {serialized.lineItems.length > 0 &&
          serialized.totalAmount !== null &&
          serialized.effectiveTotalAmount !== null &&
          Math.abs(serialized.totalAmount - serialized.effectiveTotalAmount) > 0.005 ? (
            <Field
              label="Kopējā summa visā dokumentā"
              value={formatLvMoney(serialized.totalAmount, serialized.currency ?? "EUR")}
            />
          ) : null}
        </dl>
        {serialized.explanation ? (
          <div className="mt-2 border-t border-slate-100 pt-2">
            <Field
              label="AI paskaidrojums"
              value={
                serialized.confidenceScore !== null &&
                serialized.confidenceScore !== undefined
                  ? `${serialized.explanation} (${Math.round(serialized.confidenceScore * 100)}%)`
                  : serialized.explanation
              }
              wide
            />
          </div>
        ) : null}
      </section>

      {serialized.lineItems.length > 0 ? (
        <section className="card">
          <h2 className="text-base font-semibold text-slate-900">
            Pozīcijas dokumentā
          </h2>
          <p className="mt-1 text-sm text-slate-600 md:max-w-2xl">
            Atzīmē pozīcijas, kas attiecas uz tavu saimniecisko darbību.
          </p>
          <div className="mt-4">
            <LineItemsEditor
              key={serialized.updatedAt}
              documentId={serialized.id}
              initial={serialized.lineItems}
              currency={serialized.currency ?? "EUR"}
              deductiblePercent={serialized.deductiblePercent}
            />
          </div>
        </section>
      ) : null}

      <section className="card">
        <h2 className="text-base font-semibold text-slate-900">Labot datus</h2>
        <div className="mt-2">
          {/* key forces the client form to reset its local state whenever the
              document is updated (e.g. after re-analysis). */}
          <DocumentEditor
            key={serialized.updatedAt}
            document={serialized}
            subcategories={subcategories}
            customLabels={customLabels}
          />
        </div>
      </section>

      <section className="relative overflow-hidden rounded-xl border-2 border-brand-200 bg-gradient-to-br from-brand-50 via-white to-brand-100/40 p-5 shadow-sm">
        <AskAiPanel documentId={serialized.id} />
      </section>

      <Disclaimer />
    </div>
  );
}

function Field({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "col-span-2 md:col-span-4 lg:col-span-6" : undefined}>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-sm text-slate-900" title={value}>
        {value}
      </dd>
    </div>
  );
}
