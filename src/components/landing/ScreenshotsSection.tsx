"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { FadeUp } from "./landingMotion";
import { SectionShell } from "./SectionShell";

const SCREENSHOTS = [
  {
    id: "telegram",
    title: "Telegram Bot",
    description: "Nosūti čeku vai PDF tieši no Telegram.",
    mockup: "phone" as const,
    preview: (
      <div className="space-y-2 p-3">
        <div className="rounded-lg bg-sky-100 px-3 py-2 text-xs text-sky-900">ReceiptBox Bot</div>
        <div className="ml-auto max-w-[85%] rounded-lg bg-brand-600 px-3 py-2 text-xs text-white">
          rekins.pdf
        </div>
        <div className="max-w-[85%] rounded-lg bg-white px-3 py-2 text-xs text-slate-700 shadow-sm">
          Saņemts! Analizēju… ✓
        </div>
      </div>
    ),
  },
  {
    id: "dashboard",
    title: "Dashboard",
    description: "Visi dokumenti vienuviet.",
    mockup: "browser" as const,
    preview: (
      <div className="space-y-2 p-3 text-xs">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded bg-slate-100 p-2">12 dokumenti</div>
          <div className="rounded bg-emerald-50 p-2 text-emerald-800">9 apstrādāti</div>
        </div>
        <div className="rounded border border-slate-200 p-2">Latvenergo · 32,89 €</div>
        <div className="rounded border border-slate-200 p-2">LMT · 13,98 €</div>
      </div>
    ),
  },
  {
    id: "reports",
    title: "Pārskats",
    description: "Gatavs kopsavilkums periodam.",
    mockup: "card" as const,
    preview: (
      <div className="space-y-2 p-3 text-xs">
        <div className="font-medium text-slate-900">2026 Q1</div>
        <div className="flex justify-between">
          <span>Birojs</span>
          <span>320 €</span>
        </div>
        <div className="flex justify-between">
          <span>Tehnika</span>
          <span>660 €</span>
        </div>
        <div className="flex justify-between border-t pt-2 font-semibold">
          <span>Kopā</span>
          <span>1 639 €</span>
        </div>
      </div>
    ),
  },
  {
    id: "ask-ai",
    title: "Ask AI",
    description: "Konsultācija par konkrētu dokumentu.",
    mockup: "chat" as const,
    preview: (
      <div className="space-y-2 p-3 text-xs">
        <div className="rounded-lg bg-brand-50 px-3 py-2 text-brand-900">
          Vai šo rēķinu varu atskaitīt pilnībā?
        </div>
        <div className="rounded-lg bg-white px-3 py-2 text-slate-700 shadow-sm">
          Balstoties uz tavu profilu…
        </div>
      </div>
    ),
  },
  {
    id: "csv",
    title: "CSV eksports",
    description: "Lejupielādē Excel/CSV.",
    mockup: "excel" as const,
    preview: (
      <div className="overflow-hidden p-2 text-[10px]">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-emerald-100">
              <th className="border border-emerald-200 p-1">Datums</th>
              <th className="border border-emerald-200 p-1">Summa</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border p-1">01.03</td>
              <td className="border p-1">32,89</td>
            </tr>
            <tr>
              <td className="border p-1">15.03</td>
              <td className="border p-1">13,98</td>
            </tr>
          </tbody>
        </table>
      </div>
    ),
  },
];

function MockupFrame({
  type,
  children,
}: {
  type: (typeof SCREENSHOTS)[number]["mockup"];
  children: React.ReactNode;
}) {
  if (type === "phone") {
    return (
      <div className="mx-auto w-36 rounded-[1.25rem] border-4 border-slate-800 bg-slate-800 p-1 shadow-lg">
        <div className="overflow-hidden rounded-[0.9rem] bg-slate-100">{children}</div>
      </div>
    );
  }
  if (type === "browser") {
    return (
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex gap-1 border-b border-slate-200 bg-slate-100 px-2 py-1.5">
          <span className="h-2 w-2 rounded-full bg-rose-300" />
          <span className="h-2 w-2 rounded-full bg-amber-300" />
          <span className="h-2 w-2 rounded-full bg-emerald-300" />
        </div>
        {children}
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      {children}
    </div>
  );
}

export function ScreenshotsSection() {
  const [modalIndex, setModalIndex] = useState<number | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);

  const active = modalIndex !== null ? SCREENSHOTS[modalIndex] : null;

  return (
    <SectionShell id="screenshots" tone="indigo" wave>
      <div className="mx-auto max-w-6xl px-4">
        <FadeUp className="text-center">
          <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">Kā tas izskatās</h2>
        </FadeUp>

        <div className="mt-10 hidden gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {SCREENSHOTS.map((shot, index) => (
            <FadeUp key={shot.id} delay={index * 80}>
              <motion.button
                type="button"
                onClick={() => setModalIndex(index)}
                whileHover={{ y: -6, boxShadow: "0 16px 32px rgba(79,70,229,0.12)" }}
                className="card group w-full cursor-pointer text-left transition"
              >
                <MockupFrame type={shot.mockup}>{shot.preview}</MockupFrame>
                <h3 className="mt-3 text-sm font-semibold text-slate-900 group-hover:text-brand-700">
                  {shot.title}
                </h3>
                <p className="mt-1 text-xs text-slate-600">{shot.description}</p>
              </motion.button>
            </FadeUp>
          ))}
        </div>

        <div className="mt-10 sm:hidden">
          <motion.button
            type="button"
            onClick={() => setModalIndex(carouselIndex)}
            whileTap={{ scale: 0.98 }}
            className="card w-full cursor-pointer text-left"
          >
            <MockupFrame type={SCREENSHOTS[carouselIndex].mockup}>
              {SCREENSHOTS[carouselIndex].preview}
            </MockupFrame>
            <h3 className="mt-3 text-sm font-semibold text-slate-900">
              {SCREENSHOTS[carouselIndex].title}
            </h3>
            <p className="mt-1 text-xs text-slate-600">{SCREENSHOTS[carouselIndex].description}</p>
          </motion.button>
          <div className="mt-3 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() =>
                setCarouselIndex((i) => (i === 0 ? SCREENSHOTS.length - 1 : i - 1))
              }
              className="btn-secondary min-h-10 px-3"
              aria-label="Iepriekšējais"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex gap-1">
              {SCREENSHOTS.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setCarouselIndex(i)}
                  className={`h-2 w-2 rounded-full transition ${i === carouselIndex ? "bg-brand-600" : "bg-slate-300"}`}
                  aria-label={s.title}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                setCarouselIndex((i) => (i === SCREENSHOTS.length - 1 ? 0 : i + 1))
              }
              className="btn-secondary min-h-10 px-3"
              aria-label="Nākamais"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {active ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
          onClick={() => setModalIndex(null)}
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card max-h-[90vh] w-full max-w-lg overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-900">{active.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{active.description}</p>
              </div>
              <button
                type="button"
                onClick={() => setModalIndex(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                aria-label="Aizvērt"
              >
                ✕
              </button>
            </div>
            <MockupFrame type={active.mockup}>{active.preview}</MockupFrame>
          </motion.div>
        </div>
      ) : null}
    </SectionShell>
  );
}
