import { PrismaClient } from "@prisma/client";

/**
 * Connections to keep open to the database.
 *
 * Prisma defaults to `cores * 2 + 1`. That is a reasonable rule for a database
 * on the same machine and a poor one here: the pool we need is sized by how
 * many queries a page fires at once, not by the web server's core count. The
 * dashboard alone issues eleven concurrently, so on a 2-core VPS (default: 5)
 * they queue in waves — each wave paying a full round trip to a database in
 * another region, and requests stalling whenever the pool is contended.
 *
 * Override with DATABASE_CONNECTION_LIMIT; an explicit connection_limit in
 * DATABASE_URL always wins over both.
 */
const DEFAULT_CONNECTION_LIMIT = 15;

/** Seconds to wait for a free connection before failing rather than hanging. */
const DEFAULT_POOL_TIMEOUT = 20;

/**
 * Size the pool by what the app does instead of the host's core count. Only
 * fills in what the URL does not already specify, so ops keeps the last word.
 */
function buildDatasourceUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (!url.searchParams.has("connection_limit")) {
      const configured = Number(process.env.DATABASE_CONNECTION_LIMIT);
      url.searchParams.set(
        "connection_limit",
        String(
          Number.isFinite(configured) && configured > 0
            ? configured
            : DEFAULT_CONNECTION_LIMIT,
        ),
      );
    }
    if (!url.searchParams.has("pool_timeout")) {
      url.searchParams.set("pool_timeout", String(DEFAULT_POOL_TIMEOUT));
    }
    return url.toString();
  } catch {
    // Not a parseable URL — hand it over untouched and let Prisma report it.
    return raw;
  }
}

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
    datasourceUrl: buildDatasourceUrl(),
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
