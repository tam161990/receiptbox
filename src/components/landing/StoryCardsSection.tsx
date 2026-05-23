"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowDown, ArrowRight } from "lucide-react";
import { FadeUp } from "./landingMotion";
import { SectionShell } from "./SectionShell";

const STORY_CARDS = [
  {
    image: "/landing/story-1.png",
    alt: "Pirms — čeku haoss un stresa",
    tag: "😵 PIRMS",
    tagClass: "bg-rose-100 text-rose-800",
    text: "Stress. Meklēšana. Pēdējā brīža haoss.",
  },
  {
    image: "/landing/story-2.png",
    alt: "Sūti dokumentus ReceiptBox",
    tag: "📦 RECEIPTBOX",
    tagClass: "bg-sky-100 text-sky-800",
    text: "Sūti gada laikā. ReceiptBox visu sakārto.",
  },
  {
    image: "/landing/story-3.png",
    alt: "Ar ReceiptBox — miers un kārtība",
    tag: "☕ MIERS",
    tagClass: "bg-emerald-100 text-emerald-800",
    text: "Mazāk stresa. Vairāk kontroles.",
  },
  {
    image: "/landing/story-4.png",
    alt: "Tu šodien un tu nākotnē",
    tag: "😄 NĀKOTNES TU",
    tagClass: "bg-violet-100 text-violet-800",
    text: "Nākotnes tu pateiks paldies.",
  },
];

const CHAOS_ITEMS = [
  "PDF e-pastos.",
  "Screenshoti galerijā.",
  "Lejupielādes mapē.",
  "Čeki telefonā.",
];

function StoryCard({
  image,
  alt,
  tag,
  tagClass,
  text,
}: (typeof STORY_CARDS)[number]) {
  return (
    <motion.article
      whileHover={{ y: -4, boxShadow: "0 12px 28px rgba(0,0,0,0.08)" }}
      className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm"
    >
      <div className="relative aspect-square w-full">
        <Image src={image} alt={alt} fill className="object-cover" sizes="(max-width:768px) 100vw, 25vw" />
      </div>
      <div className="p-4">
        <span
          className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${tagClass}`}
        >
          {tag}
        </span>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">{text}</p>
      </div>
    </motion.article>
  );
}

function StoryArrow({ direction }: { direction: "right" | "down" }) {
  const Icon = direction === "right" ? ArrowRight : ArrowDown;
  return (
    <motion.div
      className={`flex shrink-0 items-center justify-center text-brand-400 ${
        direction === "right" ? "hidden lg:flex lg:w-10" : "flex py-2 lg:hidden"
      }`}
      animate={{ x: direction === "right" ? [0, 6, 0] : 0, y: direction === "down" ? [0, 6, 0] : 0 }}
      transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      aria-hidden
    >
      <Icon className="h-6 w-6" strokeWidth={2} />
    </motion.div>
  );
}

export function StoryCardsSection() {
  return (
    <SectionShell id="story" tone="blue" wave>
      <div className="mx-auto max-w-6xl px-4">
        <FadeUp className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
            No čeku haosa līdz mieram
          </h2>
          <p className="mt-2 text-slate-600">
            Mazs klikšķis šodien.
            <br className="sm:hidden" /> Liels paldies sev nākotnē.
          </p>
          <ul className="mt-4 flex flex-wrap justify-center gap-x-3 gap-y-1 text-sm text-slate-600">
            {CHAOS_ITEMS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="mt-3 text-sm font-medium text-slate-700">Pazīstama situācija? 😅</p>
        </FadeUp>

        <div className="mt-10 md:hidden">
          {STORY_CARDS.map((card, index) => (
            <FadeUp key={card.image} delay={index * 80}>
              <StoryCard {...card} />
              {index < STORY_CARDS.length - 1 ? <StoryArrow direction="down" /> : null}
            </FadeUp>
          ))}
        </div>

        <div className="mt-10 hidden items-stretch lg:flex">
          {STORY_CARDS.map((card, index) => (
            <div key={card.image} className="contents">
              <FadeUp delay={index * 80} className="min-w-0 flex-1">
                <StoryCard {...card} />
              </FadeUp>
              {index < STORY_CARDS.length - 1 ? <StoryArrow direction="right" /> : null}
            </div>
          ))}
        </div>

        <div className="mt-10 hidden gap-4 md:grid md:grid-cols-2 lg:hidden">
          {STORY_CARDS.map((card, index) => (
            <FadeUp key={card.image} delay={index * 80}>
              <StoryCard {...card} />
            </FadeUp>
          ))}
        </div>
      </div>
    </SectionShell>
  );
}
