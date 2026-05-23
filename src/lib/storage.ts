import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { getUploadsRoot } from "./paths";

function uploadsRootPath(): string {
  return getUploadsRoot();
}

function sanitizeFileName(name: string): string {
  const trimmed = name.trim().slice(-160);
  return trimmed.replace(/[^a-zA-Z0-9._-]/g, "_") || "file";
}

export interface SavedFile {
  storedFilePath: string; // absolute path on disk
  storedFileName: string;
}

export async function saveBufferForUser(
  userId: string,
  originalFileName: string,
  buffer: Buffer,
): Promise<SavedFile> {
  const userDir = path.join(uploadsRootPath(), userId);
  await mkdir(userDir, { recursive: true });
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const safe = sanitizeFileName(originalFileName);
  const storedFileName = `${ts}_${rand}_${safe}`;
  const storedFilePath = path.join(userDir, storedFileName);
  await writeFile(storedFilePath, buffer);
  return { storedFilePath, storedFileName };
}

/** Best-effort delete of a temporarily stored upload (privacy-first pipeline). */
export async function deleteUploadedFile(absPath: string | null | undefined): Promise<boolean> {
  if (!absPath || typeof absPath !== "string") return true;
  try {
    const root = path.resolve(uploadsRootPath());
    const resolved = path.resolve(absPath);
    if (!resolved.startsWith(root + path.sep) && resolved !== root) {
      console.error("[storage] Refusing to delete outside uploads root:", absPath);
      return false;
    }
    const { unlink } = await import("node:fs/promises");
    await unlink(resolved);
    return true;
  } catch (e) {
    console.error("[storage] deleteUploadedFile failed:", absPath, e);
    return false;
  }
}

export function uploadsRoot(): string {
  return uploadsRootPath();
}

/** Remove all temporary uploads for a user (account deletion). */
export async function deleteUserUploadDirectory(userId: string): Promise<void> {
  const userDir = path.join(uploadsRootPath(), userId);
  try {
    await rm(userDir, { recursive: true, force: true });
  } catch (e) {
    console.error("[storage] deleteUserUploadDirectory failed:", userDir, e);
  }
}
