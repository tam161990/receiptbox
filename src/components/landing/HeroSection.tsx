"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { FileText, Smartphone, Sparkles } from "lucide-react";
import { FadeUp, FloatingIcon, MotionButton, MotionReveal, useMotionReady, fadeUp } from "./landingMotion";

const FEATURE_CARDS = [
  {
    image: "/landing/security1.png",
    alt: "Tavi dati ir drošībā",
    delay: 100,
  },
  {
    image: "/landing/community1.png",
    alt: "Tu neesi viens",
    delay: 200,
  },
  {
    image: "/landing/stress1.png",
    alt: "Mazāk stresa. Vairāk dzīves.",
    delay: 300,
  },
];

export function HeroSection({
  onBeta,
  onHowItWorks,
}: {
  onBeta: () => void;
  onHowItWorks: () => void;
}) {
  const motionReady = useMotionReady();

  return (
    <SectionHero>
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-10">
          <MotionReveal>
            <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-brand-700">
              <Sparkles className="h-4 w-4" aria-hidden />
              <span>Mazāk haosa</span>
              <span className="text-slate-300">·</span>
              <Smartphone className="h-4 w-4" aria-hidden />
              <span>Telegram &amp; mobilā lietotne</span>
              <span className="text-slate-300">·</span>
              <FileText className="h-4 w-4" aria-hidden />
              <span>PDF &amp; čeki</span>
            </div>
            <h1 className="text-3xl font-semibold leading-tight text-slate-900 sm:text-4xl lg:text-[2.5rem]">
              Vienkāršākais veids, kā sagatavot izdevumus deklarācijai
            </h1>
            <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">
              Sūti čekus, PDF failus, screenshotus un rēķinus Telegramā vai mobilajā
              lietotnē. ReceiptBox tos sakārto gada laikā.
            </p>
            <p className="mt-2 text-base text-slate-600 sm:text-lg">
              Kad pienāk deklarācijas periods — viss jau ir gatavs.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <MotionButton type="button" onClick={onBeta} className="btn-primary">
                Pieteikties beta testam
              </MotionButton>
              <MotionButton type="button" onClick={onHowItWorks} className="btn-secondary">
                Kā tas darbojas?
              </MotionButton>
            </div>
            <p className="mt-4 text-sm text-slate-500">
              Nav grāmatvedība. Nav sarežģīti. Vienkārši mazāk stresa. ✨
            </p>
          </MotionReveal>

          <MotionReveal delay={150} className="relative order-first lg:order-none">
            <FloatingIcon className="left-4 top-6 text-lg text-amber-400/70" delay={0}>
              ✨
            </FloatingIcon>
            <FloatingIcon className="right-6 top-10 text-sm text-brand-400/60" delay={1.2}>
              ✓
            </FloatingIcon>
            <FloatingIcon className="bottom-12 left-8 text-base text-slate-400/50" delay={0.6}>
              📄
            </FloatingIcon>
            <FloatingIcon className="right-10 bottom-16 text-xs text-emerald-400/60" delay={1.8}>
              ★
            </FloatingIcon>
            <div className="relative mx-auto aspect-[4/3] max-w-lg overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br from-brand-50 to-white shadow-lg">
              <Image
                src="/landing/hero_girl2.png"
                alt="Sieviete mierīgi strādā ar ReceiptBox — dokumenti sakārtoti, pārskats gatavs"
                fill
                className="object-cover object-center"
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
          </MotionReveal>
        </div>

        <div className="mt-8 grid gap-3 md:grid-cols-3">
          {FEATURE_CARDS.map((card) =>
            motionReady ? (
              <motion.article
                key={card.image}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.2 }}
                custom={card.delay}
                variants={fadeUp}
                whileHover={{ scale: 1.03, boxShadow: "0 12px 32px rgba(0,112,199,0.12)" }}
                className="overflow-hidden rounded-2xl shadow-sm transition-shadow"
              >
                <FeatureCardImage {...card} />
              </motion.article>
            ) : (
              <article
                key={card.image}
                className="overflow-hidden rounded-2xl shadow-sm"
              >
                <FeatureCardImage {...card} />
              </article>
            ),
          )}
        </div>
      </div>
    </SectionHero>
  );
}

function FeatureCardImage({ image, alt }: (typeof FEATURE_CARDS)[number]) {
  return (
    <div className="relative aspect-[2/1] w-full">
      <Image
        src={image}
        alt={alt}
        fill
        className="object-cover object-center"
        sizes="(max-width:768px) 100vw, 33vw"
      />
    </div>
  );
}

function SectionHero({ children }: { children: React.ReactNode }) {
  return (
    <section className="relative overflow-hidden bg-white py-10 md:py-14">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -left-20 top-20 h-64 w-64 rounded-full bg-brand-100/30 blur-3xl" />
        <div className="absolute -right-16 bottom-10 h-48 w-48 rounded-full bg-amber-100/40 blur-3xl" />
      </div>
      <div className="relative">{children}</div>
    </section>
  );
}
