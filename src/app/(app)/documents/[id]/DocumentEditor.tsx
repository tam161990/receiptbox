"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SerializedDocument } from "@/lib/documents";
import type { SerializedUserCategory } from "@/lib/categories";
import { inferVat } from "@/lib/lineItems";
import { RetrievalLocationPicker } from "@/components/RetrievalLocationPicker";
import {
  DEDUCTIBLE_STATUSES,
  DeductibleStatusLabels,
  EXPENSE_CATEGORIES,
  ExpenseCategoryLabels,
  type ExpenseCategory,
  type DocumentRetrievalLocation,
} from "@/lib/enums";

interface FormState {
  documentDate: string;
  paymentDate: string;
  servicePeriodStart: string;
  servicePeriodEnd: string;
  vendorName: string;
  vendorRegistrationNumber: string;
  documentNumber: string;
  netAmount: string;
  vatAmount: string;
  totalAmount: string;
  category: string;
  userCategoryId: string;
  deductibleStatus: string;
  deductiblePercent: string;
  deductibleAmount: string;
  explanation: string;
  userSourceNote: string;
  retrievalLocation: "" | DocumentRetrievalLocation;
  retrievalCustomNote: string;
}

function toDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function toNumberInput(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function buildInitialState(doc: SerializedDocument): FormState {
  return {
    documentDate: toDateInput(doc.documentDate),
    paymentDate: toDateInput(doc.paymentDate),
    servicePeriodStart: toDateInput(doc.servicePeriodStart),
    servicePeriodEnd: toDateInput(doc.servicePeriodEnd),
    vendorName: doc.vendorName ?? "",
    vendorRegistrationNumber: doc.vendorRegistrationNumber ?? "",
    documentNumber: doc.documentNumber ?? "",
    netAmount: toNumberInput(doc.effectiveNetAmount ?? doc.netAmount),
    vatAmount: toNumberInput(doc.effectiveVatAmount ?? doc.vatAmount),
    totalAmount: toNumberInput(doc.effectiveTotalAmount ?? doc.totalAmount),
    category: doc.category ?? "unknown",
    userCategoryId: doc.userCategoryId ?? "",
    deductibleStatus: doc.deductibleStatus ?? "unknown",
    deductiblePercent: toNumberInput(doc.deductiblePercent),
    deductibleAmount: toNumberInput(doc.effectiveDeductibleAmount ?? doc.deductibleAmount),
    explanation: doc.explanation ?? "",
    userSourceNote: doc.userSourceNote ?? "",
    retrievalLocation: doc.retrievalLocation ?? "",
    retrievalCustomNote: doc.retrievalCustomNote ?? "",
  };
}

export function DocumentEditor({
  document,
  subcategories = [],
  customLabels = {},
}: {
  document: SerializedDocument;
  subcategories?: SerializedUserCategory[];
  customLabels?: Partial<Record<ExpenseCategory, string>>;
}) {
  const router = useRouter();
  const initial = useMemo(() => buildInitialState(document), [document]);
  const [form, setForm] = useState<FormState>(initial);

  const subsForCategory = useMemo(
    () => subcategories.filter((s) => s.parentCategory === form.category),
    [subcategories, form.category],
  );
  const [saving, setSaving] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [splitting, setSplitting] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(
    null,
  );

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function changeMainCategory(value: string) {
    setForm((prev) => {
      const stillValid = subcategories.some(
        (s) => s.id === prev.userCategoryId && s.parentCategory === value,
      );
      return {
        ...prev,
        category: value,
        userCategoryId: stillValid ? prev.userCategoryId : "",
      };
    });
  }

  function changeSubcategory(value: string) {
    if (value === "") {
      update("userCategoryId", "");
      return;
    }
    const sub = subcategories.find((s) => s.id === value);
    if (!sub) return;
    setForm((prev) => {
      const next: FormState = { ...prev, userCategoryId: value };
      // Auto-fill % and status from subcategory overrides (only if they exist).
      if (sub.deductiblePercent !== null) {
        next.deductiblePercent = String(sub.deductiblePercent);
      }
      if (sub.deductibleStatus !== null) {
        next.deductibleStatus = sub.deductibleStatus;
      }
      return next;
    });
  }

  function toNumber(value: string): number | null {
    if (value === "") return null;
    const n = Number(value.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }

  // Recompute VAT and total at 21% from whichever of {net, total} is filled.
  // Useful when the AI returned PVN: 0 for a line where PVN was simply not
  // shown — the user types the correct net and clicks this to fill in PVN
  // and Kopā in one move.
  function autoVat() {
    const net = toNumber(form.netAmount);
    const total = toNumber(form.totalAmount);
    let inferred: ReturnType<typeof inferVat> | null = null;
    if (net !== null && net > 0) {
      inferred = inferVat({ netAmount: net, vatAmount: null, totalAmount: null });
    } else if (total !== null && total > 0) {
      inferred = inferVat({ netAmount: null, vatAmount: null, totalAmount: total });
    } else {
      setMessage({
        type: "err",
        text: "Aizpildi 'Summa bez PVN' vai 'Kopējā summa', lai aprēķinātu PVN 21%.",
      });
      return;
    }
    setForm((prev) => ({
      ...prev,
      netAmount: inferred!.netAmount !== null ? String(inferred!.netAmount) : "",
      vatAmount: inferred!.vatAmount !== null ? String(inferred!.vatAmount) : "",
      totalAmount: inferred!.totalAmount !== null ? String(inferred!.totalAmount) : "",
    }));
    setMessage({
      type: "ok",
      text: "PVN aprēķināts pēc 21% likmes. Klikšķini ‘Saglabāt’, lai apstiprinātu.",
    });
  }

  const [clearing, setClearing] = useState(false);
  const [saveRetrievalDefault, setSaveRetrievalDefault] = useState(false);
  const hasLineItems = (document.lineItems?.length ?? 0) > 0;

  // Remove the AI-generated line-item split entirely. After this the
  // top-level Summa/PVN/Kopā become the source of truth for the deductible
  // amount calculation. Use when the AI's per-line split is wrong and the
  // user wants to type a single corrected total instead.
  async function clearLineItems() {
    if (!hasLineItems) return;
    if (
      !window.confirm(
        "Notīrīt automātisko pozīciju sadalījumu? Pēc tam atskaitāmā summa tiks rēķināta no laukiem Summa/PVN/Kopējā summa.",
      )
    ) {
      return;
    }
    setClearing(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/documents/${document.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineItems: null }),
      });
      const data = await res.json().catch(() => ({ ok: false }));
      if (!res.ok || !data.ok) {
        setMessage({
          type: "err",
          text: data.error || "Neizdevās notīrīt pozīcijas.",
        });
      } else {
        setMessage({ type: "ok", text: "Pozīciju sadalījums notīrīts." });
        router.refresh();
      }
    } finally {
      setClearing(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    if (form.retrievalLocation === "other" && !form.retrievalCustomNote.trim()) {
      setMessage({
        type: "err",
        text: "Ja izvēlējies ‘Cits’, ieraksti, kur tieši meklēt oriģinālu.",
      });
      setSaving(false);
      return;
    }
    try {
      const payload = {
        documentDate: form.documentDate || null,
        paymentDate: form.paymentDate || null,
        servicePeriodStart: form.servicePeriodStart || null,
        servicePeriodEnd: form.servicePeriodEnd || null,
        vendorName: form.vendorName || null,
        vendorRegistrationNumber: form.vendorRegistrationNumber || null,
        documentNumber: form.documentNumber || null,
        netAmount: toNumber(form.netAmount),
        vatAmount: toNumber(form.vatAmount),
        totalAmount: toNumber(form.totalAmount),
        category: form.category,
        userCategoryId: form.userCategoryId || null,
        deductibleStatus: form.deductibleStatus,
        deductiblePercent: toNumber(form.deductiblePercent),
        deductibleAmount: toNumber(form.deductibleAmount),
        explanation: form.explanation || null,
        userSourceNote: form.userSourceNote.trim() || null,
        retrievalLocation: form.retrievalLocation === "" ? null : form.retrievalLocation,
        retrievalCustomNote: form.retrievalCustomNote.trim() || null,
        saveRetrievalDefaultForCategory: saveRetrievalDefault,
        userConfirmedReview: true,
      };
      const res = await fetch(`/api/documents/${document.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({ ok: false }));
      if (!res.ok || !data.ok) {
        setMessage({ type: "err", text: data.error || "Neizdevās saglabāt." });
      } else {
        setMessage({ type: "ok", text: "Saglabāts." });
        setSaveRetrievalDefault(false);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleReanalyze() {
    setReanalyzing(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/documents/${document.id}/analyze`, { method: "POST" });
      const data = await res.json().catch(() => ({ ok: false }));
      if (!res.ok || !data.ok) {
        setMessage({ type: "err", text: data.error || "Neizdevās atkārtoti analizēt." });
      } else {
        setMessage({ type: "ok", text: "Atkārtota analīze pabeigta." });
        router.refresh();
      }
    } finally {
      setReanalyzing(false);
    }
  }

  async function handleUtilitySplit() {
    setSplitting(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/documents/${document.id}/utility-split`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({ ok: false }));
      if (!res.ok || !data.ok) {
        setMessage({
          type: "err",
          text:
            data.error ||
            "Neizdevās sadalīt pa adresi. Pārbaudi identifikatorus profilā (/profile#identifikatori).",
        });
      } else {
        setMessage({ type: "ok", text: "Summa pārrēķināta pēc tavas adreses." });
        router.refresh();
      }
    } finally {
      setSplitting(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Field label="Dokumenta datums" compact>
          <input
            type="date"
            className="input-compact"
            value={form.documentDate}
            onChange={(e) => update("documentDate", e.target.value)}
          />
        </Field>
        <Field label="Maksājuma datums" compact>
          <input
            type="date"
            className="input-compact"
            value={form.paymentDate}
            onChange={(e) => update("paymentDate", e.target.value)}
          />
        </Field>
        <Field label="Periods (sāk.)" compact>
          <input
            type="date"
            className="input-compact"
            value={form.servicePeriodStart}
            onChange={(e) => update("servicePeriodStart", e.target.value)}
          />
        </Field>
        <Field label="Periods (beig.)" compact>
          <input
            type="date"
            className="input-compact"
            value={form.servicePeriodEnd}
            onChange={(e) => update("servicePeriodEnd", e.target.value)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <Field label="Piegādātājs">
          <input
            className="input-compact"
            value={form.vendorName}
            onChange={(e) => update("vendorName", e.target.value)}
          />
        </Field>
        <Field label="Reģistrācijas nr.">
          <input
            className="input-compact"
            value={form.vendorRegistrationNumber}
            onChange={(e) => update("vendorRegistrationNumber", e.target.value)}
          />
        </Field>
        <Field label="Dokumenta nr.">
          <input
            className="input-compact"
            value={form.documentNumber}
            onChange={(e) => update("documentNumber", e.target.value)}
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <Field label="Summa bez PVN" compact className="shrink-0">
          <input
            inputMode="decimal"
            className="input-compact w-[7.5rem]"
            value={form.netAmount}
            onChange={(e) => update("netAmount", e.target.value)}
          />
        </Field>
        <Field label="PVN" compact className="shrink-0">
          <input
            inputMode="decimal"
            className="input-compact w-[6rem]"
            value={form.vatAmount}
            onChange={(e) => update("vatAmount", e.target.value)}
          />
        </Field>
        <Field label="Kopējā summa" compact className="shrink-0">
          <input
            inputMode="decimal"
            className="input-compact w-[7.5rem]"
            value={form.totalAmount}
            onChange={(e) => update("totalAmount", e.target.value)}
          />
        </Field>
        <button
          type="button"
          onClick={autoVat}
          className="mb-0.5 rounded-md border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700 hover:bg-orange-100"
          title="Aprēķina PVN un Kopējo summu no Summa bez PVN (vai Kopējās summas) pēc 21% likmes"
        >
          PVN 21%
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Kategorija">
          <select
            className="input-compact"
            value={form.category}
            onChange={(e) => changeMainCategory(e.target.value)}
          >
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {customLabels[c] ?? ExpenseCategoryLabels[c]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Apakškategorija">
          <select
            className="input-compact"
            value={form.userCategoryId}
            onChange={(e) => changeSubcategory(e.target.value)}
            disabled={subsForCategory.length === 0}
          >
            <option value="">
              {subsForCategory.length === 0 ? "Nav definētu apakškategoriju" : "—"}
            </option>
            {subsForCategory.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.deductiblePercent !== null ? ` (${s.deductiblePercent}%)` : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Atskaitāms">
          <select
            className="input-compact"
            value={form.deductibleStatus}
            onChange={(e) => update("deductibleStatus", e.target.value)}
          >
            {DEDUCTIBLE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {DeductibleStatusLabels[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Atskaitāmais %" compact className="shrink-0">
          <input
            inputMode="decimal"
            className="input-compact w-[5.5rem]"
            value={form.deductiblePercent}
            onChange={(e) => update("deductiblePercent", e.target.value)}
          />
        </Field>
        <Field label="Atskaitāmā summa" compact className="shrink-0">
          <input
            inputMode="decimal"
            className="input-compact w-[7.5rem]"
            value={form.deductibleAmount}
            onChange={(e) => update("deductibleAmount", e.target.value)}
          />
        </Field>
      </div>

      <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
        <p className="text-xs font-medium text-slate-900">
          Kur vēlāk atrast šī dokumenta oriģinālu?
        </p>
        <RetrievalLocationPicker
          idPrefix={`doc-${document.id}`}
          selected={form.retrievalLocation}
          customNote={form.retrievalCustomNote}
          onLocationChange={(loc) =>
            setForm((prev) => ({
              ...prev,
              retrievalLocation: loc,
              retrievalCustomNote: loc === "other" ? prev.retrievalCustomNote : "",
            }))
          }
          onCustomNoteChange={(note) => update("retrievalCustomNote", note)}
        />
        {form.category !== "unknown" ? (
          <label className="flex cursor-pointer items-start gap-2 text-xs text-slate-700">
            <input
              type="checkbox"
              className="mt-1"
              checked={saveRetrievalDefault}
              onChange={(e) => setSaveRetrievalDefault(e.target.checked)}
            />
            <span>
              Saglabāt kā noklusējumu kategorijai &quot;
              {customLabels[form.category as ExpenseCategory] ??
                ExpenseCategoryLabels[form.category as ExpenseCategory]}
              &quot; (profilā var mainīt jebkurā laikā)
            </span>
          </label>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <Field label="Paskaidrojums">
          <input
            type="text"
            className="input-compact"
            value={form.explanation}
            onChange={(e) => update("explanation", e.target.value)}
          />
        </Field>
        <Field label="Mana piezīme — kur glabā oriģinālu">
          <input
            type="text"
            className="input-compact"
            placeholder="piem., Swedbank → Rēķini → 2026. gada aprīlis"
            value={form.userSourceNote}
            onChange={(e) => update("userSourceNote", e.target.value)}
            maxLength={500}
          />
        </Field>
      </div>

      {message ? (
        <div
          className={
            message.type === "ok"
              ? "rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
              : "rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700"
          }
        >
          {message.text}
        </div>
      ) : null}

      <div className="sticky bottom-0 z-10 -mx-5 flex flex-wrap items-center gap-2 border-t border-slate-200 bg-white/95 px-5 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/80 md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none">
        <button type="submit" className="btn-primary w-full sm:w-auto" disabled={saving}>
          {saving ? "Saglabā…" : "Saglabāt"}
        </button>
        {document.canUtilityAddressSplit ? (
          <button
            type="button"
            className="btn-secondary"
            disabled={splitting || reanalyzing}
            onClick={handleUtilitySplit}
            title="Meklē tavu adresi PDF tekstā un iestata summu tikai par šo pieslēgumu (ne visu rēķinu)"
          >
            {splitting ? "Sadala…" : "Sadalīt pa adresi"}
          </button>
        ) : null}
        <button
          type="button"
          className="btn-secondary"
          disabled={reanalyzing || splitting || !document.canReanalyzeWithAi}
          onClick={handleReanalyze}
          title={
            document.canReanalyzeWithAi
              ? undefined
              : "Oriģinālais fails ir dzēsts — augšupielādē dokumentu atkārtoti, lai AI varētu to lasīt."
          }
        >
          {reanalyzing ? "Analizē…" : "Atkārtoti analizēt ar AI"}
        </button>
        {hasLineItems ? (
          <button
            type="button"
            className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-100"
            disabled={clearing}
            onClick={clearLineItems}
            title="Noņem AI ģenerēto pozīciju sadalījumu — top-level Summa/PVN/Kopējā summa kļūs par avotu Atskaitāmajai summai"
          >
            {clearing ? "Notīra…" : "Notīrīt pozīcijas"}
          </button>
        ) : null}
      </div>
    </form>
  );
}

function Field({
  label,
  children,
  compact,
  className,
}: {
  label: string;
  children: React.ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <label className={className}>
      <span className={compact ? "label-compact" : "label"}>{label}</span>
      {children}
    </label>
  );
}
