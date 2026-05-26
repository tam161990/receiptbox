import { NextRequest, NextResponse } from "next/server";
import {
  checkDevLoginPin,
  createAuthenticatedSessionResponse,
} from "@/lib/authLogin";
import {
  parseTelegramLoginBody,
  verifyTelegramLoginPayload,
} from "@/lib/telegramLogin";

export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!botToken) {
    return NextResponse.json(
      { ok: false, error: "Telegram bots nav konfigurēts." },
      { status: 503 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const pinError = checkDevLoginPin(body.pin);
  if (pinError) return pinError;

  const payload = parseTelegramLoginBody(body);
  if (!payload) {
    return NextResponse.json(
      { ok: false, error: "Nederīgi Telegram autorizācijas dati." },
      { status: 400 },
    );
  }

  if (!verifyTelegramLoginPayload(payload, botToken)) {
    return NextResponse.json(
      { ok: false, error: "Telegram autorizācija netika apstiprināta." },
      { status: 401 },
    );
  }

  try {
    return await createAuthenticatedSessionResponse(String(payload.id), {
      telegramUsername: payload.username ?? null,
      firstName: payload.first_name ?? null,
      lastName: payload.last_name ?? null,
    });
  } catch (error) {
    console.error("[auth/telegram] session failed:", error);
    return NextResponse.json(
      { ok: false, error: "Neizdevās izveidot sesiju." },
      { status: 500 },
    );
  }
}
