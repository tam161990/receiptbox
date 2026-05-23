"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DeductibleDefault } from "@/lib/enums";
import {
  DOCUMENT_RETRIEVAL_LOCATIONS,
  DocumentRetrievalLabels,
  isDocumentRetrievalLocation,
} from "@/lib/enums";
import { IdentifierGuidePanel } from "@/components/IdentifierGuidePanel";

interface CategoryRow {
  key: string;
  defaultLabel: string;
  customLabel: string;
  suggested: DeductibleDefault;
  userValue: number | null;
  retrievalDefault?: string;
}

/** Profile defaults exclude “Cits” — that stays per-document only. */
const PROFILE_RETRIEVAL_LOCATIONS = DOCUMENT_RETRIEVAL_LOCATIONS.filter((c) => c !== "other");

interface InitialState {
  selfEmployedType: string;
  workFromHomePercent: string;
  mainActivityDescription: string;
  myIdentifiers: string[];
}

export function ProfileForm({
  initial,
  categories,
}: {
  initial: InitialState;
  categories: CategoryRow[];
}) {
  const router = useRouter();
  const [selfEmployedType, setSelfEmployedType] = useState(initial.selfEmployedType);
  const [workFromHomePercent, setWorkFromHomePercent] = useState(initial.workFromHomePercent);
  const [mainActivityDescription, setMainActivityDescription] = useState(
    initial.mainActivityDescription,
  );
  const [overrides, setOverrides] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const c of categories) {
      out[c.key] = c.userValue !== null && c.userValue !== undefined ? String(c.userValue) : "";
    }
    return out;
  });
  const [labels, setLabels] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const c of categories) {
      out[c.key] = c.customLabel ?? "";
    }
    return out;
  });
  const [retrievalPick, setRetrievalPick] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const c of categories) {
      const rv = c.retrievalDefault ?? "";
      out[c.key] = rv && isDocumentRetrievalLocation(rv) ? rv : "";
    }
    return out;
  });
  // Free-text list of identifiers (phone numbers, IBANs, meter numbers, etc.).
  const [identifiers, setIdentifiers] = useState<string[]>(() =>
    initial.myIdentifiers.length > 0 ? [...initial.myIdentifiers] : [""],
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function parsePct(v: string): number | null {
    if (v.trim() === "") return null;
    const n = Number(v.replace(",", "."));
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const categoryDefaults: Record<string, number> = {};
    for (const [k, v] of Object.entries(overrides)) {
      const p = parsePct(v);
      if (p !== null) categoryDefaults[k] = p;
    }

    const categoryLabels: Record<string, string> = {};
    for (const [k, v] of Object.entries(labels)) {
      const t = v.trim();
      if (t.length > 0) categoryLabels[k] = t;
    }

    const categoryRetrievalDefaults: Record<string, string> = {};
    for (const c of categories) {
      const v = retrievalPick[c.key]?.trim() ?? "";
      if (!v || !isDocumentRetrievalLocation(v) || v === "other") continue;
      categoryRetrievalDefaults[c.key] = v;
    }

    const myIdentifiers = identifiers
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selfEmployedType: selfEmployedType.trim() || null,
          workFromHomePercent: parsePct(workFromHomePercent),
          mainActivityDescription: mainActivityDescription.trim() || null,
          categoryDefaults,
          categoryRetrievalDefaults,
          categoryLabels,
          myIdentifiers,
        }),
      });
      const data = await res.json().catch(() => ({ ok: false }));
      if (!res.ok || !data.ok) {
        setMessage({ ok: false, text: data.error || "Neizdevās saglabāt." });
      } else {
        setMessage({ ok: true, text: "Profils saglabāts." });
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="block">
          <span className="label">Pašnodarbinātā tips</span>
          <input
            className="input"
            placeholder="piem., IT konsultants, Pasniedzējs, Pārvadātājs"
            value={selfEmployedType}
            onChange={(e) => setSelfEmployedType(e.target.value)}
            maxLength={120}
          />
        </label>
        <label className="block">
          <span className="label">Darbs no mājām (%)</span>
          <input
            className="input"
            inputMode="numeric"
            placeholder="piem., 70"
            value={workFromHomePercent}
            onChange={(e) => setWorkFromHomePercent(e.target.value)}
          />
          <span className="mt-1 block text-xs text-slate-500">
            Cik procenti no darba laika tu strādā no mājām. Tiek izmantots, lai
            AI ieteiktu pareizu īres / elektrības / interneta proporciju.
          </span>
        </label>
      </div>

      <label className="block">
        <span className="label">Galvenā darbība un konteksts</span>
        <textarea
          className="input min-h-[100px]"
          placeholder="piem., Strādāju kā freelance programmētājs no mājokļa Rīgā. Periodiski braucu uz klientu birojiem."
          value={mainActivityDescription}
          onChange={(e) => setMainActivityDescription(e.target.value)}
          maxLength={1000}
        />
        <span className="mt-1 block text-xs text-slate-500">
          Šis konteksts tiek nosūtīts AI katras analīzes laikā, lai tas labāk
          saprastu, kuri izdevumi tev ir atskaitāmi.
        </span>
      </label>

      <section id="identifikatori">
        <h2 className="text-base font-semibold text-slate-900">
          Mani identifikatori
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Ievadi to, kas rēķinā unikāli identificē tieši tavu līniju, adresi vai
          pieslēgumu. Dažādiem piegādātājiem — atšķirīgi lauki (skat. tabulu).
        </p>
        <IdentifierGuidePanel />
        <div className="mt-3 space-y-2">
          {identifiers.map((value, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                className="input py-1.5"
                placeholder={
                  idx === 0
                    ? "piem. LMT: 29151160 · Latvenergo: Ieriķu iela 58-52 · Enefit: 5105143425"
                    : "Cits identifikators (IBAN, līguma nr. …)"
                }
                value={value}
                maxLength={80}
                onChange={(e) =>
                  setIdentifiers((prev) =>
                    prev.map((v, i) => (i === idx ? e.target.value : v)),
                  )
                }
              />
              <button
                type="button"
                onClick={() =>
                  setIdentifiers((prev) =>
                    prev.length === 1 ? [""] : prev.filter((_, i) => i !== idx),
                  )
                }
                className="text-xs text-slate-400 hover:text-rose-600"
                title="Noņemt"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setIdentifiers((prev) => [...prev, ""])}
            className="text-sm font-medium text-brand-700 hover:underline"
          >
            + Pievienot vēl
          </button>
        </div>
      </section>

      <section>
        <h2 className="text-base font-semibold text-slate-900">
          Personīgie atskaitīšanas procenti un nosaukumi
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Tava vērtība % ailē aizvieto ieteikto AI analīzē un jaunajos
          dokumentos. Tava versija ailē “Tavs nosaukums” redzama visā lietotnē
          (atskaitēs, dokumentos), bet iekšējais kategorijas kods netiek mainīts.
          Atstāj tukšu, lai izmantotu noklusējumu.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Kategorija</th>
                <th className="px-3 py-2 w-56">Tavs nosaukums</th>
                <th className="px-3 py-2">Ieteiktais</th>
                <th className="px-3 py-2 w-28">Tavs %</th>
                <th className="px-3 py-2">Piezīme</th>
                <th className="px-3 py-2 min-w-[11rem]">Kur meklēt oriģinālu*</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {categories.map((c) => (
                <tr key={c.key}>
                  <td className="px-3 py-2 font-medium text-slate-900">{c.defaultLabel}</td>
                  <td className="px-3 py-2">
                    <input
                      className="input py-1.5"
                      placeholder={c.defaultLabel}
                      value={labels[c.key] ?? ""}
                      maxLength={80}
                      onChange={(e) =>
                        setLabels((prev) => ({ ...prev, [c.key]: e.target.value }))
                      }
                    />
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {c.suggested.percent !== null
                      ? `${c.suggested.percent}% (${c.suggested.status})`
                      : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="input py-1.5"
                      inputMode="numeric"
                      placeholder={
                        c.suggested.percent !== null ? String(c.suggested.percent) : "0"
                      }
                      value={overrides[c.key] ?? ""}
                      onChange={(e) =>
                        setOverrides((prev) => ({ ...prev, [c.key]: e.target.value }))
                      }
                    />
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">{c.suggested.note}</td>
                  <td className="px-3 py-2">
                    <select
                      className="input py-1.5 text-sm"
                      value={retrievalPick[c.key] ?? ""}
                      onChange={(e) =>
                        setRetrievalPick((prev) => ({ ...prev, [c.key]: e.target.value }))
                      }
                    >
                      <option value="">Nav noklusējuma</option>
                      {PROFILE_RETRIEVAL_LOCATIONS.map((code) => (
                        <option key={code} value={code}>
                          {DocumentRetrievalLabels[code]}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          * Ja augšupielādējot dokumentu šai kategorijai neizvēlies citu vietu, ReceiptBox ieteiks šo
          opciju. Pilnu sarakstu ar “Cits” var izvēlēties katram dokumentam atsevišķi.
        </p>
      </section>

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

      <div>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Saglabā…" : "Saglabāt profilu"}
        </button>
      </div>
    </form>
  );
}
