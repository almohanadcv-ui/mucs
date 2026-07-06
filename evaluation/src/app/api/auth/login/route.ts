import { NextRequest } from "next/server";
import { login } from "@/core/application/auth/auth-service";
import { setAuthCookies } from "@/infrastructure/auth/cookies";
import { rateLimit } from "@/infrastructure/security/rate-limit";
import { requestMeta, ok, handleApiError, fail } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const meta = requestMeta(req);
  try {
    // Stricter limit on auth endpoints to blunt brute-force / credential stuffing.
    const limit = await rateLimit(`login:${meta.ip ?? "unknown"}`, {
      limit: 10,
      windowMs: 60_000,
    });
    if (!limit.success) {
      return fail("RATE_LIMITED", "محاولات كثيرة، حاول لاحقاً", 429);
    }

    const body = await req.json().catch(() => ({}));
    const { user, tokens } = await login(body, meta);
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
