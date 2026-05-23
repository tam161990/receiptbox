import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { DEDUCTIBLE_STATUSES, type DeductibleStatus } from "@/lib/enums";
import { serializeUserCategory } from "@/lib/categories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(80)
    .optional()
    .transform((v) => (v === undefined ? undefined : v.trim())),
  deductibleStatus: z
    .string()
    .nullable()
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      if (v === null || v === "") return null;
      return (DEDUCTIBLE_STATUSES as readonly string[]).includes(v) ? v : null;
    }),
  deductiblePercent: z
    .union([z.number(), z.string(), z.null()])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      if (v === null || v === "") return null;
      const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
      if (!Number.isFinite(n)) return null;
      return Math.max(0, Math.min(100, Math.round(n)));
    }),
  sortOrder: z.number().int().optional(),
});

interface RouteContext {
  params: { id: string };
}

export async function PATCH(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const existing = await prisma.userCategory.findUnique({ where: { id: ctx.params.id } });
  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Nederīgi dati", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const d = parsed.data;
  const data: Record<string, unknown> = {};
  if (d.name !== undefined) data.name = d.name;
  if (d.deductibleStatus !== undefined) {
    data.deductibleStatus = d.deductibleStatus as DeductibleStatus | null;
  }
  if (d.deductiblePercent !== undefined) data.deductiblePercent = d.deductiblePercent;
  if (d.sortOrder !== undefined) data.sortOrder = d.sortOrder;

  try {
    const updated = await prisma.userCategory.update({
      where: { id: existing.id },
      data,
    });
    return NextResponse.json({ ok: true, category: serializeUserCategory(updated) });
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

export async function DELETE(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const existing = await prisma.userCategory.findUnique({ where: { id: ctx.params.id } });
  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  await prisma.userCategory.delete({ where: { id: existing.id } });
  return NextResponse.json({ ok: true });
}
