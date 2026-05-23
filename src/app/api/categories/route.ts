import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import {
  DEDUCTIBLE_STATUSES,
  EXPENSE_CATEGORIES,
  type DeductibleStatus,
  type ExpenseCategory,
} from "@/lib/enums";
import { serializeUserCategory } from "@/lib/categories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  parentCategory: z
    .string()
    .refine((v) => (EXPENSE_CATEGORIES as readonly string[]).includes(v), {
      message: "invalid_parent",
    }),
  name: z.string().min(1).max(80).transform((v) => v.trim()),
  deductibleStatus: z
    .string()
    .nullable()
    .optional()
    .transform((v) => {
      if (v === undefined || v === null || v === "") return null;
      return (DEDUCTIBLE_STATUSES as readonly string[]).includes(v) ? v : null;
    }),
  deductiblePercent: z
    .union([z.number(), z.string(), z.null()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === null || v === "") return null;
      const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
      if (!Number.isFinite(n)) return null;
      return Math.max(0, Math.min(100, Math.round(n)));
    }),
  sortOrder: z.number().int().optional(),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const rows = await prisma.userCategory.findMany({
    where: { userId: user.id },
    orderBy: [{ parentCategory: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({
    ok: true,
    categories: rows.map(serializeUserCategory),
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
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
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Nederīgi dati", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const d = parsed.data;
  try {
    const created = await prisma.userCategory.create({
      data: {
        userId: user.id,
        parentCategory: d.parentCategory as ExpenseCategory,
        name: d.name,
        deductibleStatus: (d.deductibleStatus ?? null) as DeductibleStatus | null,
        deductiblePercent: d.deductiblePercent ?? null,
        sortOrder: d.sortOrder ?? 0,
      },
    });
    return NextResponse.json({ ok: true, category: serializeUserCategory(created) });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002") {
      return NextResponse.json(
        { ok: false, error: "Tāds nosaukums šajā kategorijā jau eksistē." },
        { status: 409 },
      );
    }
    throw err;
  }
}
