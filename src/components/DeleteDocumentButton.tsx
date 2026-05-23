"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteDocumentButton({
  documentId,
  label,
  compact = false,
}: {
  documentId: string;
  label: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;

    const ok = window.confirm(
      `Dzēst dokumentu «${label}»?\n\nTiks noņemts tikai ieraksts ReceiptBox — oriģinālu tu glabā pie sevis.`,
    );
    if (!ok) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/documents/${documentId}`, { method: "DELETE" });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        window.alert(data.error ?? "Neizdevās dzēst dokumentu.");
        return;
      }
      router.refresh();
    } catch {
      window.alert("Neizdevās dzēst dokumentu.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={busy}
      className={
        compact
          ? "inline-flex min-h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
          : "inline-flex min-h-10 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50"
      }
      aria-label="Dzēst dokumentu"
      title="Dzēst"
    >
      {busy ? "…" : compact ? "✕" : "Dzēst"}
    </button>
  );
}
