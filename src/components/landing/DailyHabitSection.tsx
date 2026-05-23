"use client";

import { Sparkles } from "lucide-react";
import { DailyHabitSteps } from "@/components/DailyHabitSteps";
import { FadeUp } from "./landingMotion";
import { SectionShell } from "./SectionShell";

export function DailyHabitSection() {
  return (
    <SectionShell id="daily-habit" tone="slate" wave>
      <div className="mx-auto max-w-6xl px-4">
        <FadeUp className="text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-200/80 text-slate-700">
            <Sparkles className="h-5 w-5" aria-hidden />
          </div>
          <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
            Kā izmantot ReceiptBox ikdienā
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600 sm:text-base">
            Nav jāmaina dzīve — tikai viens ieradums: sūti dokumentu, kad tas ir rokās. Pārējo
            mēs.
          </p>
        </FadeUp>
        <FadeUp delay={100} className="mt-8">
          <DailyHabitSteps variant="landing" />
        </FadeUp>
      </div>
    </SectionShell>
  );
}
