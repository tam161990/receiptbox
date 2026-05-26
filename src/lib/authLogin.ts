import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "./auth";
import { upsertUserByTelegramId, type TelegramUserProfile } from "./founders";

export function checkDevLoginPin(pin: unknown): NextResponse | null {
  const requiredPin = process.env.DEV_LOGIN_PIN?.trim();
  if (!requiredPin) return null;

  const submitted = typeof pin === "string" ? pin.trim() : "";
  if (submitted !== requiredPin) {
    return NextResponse.json(
      { ok: false, error: "Nepareizs PIN kods." },
      { status: 401 },
    );
  }
  return null;
}

export async function createAuthenticatedSessionResponse(
  telegramUserId: string,
  profile?: TelegramUserProfile,
): Promise<NextResponse> {
  const user = await upsertUserByTelegramId(telegramUserId, profile);

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

/** Bot username without @ for Telegram Login Widget (`data-telegram-login`). */
export function getTelegramBotUsername(): string | null {
  const raw = process.env.TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "");
  return raw || null;
}
