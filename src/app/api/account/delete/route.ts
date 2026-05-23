import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest, SESSION_COOKIE_NAME } from "@/lib/auth";
import { deleteUserUploadDirectory } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  confirm: z.literal("DZĒST_VISUS_MANUS_DATUS"),
});

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

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Apstiprinājuma teksts nav pareizs. Norādi tieši: DZĒST_VISUS_MANUS_DATUS",
      },
      { status: 400 },
    );
  }

  await deleteUserUploadDirectory(user.id);
  await prisma.user.delete({ where: { id: user.id } });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, "", {
    path: "/",
    maxAge: 0,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
