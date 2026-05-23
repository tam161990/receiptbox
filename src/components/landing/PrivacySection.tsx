"use client";

import { Eye, FileSpreadsheet, Lock, Shield, Trash2, type LucideIcon } from "lucide-react";
import { FadeUp } from "./landingMotion";
import { SectionShell } from "./SectionShell";

const PRIVACY_ITEMS: { Icon: LucideIcon; text: string }[] = [
  { Icon: Trash2, text: "Oriģinālie dokumenti tiek dzēsti pēc apstrādes" },
  { Icon: Lock, text: "Saglabājam tikai minimāli nepieciešamo informāciju" },
  { Icon: FileSpreadsheet, text: "Tu vari eksportēt visu CSV vai Excel" },
  { Icon: Eye, text: "Tu kontrolē savus datus" },
  { Icon: Shield, text: "ReceiptBox nav dokumentu arhīvs" },
];

export function PrivacySection() {
  return (
    <SectionShell id="privacy" tone="emerald" wave>
      <div className="mx-auto max-w-6xl px-4">
        <FadeUp className="mx-auto max-w-2xl text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <Shield className="h-5 w-5" aria-hidden />
          </div>
          <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
            Privātums pēc noklusējuma
          </h2>
          <p className="mt-2 text-slate-600">Tavi dokumenti nepieder mums.</p>
        </FadeUp>

        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PRIVACY_ITEMS.map((item, index) => (
            <FadeUp key={item.text} delay={index * 80}>
              <div className="card flex h-full gap-3 transition hover:-translate-y-0.5 hover:shadow-md">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                  <item.Icon className="h-4 w-4" aria-hidden />
                </span>
                <p className="text-sm leading-relaxed text-slate-700">{item.text}</p>
              </div>
            </FadeUp>
          ))}
        </div>

        <FadeUp delay={200}>
          <blockquote className="mx-auto mt-10 max-w-xl rounded-2xl border-2 border-emerald-200 bg-white px-6 py-5 text-center text-lg font-medium text-emerald-900 shadow-sm">
            &ldquo;Tavi dati pieder tev.&rdquo; 🛡
          </blockquote>
        </FadeUp>
      </div>
    </SectionShell>
  );
}
