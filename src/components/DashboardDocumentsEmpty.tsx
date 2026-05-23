"use client";

import { useEffect, useState } from "react";
import { DailyHabitSteps } from "@/components/DailyHabitSteps";
import { ONBOARDING_DISMISSED_KEY } from "@/lib/dailyHabit";

export function DashboardDocumentsEmpty() {
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      setOnboardingDone(localStorage.getItem(ONBOARDING_DISMISSED_KEY) === "1");
    } catch {
      setOnboardingDone(true);
    }
  }, []);

  if (onboardingDone === null) {
    return (
      <li className="py-3 text-sm text-slate-500">
        Sūti pirmo dokumentu Telegram botam — redzēsi to šeit ✨
      </li>
    );
  }

  if (!onboardingDone) {
    return (
      <li className="py-3 text-sm text-slate-500">
        Sūti pirmo dokumentu Telegram botam — soļi redzami augstāk 👆
      </li>
    );
  }

  return (
    <li className="py-2">
      <DailyHabitSteps variant="inline" />
    </li>
  );
}
