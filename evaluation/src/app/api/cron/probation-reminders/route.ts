import { NextRequest } from "next/server";
import { runProbationReminders } from "@/core/application/reminders/probation-reminder-service";
import { getServerEnv } from "@/lib/env";
import { ok, fail, handleApiError } from "@/lib/http";
import { safeEqual } from "@/infrastructure/security/crypto";

export const runtime = "nodejs";
// Never cache: this performs writes and must run on every trigger.
export const dynamic = "force-dynamic";

/**
 * Daily job: email evaluators about employees whose probation ends within 90
 * days. Triggered by the system cron with a shared bearer secret — there is no
 * user session here — e.g.:
 *   0 7 * * *  curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
 *              https://<host>/api/cron/probation-reminders
 */
export async function POST(req: NextRequest) {
  try {
    const secret = getServerEnv().CRON_SECRET;
    if (!secret) {
      // Fail closed: without a configured secret the endpoint stays disabled
      // rather than runnable by anyone.
      return fail("FORBIDDEN", "نقطة النهاية غير مُفعّلة", 403);
    }
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token || !safeEqual(token, secret)) {
      return fail("UNAUTHORIZED", "غير مصرّح", 401);
    }

    const result = await runProbationReminders();
    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}
