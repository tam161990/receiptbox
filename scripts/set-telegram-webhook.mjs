#!/usr/bin/env node
/**
 * Register Telegram webhook for production (or local tunnel URL from .env).
 *
 * Usage: npm run telegram:set-webhook
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv(name) {
  const fromEnv = process.env[name]?.trim();
  if (fromEnv) return fromEnv.replace(/^["']|["']$/g, "");

  const envPath = join(root, ".env");
  if (!existsSync(envPath)) return null;
  const match = readFileSync(envPath, "utf8").match(new RegExp(`^${name}=(.+)$`, "m"));
  return match?.[1]?.trim().replace(/^["']|["']$/g, "") ?? null;
}

async function main() {
  const token = loadEnv("TELEGRAM_BOT_TOKEN");
  const secret = loadEnv("TELEGRAM_WEBHOOK_SECRET");
  const appUrl = (loadEnv("APP_URL") ?? "https://receiptbox.online").replace(/\/$/, "");

  if (!token) {
    console.error("ERROR: TELEGRAM_BOT_TOKEN nav .env");
    process.exit(1);
  }
  if (!secret) {
    console.error("ERROR: TELEGRAM_WEBHOOK_SECRET nav .env");
    process.exit(1);
  }

  const webhookUrl = `${appUrl}/api/telegram/webhook`;
  console.log(`Reģistrējam webhook: ${webhookUrl}`);

  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: secret,
      allowed_updates: ["message", "edited_message", "callback_query"],
    }),
  });

  const data = await res.json();
  if (!data.ok) {
    console.error("Telegram atteica:", data);
    process.exit(1);
  }

  console.log("✓ Webhook iestatīts");

  const commandsRes = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      commands: [
        { command: "start", description: "Sākt darbu" },
        { command: "help", description: "Palīdzība" },
        { command: "id", description: "Mans Telegram ID" },
      ],
    }),
  });
  const commandsData = await commandsRes.json();
  if (commandsData.ok) {
    console.log("✓ Bot komandas (/start, /help, /id)");
  } else {
    console.warn("setMyCommands:", commandsData.description || commandsData);
  }

  const infoRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
  const info = await infoRes.json();
  if (info.ok) {
    console.log("Pašreizējais webhook:", info.result.url || "(nav)");
    if (info.result.last_error_message) {
      console.warn("Pēdējā kļūda:", info.result.last_error_message);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
