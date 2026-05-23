"use client";

import { HelpCircle } from "lucide-react";
import { DAILY_HABIT_FAQ } from "@/lib/dailyHabit";
import { FadeUp } from "./landingMotion";
import { SectionShell } from "./SectionShell";

const FAQ_ITEMS = [
  DAILY_HABIT_FAQ,
  {
    q: "Vai tas iesniedz deklarāciju VID?",
    a: "Nē. ReceiptBox palīdz sagatavot izdevumu pārskatu — deklarāciju iesniedz tu pats vai ar grāmatvedi.",
  },
  {
    q: "Vai glabā manus čekus?",
    a: "Nē. Oriģinālie faili tiek dzēsti pēc apstrādes. Saglabājam tikai strukturētos datus, ko tu vari eksportēt.",
  },
  {
    q: "Vai darbojas telefonā?",
    a: "Jā — caur Telegram un mobilās pārlūkprogrammas lietotni (PWA).",
  },
  {
    q: "Vai var pārbaudīt datus?",
    a: "Jā. Tu rediģē laukus, apstiprini pozīcijas un eksportē, kad viss ir kārtībā.",
  },
  {
    q: "Vai tas ir grāmatvedis?",
    a: "Nē. ReceiptBox ir rīks dokumentu kārtībai un pārskatam — ne juridiska vai nodokļu konsultācija.",
  },
];

export function FaqSection() {
  return (
    <SectionShell id="faq" tone="white">
      <div className="mx-auto max-w-3xl px-4">
        <FadeUp className="text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600">
            <HelpCircle className="h-5 w-5" aria-hidden />
          </div>
          <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">Biežākie jautājumi</h2>
        </FadeUp>
        <dl className="mt-10 space-y-3">
          {FAQ_ITEMS.map((item, index) => (
            <FadeUp key={item.q} delay={index * 60}>
              <div className="card transition hover:-translate-y-0.5 hover:shadow-md">
                <dt className="flex items-start gap-2 font-medium text-slate-900">
                  <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" aria-hidden />
                  {item.q}
                </dt>
                <dd className="mt-2 pl-6 text-sm leading-relaxed text-slate-600">{item.a}</dd>
              </div>
            </FadeUp>
          ))}
        </dl>
      </div>
    </SectionShell>
  );
}
