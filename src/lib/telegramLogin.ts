import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** Payload returned by Telegram Login Widget (https://core.telegram.org/widgets/login). */
export interface TelegramLoginPayload {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

const CHECK_FIELD_KEYS = [
  "auth_date",
  "first_name",
  "id",
  "last_name",
  "photo_url",
  "username",
] as const;

function buildDataCheckString(data: TelegramLoginPayload): string {
  const pairs: string[] = [];
  for (const key of CHECK_FIELD_KEYS) {
    const value = data[key];
    if (value === undefined || value === null || value === "") continue;
    pairs.push(`${key}=${value}`);
  }
  return pairs.sort().join("\n");
}

/** Verifies Telegram Login Widget `hash` per official algorithm. */
export function verifyTelegramLoginPayload(
  data: TelegramLoginPayload,
  botToken: string,
  maxAgeSeconds = 86_400,
): boolean {
  if (!botToken || !data.hash || !data.id || !data.auth_date) return false;

  const now = Math.floor(Date.now() / 1000);
  if (data.auth_date > now + 60 || now - data.auth_date > maxAgeSeconds) {
    return false;
  }

  const secretKey = createHash("sha256").update(botToken).digest();
  const expected = createHmac("sha256", secretKey)
    .update(buildDataCheckString(data))
    .digest("hex");

  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(data.hash, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function parseTelegramLoginBody(
  body: Record<string, unknown>,
): TelegramLoginPayload | null {
  const id = typeof body.id === "number" ? body.id : Number(body.id);
  const auth_date =
    typeof body.auth_date === "number" ? body.auth_date : Number(body.auth_date);
  const hash = typeof body.hash === "string" ? body.hash.trim() : "";

  if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(auth_date) || !hash) {
    return null;
  }

  return {
    id: Math.trunc(id),
    auth_date: Math.trunc(auth_date),
    hash,
    ...(typeof body.first_name === "string" ? { first_name: body.first_name } : {}),
    ...(typeof body.last_name === "string" ? { last_name: body.last_name } : {}),
    ...(typeof body.username === "string" ? { username: body.username } : {}),
    ...(typeof body.photo_url === "string" ? { photo_url: body.photo_url } : {}),
  };
}
