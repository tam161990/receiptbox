import type { ReactNode } from "react";

const BG: Record<string, string> = {
  white: "bg-white",
  blue: "bg-blue-50",
  slate: "bg-slate-50",
  amber: "bg-amber-50",
  emerald: "bg-emerald-50",
  indigo: "bg-indigo-50",
  orange: "bg-orange-50",
};

export function SectionShell({
  id,
  tone = "white",
  wave = false,
  children,
  className = "",
}: {
  id?: string;
  tone?: keyof typeof BG;
  wave?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={`relative scroll-mt-20 py-10 md:py-14 ${BG[tone]} ${className}`}
    >
      {wave ? (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-white/40 to-transparent"
          aria-hidden
        />
      ) : null}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <span className="absolute left-[8%] top-12 h-2 w-2 rounded-full bg-brand-200/40" />
        <span className="absolute right-[12%] top-24 h-1.5 w-1.5 rounded-full bg-brand-300/30" />
        <span className="absolute bottom-16 left-[20%] h-1.5 w-1.5 rounded-full bg-slate-300/40" />
      </div>
      <div className="relative">{children}</div>
      <WaveDivider tone={tone} />
    </section>
  );
}

function WaveDivider({ tone }: { tone: keyof typeof BG }) {
  const fill =
    tone === "blue"
      ? "#eff6ff"
      : tone === "slate"
        ? "#f8fafc"
        : tone === "amber"
          ? "#fffbeb"
          : tone === "emerald"
            ? "#ecfdf5"
            : tone === "indigo"
              ? "#eef2ff"
              : tone === "orange"
                ? "#fff7ed"
                : "#ffffff";

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-px" aria-hidden>
      <svg viewBox="0 0 1440 48" className="h-6 w-full md:h-8" preserveAspectRatio="none">
        <path
          d="M0,24 C240,48 480,0 720,24 C960,48 1200,0 1440,24 L1440,48 L0,48 Z"
          fill={fill}
          fillOpacity="0.35"
        />
      </svg>
    </div>
  );
}
