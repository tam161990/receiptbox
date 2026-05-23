/**
 * Dzēš failus mapē storage/uploads, uz kuriem neviena Document rinda vairs
 * neatreferējas (storedFilePath nav DB vai norāda uz citu ceļu).
 *
 * Palaid no projekta saknes:
 *   npm run storage:cleanup-orphans
 *   npm run storage:cleanup-orphans:dry
 *
 * DATABASE_URL tiek nolasīts no .env, ja nav iestatīts vidē.
 */

import { PrismaClient } from "@prisma/client";
import { readdir, unlink, rmdir } from "node:fs/promises";
import path from "node:path";
import { readFileSync } from "node:fs";

function loadDatabaseUrlFromEnvFile() {
  if (process.env.DATABASE_URL) return;
  const envPath = path.join(process.cwd(), ".env");
  try {
    const txt = readFileSync(envPath, "utf8");
    for (const line of txt.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (key === "DATABASE_URL") process.env.DATABASE_URL = val;
    }
  } catch {
    // ignore
  }
}

const UPLOADS_ROOT = path.resolve(process.cwd(), "storage", "uploads");

async function collectFilesRecursive(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await collectFilesRecursive(full)));
    } else if (e.isFile()) {
      out.push(full);
    }
  }
  return out;
}

async function pruneEmptyDirs(dir) {
  const resolved = path.resolve(dir);
  const root = path.resolve(UPLOADS_ROOT);
  if (!resolved.startsWith(root)) return;

  let entries;
  try {
    entries = await readdir(resolved, { withFileTypes: true });
  } catch {
    return;
  }

  for (const e of entries) {
    if (e.isDirectory()) {
      await pruneEmptyDirs(path.join(resolved, e.name));
    }
  }

  if (resolved === root) return;

  try {
    const names = await readdir(resolved);
    if (names.length === 0) await rmdir(resolved);
  } catch {
    // ignore
  }
}

function assertInsideUploadsRoot(absPath) {
  const root = path.resolve(UPLOADS_ROOT);
  const p = path.resolve(absPath);
  return p === root || p.startsWith(root + path.sep);
}

async function main() {
  loadDatabaseUrlFromEnvFile();
  const dryRun = process.argv.includes("--dry-run");

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL nav atrasts (.env vai vide).");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const docs = await prisma.document.findMany({
      where: { storedFilePath: { not: null } },
      select: { storedFilePath: true },
    });

    const referenced = new Set(docs.map((d) => path.resolve(d.storedFilePath)));

    const files = await collectFilesRecursive(UPLOADS_ROOT);

    let deleted = 0;
    let skipped = 0;

    for (const filePath of files) {
      const abs = path.resolve(filePath);
      if (!assertInsideUploadsRoot(abs)) {
        skipped++;
        continue;
      }
      const base = path.basename(abs);
      if (base.startsWith(".")) {
        skipped++;
        continue;
      }
      if (referenced.has(abs)) continue;

      if (dryRun) {
        console.log(`[dry-run] dzēstu: ${abs}`);
        deleted++;
      } else {
        await unlink(abs);
        console.log(`dzēsts: ${abs}`);
        deleted++;
      }
    }

    if (!dryRun && deleted > 0) {
      await pruneEmptyDirs(UPLOADS_ROOT);
    }

    console.log(
      dryRun
        ? `\nSimulācija: ${deleted} faili būtu dzēsti (nav dokumenta lauka storedFilePath).${skipped ? ` Drošības izlaisti: ${skipped}.` : ""}`
        : `\nGatavs: dzēsti ${deleted} faili bez DB atsauce.${skipped ? ` Drošības izlaisti: ${skipped}.` : ""}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
