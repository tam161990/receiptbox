#!/usr/bin/env node
/**
 * Upload PWA app icon as Telegram bot profile photo.
 * Requires TELEGRAM_BOT_TOKEN in .env or environment.
 *
 * Usage: npm run telegram:set-photo
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const photoPath = join(root, "public/icons/telegram-bot-photo.png");

function loadEnvToken() {
  const fromEnv = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (fromEnv) return fromEnv;

  const envPath = join(root, ".env");
  if (!existsSync(envPath)) return null;
  const match = readFileSync(envPath, "utf8").match(/^TELEGRAM_BOT_TOKEN=(.+)$/m);
  return match?.[1]?.trim().replace(/^["']|["']$/g, "") ?? null;
}

async function setBotProfilePhoto(token, pngBuffer) {
  const attachName = "receiptbox.jpg";
  const form = new FormData();
  form.append(
    "photo",
    JSON.stringify({
      type: "static",
      photo: `attach://${attachName}`,
    }),
  );
  form.append(attachName, new Blob([pngBuffer], { type: "image/jpeg" }), attachName);

  const res = await fetch(`https://api.telegram.org/bot${token}/setMyProfilePhoto`, {
    method: "POST",
    body: form,
  });
  const data = await res.json();
  if (!data.ok) {
    throw new Error(data.description || "setMyProfilePhoto failed");
  }
  return data.result;
}

async function setBotDescription(token) {
  const description =
    "ReceiptBox LV — sūti čekus un rēķinus, sagatavo izdevumus deklarācijai. Vienkāršāk nekā PDF medības.";
  const res = await fetch(`https://api.telegram.org/bot${token}/setMyDescription`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description }),
  });
  const data = await res.json();
  if (!data.ok) {
    console.warn("setMyDescription:", data.description || "failed");
    return;
  }
  console.log("Bot description updated.");
}

async function setBotShortDescription(token) {
  const shortDescription = "Čeki, rēķini un izdevumi deklarācijai — vienkārši.";
  const res = await fetch(`https://api.telegram.org/bot${token}/setMyShortDescription`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ short_description: shortDescription }),
  });
  const data = await res.json();
  if (!data.ok) {
    console.warn("setMyShortDescription:", data.description || "failed");
    return;
  }
  console.log("Bot short description updated.");
}

async function main() {
  if (!existsSync(photoPath)) {
    console.error("Missing public/icons/telegram-bot-photo.png — run: npm run icons:generate");
    process.exit(1);
  }

  const token = loadEnvToken();
  if (!token) {
    console.error("TELEGRAM_BOT_TOKEN not found in environment or .env");
    process.exit(1);
  }

  const pngBuffer = readFileSync(photoPath);
  console.log(`Uploading ${photoPath} (${pngBuffer.length} bytes) as bot profile photo…`);

  await setBotProfilePhoto(token, pngBuffer);
  console.log("Bot profile photo updated.");

  await setBotDescription(token);
  await setBotShortDescription(token);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
