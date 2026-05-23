"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PrivacyTools() {
  const router = useRouter();
  const [busy, setBusy] = useState<"delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function deleteAll() {
    const typed = window.prompt(
      "Lai dzēstu VISUS datus, ieraksti tieši šādi:\n\nDZĒST_VISUS_MANUS_DATUS",
    );
    if (typed !== "DZĒST_VISUS_MANUS_DATUS") {
      setError("Darbība atcelta — apstiprinājuma teksts nesakrīt.");
      return;
    }
    setError(null);
    setBusy("delete");
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DZĒST_VISUS_MANUS_DATUS" }),
      });
      const data = await res.json().catch(() => ({ ok: false }));
      if (!res.ok || !data.ok) {
        setError(data.error || "Neizdevās dzēst datus.");
        return;
      }
      router.push("/login");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <a href="/api/account/export" className="btn-primary" download>
          Lejupielādēt manus datus (JSON)
        </a>
      </div>
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
        <p className="text-sm font-medium text-rose-900">
          Dzēst visus manus datus ReceiptBox
        </p>
        <p className="mt-1 text-sm text-rose-800">
          Tiks neatgriezeniski dzēsti visi dokumentu ieraksti, kategorijas un profila iestatījumi.
          Telegram konts paliek — vari pieslēgties atkārtoti un sākt no jauna.
        </p>
        <button
          type="button"
          className="mt-3 rounded-md border border-rose-300 bg-white px-3 py-1.5 text-sm font-medium text-rose-800 hover:bg-rose-100"
          disabled={busy !== null}
          onClick={deleteAll}
        >
          {busy === "delete" ? "Dzēš…" : "Dzēst visus manus datus"}
        </button>
      </div>
      {error ? (
        <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
      ) : null}
    </div>
  );
}
