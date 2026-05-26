import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

// Reuse one client per process (avoids SQLite lock errors on Railway).
globalForPrisma.prisma = prisma;

/** Verifies DB read/write against the User table (not just SELECT 1). */
export async function isDatabaseReachable(): Promise<boolean> {
  try {
    await prisma.user.count();
    return true;
  } catch (error) {
    console.error("[prisma] database unreachable:", error);
    return false;
  }
}
