"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "rblv_cookie_consent";

type ConsentChoice = "accepted" | "declined";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  function save(choice: ConsentChoice) {
    try {
      localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      // ignore
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-white/90"
      role="dialog"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-desc"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 text-sm text-slate-700">
          <p id="cookie-consent-title" className="font-medium text-slate-900">
            Sīkdatnes (cookies)
          </p>
          <p id="cookie-consent-desc" className="mt-1">
            ReceiptBox izmanto tikai nepieciešamās sīkdatnes, lai uzturētu tavu
            pieslēgumu. Mēs neizmantojam reklāmu izsekošanu.{" "}
            <Link href="/#privacy" className="text-brand-700 hover:underline">
              Vairāk par privātumu
            </Link>
            .
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button type="button" onClick={() => save("declined")} className="btn-secondary">
            Noraidīt
          </button>
          <button type="button" onClick={() => save("accepted")} className="btn-primary">
            Pieņemt
          </button>
        </div>
      </div>
    </div>
  );
}
