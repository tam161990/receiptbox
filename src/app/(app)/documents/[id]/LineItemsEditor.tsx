"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { inferVat, type LineItem } from "@/lib/lineItems";

interface Props {
  documentId: string;
  initial: LineItem[];
  currency: string;
  // Used to recompute attributed totals client-side without a server
  // round-trip. Server is the source of truth — we just give optimistic
  // feedback.
  deductiblePercent: number | null;
}

type AmountField = "net" | "vat" | "total";

type Edits = Record<string, Partial<Record<AmountField, string>>>;

function formatMoney(v: number | null, currency: string): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return new Intl.NumberFormat("lv-LV", {
    style: "currency",
    currency: currency || "EUR",
  }).format(v);
}

function parseNum(s: string | undefined | null): number | null {
  if (s === undefined || s === null) return null;
  const t = String(s).trim().replace(/\s/g, "").replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function fieldKey(field: AmountField): "netAmount" | "vatAmount" | "totalAmount" {
  return field === "net"
    ? "netAmount"
    : field === "vat"
      ? "vatAmount"
      : "totalAmount";
}

function normalizeToken(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function shouldShowIdentifier(description: string, identifier: string | null): boolean {
  if (!identifier) return false;
  const desc = normalizeToken(description);
  const id = normalizeToken(identifier);
  if (!id) return false;
  return !desc.includes(id) && id !== desc;
}

function IdentifierBadge({
  identifier,
  belongsToUser,
}: {
  identifier: string;
  belongsToUser: boolean;
}) {
  return (
    <span
      className={
        belongsToUser
          ? "inline-block max-w-full rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-800"
          : "inline-block max-w-full rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600"
      }
      title={belongsToUser ? "Atrasts tavu identifikatoru sarakstā" : "Nav tavā sarakstā"}
    >
      {identifier}
    </span>
  );
}

export function LineItemsEditor({ documentId, initial, currency, deductiblePercent }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<LineItem[]>(initial);
  const [edits, setEdits] = useState<Edits>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  // Returns the displayed value for an input — the in-progress text if the
  // user is actively editing, otherwise the canonical number from `items`.
  function inputValue(it: LineItem, field: AmountField): string {
    const e = edits[it.id]?.[field];
    if (e !== undefined) return e;
    const v = it[fieldKey(field)];
    return v !== null && v !== undefined ? String(v) : "";
  }

  function setInputValue(id: string, field: AmountField, value: string) {
    setEdits((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  }

  // Effective items merge `items` with any in-progress edits (parsed). Used
  // for live total calculations in the footer.
  const effective: LineItem[] = useMemo(() => {
    return items.map((it) => {
      const e = edits[it.id];
      if (!e) return it;
      return {
        ...it,
        netAmount: e.net !== undefined ? parseNum(e.net) : it.netAmount,
        vatAmount: e.vat !== undefined ? parseNum(e.vat) : it.vatAmount,
        totalAmount: e.total !== undefined ? parseNum(e.total) : it.totalAmount,
      };
    });
  }, [items, edits]);

  const dirty = useMemo(() => {
    if (items.length !== initial.length) return true;
    if (Object.keys(edits).length > 0) {
      for (const id of Object.keys(edits)) {
        const orig = initial.find((x) => x.id === id);
        if (!orig) return true;
        const e = edits[id];
        if (e.net !== undefined && parseNum(e.net) !== orig.netAmount) return true;
        if (e.vat !== undefined && parseNum(e.vat) !== orig.vatAmount) return true;
        if (e.total !== undefined && parseNum(e.total) !== orig.totalAmount) return true;
      }
    }
    for (let i = 0; i < items.length; i++) {
      if (items[i].id !== initial[i].id) return true;
      if (items[i].included !== initial[i].included) return true;
    }
    return false;
  }, [items, initial, edits]);

  const totals = useMemo(() => {
    let sum = 0;
    let count = 0;
    for (const it of effective) {
      if (it.included && it.totalAmount !== null) {
        sum += it.totalAmount;
        count += 1;
      }
    }
    const round = (n: number) => Math.round(n * 100) / 100;
    const total = round(sum);
    const allTotal = round(
      effective.reduce(
        (acc, it) => (it.totalAmount !== null ? acc + it.totalAmount : acc),
        0,
      ),
    );
    const deductible =
      deductiblePercent !== null ? round((total * deductiblePercent) / 100) : null;
    return { total, allTotal, count, deductible };
  }, [effective, deductiblePercent]);

  function toggle(id: string) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, included: !it.included } : it)),
    );
  }

  function selectMine() {
    setItems((prev) => prev.map((it) => ({ ...it, included: it.belongsToUser })));
  }

  function selectAll() {
    setItems((prev) => prev.map((it) => ({ ...it, included: true })));
  }

  function selectNone() {
    setItems((prev) => prev.map((it) => ({ ...it, included: false })));
  }

  // Recompute VAT/total for one line, treating its current `net` (or, if
  // net is empty, its current `total`) as the truth. Powers the per-row
  // "21%" button — handy when the AI returned 0 for PVN but the user
  // entered a correct net.
  function recomputeRow(id: string) {
    const it = effective.find((x) => x.id === id);
    if (!it) return;
    let inferred: ReturnType<typeof inferVat> | null = null;
    if (it.netAmount !== null && it.netAmount > 0) {
      inferred = inferVat({ netAmount: it.netAmount, vatAmount: null, totalAmount: null });
    } else if (it.totalAmount !== null && it.totalAmount > 0) {
      inferred = inferVat({ netAmount: null, vatAmount: null, totalAmount: it.totalAmount });
    }
    if (!inferred) return;
    setEdits((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        net: inferred!.netAmount !== null ? String(inferred!.netAmount) : "",
        vat: inferred!.vatAmount !== null ? String(inferred!.vatAmount) : "",
        total: inferred!.totalAmount !== null ? String(inferred!.totalAmount) : "",
      },
    }));
  }

  // Run "Aprēķināt PVN 21%" on every line that currently has either net or
  // total, ignoring lines where neither is set.
  function recomputeAll() {
    let next: Edits = { ...edits };
    for (const it of effective) {
      let inferred: ReturnType<typeof inferVat> | null = null;
      if (it.netAmount !== null && it.netAmount > 0) {
        inferred = inferVat({ netAmount: it.netAmount, vatAmount: null, totalAmount: null });
      } else if (it.totalAmount !== null && it.totalAmount > 0) {
        inferred = inferVat({ netAmount: null, vatAmount: null, totalAmount: it.totalAmount });
      }
      if (!inferred) continue;
      next = {
        ...next,
        [it.id]: {
          ...next[it.id],
          net: inferred.netAmount !== null ? String(inferred.netAmount) : "",
          vat: inferred.vatAmount !== null ? String(inferred.vatAmount) : "",
          total: inferred.totalAmount !== null ? String(inferred.totalAmount) : "",
        },
      };
    }
    setEdits(next);
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    const wasDirty = dirty;
    try {
      const payload = effective.map((it) => ({
        id: it.id,
        included: it.included,
        netAmount: it.netAmount,
        vatAmount: it.vatAmount,
        totalAmount: it.totalAmount,
      }));
      const res = await fetch(`/api/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineItems: payload, userConfirmedReview: true }),
      });
      const data = await res.json().catch(() => ({ ok: false }));
      if (!res.ok || !data.ok) {
        setMessage({ ok: false, text: data.error || "Neizdevās saglabāt." });
      } else {
        setMessage({
          ok: true,
          text: wasDirty ? "Pozīcijas saglabātas." : "Atlase apstiprināta.",
        });
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  if (items.length === 0) return null;

  function renderAmountField(it: LineItem, field: AmountField, compact = false) {
    const source = items.find((x) => x.id === it.id)!;
    const inputClass = compact
      ? "w-full rounded border border-slate-200 bg-white px-1.5 py-1 text-right text-sm focus:border-slate-400 focus:outline-none"
      : field === "vat"
        ? "w-20 rounded border border-slate-200 bg-white px-1.5 py-1 text-right text-sm focus:border-slate-400 focus:outline-none"
        : "w-24 rounded border border-slate-200 bg-white px-1.5 py-1 text-right text-sm focus:border-slate-400 focus:outline-none";

    if (field === "vat") {
      return (
        <div className={compact ? "flex w-full items-center gap-1" : "inline-flex items-center gap-1"}>
          <input
            type="text"
            inputMode="decimal"
            value={inputValue(source, "vat")}
            onChange={(e) => setInputValue(it.id, "vat", e.target.value)}
            disabled={saving}
            className={inputClass}
            placeholder="0.00"
          />
          {it.vatAssumed ? (
            <span
              className="shrink-0 text-[10px] text-orange-600"
              title="PVN aprēķināts pēc 21% — pārbaudi"
            >
              *
            </span>
          ) : null}
        </div>
      );
    }

    return (
      <input
        type="text"
        inputMode="decimal"
        value={inputValue(source, field)}
        onChange={(e) => setInputValue(it.id, field, e.target.value)}
        disabled={saving}
        className={`${inputClass}${field === "total" && !compact ? " font-medium" : ""}`}
        placeholder="0.00"
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button
          type="button"
          onClick={selectMine}
          className="rounded-md border border-slate-200 bg-white px-2 py-1 font-medium text-slate-700 hover:bg-slate-50"
          disabled={saving}
        >
          Tikai manas
        </button>
        <button
          type="button"
          onClick={selectAll}
          className="rounded-md border border-slate-200 bg-white px-2 py-1 font-medium text-slate-700 hover:bg-slate-50"
          disabled={saving}
        >
          Visas
        </button>
        <button
          type="button"
          onClick={selectNone}
          className="rounded-md border border-slate-200 bg-white px-2 py-1 font-medium text-slate-700 hover:bg-slate-50"
          disabled={saving}
        >
          Nevienu
        </button>
        <button
          type="button"
          onClick={recomputeAll}
          className="rounded-md border border-orange-200 bg-orange-50 px-2 py-1 font-medium text-orange-700 hover:bg-orange-100"
          disabled={saving}
          title="Pārrēķina PVN un Kopā no Bez PVN visām pozīcijām, kur tas ir aizpildīts"
        >
          PVN 21% visām
        </button>
        <span className="w-full text-slate-500 sm:ml-auto sm:w-auto">
          {totals.count} no {items.length} iekļauti
        </span>
      </div>

      <ul className="space-y-2 md:hidden">
        {effective.map((it) => (
          <li
            key={it.id}
            className={`rounded-lg border p-3 ${
              it.included
                ? "border-emerald-200 bg-emerald-50/40"
                : "border-slate-200 bg-white text-slate-500"
            }`}
          >
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={it.included}
                onChange={() => toggle(it.id)}
                disabled={saving}
                className="mt-0.5 h-4 w-4 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug text-slate-900">{it.description || "—"}</p>
                {shouldShowIdentifier(it.description, it.identifier) ? (
                  <div className="mt-1">
                    <IdentifierBadge
                      identifier={it.identifier!}
                      belongsToUser={it.belongsToUser}
                    />
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-2 grid grid-cols-3 gap-2">
              <label className="block">
                <span className="label-compact">Bez PVN</span>
                {renderAmountField(it, "net", true)}
              </label>
              <label className="block">
                <span className="label-compact">PVN</span>
                {renderAmountField(it, "vat", true)}
              </label>
              <label className="block">
                <span className="label-compact">Kopā</span>
                {renderAmountField(it, "total", true)}
              </label>
            </div>

            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => recomputeRow(it.id)}
                disabled={saving}
                className="rounded border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-medium text-orange-700 hover:bg-orange-100"
                title="Pārrēķināt PVN no šīs rindas Bez PVN (21%)"
              >
                Aprēķināt PVN 21%
              </button>
            </div>
          </li>
        ))}
        <li className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-600">Mana daļa (iekļautās pozīcijas)</span>
            <span className="font-semibold text-slate-900">
              {formatMoney(totals.total, currency)}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-3 text-xs text-slate-500">
            <span>Dokumenta kopsumma</span>
            <span>{formatMoney(totals.allTotal, currency)}</span>
          </div>
          {totals.deductible !== null ? (
            <div className="mt-1 flex items-center justify-between gap-3 text-xs">
              <span className="text-slate-500">Atskaitāmā summa ({deductiblePercent}%)</span>
              <span className="font-medium text-emerald-700">
                {formatMoney(totals.deductible, currency)}
              </span>
            </div>
          ) : null}
        </li>
      </ul>

      <div className="hidden overflow-x-auto rounded-lg border border-slate-200 md:block">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-10 px-2 py-2"></th>
              <th className="px-3 py-2">Apraksts</th>
              <th className="px-3 py-2">Identifikators</th>
              <th className="px-3 py-2 text-right">Bez PVN</th>
              <th className="px-3 py-2 text-right">PVN</th>
              <th className="px-3 py-2 text-right">Kopā</th>
              <th className="w-10 px-2 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {effective.map((it) => (
                <tr
                  key={it.id}
                  className={
                    it.included ? "bg-emerald-50/40" : "bg-white text-slate-500"
                  }
                >
                  <td className="px-2 py-2">
                    <input
                      type="checkbox"
                      checked={it.included}
                      onChange={() => toggle(it.id)}
                      disabled={saving}
                      className="h-4 w-4"
                    />
                  </td>
                  <td className="px-3 py-2 text-slate-900">{it.description || "—"}</td>
                  <td className="px-3 py-2">
                    {it.identifier ? (
                      <IdentifierBadge
                        identifier={it.identifier}
                        belongsToUser={it.belongsToUser}
                      />
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right">
                    {renderAmountField(it, "net")}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right">
                    {renderAmountField(it, "vat")}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right">
                    {renderAmountField(it, "total")}
                  </td>
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      onClick={() => recomputeRow(it.id)}
                      disabled={saving}
                      className="rounded border border-orange-200 bg-orange-50 px-1.5 py-0.5 text-[10px] font-medium text-orange-700 hover:bg-orange-100"
                      title="Pārrēķināt PVN no šīs rindas Bez PVN (21%)"
                    >
                      21%
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
          <tfoot className="bg-slate-50 text-sm">
            <tr>
              <td colSpan={5} className="px-3 py-2 text-right text-slate-600">
                Mana daļa (iekļautās pozīcijas):
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right font-semibold text-slate-900">
                {formatMoney(totals.total, currency)}
              </td>
              <td></td>
            </tr>
            <tr>
              <td colSpan={5} className="px-3 py-2 text-right text-xs text-slate-500">
                Dokumenta kopsumma:
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right text-xs text-slate-500">
                {formatMoney(totals.allTotal, currency)}
              </td>
              <td></td>
            </tr>
            {totals.deductible !== null ? (
              <tr>
                <td colSpan={5} className="px-3 py-2 text-right text-xs text-slate-500">
                  Atskaitāmā summa ({deductiblePercent}%):
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right text-xs font-medium text-emerald-700">
                  {formatMoney(totals.deductible, currency)}
                </td>
                <td></td>
              </tr>
            ) : null}
          </tfoot>
        </table>
      </div>

      {message ? (
        <div
          className={
            message.ok
              ? "rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
              : "rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700"
          }
        >
          {message.text}
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn-primary"
          onClick={save}
          disabled={saving}
        >
          {saving
            ? "Saglabā…"
            : dirty
              ? "Saglabāt pozīcijas"
              : "Apstiprināt atlasi"}
        </button>
        {dirty ? (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setItems(initial);
              setEdits({});
            }}
            disabled={saving}
          >
            Atcelt izmaiņas
          </button>
        ) : null}
      </div>

      <p className="text-xs text-slate-500">
        Tu vari labot summas tieši tabulā. Pogas “21%” pārrēķina PVN un Kopā
        pēc 21% likmes no Bez PVN. Zvaigznīte (*) blakus PVN nozīmē, ka tas
        nav bijis redzams oriģinālā un aprēķināts pēc Latvijas standarta
        likmes.
      </p>
    </div>
  );
}
