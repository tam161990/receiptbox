"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm({
  pinRequired,
  redirectTo = "/dashboard",
}: {
  pinRequired: boolean;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [telegramUserId, setTelegramUserId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
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
    <form onSubmit={handleSubmit} className="space-y-3">
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
          required
        />
      </div>
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
      {error ? (
        <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
      ) : null}
      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? "Pieslēdzas…" : "Pieslēgties"}
      </button>
    </form>
  );
}
