import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import {
  EXPENSE_CATEGORIES,
  isExpenseCategory,
  isDocumentRetrievalLocation,
  normalizeRetrievalLocation,
  type DocumentRetrievalLocation,
  type ExpenseCategory,
} from "@/lib/enums";
import { parseCategoryLabels } from "@/lib/categories";
import { parseMyIdentifiers, serializeMyIdentifiers } from "@/lib/lineItems";
import {
  parseCategoryRetrievalDefaults,
  serializeCategoryRetrievalDefaults,
} from "@/lib/categoryRetrievalDefaults";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const optionalString = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) =>
    v === undefined ? undefined : v === null ? null : v.trim().slice(0, 1000) || null,
  );

const optionalPercent = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((v) => {
    if (v === undefined) return undefined;
    if (v === null || v === "") return null;
    const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.min(100, Math.round(n)));
  });

const profileSchema = z.object({
  selfEmployedType: optionalString,
  workFromHomePercent: optionalPercent,
  mainActivityDescription: optionalString,
  categoryDefaults: z.record(z.string(), z.number().min(0).max(100)).optional().nullable(),
  categoryRetrievalDefaults: z.record(z.string(), z.string()).optional().nullable(),
  categoryLabels: z.record(z.string(), z.string()).optional().nullable(),
  myIdentifiers: z.array(z.string()).optional().nullable(),
});

function serializeProfile(u: {
  telegramUserId: string;
  telegramUsername: string | null;
  firstName: string | null;
  lastName: string | null;
  selfEmployedType: string | null;
  workFromHomePercent: number | null;
  mainActivityDescription: string | null;
  categoryDefaultsJson: string | null;
  categoryRetrievalDefaultsJson: string | null;
  categoryLabelsJson: string | null;
  myIdentifiersJson: string | null;
}) {
  let categoryDefaults: Record<string, number> = {};
  if (u.categoryDefaultsJson) {
    try {
      const parsed = JSON.parse(u.categoryDefaultsJson) as unknown;
      if (parsed && typeof parsed === "object") {
        for (const [k, v] of Object.entries(parsed)) {
          if (isExpenseCategory(k) && typeof v === "number") categoryDefaults[k] = v;
        }
      }
    } catch {
      categoryDefaults = {};
    }
  }
  const categoryLabels = parseCategoryLabels(u.categoryLabelsJson);
  const myIdentifiers = parseMyIdentifiers(u.myIdentifiersJson);
  const categoryRetrievalDefaults = parseCategoryRetrievalDefaults(u.categoryRetrievalDefaultsJson);
  return {
    telegramUserId: u.telegramUserId,
    telegramUsername: u.telegramUsername,
    firstName: u.firstName,
    lastName: u.lastName,
    selfEmployedType: u.selfEmployedType,
    workFromHomePercent: u.workFromHomePercent,
    mainActivityDescription: u.mainActivityDescription,
    categoryDefaults,
    categoryRetrievalDefaults,
    categoryLabels,
    myIdentifiers,
  };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const fresh = await prisma.user.findUnique({ where: { id: user.id } });
  if (!fresh) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, profile: serializeProfile(fresh) });
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Nederīgi dati", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const d = parsed.data;
  const data: Record<string, unknown> = {};
  if (d.selfEmployedType !== undefined) data.selfEmployedType = d.selfEmployedType;
  if (d.workFromHomePercent !== undefined) data.workFromHomePercent = d.workFromHomePercent;
  if (d.mainActivityDescription !== undefined) data.mainActivityDescription = d.mainActivityDescription;
  if (d.categoryDefaults !== undefined) {
    if (d.categoryDefaults === null) {
      data.categoryDefaultsJson = null;
    } else {
      const clean: Record<string, number> = {};
      for (const [k, v] of Object.entries(d.categoryDefaults)) {
        if (EXPENSE_CATEGORIES.includes(k as (typeof EXPENSE_CATEGORIES)[number])) {
          clean[k] = Math.max(0, Math.min(100, Math.round(v)));
        }
      }
      data.categoryDefaultsJson = Object.keys(clean).length > 0 ? JSON.stringify(clean) : null;
    }
  }
  if (d.categoryRetrievalDefaults !== undefined) {
    if (d.categoryRetrievalDefaults === null) {
      data.categoryRetrievalDefaultsJson = null;
    } else {
      const merged: Partial<Record<ExpenseCategory, DocumentRetrievalLocation>> = {};
      for (const [k, v] of Object.entries(d.categoryRetrievalDefaults)) {
        if (!isExpenseCategory(k) || k === "unknown") continue;
        if (typeof v !== "string") continue;
        const loc = normalizeRetrievalLocation(v);
        if (!loc || loc === "other") continue;
        merged[k] = loc;
      }
      data.categoryRetrievalDefaultsJson = serializeCategoryRetrievalDefaults(merged);
    }
  }
  if (d.categoryLabels !== undefined) {
    if (d.categoryLabels === null) {
      data.categoryLabelsJson = null;
    } else {
      const clean: Record<string, string> = {};
      for (const [k, v] of Object.entries(d.categoryLabels)) {
        if (
          EXPENSE_CATEGORIES.includes(k as (typeof EXPENSE_CATEGORIES)[number]) &&
          typeof v === "string"
        ) {
          const trimmed = v.trim().slice(0, 80);
          if (trimmed.length > 0) clean[k] = trimmed;
        }
      }
      data.categoryLabelsJson = Object.keys(clean).length > 0 ? JSON.stringify(clean) : null;
    }
  }
  if (d.myIdentifiers !== undefined) {
    if (d.myIdentifiers === null) {
      data.myIdentifiersJson = null;
    } else {
      data.myIdentifiersJson = serializeMyIdentifiers(d.myIdentifiers);
    }
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data,
  });

  return NextResponse.json({ ok: true, profile: serializeProfile(updated) });
}
