/**
 * Founder program — automatic cohort enrollment on first signup.
 * See docs/FOUNDER_PROGRAM.md and FOUNDER_COHORT_RULES in plans.ts.
 */

import type { Prisma, User } from "@prisma/client";
import { prisma } from "./prisma";
import {
  buildFoundingFeatureSnapshot,
  CURRENT_SHIPPED_FEATURES,
  type Feature,
} from "./features";
import {
  DEFAULT_PLAN_FIELDS,
  FOUNDER_COHORT_RULES,
  FOUNDER_LIFETIME_DISCOUNT_PERCENT,
  type PlanType,
} from "./plans";

export type FounderCohortKey = "founderBeta" | "founder" | "standard";

export interface FounderCohortResolution {
  cohortKey: FounderCohortKey;
  planType: PlanType;
  initiallyFree: boolean;
}

export interface EnrollFounderInput {
  userId: string;
  planType?: PlanType;
  featureSnapshot?: Feature[];
  cohortKey?: Exclude<FounderCohortKey, "standard">;
}

export interface TelegramUserProfile {
  telegramUsername?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

/** Resolve founder cohort by global signup order (0-based index). */
export function resolveFounderCohortByUserIndex(userIndex: number): FounderCohortResolution {
  const { founderBeta, founder } = FOUNDER_COHORT_RULES;

  if (userIndex >= founderBeta.userIndexMin && userIndex < founderBeta.userIndexMax) {
    return {
      cohortKey: "founderBeta",
      planType: founderBeta.planType,
      initiallyFree: founderBeta.initiallyFree,
    };
  }

  if (userIndex >= founder.userIndexMin && userIndex < founder.userIndexMax) {
    return {
      cohortKey: "founder",
      planType: founder.planType,
      initiallyFree: founder.initiallyFree,
    };
  }

  return {
    cohortKey: "standard",
    planType: "beta",
    initiallyFree: false,
  };
}

function buildFeaturesJson(cohortKey: FounderCohortKey): string {
  return JSON.stringify({ founderCohort: cohortKey });
}

type FoundingEnrollmentFields = {
  planType: string;
  planStatus: string;
  isFoundingUser: boolean;
  foundingJoinedAt: Date;
  foundingDiscountPercent: number;
  foundingFeatureSnapshotJson: string;
  featuresJson: string;
};

function buildFoundingEnrollmentFields(
  cohort: Exclude<FounderCohortResolution, { cohortKey: "standard" }>,
): FoundingEnrollmentFields {
  return {
    planType: cohort.planType,
    planStatus: "active",
    isFoundingUser: true,
    foundingJoinedAt: new Date(),
    foundingDiscountPercent: FOUNDER_LIFETIME_DISCOUNT_PERCENT,
    foundingFeatureSnapshotJson: buildFoundingFeatureSnapshot(CURRENT_SHIPPED_FEATURES),
    featuresJson: buildFeaturesJson(cohort.cohortKey),
  };
}

function buildNewUserCreateData(
  telegramUserId: string,
  userIndex: number,
  profile?: TelegramUserProfile,
): Prisma.UserCreateInput {
  const cohort = resolveFounderCohortByUserIndex(userIndex);
  const base: Prisma.UserCreateInput = {
    telegramUserId,
    countryCode: DEFAULT_PLAN_FIELDS.countryCode,
    planType: DEFAULT_PLAN_FIELDS.planType,
    planStatus: DEFAULT_PLAN_FIELDS.planStatus,
    isFoundingUser: DEFAULT_PLAN_FIELDS.isFoundingUser,
    foundingDiscountPercent: DEFAULT_PLAN_FIELDS.foundingDiscountPercent,
    monthlyDocumentLimit: DEFAULT_PLAN_FIELDS.monthlyDocumentLimit,
    monthlyAiQuestionsLimit: DEFAULT_PLAN_FIELDS.monthlyAiQuestionsLimit,
    documentsProcessedCurrentMonth: DEFAULT_PLAN_FIELDS.documentsProcessedCurrentMonth,
    aiQuestionsCurrentMonth: DEFAULT_PLAN_FIELDS.aiQuestionsCurrentMonth,
    featuresJson: DEFAULT_PLAN_FIELDS.featuresJson,
    ...(profile?.telegramUsername != null ? { telegramUsername: profile.telegramUsername } : {}),
    ...(profile?.firstName != null ? { firstName: profile.firstName } : {}),
    ...(profile?.lastName != null ? { lastName: profile.lastName } : {}),
  };

  if (cohort.cohortKey === "standard") {
    return base;
  }

  return {
    ...base,
    ...buildFoundingEnrollmentFields(cohort),
  };
}

async function getUserSignupIndex(
  tx: Prisma.TransactionClient,
  user: Pick<User, "id" | "createdAt">,
): Promise<number> {
  const earlierCount = await tx.user.count({
    where: { createdAt: { lt: user.createdAt } },
  });
  const sameTimeEarlier = await tx.user.count({
    where: { createdAt: user.createdAt, id: { lt: user.id } },
  });
  return earlierCount + sameTimeEarlier;
}

function profileUpdateData(profile?: TelegramUserProfile): Prisma.UserUpdateInput {
  if (!profile) return {};
  return {
    ...(profile.telegramUsername !== undefined
      ? { telegramUsername: profile.telegramUsername }
      : {}),
    ...(profile.firstName !== undefined ? { firstName: profile.firstName } : {}),
    ...(profile.lastName !== undefined ? { lastName: profile.lastName } : {}),
  };
}

/**
 * Create or load a user and assign founder cohort on first signup.
 * Uses a transaction so concurrent signups get distinct cohort slots.
 */
export async function upsertUserByTelegramId(
  telegramUserId: string,
  profile?: TelegramUserProfile,
): Promise<User> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({ where: { telegramUserId } });

    if (existing) {
      const profileData = profileUpdateData(profile);
      const needsBackfill = !existing.isFoundingUser;

      if (needsBackfill) {
        const userIndex = await getUserSignupIndex(tx, existing);
        const cohort = resolveFounderCohortByUserIndex(userIndex);
        if (cohort.cohortKey !== "standard") {
          return tx.user.update({
            where: { id: existing.id },
            data: {
              ...profileData,
              ...buildFoundingEnrollmentFields(cohort),
            },
          });
        }
      }

      if (Object.keys(profileData).length > 0) {
        return tx.user.update({
          where: { id: existing.id },
          data: profileData,
        });
      }

      return existing;
    }

    const userIndex = await tx.user.count();
    return tx.user.create({
      data: buildNewUserCreateData(telegramUserId, userIndex, profile),
    });
  });
}

/** Mark user as founder and freeze current feature set (manual override). */
export async function enrollFoundingUser(input: EnrollFounderInput): Promise<void> {
  const snapshot = input.featureSnapshot ?? CURRENT_SHIPPED_FEATURES;
  const cohortKey = input.cohortKey ?? "founder";

  await prisma.user.update({
    where: { id: input.userId },
    data: {
      isFoundingUser: true,
      foundingJoinedAt: new Date(),
      foundingDiscountPercent: FOUNDER_LIFETIME_DISCOUNT_PERCENT,
      foundingFeatureSnapshotJson: buildFoundingFeatureSnapshot(snapshot),
      planType: input.planType ?? "founder",
      planStatus: "active",
      featuresJson: buildFeaturesJson(cohortKey),
    },
  });
}

export interface FounderMembership {
  isFoundingUser: boolean;
  cohortKey: FounderCohortKey;
  planType: string;
  foundingDiscountPercent: number;
  foundingJoinedAt: Date | null;
}

export function parseFounderCohortFromFeaturesJson(
  featuresJson: string | null | undefined,
): Exclude<FounderCohortKey, "standard"> | null {
  if (!featuresJson || featuresJson === "{}") return null;
  try {
    const parsed = JSON.parse(featuresJson) as { founderCohort?: unknown };
    if (parsed.founderCohort === "founderBeta" || parsed.founderCohort === "founder") {
      return parsed.founderCohort;
    }
  } catch {
    // ignore invalid JSON
  }
  return null;
}

export function getFounderMembership(
  user: Pick<
    User,
    "isFoundingUser" | "planType" | "featuresJson" | "foundingDiscountPercent" | "foundingJoinedAt"
  >,
): FounderMembership {
  const cohortFromJson = parseFounderCohortFromFeaturesJson(user.featuresJson);
  const cohortKey: FounderCohortKey =
    user.isFoundingUser && cohortFromJson ? cohortFromJson : user.isFoundingUser ? "founder" : "standard";

  return {
    isFoundingUser: user.isFoundingUser,
    cohortKey,
    planType: user.planType,
    foundingDiscountPercent: user.foundingDiscountPercent,
    foundingJoinedAt: user.foundingJoinedAt,
  };
}

export function founderCohortLabel(cohortKey: FounderCohortKey): string | null {
  switch (cohortKey) {
    case "founderBeta":
      return "Founder Beta";
    case "founder":
      return "Founder";
    default:
      return null;
  }
}

export function founderProfileTitle(): string {
  return "Paldies, ka esi ar mums no paša sākuma";
}
