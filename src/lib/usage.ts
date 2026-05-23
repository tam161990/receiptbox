/**
 * Usage tracking — increments monthly counters and logs events.
 * Limits are NOT enforced (see features.ts ENFORCE_FEATURE_GATES).
 */

import { prisma } from "./prisma";

export const USAGE_EVENT_TYPES = {
  DOCUMENT_UPLOAD_WEB: "document_upload_web",
  DOCUMENT_UPLOAD_TELEGRAM: "document_upload_telegram",
  ASK_AI: "ask_ai",
  REPORT_GENERATION: "report_generation",
  CSV_EXPORT: "csv_export",
  XLSX_EXPORT: "xlsx_export",
  DOCUMENT_REANALYZE: "document_reanalyze",
} as const;

export type UsageEventType = (typeof USAGE_EVENT_TYPES)[keyof typeof USAGE_EVENT_TYPES];

export interface TrackUsageInput {
  userId: string;
  eventType: UsageEventType;
  /** Number of documents processed (uploads / bank splits). Default 1. */
  documentCount?: number;
  /** For Ask AI — defaults to 1 when event is ask_ai. */
  aiQuestionCount?: number;
  metadata?: Record<string, unknown>;
}

function utcMonthStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/** Reset monthly counters when calendar month changes. */
async function ensureMonthlyReset(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      lastUsageResetAt: true,
      documentsProcessedCurrentMonth: true,
      aiQuestionsCurrentMonth: true,
    },
  });
  if (!user) return;

  const now = new Date();
  const monthStart = utcMonthStart(now);
  const lastReset = user.lastUsageResetAt ? utcMonthStart(user.lastUsageResetAt) : null;

  if (lastReset && lastReset.getTime() === monthStart.getTime()) return;

  await prisma.user.update({
    where: { id: userId },
    data: {
      documentsProcessedCurrentMonth: 0,
      aiQuestionsCurrentMonth: 0,
      lastUsageResetAt: now,
    },
  });
}

/**
 * Track product usage: increment counters and persist an analytics event.
 * Safe to call from API routes — failures are logged, not thrown to callers.
 */
export async function trackUsage(input: TrackUsageInput): Promise<void> {
  try {
    await ensureMonthlyReset(input.userId);

    const docCount = input.documentCount ?? 0;
    const aiCount =
      input.aiQuestionCount ??
      (input.eventType === USAGE_EVENT_TYPES.ASK_AI ? 1 : 0);

    const userUpdate: {
      documentsProcessedCurrentMonth?: { increment: number };
      aiQuestionsCurrentMonth?: { increment: number };
    } = {};

    if (docCount > 0) {
      userUpdate.documentsProcessedCurrentMonth = { increment: docCount };
    }
    if (aiCount > 0) {
      userUpdate.aiQuestionsCurrentMonth = { increment: aiCount };
    }

    await prisma.usageEvent.create({
      data: {
        userId: input.userId,
        eventType: input.eventType,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    });

    if (Object.keys(userUpdate).length > 0) {
      await prisma.user.update({
        where: { id: input.userId },
        data: userUpdate,
      });
    }
  } catch (error) {
    console.error("[usage] trackUsage failed:", error);
  }
}
