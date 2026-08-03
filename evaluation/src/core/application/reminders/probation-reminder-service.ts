import { prisma } from "@/infrastructure/db/prisma";
import { notify } from "@/core/application/notifications/notification-service";
import { NotificationType } from "@/core/domain/enums";
import { sendEmail } from "@/infrastructure/email/mailer";
import { probationReminderEmail } from "@/infrastructure/email/templates";

/** Remind an evaluator this many days before probation ends, at the latest. */
const WINDOW_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ReminderRunResult {
  /** Employees found inside the window that still needed a reminder. */
  candidates: number;
  /** Reminders actually recorded (in-app notification written). */
  notified: number;
  /** Of those, how many also went out by email. */
  emailed: number;
}

/**
 * Notify evaluators of employees whose probation ends within the next 90 days.
 *
 * Runs once per employee: `probationReminderSentAt` is stamped on success so a
 * daily trigger doesn't re-send every day inside the window. Global across
 * tenants — the caller is a cron job, not a signed-in user — so each
 * notification carries the employee's own tenantId.
 */
export async function runProbationReminders(now = new Date()): Promise<ReminderRunResult> {
  const windowEnd = new Date(now.getTime() + WINDOW_DAYS * DAY_MS);

  const employees = await prisma.employee.findMany({
    where: {
      deletedAt: null,
      status: "ACTIVE",
      evaluatorId: { not: null },
      probationReminderSentAt: null,
      probationEndDate: { gte: now, lte: windowEnd },
    },
    select: {
      id: true,
      name: true,
      tenantId: true,
      probationEndDate: true,
      evaluator: { select: { id: true, name: true, email: true, isActive: true, deletedAt: true } },
    },
  });

  let notified = 0;
  let emailed = 0;

  for (const emp of employees) {
    const evaluator = emp.evaluator;
    // evaluatorId was filtered non-null, but the account may since be gone.
    if (!evaluator || evaluator.deletedAt || !evaluator.isActive) continue;
    if (!emp.probationEndDate) continue;

    const daysLeft = Math.max(0, Math.ceil((emp.probationEndDate.getTime() - now.getTime()) / DAY_MS));

    // In-app notification first — it's the durable record and never fails on a
    // mail-provider hiccup.
    await notify({
      tenantId: emp.tenantId,
      userId: evaluator.id,
      type: NotificationType.REMINDER,
      title: "تذكير بتقييم قبل انتهاء التجربة",
      body: `تبقّى ${daysLeft} يومًا على انتهاء تجربة ${emp.name}. الرجاء تقييمه.`,
      data: { employeeId: emp.id, daysLeft },
      i18n: {
        titleKey: "notif.probationReminderTitle",
        bodyKey: "notif.probationReminderBody",
        params: { name: emp.name, days: daysLeft },
      },
    });
    notified += 1;

    if (evaluator.email) {
      const mail = probationReminderEmail({
        evaluatorName: evaluator.name,
        employeeName: emp.name,
        daysLeft,
        endDate: emp.probationEndDate,
      });
      try {
        const sent = await sendEmail({ to: evaluator.email, subject: mail.subject, html: mail.html, text: mail.text });
        if (sent) emailed += 1;
      } catch (err) {
        // A failed email must not stop the run or block the stamp below — the
        // evaluator still has the in-app notification.
        console.error(`[reminders] email to ${evaluator.email} failed:`, err);
      }
    }

    await prisma.employee.update({
      where: { id: emp.id },
      data: { probationReminderSentAt: now },
    });
  }

  return { candidates: employees.length, notified, emailed };
}
