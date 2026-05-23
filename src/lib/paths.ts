import path from "node:path";

/**
 * Persistent data directory.
 * Local dev: defaults to process.cwd().
 * Railway: set DATA_DIR=/data and mount a volume at /data.
 */
export function getDataDir(): string {
  const dir = process.env.DATA_DIR?.trim();
  return dir && dir.length > 0 ? dir : process.cwd();
}

/** Temporary upload files (deleted after processing). */
export function getUploadsRoot(): string {
  if (process.env.DATA_DIR?.trim()) {
    return path.join(getDataDir(), "uploads");
  }
  return path.join(process.cwd(), "storage", "uploads");
}
