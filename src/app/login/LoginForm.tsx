"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TelegramLoginWidget } from "@/components/TelegramLoginWidget";

export function LoginForm({
  botUsername,
  pinRequired,
  redirectTo = "/dashboard",
}: {
  botUsername: string | null;
  pinRequired: boolean;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [telegramUserId, setTelegramUserId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showManual, setShowManual] = useState(!botUsername);

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegramUserId, pin }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Neizdevās pieslēgties.");
        setLoading(false);
        return;
      }
      router.push(redirectTo);
      router.refresh();
    } catch {
      setError("Tīkla kļūda. Mēģini vēlreiz.");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {pinRequired ? (
        <div>
          <label className="label" htmlFor="pin">
            Dev PIN
          </label>
          <input
            id="pin"
            type="password"
            className="input"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            required
          />
        </div>
      ) : null}

      {botUsername ? (
        <>
          <TelegramLoginWidget
            botUsername={botUsername}
            pin={pin}
            redirectTo={redirectTo}
            onError={(msg) => setError(msg || null)}
          />
          <p className="text-center text-xs text-slate-500">
            Pieslēdzies ar savu Telegram kontu — tāpat kā ar botu.
          </p>
        </>
      ) : (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Telegram Login nav konfigurēts (trūkst{" "}
          <code className="text-xs">TELEGRAM_BOT_USERNAME</code>). Izmanto ID zemāk.
        </p>
      )}

      {error ? (
        <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
      ) : null}

      {botUsername ? (
        <div className="border-t border-slate-100 pt-3">
          <button
            type="button"
            className="text-sm text-slate-600 hover:text-brand-700"
            onClick={() => setShowManual((v) => !v)}
          >
            {showManual ? "Slēpt manuālo ID" : "Pieslēgties ar Telegram ID (manuāli)"}
          </button>
        </div>
      ) : null}

      {showManual || !botUsername ? (
        <form onSubmit={handleManualSubmit} className="space-y-3">
          <div>
            <label className="label" htmlFor="tgid">
              Telegram lietotāja ID
            </label>
            <input
              id="tgid"
              inputMode="numeric"
              autoComplete="off"
              className="input"
              placeholder="piem., 123456789"
              value={telegramUserId}
              onChange={(e) => setTelegramUserId(e.target.value.replace(/\D/g, ""))}
              required={!botUsername}
            />
            <p className="mt-1 text-xs text-slate-500">
              ID nosūti botam ar komandu <code>/id</code>, ja vajag rezerves variantu.
            </p>
          </div>
          <button type="submit" className="btn-secondary w-full" disabled={loading}>
            {loading ? "Pieslēdzas…" : "Pieslēgties ar ID"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
