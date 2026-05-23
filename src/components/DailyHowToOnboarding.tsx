"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DailyHabitSteps } from "@/components/DailyHabitSteps";
import { ONBOARDING_DISMISSED_KEY } from "@/lib/dailyHabit";

export function DailyHowToOnboarding() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(ONBOARDING_DISMISSED_KEY) === "1") return;
    } catch {
      return;
    }
    setVisible(true);
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(ONBOARDING_DISMISSED_KEY, "1");
    } catch {
      // ignore
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <section
      className="relative overflow-hidden rounded-xl border border-brand-200/80 bg-gradient-to-br from-brand-50 via-white to-amber-50/50 p-4 shadow-sm sm:p-5"
      aria-labelledby="onboarding-title"
    >
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-3 top-3 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-white/80 hover:text-slate-700"
        aria-label="Aizvērt"
      >
        ✕
      </button>

      <p className="text-sm font-medium text-brand-700">👋 Ērti!</p>
      <h2 id="onboarding-title" className="mt-1 pr-8 text-base font-semibold text-slate-900 sm:text-lg">
        ReceiptBox ikdienā — 4 soļi un viss
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Jauns ieradums, bet ļoti vienkāršs. Vienreiz parādi — un vairs nejautāsi.
      </p>

      <div className="mt-4">
        <DailyHabitSteps variant="compact" />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={dismiss} className="btn-primary">
          Sapratu, sāksim! 🚀
        </button>
        <Link href="/documents" className="btn-secondary" onClick={dismiss}>
          📄 Uz dokumentiem
        </Link>
      </div>
    </section>
  );
}
