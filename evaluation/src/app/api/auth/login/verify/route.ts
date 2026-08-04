import { NextRequest } from "next/server";
import { completeLoginChallenge } from "@/core/application/auth/auth-service";
import { setAuthCookies } from "@/infrastructure/auth/cookies";
import { rateLimit } from "@/infrastructure/security/rate-limit";
import { requestMeta, ok, handleApiError, fail } from "@/lib/http";

export const runtime = "nodejs";

/** Second step of sign-in: verify the emailed code and mint the session. */
export async function POST(req: NextRequest) {
  const meta = requestMeta(req);
  try {
    // Generous per-IP throttle: an office shares one public IP, so this must not
    // lock out colleagues; a wrong code is already capped per-challenge (5 tries).
    const limit = await rateLimit(`login-verify:${meta.ip ?? "unknown"}`, {
      limit: 40,
      windowMs: 60_000,
    });
    if (!limit.success) {
      return fail("RATE_LIMITED", "محاولات كثيرة، حاول لاحقاً", 429);
    }

    const body = await req.json().catch(() => ({}));
    const { user, tokens } = await completeLoginChallenge(body, meta);
    await setAuthCookies(tokens);
    return ok({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
