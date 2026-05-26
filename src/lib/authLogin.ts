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

let cachedBotUsername: string | null | undefined;

/** Bot username without @ for Telegram Login Widget (`data-telegram-login`). */
export async function getTelegramBotUsername(): Promise<string | null> {
  const fromEnv = process.env.TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "");
  if (fromEnv) return fromEnv;

  if (cachedBotUsername !== undefined) return cachedBotUsername;

  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    cachedBotUsername = null;
    return null;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      cache: "no-store",
    });
    const data = (await res.json()) as { ok?: boolean; result?: { username?: string } };
    cachedBotUsername =
      data.ok && data.result?.username ? data.result.username.trim() : null;
  } catch (error) {
    console.error("[auth] getMe for bot username failed:", error);
    cachedBotUsername = null;
  }

  return cachedBotUsername;
}
