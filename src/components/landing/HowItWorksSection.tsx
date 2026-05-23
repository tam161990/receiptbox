"use client";

import { Bot, Eye, BarChart3, Upload } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { FadeUp } from "./landingMotion";
import { SectionShell } from "./SectionShell";

const STEPS: { number: string; title: string; body: string; Icon: LucideIcon }[] = [
  {
    number: "1",
    title: "Nosūti dokumentu",
    body: "Sūti PDF, čeku, screenshotu vai rēķinu Telegramā vai web lietotnē.",
    Icon: Upload,
  },
  {
    number: "2",
    title: "ReceiptBox analizē",
    body: "Atrod summas, datumus, PVN un kategorijas.",
    Icon: Bot,
  },
  {
    number: "3",
    title: "Pārbaudi",
    body: "Ja kaut kas nav skaidrs — atzīmējam “Jāpārbauda”.",
    Icon: Eye,
  },
  {
    number: "4",
    title: "Eksportē",
    body: "CSV, Excel — pārskats gatavs deklarācijai.",
    Icon: BarChart3,
  },
];

export function HowItWorksSection() {
  return (
    <SectionShell id="how-it-works" tone="slate" wave>
      <div className="mx-auto max-w-6xl px-4">
        <FadeUp className="text-center">
          <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">Kā tas strādā</h2>
        </FadeUp>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <FadeUp key={step.number} delay={index * 100}>
              <article className="card h-full transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                    <step.Icon className="h-4 w-4" aria-hidden />
                  </div>
                  <span className="text-xs font-bold text-brand-600">{step.number}</span>
                </div>
                <h3 className="mt-3 font-semibold text-slate-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.body}</p>
              </article>
            </FadeUp>
          ))}
        </div>
      </div>
    </SectionShell>
  );
}
