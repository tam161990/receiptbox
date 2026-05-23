"use client";

import {
  BarChart3,
  Coffee,
  FolderOpen,
  Smile,
  TrendingDown,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { FadeUp } from "./landingMotion";
import { SectionShell } from "./SectionShell";

const BENEFITS: { Icon: LucideIcon; title: string; accent?: string }[] = [
  { Icon: TrendingDown, title: "Mazāk stresa", accent: "text-rose-500" },
  { Icon: FolderOpen, title: "Mazāk dokumentu medību", accent: "text-amber-600" },
  { Icon: Coffee, title: "Vairāk brīvā laika", accent: "text-orange-500" },
  { Icon: BarChart3, title: "Skaidrs pārskats", accent: "text-brand-600" },
  { Icon: Smile, title: "Mazāk pēdējā vakara panikas", accent: "text-emerald-600" },
  { Icon: Zap, title: "Vienkāršāk nekā meklēt PDF Gmailā", accent: "text-violet-500" },
];

export function BenefitsSection() {
  return (
    <SectionShell tone="amber" wave>
      <div className="mx-auto max-w-6xl px-4">
        <FadeUp className="text-center">
          <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
            Mazāk haosa.
            <br className="sm:hidden" /> Vairāk dzīves.
          </h2>
        </FadeUp>
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((item, index) => (
            <FadeUp key={item.title} delay={index * 80}>
              <div className="flex items-center gap-3 rounded-xl border border-amber-100/80 bg-white/80 px-4 py-3 shadow-sm backdrop-blur-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 ${item.accent ?? "text-amber-600"}`}
                >
                  <item.Icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="text-sm font-medium text-slate-800">{item.title}</span>
              </div>
            </FadeUp>
          ))}
        </div>
      </div>
    </SectionShell>
  );
}
