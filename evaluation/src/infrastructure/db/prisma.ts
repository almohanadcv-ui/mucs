import { PrismaClient } from "@prisma/client";

/**
 * Prisma singleton — one client per process.
 * In dev, HMR would otherwise create a new client on every reload and exhaust
 * the connection pool, so we cache it on globalThis.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
