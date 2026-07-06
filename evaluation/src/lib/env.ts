import { z } from "zod";

/**
 * Centralized, type-safe environment validation.
 * Fails fast at startup if a required variable is missing or malformed.
 * Never read `process.env` directly elsewhere — import `env` from here.
 */
const serverSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  // Database
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),

  // Auth / crypto secrets (min length enforced for entropy)
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("7d"),

  // Symmetric key for encrypting secrets at rest (2FA seeds, tokens). 32-byte hex/base64.
  ENCRYPTION_KEY: z.string().min(32),

  // App
  APP_URL: z.string().url().default("http://localhost:3000"),
  APP_NAME: z.string().default("EMS"),

  // Security tunables
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  AUTH_MAX_FAILED_ATTEMPTS: z.coerce.number().int().positive().default(5),
  AUTH_LOCKOUT_MINUTES: z.coerce.number().int().positive().default(15),
});

const clientSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().default("EMS"),
});

type ServerEnv = z.infer<typeof serverSchema>;
type ClientEnv = z.infer<typeof clientSchema>;

function formatErrors(error: z.ZodError): string {
  return error.issues
    .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
}

let cachedServerEnv: ServerEnv | null = null;

/** Validated server-only environment. Throws on first access if invalid. */
export function getServerEnv(): ServerEnv {
  if (cachedServerEnv) return cachedServerEnv;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `❌ Invalid server environment variables:\n${formatErrors(parsed.error)}`,
    );
  }
  cachedServerEnv = parsed.data;
  return cachedServerEnv;
}

export const clientEnv: ClientEnv = clientSchema.parse({
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
});

export type { ServerEnv, ClientEnv };
