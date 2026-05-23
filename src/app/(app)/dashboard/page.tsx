import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { DashboardHero } from "@/components/DashboardHero";
import { DailyHowToOnboarding } from "@/components/DailyHowToOnboarding";
import { ProfileTipCard } from "@/components/ProfileTipCard";
import { DashboardDocumentsEmpty } from "@/components/DashboardDocumentsEmpty";
import { FounderMembershipCard } from "@/components/FounderMembershipCard";
import { getFounderMembership } from "@/lib/founders";
import { prisma } from "@/lib/prisma";
import { serializeDocument } from "@/lib/documents";
import { formatLvDate, formatLvMoney } from "@/lib/dates";
import { Disclaimer } from "@/components/Disclaimer";
import { DocumentStatusBadge, DeductibleBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = (await getSessionUser())!;
  const dbUser = await prisma.user.findUnique({ where: { id: session.id } });
  const membership = getFounderMembership(
    dbUser ?? {
      isFoundingUser: false,
      planType: "beta",
      featuresJson: "{}",
      foundingDiscountPercent: 0,
      foundingJoinedAt: null,
    },
  );
  const displayName = dbUser?.firstName?.trim() || session.firstName?.trim() || null;

  const [total, processed, needsReview, failed, latestDocs, reviewDocs] =
    await Promise.all([
      prisma.document.count({ where: { userId: session.id } }),
      prisma.document.count({ where: { userId: session.id, status: "processed" } }),
      prisma.document.count({ where: { userId: session.id, status: "needs_review" } }),
      prisma.document.count({ where: { userId: session.id, status: "failed" } }),
      prisma.document.findMany({
        where: { userId: session.id },
        orderBy: { uploadedAt: "desc" },
        take: 5,
      }),
      prisma.document.findMany({
        where: { userId: session.id, status: "needs_review" },
        orderBy: { uploadedAt: "desc" },
        take: 5,
      }),
    ]);

  const latest = latestDocs.map((d) => serializeDocument(d));
  const reviews = reviewDocs.map((d) => serializeDocument(d));

  return (
    <div className="space-y-4">
      {membership.isFoundingUser ? (
        <FounderMembershipCard membership={membership} variant="dashboard" />
      ) : null}

      <DashboardHero firstName={displayName} />

      <DailyHowToOnboarding />

      <ProfileTipCard />

      <section className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <StatCard label="Visi dokumenti" value={total} />
        <StatCard label="Apstrādāti" value={processed} accent="emerald" />
        <StatCard label="Jāpārbauda" value={needsReview} accent="orange" />
        <StatCard label="Kļūdas" value={failed} accent="rose" />
      </section>

      <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
        <section className="card">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">
              Jaunākie dokumenti
            </h2>
            <Link className="text-sm text-brand-700 hover:underline" href="/documents">
              Skatīt visus →
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-slate-100">
            {latest.length === 0 ? (
              <DashboardDocumentsEmpty />
            ) : null}
            {latest.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <Link
                    href={`/documents/${doc.id}`}
                    className="block truncate text-sm font-medium text-slate-900 hover:underline"
                  >
                    {doc.vendorName ?? doc.originalFileName}
                  </Link>
                  <div className="text-xs text-slate-500">
                    {formatLvDate(doc.documentDate ?? doc.uploadedAt)} ·{" "}
                    {formatLvMoney(doc.totalAmount, doc.currency ?? "EUR")}
                  </div>
                </div>
                <DocumentStatusBadge status={doc.status} />
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">
              Jāpārbauda
            </h2>
            <Link
              className="text-sm text-brand-700 hover:underline"
              href="/documents?status=needs_review"
            >
              Skatīt visus →
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-slate-100">
            {reviews.length === 0 ? (
              <li className="py-3 text-sm text-slate-600">
                <span className="font-medium text-emerald-700">Lieliski!</span> Nekas nav jālabo
                — vari mierīgi turpināt sūtīt dokumentus Telegram botam ☕
              </li>
            ) : null}
            {reviews.map((doc) => (
              <li key={doc.id} className="py-3">
                <Link
                  href={`/documents/${doc.id}`}
                  className="block text-sm font-medium text-slate-900 hover:underline"
                >
                  {doc.vendorName ?? doc.originalFileName}
                </Link>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <DeductibleBadge status={doc.deductibleStatus} />
                  <span>
                    {formatLvDate(doc.documentDate ?? doc.uploadedAt)} ·{" "}
                    {formatLvMoney(doc.totalAmount, doc.currency ?? "EUR")}
                  </span>
                </div>
                {doc.needsReviewReasons.length > 0 ? (
                  <p className="mt-1 text-xs text-orange-700">
                    {doc.needsReviewReasons[0]}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <Disclaimer />
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "emerald" | "orange" | "rose";
}) {
  const accentClass =
    accent === "emerald"
      ? "text-emerald-600"
      : accent === "orange"
        ? "text-orange-600"
        : accent === "rose"
          ? "text-rose-600"
          : "text-slate-900";
  return (
    <div className="card py-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className={`mt-1 text-xl font-semibold ${accentClass}`}>{value}</div>
    </div>
  );
}
