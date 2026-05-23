/**
 * Feature gate system — infrastructure for future monetization.
 * Enforcement is OFF: all users retain full access (see ENFORCE_FEATURE_GATES).
 */

import type { User } from "@prisma/client";
import type { PlanType } from "./plans";

/** Set to true when ready to enforce plan-based access. Currently always permissive. */
export const ENFORCE_FEATURE_GATES = false;

export const FEATURES = [
  "DOCUMENT_UPLOAD_WEB",
  "DOCUMENT_UPLOAD_TELEGRAM",
  "ASK_AI",
  "CSV_EXPORT",
  "XLSX_EXPORT",
  "DOCUMENT_REANALYZE",
  "YEAR_SUMMARY",
  "QUARTER_SUMMARY",
  "SMART_WARNINGS",
  "ADVANCED_AI_ASSISTANT",
  "ACCOUNTANT_MODE",
  "PRIORITY_PROCESSING",
  "MULTI_CLIENT_DASHBOARD",
] as const;

export type Feature = (typeof FEATURES)[number];

export function isFeature(value: string): value is Feature {
  return (FEATURES as readonly string[]).includes(value);
}

/** All features currently shipped in the product (used for founder snapshots). */
export const CURRENT_SHIPPED_FEATURES: Feature[] = [
  "DOCUMENT_UPLOAD_WEB",
  "DOCUMENT_UPLOAD_TELEGRAM",
  "ASK_AI",
  "CSV_EXPORT",
  "XLSX_EXPORT",
  "YEAR_SUMMARY",
  "QUARTER_SUMMARY",
  "DOCUMENT_REANALYZE",
];

const ALL_FEATURES_SET = new Set<Feature>(FEATURES);

const BETA_AND_FOUNDER_FEATURES: Feature[] = [...FEATURES];

/** Plan → enabled features mapping (future enforcement). */
export const PLAN_FEATURES: Record<PlanType, Feature[]> = {
  beta: BETA_AND_FOUNDER_FEATURES,
  founder: BETA_AND_FOUNDER_FEATURES,
  free: [],
  unlimited: [],
  pro: [],
  accountant: [
    "DOCUMENT_UPLOAD_WEB",
    "CSV_EXPORT",
    "XLSX_EXPORT",
    "YEAR_SUMMARY",
    "QUARTER_SUMMARY",
    "ACCOUNTANT_MODE",
    "MULTI_CLIENT_DASHBOARD",
  ],
};

export type FeatureUser = Pick<
  User,
  | "planType"
  | "planStatus"
  | "isFoundingUser"
  | "foundingFeatureSnapshotJson"
  | "featuresJson"
>;

function parseFoundingSnapshot(json: string | null | undefined): Feature[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((f): f is Feature => typeof f === "string" && isFeature(f));
  } catch {
    return [];
  }
}

function parseFeatureOverrides(json: string | null | undefined): Partial<Record<Feature, boolean>> {
  if (!json || json === "{}") return {};
  try {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== "object") return {};
    const out: Partial<Record<Feature, boolean>> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (isFeature(k) && typeof v === "boolean") out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

/** Permanent founder rights: feature was available when user joined as founder. */
export function userHasLifetimeFounderFeature(user: FeatureUser, feature: Feature): boolean {
  if (!user.isFoundingUser) return false;
  const snapshot = parseFoundingSnapshot(user.foundingFeatureSnapshotJson);
  return snapshot.includes(feature);
}

function planAllowsFeature(user: FeatureUser, feature: Feature): boolean {
  const plan = (user.planType || "beta") as PlanType;
  const status = user.planStatus || "active";
  if (status === "suspended" || status === "expired") return false;

  if (userHasLifetimeFounderFeature(user, feature)) return true;

  const planFeatures = PLAN_FEATURES[plan] ?? PLAN_FEATURES.beta;
  if (planFeatures.includes(feature)) return true;

  const overrides = parseFeatureOverrides(user.featuresJson);
  if (feature in overrides) return overrides[feature] === true;

  return false;
}

/**
 * Check whether a user may use a feature.
 * Currently returns true for everyone — enforcement disabled.
 */
export function canUseFeature(user: FeatureUser, _feature: Feature): boolean {
  if (!ENFORCE_FEATURE_GATES) return true;
  return planAllowsFeature(user, _feature);
}

/** Capture feature list at founder join time. */
export function buildFoundingFeatureSnapshot(features: Feature[] = CURRENT_SHIPPED_FEATURES): string {
  return JSON.stringify(features.filter((f) => ALL_FEATURES_SET.has(f)));
}

/** Future UI lock messages (Latvian) — not displayed yet. */
export function featureLockMessage(feature: Feature): string {
  switch (feature) {
    case "ASK_AI":
      return "Pieejams PRO";
    case "SMART_WARNINGS":
      return "Jauna Premium funkcija";
    case "ADVANCED_AI_ASSISTANT":
      return "Pieejams Premium";
    case "ACCOUNTANT_MODE":
      return "Pieejams Grāmatveža plānam";
    case "MULTI_CLIENT_DASHBOARD":
      return "Pieejams Grāmatveža plānam";
    case "PRIORITY_PROCESSING":
      return "Pieejams Premium";
    case "CSV_EXPORT":
    case "XLSX_EXPORT":
      return "Pieejams paplašinātajā plānā";
    default:
      return "Pieejams paplašinātajā plānā";
  }
}
