"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  PROFILE_TIP,
  PROFILE_TIP_DISMISSED_KEY,
  dismissEducation,
  isEducationDismissed,
} from "@/lib/userEducation";

export function ProfileTipCard() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isEducationDismissed(PROFILE_TIP_DISMISSED_KEY)) {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    dismissEducation(PROFILE_TIP_DISMISSED_KEY);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <section
      className="relative rounded-xl border border-sky-200/80 bg-gradient-to-br from-sky-50/80 via-white to-white p-4 shadow-sm sm:p-5"
      aria-labelledby="profile-tip-title"
    >
      <p className="text-sm font-medium text-sky-800">
        <span aria-hidden="true">💡 </span>
        {PROFILE_TIP.title}
      </p>
      <h2 id="profile-tip-title" className="mt-2 text-base font-semibold text-slate-900">
        {PROFILE_TIP.intro}
      </h2>
      <p className="mt-1 text-sm text-slate-600">{PROFILE_TIP.detail}</p>
      <ul className="mt-2 space-y-1 text-sm text-slate-700">
        {PROFILE_TIP.items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="text-sky-600">✓</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/profile" className="btn-primary" onClick={dismiss}>
          Pāriet uz profilu
        </Link>
        <button type="button" onClick={dismiss} className="btn-secondary">
          Vēlāk
        </button>
      </div>
    </section>
  );
}
