import { NextRequest } from "next/server";
import { runIdleEvaluationReminders } from "@/core/application/reminders/idle-evaluation-service";
import { getServerEnv } from "@/lib/env";
import { ok, fail, handleApiError } from "@/lib/http";
import { safeEqual } from "@/infrastructure/security/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily job: warn employees who opened their evaluation but took no action, and
 * tell their manager + HR. Triggered by the system cron with the shared bearer
 * secret (no user session), e.g.:
 *   0 8 * * *  curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
 *              https://<host>/api/cron/evaluation-idle
 */
export async function POST(req: NextRequest) {
  try {
    const secret = getServerEnv().CRON_SECRET;
    if (!secret) return fail("FORBIDDEN", "نقطة النهاية غير مُفعّلة", 403);
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token || !safeEqual(token, secret)) return fail("UNAUTHORIZED", "غير مصرّح", 401);

    const result = await runIdleEvaluationReminders();
    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}
