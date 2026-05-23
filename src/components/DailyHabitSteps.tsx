import type { DailyHabitStep } from "@/lib/dailyHabit";
import { DAILY_HABIT_STEPS } from "@/lib/dailyHabit";

export function DailyHabitSteps({
  steps = DAILY_HABIT_STEPS,
  variant = "landing",
}: {
  steps?: DailyHabitStep[];
  variant?: "landing" | "compact" | "inline";
}) {
  if (variant === "compact") {
    return (
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {steps.map((step, index) => (
          <li
            key={step.id}
            className="rounded-lg border border-slate-200/80 bg-white/80 px-2.5 py-2 text-center"
          >
            <span className="text-lg" aria-hidden>
              {step.emoji}
            </span>
            <p className="mt-1 text-xs font-medium text-slate-900">{step.title}</p>
            <span className="sr-only">{index + 1}. </span>
          </li>
        ))}
      </ol>
    );
  }

  if (variant === "inline") {
    return (
      <div className="rounded-xl border border-dashed border-brand-200 bg-brand-50/40 p-4">
        <p className="text-sm font-medium text-slate-900">Sāc ar šo ieradumu 👇</p>
        <ol className="mt-3 grid gap-2 sm:grid-cols-2">
          {steps.map((step, index) => (
            <li
              key={step.id}
              className="flex items-start gap-2.5 rounded-lg bg-white/90 px-3 py-2.5 text-sm"
            >
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm"
                aria-hidden
              >
                {step.emoji}
              </span>
              <div>
                <p className="font-medium text-slate-900">
                  <span className="text-brand-600">{index + 1}.</span> {step.title}
                </p>
                <p className="mt-0.5 text-xs text-slate-600">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {steps.map((step, index) => (
        <article
          key={step.id}
          className="card h-full transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-lg">
              <span aria-hidden>{step.emoji}</span>
            </div>
            <span className="text-xs font-bold text-brand-600">{index + 1}</span>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <step.Icon className="h-4 w-4 text-brand-600" aria-hidden />
            <h3 className="font-semibold text-slate-900">{step.title}</h3>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.body}</p>
        </article>
      ))}
    </div>
  );
}
