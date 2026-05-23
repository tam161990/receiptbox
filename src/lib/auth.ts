import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { upsertUserByTelegramId } from "./founders";

const COOKIE_NAME = "rblv_tg_uid";

export interface SessionUser {
  id: string;
  telegramUserId: string;
  telegramUsername: string | null;
  firstName: string | null;
  lastName: string | null;
}

function readCookieFromHeaders(): string | null {
  try {
    const store = cookies();
    return store.get(COOKIE_NAME)?.value ?? null;
  } catch {
    return null;
  }
}

function readCookieFromRequest(req: NextRequest): string | null {
  return req.cookies.get(COOKIE_NAME)?.value ?? null;
}

async function loadUser(telegramUserId: string): Promise<SessionUser | null> {
  if (!telegramUserId) return null;
  const user = await upsertUserByTelegramId(telegramUserId);
  return {
    id: user.id,
    telegramUserId: user.telegramUserId,
    telegramUsername: user.telegramUsername,
    firstName: user.firstName,
    lastName: user.lastName,
  };
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const id = readCookieFromHeaders();
  if (!id) return null;
  return loadUser(id);
}

export async function requireSessionUser(): Promise<SessionUser | null> {
  return getSessionUser();
}

export async function getUserFromRequest(req: NextRequest): Promise<SessionUser | null> {
  const id = readCookieFromRequest(req);
  if (!id) return null;
  return loadUser(id);
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
