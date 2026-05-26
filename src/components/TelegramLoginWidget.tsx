"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { TelegramLoginPayload } from "@/lib/telegramLogin";

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramLoginPayload) => void;
  }
}

export function TelegramLoginWidget({
  botUsername,
  pin,
  redirectTo = "/dashboard",
  onError,
}: {
  botUsername: string;
  pin?: string;
  redirectTo?: string;
  onError?: (message: string) => void;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = "";
    setLoading(false);

    window.onTelegramAuth = async (user) => {
      setLoading(true);
      onError?.("");
      try {
        const res = await fetch("/api/auth/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...user, pin: pin?.trim() || undefined }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !data.ok) {
          const msg = data.error || "Neizdevās pieslēgties ar Telegram.";
          onError?.(msg);
          setLoading(false);
          return;
        }
        router.push(redirectTo);
        router.refresh();
      } catch {
        onError?.("Tīkla kļūda. Mēģini vēlreiz.");
        setLoading(false);
      }
    };

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "8");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");
    container.appendChild(script);

    return () => {
      container.innerHTML = "";
      delete window.onTelegramAuth;
    };
  }, [botUsername, pin, redirectTo, router, onError]);

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="flex min-h-[44px] justify-center [&>iframe]:max-w-full"
        aria-busy={loading}
      />
      {loading ? (
        <p className="text-center text-sm text-slate-500">Pieslēdzas…</p>
      ) : null}
    </div>
  );
}
