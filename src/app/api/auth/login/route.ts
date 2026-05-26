import { NextRequest, NextResponse } from "next/server";
import {
  checkDevLoginPin,
  createAuthenticatedSessionResponse,
} from "@/lib/authLogin";

export const runtime = "nodejs";

/** Fallback login by numeric Telegram ID (dev / if widget unavailable). */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { telegramUserId?: unknown; pin?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const pinError = checkDevLoginPin(body.pin);
  if (pinError) return pinError;

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

  try {
    return await createAuthenticatedSessionResponse(telegramUserId);
  } catch (error) {
    console.error("[auth/login] session failed:", error);
    return NextResponse.json(
      { ok: false, error: "Neizdevās pieslēgties." },
      { status: 500 },
    );
  }
}
