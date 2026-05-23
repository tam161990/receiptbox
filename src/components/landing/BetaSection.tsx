"use client";

import { Gift, Heart, Rocket, Sparkles } from "lucide-react";
import { FadeUp, MotionButton } from "./landingMotion";
import { SectionShell } from "./SectionShell";

export function BetaSection({ onApply }: { onApply: () => void }) {
  return (
    <SectionShell id="beta" tone="orange" wave>
      <div className="mx-auto max-w-3xl px-4">
        <FadeUp>
          <div className="card border-2 border-orange-200/80 bg-white/90 shadow-md backdrop-blur-sm">
            <div className="flex items-center gap-2 text-orange-600">
              <Rocket className="h-5 w-5" aria-hidden />
              <span className="text-sm font-semibold uppercase tracking-wide">Founder program</span>
            </div>
            <h2 className="mt-3 text-2xl font-semibold text-slate-900 sm:text-3xl">
              Meklējam pirmos beta lietotājus
            </h2>
            <p className="mt-3 text-slate-600">
              Veidojam ReceiptBox LV kopā ar pirmajiem lietotājiem.
            </p>

            {/* 1 — Beta is free (primary message) */}
            <div className="mt-6 space-y-3 rounded-2xl border-2 border-emerald-200 bg-emerald-50/80 p-5">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-white shadow-sm">
                <Gift className="h-3.5 w-3.5" aria-hidden />
                Bez maksas beta periodā
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-300 bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-800">
                🔥 Šobrīd: bezmaksas beta
              </span>
              <p className="text-sm leading-relaxed text-emerald-900">
                Pievienojies bez maksas, testē produktu un palīdzi mums to uzlabot. Nekādu
                maksājumu beta laikā.
              </p>
            </div>

            {/* 2 — Founder benefits (value before price) */}
            <div className="mt-6">
              <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-700">
                <Sparkles className="h-4 w-4 text-brand-600" aria-hidden />
                Founder priekšrocības
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-emerald-600">✓</span>
                  Palīdz veidot produktu — tava atgriezeniskā saite ir svarīga
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-emerald-600">✓</span>
                  50% atlaide nākotnes premium funkcijām
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-emerald-600">✓</span>
                  Agrīna pieeja jaunām funkcijām
                </li>
              </ul>
            </div>

            {/* 3 — Future pricing (after value) */}
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-sm font-medium text-slate-800">Pēc beta — īpaša cena uz mūžu</p>
              <p className="mt-1 text-xs text-slate-500">
                Founder lietotāji saņems pastāvīgu atlaidi, kad beta periods beigsies.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-orange-100 bg-white p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-orange-700">
                    0–100 lietotāji
                  </div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-900">Founder Beta</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    100–300 lietotāji
                  </div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-900">Founder</div>
                </div>
              </div>
            </div>

            <MotionButton type="button" onClick={onApply} className="btn-primary mt-6 w-full sm:w-auto">
              Pieteikties beta testam — bez maksas
            </MotionButton>

            <p className="mt-4 flex items-center gap-1.5 text-sm text-slate-600">
              <Heart className="h-4 w-4 text-rose-500" aria-hidden />
              Paldies, ka palīdz uzbūvēt kaut ko noderīgu
            </p>
          </div>
        </FadeUp>
      </div>
    </SectionShell>
  );
}
