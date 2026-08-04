import { NextRequest } from "next/server";
import { resetPassword } from "@/core/application/auth/password-reset-service";
import { resetPasswordSchema } from "@/core/application/auth/dto";
import { rateLimit } from "@/infrastructure/security/rate-limit";
import { requestMeta, ok, fail, handleApiError } from "@/lib/http";
import { AppError } from "@/core/application/errors";

export const runtime = "nodejs";

/** Complete a password reset from the emailed link. */
export async function POST(req: NextRequest) {
  const meta = requestMeta(req);
  try {
    const limit = await rateLimit(`reset:${meta.ip ?? "unknown"}`, { limit: 10, windowMs: 60_000 });
    if (!limit.success) return fail("RATE_LIMITED", "محاولات كثيرة، حاول لاحقاً", 429);

    const body = await req.json().catch(() => ({}));
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      throw AppError.validation("بيانات غير صالحة", parsed.error.flatten());
    }
    await resetPassword(parsed.data.token, parsed.data.password);
    return ok({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
