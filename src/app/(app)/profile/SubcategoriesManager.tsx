"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SerializedUserCategory } from "@/lib/categories";
import { DEDUCTIBLE_STATUSES, DeductibleStatusLabels } from "@/lib/enums";

interface CategoryOption {
  code: string;
  label: string;
}

export function SubcategoriesManager({
  initial,
  categories,
}: {
  initial: SerializedUserCategory[];
  categories: CategoryOption[];
}) {
  const router = useRouter();
  const [items, setItems] = useState<SerializedUserCategory[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New row state.
  const [newParent, setNewParent] = useState<string>(categories[0]?.code ?? "");
  const [newName, setNewName] = useState("");
  const [newPercent, setNewPercent] = useState("");
  const [newStatus, setNewStatus] = useState<string>("");

  const grouped = useMemo(() => {
    const map = new Map<string, SerializedUserCategory[]>();
    for (const c of categories) map.set(c.code, []);
    for (const sc of items) {
      const arr = map.get(sc.parentCategory) ?? [];
      arr.push(sc);
      map.set(sc.parentCategory, arr);
    }
    return Array.from(map.entries()).map(([code, list]) => ({
      code,
      label: categories.find((c) => c.code === code)?.label ?? code,
      list,
    }));
  }, [items, categories]);

  function parsePct(v: string): number | null {
    if (v.trim() === "") return null;
    const n = Number(v.replace(",", "."));
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  async function addItem() {
    setError(null);
    if (!newName.trim()) {
      setError("Norādi apakškategorijas nosaukumu.");
      return;
    }
    if (!newParent) {
      setError("Izvēlies galveno kategoriju.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentCategory: newParent,
          name: newName.trim(),
          deductibleStatus: newStatus || null,
          deductiblePercent: parsePct(newPercent),
        }),
      });
      const data = await res.json().catch(() => ({ ok: false }));
      if (!res.ok || !data.ok || !data.category) {
        setError(data.error || "Neizdevās pievienot.");
        return;
      }
      setItems((prev) => [...prev, data.category]);
      setNewName("");
      setNewPercent("");
      setNewStatus("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function updateItem(id: string, patch: Partial<SerializedUserCategory>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => ({ ok: false }));
      if (!res.ok || !data.ok || !data.category) {
        setError(data.error || "Neizdevās saglabāt.");
        return;
      }
      setItems((prev) => prev.map((it) => (it.id === id ? data.category : it)));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(id: string) {
    if (!confirm("Dzēst apakškategoriju?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({ ok: false }));
      if (!res.ok || !data.ok) {
        setError(data.error || "Neizdevās dzēst.");
        return;
      }
      setItems((prev) => prev.filter((it) => it.id !== id));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {error ? (
        <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
      ) : null}

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_2fr_120px_1fr_auto]">
          <select
            className="input py-1.5"
            value={newParent}
            onChange={(e) => setNewParent(e.target.value)}
            disabled={busy}
          >
            {categories.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
          <input
            className="input py-1.5"
            placeholder="Apakškategorijas nosaukums"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            disabled={busy}
            maxLength={80}
          />
          <input
            className="input py-1.5"
            placeholder="% (nav obl.)"
            inputMode="numeric"
            value={newPercent}
            onChange={(e) => setNewPercent(e.target.value)}
            disabled={busy}
          />
          <select
            className="input py-1.5"
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value)}
            disabled={busy}
          >
            <option value="">Statuss (auto)</option>
            {DEDUCTIBLE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {DeductibleStatusLabels[s]}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-primary"
            onClick={addItem}
            disabled={busy || !newName.trim()}
          >
            Pievienot
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          % un statuss nav obligāti — ja atstāj tukšu, lieto galvenās kategorijas
          noklusējumu.
        </p>
      </div>

      <div className="space-y-3">
        {grouped.map((g) => (
          <div key={g.code} className="rounded-lg border border-slate-200">
            <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
              {g.label}
              {g.list.length > 0 ? (
                <span className="ml-2 text-xs text-slate-500">{g.list.length}</span>
              ) : null}
            </div>
            {g.list.length === 0 ? (
              <div className="px-3 py-3 text-xs text-slate-400">
                Nav nevienas apakškategorijas.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {g.list.map((sc) => (
                  <SubRow
                    key={sc.id}
                    sc={sc}
                    busy={busy}
                    onSave={(patch) => updateItem(sc.id, patch)}
                    onDelete={() => removeItem(sc.id)}
                  />
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SubRow({
  sc,
  busy,
  onSave,
  onDelete,
}: {
  sc: SerializedUserCategory;
  busy: boolean;
  onSave: (patch: Partial<SerializedUserCategory>) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(sc.name);
  const [percent, setPercent] = useState(
    sc.deductiblePercent !== null && sc.deductiblePercent !== undefined
      ? String(sc.deductiblePercent)
      : "",
  );
  const [status, setStatus] = useState<string>(sc.deductibleStatus ?? "");

  const dirty =
    name.trim() !== sc.name ||
    percent !== (sc.deductiblePercent !== null ? String(sc.deductiblePercent) : "") ||
    status !== (sc.deductibleStatus ?? "");

  function save() {
    onSave({
      name: name.trim() || sc.name,
      deductiblePercent: percent.trim() === "" ? null : Number(percent.replace(",", ".")),
      deductibleStatus: (status || null) as SerializedUserCategory["deductibleStatus"],
    });
  }

  return (
    <li className="grid grid-cols-1 items-center gap-2 px-3 py-2 text-sm md:grid-cols-[2fr_120px_1fr_auto]">
      <input
        className="input py-1.5"
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={busy}
        maxLength={80}
      />
      <input
        className="input py-1.5"
        placeholder="—"
        inputMode="numeric"
        value={percent}
        onChange={(e) => setPercent(e.target.value)}
        disabled={busy}
      />
      <select
        className="input py-1.5"
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        disabled={busy}
      >
        <option value="">Auto</option>
        {DEDUCTIBLE_STATUSES.map((s) => (
          <option key={s} value={s}>
            {DeductibleStatusLabels[s]}
          </option>
        ))}
      </select>
      <div className="flex items-center justify-end gap-2">
        {dirty ? (
          <button
            type="button"
            className="btn-secondary py-1.5 text-xs"
            onClick={save}
            disabled={busy}
          >
            Saglabāt
          </button>
        ) : null}
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          className="text-xs text-rose-600 hover:text-rose-800"
        >
          Dzēst
        </button>
      </div>
    </li>
  );
}
