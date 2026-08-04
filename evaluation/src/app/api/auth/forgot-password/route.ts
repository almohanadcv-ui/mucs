import { NextRequest } from "next/server";
import { requestPasswordReset } from "@/core/application/auth/password-reset-service";
import { forgotPasswordSchema } from "@/core/application/auth/dto";
import { rateLimit } from "@/infrastructure/security/rate-limit";
import { requestMeta, ok, fail, handleApiError } from "@/lib/http";

export const runtime = "nodejs";

/**
 * Start a password reset. Always answers 200 with the same body whether or not
 * the email exists — revealing that would enumerate accounts.
 */
export async function POST(req: NextRequest) {
  const meta = requestMeta(req);
  try {
    const limit = await rateLimit(`forgot:${meta.ip ?? "unknown"}`, { limit: 5, windowMs: 60_000 });
    if (!limit.success) return fail("RATE_LIMITED", "محاولات كثيرة، حاول لاحقاً", 429);

    const body = await req.json().catch(() => ({}));
    const parsed = forgotPasswordSchema.safeParse(body);
    // Even on a malformed email we answer success-shaped, to stay uniform.
    if (parsed.success) await requestPasswordReset(parsed.data.email, meta);
    return ok({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
