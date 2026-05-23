import { NextRequest, NextResponse } from "next/server";
import { upsertUserByTelegramId } from "@/lib/founders";
import { SESSION_COOKIE_NAME } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { telegramUserId?: unknown; pin?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const rawId = body.telegramUserId;
  const telegramUserId =
    typeof rawId === "string" || typeof rawId === "number"
      ? String(rawId).trim()
      : "";

  if (!telegramUserId || !/^\d{3,20}$/.test(telegramUserId)) {
    return NextResponse.json(
      { ok: false, error: "Lūdzu, ievadi derīgu Telegram lietotāja ID (tikai cipari)." },
      { status: 400 },
    );
  }

  const requiredPin = process.env.DEV_LOGIN_PIN;
  if (requiredPin && requiredPin.length > 0) {
    const pin = typeof body.pin === "string" ? body.pin.trim() : "";
    if (pin !== requiredPin) {
      return NextResponse.json(
        { ok: false, error: "Nepareizs PIN kods." },
        { status: 401 },
      );
    }
  }

  const user = await upsertUserByTelegramId(telegramUserId);

  const res = NextResponse.json({
    ok: true,
    isFoundingUser: user.isFoundingUser,
    planType: user.planType,
  });
  res.cookies.set(SESSION_COOKIE_NAME, telegramUserId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
