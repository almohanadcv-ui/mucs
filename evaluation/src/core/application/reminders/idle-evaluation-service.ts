import { prisma } from "@/infrastructure/db/prisma";
import { notify } from "@/core/application/notifications/notification-service";
import { NotificationType, EvaluationStatus, Role } from "@/core/domain/enums";
import { sendEmail } from "@/infrastructure/email/mailer";
import {
  evaluationEmployeeIdleEmail,
  evaluationNudgeEmployeeEmail,
} from "@/infrastructure/email/templates";
import { getServerEnv } from "@/lib/env";

/** Opened, but no employee action for this long → nudge everyone once. */
const IDLE_HOURS = 24;
const HOUR_MS = 60 * 60 * 1000;

export interface IdleRunResult {
  /** Evaluations found that were opened-but-ignored past the window. */
  candidates: number;
  /** Evaluations actually nudged (manager/HR notified + employee warned). */
  nudged: number;
}

function formatAr(d: Date): string {
  try {
    return d.toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return d.toISOString().slice(0, 16).replace("T", " ");
  }
}

async function trySend(to: string, mail: { subject: string; html: string; text: string }) {
  try {
    await sendEmail({ to, subject: mail.subject, html: mail.html, text: mail.text });
  } catch (err) {
    console.error(`[idle-eval] email to ${to} failed:`, err);
  }
}

/**
 * Daily job: an employee who OPENED their evaluation but took no action (didn't
 * agree, object, or reply) for {@link IDLE_HOURS} gets a warning, and their
 * manager + all HR are told they opened it at a given time and ignored it.
 *
 * Runs once per evaluation — `employeeIgnoredNotifiedAt` is stamped on success so
 * a daily trigger doesn't re-nudge every day. Cross-tenant (the caller is cron),
 * so each notification carries the evaluation's own tenantId.
 */
export async function runIdleEvaluationReminders(now = new Date()): Promise<IdleRunResult> {
  const cutoff = new Date(now.getTime() - IDLE_HOURS * HOUR_MS);

  const evals = await prisma.evaluation.findMany({
    where: {
      deletedAt: null,
      status: EvaluationStatus.SENT_TO_EMPLOYEE, // still awaiting the employee
      lockedAt: null,
      employeeDecisionAt: null, // never agreed/objected
      employeeIgnoredNotifiedAt: null, // not nudged yet
      employeeOpenedAt: { not: null, lte: cutoff }, // opened, then went quiet
    },
    select: {
      id: true,
      tenantId: true,
      employeeOpenedAt: true,
      evaluator: {
        select: { id: true, name: true, email: true, isActive: true, deletedAt: true },
      },
      employee: { select: { name: true, email: true, userId: true } },
    },
  });

  let nudged = 0;
  const appBase = getServerEnv().APP_URL.replace(/\/$/, "");

  for (const ev of evals) {
    const openedText = ev.employeeOpenedAt ? formatAr(ev.employeeOpenedAt) : "";
    const alertTitle = "الموظف اطّلع على التقييم دون رد";
    const alertBody = `فتح ${ev.employee.name} تقييمه بتاريخ ${openedText} ولم يتّخذ أي إجراء.`;

    // Manager (evaluator).
    const mgr = ev.evaluator;
    if (mgr && mgr.isActive && !mgr.deletedAt) {
      await notify({
        tenantId: ev.tenantId,
        userId: mgr.id,
        type: NotificationType.REMINDER,
        title: alertTitle,
        body: alertBody,
        data: { evaluationId: ev.id },
      });
      if (mgr.email) {
        await trySend(
          mgr.email,
          evaluationEmployeeIdleEmail({
            recipientName: mgr.name,
            employeeName: ev.employee.name,
            openedAtText: openedText,
          }),
        );
      }
    }

    // Every HR user in the tenant.
    const hrUsers = await prisma.user.findMany({
      where: { tenantId: ev.tenantId, role: Role.HR, isActive: true, deletedAt: null },
      select: { id: true, name: true, email: true },
    });
    for (const hr of hrUsers) {
      await notify({
        tenantId: ev.tenantId,
        userId: hr.id,
        type: NotificationType.REMINDER,
        title: alertTitle,
        body: alertBody,
        data: { evaluationId: ev.id },
      });
      if (hr.email) {
        await trySend(
          hr.email,
          evaluationEmployeeIdleEmail({
            recipientName: hr.name,
            employeeName: ev.employee.name,
            openedAtText: openedText,
          }),
        );
      }
    }

    // The employee — a clear nudge to respond.
    if (ev.employee.userId) {
      await notify({
        tenantId: ev.tenantId,
        userId: ev.employee.userId,
        type: NotificationType.REMINDER,
        title: "تذكير: تقييمك بانتظار ردّك",
        body: "لقد اطّلعت على تقييمك ولم تُبدِ ردّك بعد. الرجاء الموافقة أو كتابة ملاحظاتك.",
        data: { evaluationId: ev.id },
      });
    }
    if (ev.employee.email) {
      await trySend(
        ev.employee.email,
        evaluationNudgeEmployeeEmail({ employeeName: ev.employee.name, link: `${appBase}/my-evaluation` }),
      );
    }

    await prisma.evaluation.update({
      where: { id: ev.id },
      data: { employeeIgnoredNotifiedAt: now },
    });
    nudged += 1;
  }

  return { candidates: evals.length, nudged };
}
