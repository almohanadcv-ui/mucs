import { NextRequest } from "next/server";
import { getServerEnv } from "@/lib/env";
import { safeEqual } from "@/infrastructure/security/crypto";
import { ok, fail, handleApiError } from "@/lib/http";
import { sendEmail } from "@/infrastructure/email/mailer";
import {
  loginCodeEmail,
  probationReminderEmail,
  evaluationResultEmail,
} from "@/infrastructure/email/templates";
import { buildEvaluationPdfBranded } from "@/infrastructure/pdf/evaluation-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Send the three system emails with sample data to a chosen address, so the
 * design (and the attached PDF) can be checked end-to-end without seeding data.
 * Guarded by the same CRON_SECRET as the reminders job.
 *
 *   curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" \
 *     "https://<host>/api/cron/test-email?to=you@example.com"
 */
export async function POST(req: NextRequest) {
  try {
    const secret = getServerEnv().CRON_SECRET;
    if (!secret) return fail("FORBIDDEN", "نقطة النهاية غير مُفعّلة", 403);
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token || !safeEqual(token, secret)) return fail("UNAUTHORIZED", "غير مصرّح", 401);

    const to = req.nextUrl.searchParams.get("to");
    if (!to) return fail("VALIDATION", "أضف ?to=بريدك في الرابط", 422);

    const results: Record<string, boolean> = {};

    const code = loginCodeEmail("123456", "محمد");
    results.loginCode = await sendEmail({ to, subject: code.subject, html: code.html, text: code.text });

    const rem = probationReminderEmail({
      evaluatorName: "محمد",
      employeeName: "موظف تجريبي",
      daysLeft: 45,
      endDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
    });
    results.reminder = await sendEmail({ to, subject: rem.subject, html: rem.html, text: rem.text });

    const reviewedAt = new Date();
    const items = [
      { label: "الالتزام بمواعيد العمل والانضباط", value: "5 / 5", remarks: "ممتاز ومنضبط" },
      { label: "جودة العمل وإتقانه", value: "4 / 5", remarks: null },
      { label: "التعاون مع فريق العمل", value: "نعم", remarks: null },
      { label: "المبادرة وتحمّل المسؤولية", value: "جيد جدًا", remarks: "يبادر بلا توجيه" },
    ];
    const res = evaluationResultEmail({
      employeeName: "موظف تجريبي",
      templateTitle: "نموذج تقييم الأداء الوظيفي",
      score: 85,
      reviewedAt,
      items,
    });
    const pdf = await buildEvaluationPdfBranded({
      employeeName: "موظف تجريبي",
      employeeNo: "TEST-001",
      templateTitle: "نموذج تقييم الأداء الوظيفي",
      evaluatorName: "محمد",
      score: 85,
      reviewedAt,
      items,
    }).catch(() => null);
    results.result = await sendEmail({
      to,
      subject: res.subject,
      html: res.html,
      text: res.text,
      attachments: pdf
        ? [{ filename: "تقييم-تجريبي.pdf", content: pdf, contentType: "application/pdf" }]
        : undefined,
    });
    results.pdfAttached = Boolean(pdf);

    return ok(results);
  } catch (err) {
    return handleApiError(err);
  }
}
