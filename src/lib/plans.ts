/**
 * Plan types, statuses, and future pricing configuration.
 * Not used in UI or enforcement yet — infrastructure only.
 */

export const PLAN_TYPES = [
  "beta",
  "founder",
  "free",
  "unlimited",
  "pro",
  "accountant",
] as const;

export type PlanType = (typeof PLAN_TYPES)[number];

export const PLAN_STATUSES = ["active", "trial", "expired", "suspended"] as const;

export type PlanStatus = (typeof PLAN_STATUSES)[number];

export function isPlanType(value: string): value is PlanType {
  return (PLAN_TYPES as readonly string[]).includes(value);
}

export function isPlanStatus(value: string): value is PlanStatus {
  return (PLAN_STATUSES as readonly string[]).includes(value);
}

/** Default plan fields for new users. */
export const DEFAULT_PLAN_FIELDS = {
  planType: "beta" as PlanType,
  planStatus: "active" as PlanStatus,
  isFoundingUser: false,
  foundingDiscountPercent: 0,
  monthlyDocumentLimit: 999_999,
  monthlyAiQuestionsLimit: 999_999,
  documentsProcessedCurrentMonth: 0,
  aiQuestionsCurrentMonth: 0,
  featuresJson: "{}",
  countryCode: "LV",
} as const;

export interface PlanPriceOption {
  amount: number;
  currency: "EUR";
  interval: "month" | "year";
  description: string;
  discountEligible: boolean;
}

export interface PlanPricingConfig {
  planType: PlanType;
  label: string;
  monthly?: PlanPriceOption;
  yearly?: PlanPriceOption;
  note?: string;
}

/** Future pricing — not displayed or charged yet. */
export const PLAN_PRICING: Record<Exclude<PlanType, "beta" | "free">, PlanPricingConfig> = {
  founder: {
    planType: "founder",
    label: "Founder",
    monthly: {
      amount: 2.99,
      currency: "EUR",
      interval: "month",
      description: "Founder monthly (future)",
      discountEligible: false,
    },
    yearly: {
      amount: 29,
      currency: "EUR",
      interval: "year",
      description: "Founder yearly lifetime pricing (future)",
      discountEligible: false,
    },
  },
  unlimited: {
    planType: "unlimited",
    label: "Unlimited",
    monthly: {
      amount: 6.99,
      currency: "EUR",
      interval: "month",
      description: "Unlimited plan monthly (future)",
      discountEligible: true,
    },
    yearly: {
      amount: 69,
      currency: "EUR",
      interval: "year",
      description: "Unlimited plan yearly (future)",
      discountEligible: true,
    },
  },
  pro: {
    planType: "pro",
    label: "Pro",
    monthly: {
      amount: 9.99,
      currency: "EUR",
      interval: "month",
      description: "Pro plan monthly (future)",
      discountEligible: true,
    },
    yearly: {
      amount: 89,
      currency: "EUR",
      interval: "year",
      description: "Pro plan yearly (future)",
      discountEligible: true,
    },
  },
  accountant: {
    planType: "accountant",
    label: "Accountant",
    note: "Future: 29–99 EUR/month depending on client count",
    monthly: {
      amount: 29,
      currency: "EUR",
      interval: "month",
      description: "Accountant base tier (future)",
      discountEligible: true,
    },
  },
};

/** Founder cohort rules — stored for future automation, not enforced. */
export const FOUNDER_COHORT_RULES = {
  /** Users 0–100: Founder Beta — initially free, later 29 EUR/year lifetime. */
  founderBeta: { userIndexMin: 0, userIndexMax: 100, planType: "founder" as PlanType, initiallyFree: true },
  /** Users 100–300: Founder at 29 EUR/year. */
  founder: { userIndexMin: 100, userIndexMax: 300, planType: "founder" as PlanType, initiallyFree: false },
  /** Users 300+: future standard plans. */
  standard: { userIndexMin: 300, userIndexMax: null, planType: null },
} as const;

export const FOUNDER_LIFETIME_DISCOUNT_PERCENT = 50;
