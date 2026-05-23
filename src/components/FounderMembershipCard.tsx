import { Heart, Users } from "lucide-react";
import { formatLvDate } from "@/lib/dates";
import {
  founderCohortLabel,
  founderProfileTitle,
  type FounderMembership,
} from "@/lib/founders";

export function FounderMembershipCard({
  membership,
  variant = "dashboard",
}: {
  membership: FounderMembership;
  variant?: "dashboard" | "profile";
}) {
  if (!membership.isFoundingUser) return null;

  const label = founderCohortLabel(membership.cohortKey);
  const isBeta = membership.cohortKey === "founderBeta";

  if (variant === "dashboard") {
    return (
      <section className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-orange-200/70 bg-orange-50/70 px-3 py-2 text-sm">
        <span className="font-medium text-orange-900">
          {isBeta ? "🔥 Founder Beta" : "✨ Founder"}
        </span>
        <span className="hidden text-orange-300 sm:inline" aria-hidden>
          ·
        </span>
        <span className="text-slate-700">Paldies, ka palīdz veidot ReceiptBox</span>
      </section>
    );
  }

  return (
    <section className="card border-orange-200/80 bg-gradient-to-br from-orange-50/70 via-white to-brand-50/40">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {label ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-100/80 px-2.5 py-1 text-xs font-medium text-orange-800">
              <Users className="h-3.5 w-3.5" aria-hidden />
              {label}
            </span>
          ) : null}
          <h2 className="mt-3 text-base font-semibold text-slate-900">
            <span aria-hidden="true">❤️ </span>
            {founderProfileTitle()}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Tu palīdzi veidot kaut ko noderīgu — kopā ar tevi un citiem agrīnajiem
            lietotājiem.
          </p>
        </div>
        <Heart className="h-5 w-5 shrink-0 text-orange-400/80" aria-hidden />
      </div>

      <ul className="mt-4 space-y-2 text-sm text-slate-700">
        <li className="flex gap-2">
          <span className="text-orange-500">✓</span>
          <span>Tava atsauksme un ikdienas lietojums palīdz veidot ReceiptBox</span>
        </li>
        <li className="flex gap-2">
          <span className="text-orange-500">✓</span>
          <span>Visas pašreizējās funkcijas bez ierobežojumiem</span>
        </li>
        <li className="flex gap-2">
          <span className="text-orange-500">✓</span>
          <span>Īpaša Founder cena tiks saglabāta tev uz mūžu</span>
        </li>
        {!isBeta && membership.foundingDiscountPercent > 0 ? (
          <li className="flex gap-2">
            <span className="text-orange-500">✓</span>
            <span>
              Atlaidi turpmākajām jaunajām funkcijām, kad tās parādīsies
            </span>
          </li>
        ) : null}
      </ul>

      {membership.foundingJoinedAt ? (
        <p className="mt-4 text-xs text-slate-500">
          Ar mums kopš {formatLvDate(membership.foundingJoinedAt)}
        </p>
      ) : null}
    </section>
  );
}
