import Link from "next/link";
import { getDashboardGreeting } from "@/lib/dashboardGreeting";

export function DashboardHero({ firstName }: { firstName?: string | null }) {
  const greeting = getDashboardGreeting(firstName);

  return (
    <section className="relative overflow-hidden rounded-xl border border-slate-200/70 bg-gradient-to-br from-white via-amber-50/40 to-brand-50/30 px-4 py-4 sm:px-5 sm:py-5">
      <div
        className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-orange-100/50 blur-2xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-6 left-8 h-20 w-20 rounded-full bg-brand-100/40 blur-2xl"
        aria-hidden
      />

      <div className="relative">
        <p className="text-sm font-medium text-brand-700">{greeting}</p>
        <h1 className="mt-1 text-2xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-[1.75rem]">
          Mazāk stresa. Vairāk dzīves.
        </h1>
        <p className="mt-1.5 text-sm text-slate-600">
          Šodien ReceiptBox jau parūpējās par tavu dokumentu haosu 😄
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/documents" className="btn-primary">
            📄 Apskatīt dokumentus
          </Link>
          <Link href="/reports" className="btn-secondary">
            📊 Sagatavot pārskatu
          </Link>
        </div>
      </div>
    </section>
  );
}
