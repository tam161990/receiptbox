"use client";

import { FloatingIcon, MotionButton, MotionReveal } from "./landingMotion";

export function FinalCtaSection({ onBeta }: { onBeta: () => void }) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-brand-600 via-brand-500 to-brand-300 py-10 text-white md:py-14">
      <FloatingIcon className="left-[10%] top-[20%] text-lg opacity-40" delay={0}>
        🧾
      </FloatingIcon>
      <FloatingIcon className="right-[15%] top-[25%] text-sm opacity-35" delay={1}>
        ✓
      </FloatingIcon>
      <FloatingIcon className="left-[18%] bottom-[22%] text-base opacity-30" delay={1.5}>
        ★
      </FloatingIcon>
      <FloatingIcon className="right-[12%] bottom-[18%] text-lg opacity-35" delay={0.8}>
        ✨
      </FloatingIcon>

      <div className="relative mx-auto max-w-3xl px-4 text-center">
        <MotionReveal>
          <h2 className="text-2xl font-semibold sm:text-3xl">
            Mazāk pēdējā vakara stresa.
            <br />
            Vairāk normālas dzīves.
          </h2>
        </MotionReveal>
        <MotionButton
          type="button"
          onClick={onBeta}
          className="mt-8 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-brand-700 shadow-lg transition hover:bg-brand-50"
        >
          Pieteikties beta testam
        </MotionButton>
        <p className="mt-4 text-sm text-brand-50">Nākotnes tu būs pateicīgs 😄</p>
      </div>
    </section>
  );
}
