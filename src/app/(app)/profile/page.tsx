import { getSessionUser } from "@/lib/auth";
import { FounderMembershipCard } from "@/components/FounderMembershipCard";
import { getFounderMembership } from "@/lib/founders";
import { prisma } from "@/lib/prisma";
import { ProfileForm } from "./ProfileForm";
import { SubcategoriesManager } from "./SubcategoriesManager";
import {
  CATEGORY_DEDUCTIBLE_DEFAULTS,
  EXPENSE_CATEGORIES,
  ExpenseCategoryLabels,
  isExpenseCategory,
} from "@/lib/enums";
import { parseCategoryRetrievalDefaults } from "@/lib/categoryRetrievalDefaults";
import { parseCategoryLabels, serializeUserCategory } from "@/lib/categories";
import { parseMyIdentifiers } from "@/lib/lineItems";
import { Disclaimer } from "@/components/Disclaimer";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = (await getSessionUser())!;
  const user = await prisma.user.findUnique({ where: { id: session.id } });
  const membership = getFounderMembership(
    user ?? {
      isFoundingUser: false,
      planType: "beta",
      featuresJson: "{}",
      foundingDiscountPercent: 0,
      foundingJoinedAt: null,
    },
  );

  const userDefaults: Record<string, number> = {};
  if (user?.categoryDefaultsJson) {
    try {
      const parsed = JSON.parse(user.categoryDefaultsJson);
      if (parsed && typeof parsed === "object") {
        for (const [k, v] of Object.entries(parsed)) {
          if (isExpenseCategory(k) && typeof v === "number") userDefaults[k] = v;
        }
      }
    } catch {
      // ignore
    }
  }

  const customLabels = parseCategoryLabels(user?.categoryLabelsJson);
  const retrievalDefaults = parseCategoryRetrievalDefaults(user?.categoryRetrievalDefaultsJson);

  const categories = EXPENSE_CATEGORIES.filter((c) => c !== "unknown").map((c) => ({
    key: c,
    defaultLabel: ExpenseCategoryLabels[c],
    customLabel: customLabels[c] ?? "",
    suggested: CATEGORY_DEDUCTIBLE_DEFAULTS[c],
    userValue: userDefaults[c] ?? null,
    retrievalDefault: retrievalDefaults[c] ?? "",
  }));

  const subRows = await prisma.userCategory.findMany({
    where: { userId: session.id },
    orderBy: [{ parentCategory: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
  const subcategories = subRows.map(serializeUserCategory);

  const categoryOptions = EXPENSE_CATEGORIES.filter((c) => c !== "unknown").map((c) => ({
    code: c,
    label: customLabels[c] ?? ExpenseCategoryLabels[c],
  }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Mans profils</h1>
        <p className="text-sm text-slate-600">
          Aizpildi profilu, lai AI labāk saprastu tavu situāciju un piedāvātu
          precīzākas atskaitāmās proporcijas.
        </p>
      </header>

      <FounderMembershipCard
        membership={membership}
        variant="profile"
      />

      <section className="card">
        <ProfileForm
          initial={{
            selfEmployedType: user?.selfEmployedType ?? "",
            workFromHomePercent:
              user?.workFromHomePercent !== null && user?.workFromHomePercent !== undefined
                ? String(user.workFromHomePercent)
                : "",
            mainActivityDescription: user?.mainActivityDescription ?? "",
            myIdentifiers: parseMyIdentifiers(user?.myIdentifiersJson),
          }}
          categories={categories}
        />
      </section>

      <section className="card">
        <h2 className="text-base font-semibold text-slate-900">
          Apakškategorijas
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Pievieno savas apakškategorijas zem galvenajām (piem., zem
          “Tehnika” → “Dārza inventārs”, “Cimdi”). Apakškategoriju var izvēlēties
          dokumenta lapā. Savs % šeit aizvieto galvenās kategorijas noklusējumu.
        </p>
        <div className="mt-4">
          <SubcategoriesManager
            initial={subcategories}
            categories={categoryOptions}
          />
        </div>
      </section>

      <Disclaimer />
    </div>
  );
}
