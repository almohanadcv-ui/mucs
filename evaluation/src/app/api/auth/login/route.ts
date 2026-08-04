import { NextRequest } from "next/server";
import { login } from "@/core/application/auth/auth-service";
import { rateLimit } from "@/infrastructure/security/rate-limit";
import { requestMeta, ok, handleApiError, fail } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const meta = requestMeta(req);
  try {
    // Per-IP throttle to blunt automated credential stuffing. Kept generous —
    // a whole office shares one public IP (NAT), so a low cap would lock out
    // legitimate colleagues; per-account lockout (5 fails) is the real defence.
    const limit = await rateLimit(`login:${meta.ip ?? "unknown"}`, {
      limit: 40,
      windowMs: 60_000,
    });
    if (!limit.success) {
      return fail("RATE_LIMITED", "محاولات كثيرة، حاول لاحقاً", 429);
    }

    const body = await req.json().catch(() => ({}));
    // Password verified → a six-digit code is emailed. No session yet; the
    // client must post the code to /api/auth/login/verify to finish.
    const { challengeId } = await login(body, meta);
    return ok({ challengeRequired: true, challengeId });
  } catch (err) {
    return handleApiError(err);
  }
}
