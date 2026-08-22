import { Prisma } from "@prisma/client";
import { prisma } from "@/infrastructure/db/prisma";
import { writeAudit } from "@/infrastructure/audit/audit-log";
import { publishToTenant } from "@/infrastructure/realtime/bus";
import { notify, notifyMany } from "@/core/application/notifications/notification-service";
import { evaluatorOwns } from "@/core/application/employees/employee-service";
import { AppError } from "@/core/application/errors";
import { can, Permission } from "@/core/domain/permissions";
import {
  AuditAction,
  EvaluationStatus,
  NotificationType,
  Role,
  CommentAuthor,
  QuestionType,
  STAR_RATING_LABELS,
  RECOMMENDATION_KEYS,
} from "@/core/domain/enums";
import { sha256, randomToken } from "@/infrastructure/security/crypto";
import { getServerEnv } from "@/lib/env";
import { evaluationToEmployeeEmail } from "@/infrastructure/email/templates";

/** Keep only known recommendation keys, de-duplicated, order preserved. */
function sanitizeRecommendation(rec?: string[]): string[] {
  if (!rec) return [];
  const allowed = new Set<string>(RECOMMENDATION_KEYS);
  return [...new Set(rec.filter((k) => allowed.has(k)))];
}
import {
  normalizeAnswer,
  computeScore,
  formatAnswerDisplay,
  AnswerValidationError,
  type QuestionLike,
  type NormalizedAnswer,
} from "@/core/domain/answers";
import { sendEmail } from "@/infrastructure/email/mailer";
import { evaluationResultEmail } from "@/infrastructure/email/templates";
import { buildEvaluationPdfBranded } from "@/infrastructure/pdf/evaluation-pdf";
import { buildMeta, toSkipTake, type Paginated } from "@/lib/pagination";
import type { SessionUser } from "@/infrastructure/auth/session";
import type { RequestMeta } from "@/core/application/auth/dto";
import type {
  CreateEvaluationInput,
  UpdateEvaluationInput,
  ReviewEvaluationInput,
  ListEvaluationsInput,
} from "./dto";

interface AnswerInput {
  questionId: string;
  value: unknown;
  remarks?: string | null;
}

function toQuestionLike(q: {
  id: string;
  type: string;
  required: boolean;
  config: Prisma.JsonValue;
}): QuestionLike {
  return {
    id: q.id,
    type: q.type as QuestionLike["type"],
    required: q.required,
    config: (q.config as QuestionLike["config"]) ?? null,
  };
}

/**
 * Validate & normalize submitted answers against the template's questions.
 * When `enforceRequired` is true (i.e. on submit) every required question must
 * be answered. Returns rows ready for persistence plus the computed score.
 */
function buildAnswers(
  questions: ReturnType<typeof toQuestionLike>[],
  answers: AnswerInput[],
  enforceRequired: boolean,
) {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const provided = new Map(answers.map((a) => [a.questionId, a.value]));
  const notes = new Map(answers.map((a) => [a.questionId, a.remarks ?? null]));

  const rows: { questionId: string; normalized: NormalizedAnswer; remarks?: string | null }[] = [];
  const scoreEntries: { question: QuestionLike; answer: NormalizedAnswer }[] = [];

  for (const q of questions) {
    const hasValue = provided.has(q.id);
    if (!hasValue && !enforceRequired) continue;
    try {
      const normalized = normalizeAnswer(q, provided.get(q.id));
      // Skip persisting fully-empty optional answers.
      const empty =
        normalized.valueNumber == null &&
        normalized.valueText == null &&
        normalized.valueBool == null &&
        normalized.valueDate == null &&
        normalized.valueJson == null;
      if (empty && !q.required && !notes.get(q.id)) continue;
      rows.push({ questionId: q.id, normalized, remarks: notes.get(q.id) ?? null });
      scoreEntries.push({ question: q, answer: normalized });
    } catch (e) {
      if (e instanceof AnswerValidationError) {
        throw AppError.validation(e.message, { questionId: q.id });
      }
      throw e;
    }
  }

  // Reject answers targeting questions outside this template.
  for (const a of answers) {
    if (!byId.has(a.questionId)) {
      throw AppError.validation("إجابة لسؤال لا ينتمي للنموذج", {
        questionId: a.questionId,
      });
    }
  }

  const score = enforceRequired ? computeScore(scoreEntries) : null;
  return { rows, score };
}

function answerCreateData(
  rows: { questionId: string; normalized: NormalizedAnswer; remarks?: string | null }[],
) {
  return rows.map((r) => ({
    questionId: r.questionId,
    remarks: r.remarks?.trim() || null,
    valueNumber: r.normalized.valueNumber,
    valueText: r.normalized.valueText,
    valueBool: r.normalized.valueBool,
    valueDate: r.normalized.valueDate,
    valueJson: (r.normalized.valueJson ?? Prisma.JsonNull) as Prisma.InputJsonValue,
  }));
}

const LIST_INCLUDE = {
  employee: { select: { id: true, name: true, employeeNo: true } },
  template: { select: { id: true, title: true } },
  evaluator: { select: { id: true, name: true } },
  reviewer: { select: { id: true, name: true } },
} satisfies Prisma.EvaluationInclude;

function scopeForRole(user: SessionUser): Prisma.EvaluationWhereInput {
  switch (user.role) {
    // These roles all hold EVALUATION_VIEW_ALL. Which evaluations they may *act*
    // on is enforced per-status in reviewEvaluation; for listing they see all.
    case Role.ADMIN:
    case Role.MANAGEMENT:
    case Role.HR:
    case Role.PRIMARY_REVIEWER:
    case Role.SUPERVISOR:
      return {};
    case Role.EVALUATOR:
      return { evaluatorId: user.id };
    default:
      return { id: { in: [] } };
  }
}

export async function listEvaluations(
  user: SessionUser,
  input: ListEvaluationsInput,
): Promise<Paginated<unknown>> {
  const where: Prisma.EvaluationWhereInput = {
    tenantId: user.tenantId,
    deletedAt: null,
    ...scopeForRole(user),
    ...(input.status ? { status: input.status } : {}),
    ...(input.employeeId ? { employeeId: input.employeeId } : {}),
    ...(input.templateId ? { templateId: input.templateId } : {}),
    ...(input.kind ? { template: { kind: input.kind } } : {}),
    ...(input.search
      ? { employee: { name: { contains: input.search, mode: "insensitive" } } }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.evaluation.findMany({
      where,
      orderBy: { createdAt: input.sortDir },
      ...toSkipTake(input),
      include: LIST_INCLUDE,
    }),
    prisma.evaluation.count({ where }),
  ]);
  return { items, meta: buildMeta(input, total) };
}

export async function getEvaluation(user: SessionUser, id: string) {
  const evaluation = await prisma.evaluation.findFirst({
    where: {
      id,
      tenantId: user.tenantId,
      deletedAt: null,
      ...scopeForRole(user),
    },
    include: {
      ...LIST_INCLUDE,
      template: { include: { questions: { orderBy: { order: "asc" } } } },
      answers: true,
    },
  });
  if (!evaluation) throw AppError.notFound("التقييم غير موجود");
  return evaluation;
}

async function loadEmployeeForEvaluator(user: SessionUser, employeeId: string) {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, tenantId: user.tenantId, deletedAt: null },
    select: {
      id: true,
      name: true,
      supervisorId: true,
      evaluatorId: true,
      directManager: true,
    },
  });
  if (!employee) throw AppError.validation("الموظف غير موجود");
  // Evaluators may only evaluate employees assigned to them. This must use the
  // same rule the employee list is filtered by, otherwise an evaluator sees a
  // team they are then told they may not evaluate.
  if (user.role === Role.EVALUATOR && !evaluatorOwns(user, employee)) {
    throw AppError.forbidden("غير مكلّف بتقييم هذا الموظف");
  }
  return employee;
}

/** Notify every active user holding one of `roles` (the actor excluded). */
async function notifyRoles(params: {
  tenantId: string;
  roles: Role[];
  excludeUserId: string;
  title: string;
  body: string;
  evaluationId: string;
  i18n: NonNullable<Parameters<typeof notifyMany>[0]["i18n"]>;
}): Promise<number> {
  const recipients = await prisma.user.findMany({
    where: {
      tenantId: params.tenantId,
      deletedAt: null,
      isActive: true,
      role: { in: params.roles },
      id: { not: params.excludeUserId },
    },
    select: { id: true },
  });
  return notifyMany({
    tenantId: params.tenantId,
    userIds: recipients.map((r) => r.id),
    type: NotificationType.ASSIGNMENT,
    title: params.title,
    body: params.body,
    data: { evaluationId: params.evaluationId },
    i18n: params.i18n,
  });
}

/** Preliminary reviewers to notify when an evaluation enters PENDING. */
const PRELIM_REVIEWER_ROLES = [Role.SUPERVISOR, Role.MANAGEMENT, Role.ADMIN];
/** Final reviewers to notify when an evaluation is preliminarily approved. */
const FINAL_REVIEWER_ROLES = [Role.PRIMARY_REVIEWER, Role.MANAGEMENT, Role.ADMIN];

/** Tell the preliminary reviewers a submission is waiting. */
async function notifySubmitted(user: SessionUser, employeeName: string, evaluationId: string) {
  const sent = await notifyRoles({
    tenantId: user.tenantId,
    roles: PRELIM_REVIEWER_ROLES,
    excludeUserId: user.id,
    title: "تقييم بانتظار الاعتماد المبدئي",
    body: `تقييم للموظف ${employeeName} بانتظار مراجعتك (اعتماد مبدئي).`,
    evaluationId,
    i18n: { titleKey: "notif.pendingTitle", bodyKey: "notif.pendingBody", params: { name: employeeName } },
  });
  if (sent === 0) {
    console.error(
      `[evaluations] ${evaluationId} submitted but no preliminary reviewer exists in tenant ${user.tenantId}`,
    );
  }
}

export async function createEvaluation(
  user: SessionUser,
  meta: RequestMeta,
  input: CreateEvaluationInput,
) {
  const employee = await loadEmployeeForEvaluator(user, input.employeeId);

  const template = await prisma.evaluationTemplate.findFirst({
    where: { id: input.templateId, tenantId: user.tenantId, deletedAt: null },
    include: { questions: { orderBy: { order: "asc" } } },
  });
  if (!template) throw AppError.validation("النموذج غير موجود");
  if (!template.isActive && input.submit)
    throw AppError.validation("النموذج غير مفعّل");

  const questions = template.questions.map(toQuestionLike);
  const { rows, score } = buildAnswers(questions, input.answers, input.submit);

  // On submit the evaluation goes straight to the employee (magic-link), not to
  // a reviewer queue — the manager owns the whole flow now.
  const status = input.submit ? EvaluationStatus.SENT_TO_EMPLOYEE : EvaluationStatus.DRAFT;

  const evaluation = await prisma.evaluation.create({
    data: {
      tenantId: user.tenantId,
      templateId: template.id,
      employeeId: employee.id,
      evaluatorId: user.id,
      status,
      score,
      recommendation: sanitizeRecommendation(input.recommendation),
      overallNote: input.overallNote?.trim() || null,
      submittedAt: input.submit ? new Date() : null,
      sentToEmployeeAt: input.submit ? new Date() : null,
      answers: { create: answerCreateData(rows) },
    },
    include: LIST_INCLUDE,
  });

  await writeAudit({
    tenantId: user.tenantId,
    actorId: user.id,
    action: AuditAction.CREATE,
    entity: "Evaluation",
    entityId: evaluation.id,
    after: { status, score },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  if (input.submit) {
    await dispatchEvaluationToEmployee(evaluation.id, user.id);
  }

  publishToTenant(user.tenantId, { type: "data-changed", entity: "evaluation" });
  return evaluation;
}

/**
 * Update a DRAFT or NEEDS_EDIT evaluation's answers, optionally re-submitting it.
 * NEEDS_EDIT is the returned-for-correction state, so the evaluator can fix and
 * send it back into the review flow.
 */
export async function updateEvaluation(
  user: SessionUser,
  meta: RequestMeta,
  id: string,
  input: UpdateEvaluationInput,
) {
  const existing = await prisma.evaluation.findFirst({
    where: { id, tenantId: user.tenantId, deletedAt: null, evaluatorId: user.id },
    include: {
      employee: { select: { id: true, name: true, supervisorId: true } },
      template: { include: { questions: { orderBy: { order: "asc" } } } },
    },
  });
  if (!existing) throw AppError.notFound("التقييم غير موجود");
  // The manager may edit while the evaluation is a draft or still in the
  // employee dialogue; once approved (locked) it is read-only.
  if (existing.status === EvaluationStatus.APPROVED || existing.lockedAt) {
    throw new AppError("CONFLICT", "لا يمكن تعديل تقييم معتمد");
  }
  if (!existing.template) {
    throw new AppError("CONFLICT", "التقييم غير مرتبط بنموذج");
  }

  const questions = existing.template.questions.map(toQuestionLike);
  const { rows, score } = buildAnswers(questions, input.answers, input.submit);
  // Submitting (re)sends to the employee; a plain save keeps the current state.
  const resend = input.submit;
  const status = resend ? EvaluationStatus.SENT_TO_EMPLOYEE : existing.status;

  const evaluation = await prisma.$transaction(async (tx) => {
    await tx.answer.deleteMany({ where: { evaluationId: id } });
    return tx.evaluation.update({
      where: { id },
      data: {
        status,
        score,
        recommendation: sanitizeRecommendation(input.recommendation),
        overallNote: input.overallNote?.trim() || null,
        ...(resend
          ? { submittedAt: new Date(), sentToEmployeeAt: new Date(), rejectionReason: null }
          : {}),
        answers: { create: answerCreateData(rows) },
      },
      include: LIST_INCLUDE,
    });
  });

  if (resend) {
    await dispatchEvaluationToEmployee(id, user.id);
  }

  await writeAudit({
    tenantId: user.tenantId,
    actorId: user.id,
    action: AuditAction.UPDATE,
    entity: "Evaluation",
    entityId: id,
    after: { status, score },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  publishToTenant(user.tenantId, { type: "data-changed", entity: "evaluation" });
  return evaluation;
}

/**
 * Remove an evaluation. Soft delete: the row is retained so an approved score
 * that fed reports and an employee's history can be recovered — deleting one is
 * a correction, not something that should erase the record.
 *
 * Restricted to IT and الإدارة via EVALUATION_DELETE at the route; the scope
 * check here is the second gate.
 */
export async function deleteEvaluation(
  user: SessionUser,
  meta: RequestMeta,
  id: string,
) {
  const existing = await prisma.evaluation.findFirst({
    where: { id, tenantId: user.tenantId, deletedAt: null, ...scopeForRole(user) },
    select: { id: true, status: true, employeeId: true, score: true },
  });
  if (!existing) throw AppError.notFound("التقييم غير موجود");

  await prisma.evaluation.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  await writeAudit({
    tenantId: user.tenantId,
    actorId: user.id,
    action: AuditAction.DELETE,
    entity: "Evaluation",
    entityId: id,
    before: { status: existing.status, score: existing.score },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  publishToTenant(user.tenantId, { type: "data-changed", entity: "evaluation" });
}

export async function reviewEvaluation(
  user: SessionUser,
  meta: RequestMeta,
  id: string,
  input: ReviewEvaluationInput,
) {
  const evaluation = await prisma.evaluation.findFirst({
    where: { id, tenantId: user.tenantId, deletedAt: null, ...scopeForRole(user) },
    include: { evaluator: { select: { id: true } }, employee: { select: { name: true } } },
  });
  if (!evaluation) throw AppError.notFound("التقييم غير موجود");

  const name = evaluation.employee.name;
  const status = evaluation.status;
  const canPrelim = can(user.role, Permission.EVALUATION_APPROVE_PRELIMINARY);
  const canFinal = can(user.role, Permission.EVALUATION_APPROVE_FINAL);
  const canReturn = can(user.role, Permission.EVALUATION_RETURN);

  const data: Prisma.EvaluationUncheckedUpdateInput = {};
  let auditAction: AuditAction;

  if (input.action === "RETURN") {
    if (!canReturn) throw AppError.forbidden("لا تملك صلاحية إعادة التقييم");
    if (status !== EvaluationStatus.PENDING && status !== EvaluationStatus.PRELIMINARY_APPROVED) {
      throw new AppError("CONFLICT", "لا يمكن إعادة التقييم في حالته الحالية");
    }
    data.status = EvaluationStatus.NEEDS_EDIT;
    data.rejectionReason = input.reason ?? null;
    auditAction = AuditAction.REJECT;
  } else if (input.action === "PRELIMINARY") {
    if (!canPrelim) throw AppError.forbidden("لا تملك صلاحية الاعتماد المبدئي");
    if (status !== EvaluationStatus.PENDING) {
      throw new AppError("CONFLICT", "التقييم ليس بانتظار الاعتماد المبدئي");
    }
    data.status = EvaluationStatus.PRELIMINARY_APPROVED;
    data.prelimReviewerId = user.id;
    data.prelimReviewedAt = new Date();
    data.rejectionReason = null;
    auditAction = AuditAction.APPROVE;
  } else {
    // FINAL — normally after preliminary approval. الإدارة/IT hold both approval
    // permissions, so they may finalize a PENDING evaluation directly (shortcut).
    if (!canFinal) throw AppError.forbidden("لا تملك صلاحية الاعتماد النهائي");
    const shortcut = canPrelim && canFinal;
    const okStatus =
      status === EvaluationStatus.PRELIMINARY_APPROVED ||
      (shortcut && status === EvaluationStatus.PENDING);
    if (!okStatus) throw new AppError("CONFLICT", "التقييم ليس بانتظار الاعتماد النهائي");
    data.status = EvaluationStatus.APPROVED;
    data.reviewerId = user.id;
    data.reviewedAt = new Date();
    data.rejectionReason = null;
    auditAction = AuditAction.APPROVE;
  }

  const updated = await prisma.evaluation.update({ where: { id }, data, include: LIST_INCLUDE });

  // Tell the evaluator the outcome, and (on preliminary) alert the final reviewers.
  if (input.action === "RETURN") {
    await notify({
      tenantId: user.tenantId,
      userId: evaluation.evaluator.id,
      type: NotificationType.REJECTION,
      title: "أُعيد التقييم للتعديل",
      body: `أُعيد تقييمك للموظف ${name} للتعديل. السبب: ${input.reason}`,
      data: { evaluationId: id },
      i18n: { titleKey: "notif.returnedTitle", bodyKey: "notif.returnedBody", params: { name, reason: input.reason ?? "" } },
    });
  } else if (input.action === "PRELIMINARY") {
    await notify({
      tenantId: user.tenantId,
      userId: evaluation.evaluator.id,
      type: NotificationType.APPROVAL,
      title: "اعتماد مبدئي",
      body: `اعتُمد تقييمك للموظف ${name} مبدئيًا، وهو بانتظار الاعتماد النهائي.`,
      data: { evaluationId: id },
      i18n: { titleKey: "notif.prelimTitle", bodyKey: "notif.prelimBody", params: { name } },
    });
    await notifyRoles({
      tenantId: user.tenantId,
      roles: FINAL_REVIEWER_ROLES,
      excludeUserId: user.id,
      title: "تقييم بانتظار الاعتماد النهائي",
      body: `تقييم للموظف ${name} بانتظار الاعتماد النهائي.`,
      evaluationId: id,
      i18n: { titleKey: "notif.pendingFinalTitle", bodyKey: "notif.pendingFinalBody", params: { name } },
    });
  } else {
    await notify({
      tenantId: user.tenantId,
      userId: evaluation.evaluator.id,
      type: NotificationType.APPROVAL,
      title: "اعتماد نهائي",
      body: `تم الاعتماد النهائي لتقييمك للموظف ${name}.`,
      data: { evaluationId: id },
      i18n: { titleKey: "notif.finalTitle", bodyKey: "notif.finalBody", params: { name } },
    });
  }

  await writeAudit({
    tenantId: user.tenantId,
    actorId: user.id,
    action: auditAction,
    entity: "Evaluation",
    entityId: id,
    before: { status },
    after: { status: data.status, reason: input.reason },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  // Only the FINAL approval reaches the employee — best-effort so a mail outage
  // can't fail an approval, which is a committed database decision.
  if (input.action === "FINAL") {
    void sendApprovedEvaluationToEmployee(id).catch((err) =>
      console.error(`[evaluations] result email for ${id} failed:`, err),
    );
  }

  publishToTenant(user.tenantId, { type: "data-changed", entity: "evaluation" });
  return updated;
}

/**
 * Email an approved evaluation's result to the employee it is about.
 *
 * A no-op when the employee has no email on file. Answers are rendered to human
 * text (choice questions show their option label) and ordered as on the form.
 */
export async function sendApprovedEvaluationToEmployee(evaluationId: string): Promise<void> {
  const ev = await prisma.evaluation.findUnique({
    where: { id: evaluationId },
    select: {
      score: true,
      reviewedAt: true,
      employee: { select: { name: true, email: true, employeeNo: true } },
      evaluator: { select: { name: true } },
      template: { select: { title: true } },
      answers: {
        select: {
          valueNumber: true,
          valueText: true,
          valueBool: true,
          valueDate: true,
          valueJson: true,
          remarks: true,
          question: { select: { id: true, label: true, type: true, required: true, config: true, order: true } },
        },
      },
    },
  });

  if (!ev || !ev.employee.email) return;

  const items = ev.answers
    .slice()
    .sort((a, b) => a.question.order - b.question.order)
    .map((a) => {
      const question = toQuestionLike(a.question);
      const normalized: NormalizedAnswer = {
        valueNumber: a.valueNumber,
        valueText: a.valueText,
        valueBool: a.valueBool,
        valueDate: a.valueDate,
        valueJson: a.valueJson,
      };
      return {
        label: a.question.label,
        value: formatAnswerDisplay(question, normalized),
        remarks: a.remarks,
      };
    });

  const reviewedAt = ev.reviewedAt ?? new Date();
  const mail = evaluationResultEmail({
    employeeName: ev.employee.name,
    templateTitle: ev.template.title,
    score: ev.score,
    reviewedAt,
    items,
  });

  // Attach the evaluation as a PDF. Best-effort: if the font/render fails the
  // email still goes with its inline summary, so the employee is never left
  // with nothing because of the attachment.
  let attachments: { filename: string; content: Buffer; contentType: string }[] | undefined;
  try {
    const pdf = await buildEvaluationPdfBranded({
      employeeName: ev.employee.name,
      employeeNo: ev.employee.employeeNo,
      templateTitle: ev.template.title,
      evaluatorName: ev.evaluator?.name,
      score: ev.score,
      reviewedAt,
      items,
    });
    if (pdf) {
      attachments = [
        { filename: `تقييم-${ev.employee.name}.pdf`, content: pdf, contentType: "application/pdf" },
      ];
    }
  } catch (err) {
    console.error(`[evaluations] PDF render for ${evaluationId} failed:`, err);
  }

  await sendEmail({
    to: ev.employee.email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    attachments,
  });
}

/**
 * Build the branded PDF for one evaluation, for download. Role-scoped: a user
 * can only fetch an evaluation they are allowed to see. Works in any status, so
 * a reviewer/evaluator can download a draft or a finished report alike.
 */
export async function getEvaluationPdf(
  user: SessionUser,
  id: string,
): Promise<{ buffer: Buffer; filename: string }> {
  const ev = await prisma.evaluation.findFirst({
    where: { id, tenantId: user.tenantId, deletedAt: null, ...scopeForRole(user) },
    select: {
      score: true,
      reviewedAt: true,
      submittedAt: true,
      recommendation: true,
      employee: { select: { name: true, employeeNo: true } },
      evaluator: { select: { name: true } },
      template: { select: { title: true } },
      answers: {
        select: {
          valueNumber: true,
          valueText: true,
          valueBool: true,
          valueDate: true,
          valueJson: true,
          remarks: true,
          question: { select: { id: true, label: true, type: true, required: true, config: true, order: true } },
        },
      },
    },
  });
  if (!ev) throw AppError.notFound("التقييم غير موجود");

  const items = ev.answers
    .slice()
    .sort((a, b) => a.question.order - b.question.order)
    .map((a) => ({
      label: a.question.label,
      value: formatAnswerDisplay(toQuestionLike(a.question), {
        valueNumber: a.valueNumber,
        valueText: a.valueText,
        valueBool: a.valueBool,
        valueDate: a.valueDate,
        valueJson: a.valueJson,
      }),
      remarks: a.remarks,
    }));

  const pdf = await buildEvaluationPdfBranded({
    employeeName: ev.employee.name,
    employeeNo: ev.employee.employeeNo,
    templateTitle: ev.template.title,
    evaluatorName: ev.evaluator?.name,
    score: ev.score,
    reviewedAt: ev.reviewedAt ?? ev.submittedAt ?? new Date(),
    items,
    // Staff download includes «التوصية». The employee's own copy (built in
    // sendApprovedEvaluationToEmployee) deliberately omits it.
    recommendation: ev.recommendation,
  });
  if (!pdf) throw new AppError("INTERNAL", "تعذّر توليد ملف PDF");

  return { buffer: pdf, filename: `تقييم-${ev.employee.name}.pdf` };
}

// ─────────────────────────────────────────────────────────────────────────────
// Manager↔employee flow: magic-link, dialogue, revisions, manager approval.
// ─────────────────────────────────────────────────────────────────────────────

/** Employee magic-link lifetime: 30 days or until approval, whichever first. */
const EMPLOYEE_LINK_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Retire any live link for the evaluation and mint a fresh one; return its URL. */
async function issueEmployeeLink(evaluationId: string): Promise<string> {
  await prisma.evaluationAccessToken.updateMany({
    where: { evaluationId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  const raw = randomToken(32);
  await prisma.evaluationAccessToken.create({
    data: {
      evaluationId,
      tokenHash: sha256(raw),
      expiresAt: new Date(Date.now() + EMPLOYEE_LINK_TTL_MS),
    },
  });
  return `${getServerEnv().APP_URL.replace(/\/$/, "")}/evaluation-review/${raw}`;
}

/** Immutable snapshot of the current answers + score, for the change history. */
async function snapshotRevision(
  evaluationId: string,
  createdById: string | null,
  note?: string,
): Promise<void> {
  const [last, ev] = await Promise.all([
    prisma.evaluationRevision.findFirst({
      where: { evaluationId },
      orderBy: { version: "desc" },
      select: { version: true },
    }),
    prisma.evaluation.findUnique({
      where: { id: evaluationId },
      select: {
        score: true,
        answers: {
          select: {
            questionId: true,
            valueNumber: true,
            valueText: true,
            valueBool: true,
            valueDate: true,
            valueJson: true,
            remarks: true,
          },
        },
      },
    }),
  ]);
  if (!ev) return;
  await prisma.evaluationRevision.create({
    data: {
      evaluationId,
      version: (last?.version ?? 0) + 1,
      score: ev.score,
      answers: ev.answers as unknown as Prisma.InputJsonValue,
      createdById,
      note: note ?? null,
    },
  });
}

/**
 * Snapshot the current state, mint a fresh magic-link, and email it to the
 * employee. Best-effort throughout: a mail or link failure must never fail the
 * manager submit (the evaluation is already SENT_TO_EMPLOYEE) — they can
 * re-send from the evaluation screen.
 */
export async function dispatchEvaluationToEmployee(
  evaluationId: string,
  actorUserId: string,
): Promise<void> {
  try {
    await snapshotRevision(evaluationId, actorUserId);
    const link = await issueEmployeeLink(evaluationId);
    const ev = await prisma.evaluation.findUnique({
      where: { id: evaluationId },
      select: {
        employee: { select: { name: true, email: true } },
        evaluator: { select: { name: true } },
        template: { select: { title: true } },
      },
    });
    if (!ev || !ev.employee.email) return;
    const mail = evaluationToEmployeeEmail({
      link,
      employeeName: ev.employee.name,
      evaluatorName: ev.evaluator?.name,
      templateTitle: ev.template.title,
    });
    await sendEmail({ to: ev.employee.email, subject: mail.subject, html: mail.html, text: mail.text });
  } catch (err) {
    console.error(`[evaluations] dispatch to employee for ${evaluationId} failed:`, err);
  }
}

/**
 * The manager gives the final approval — the manager alone approves. Locks the
 * evaluation (read-only), revokes the employee magic-link, snapshots the final
 * version, and emails the employee the approved result.
 */
export async function managerApproveEvaluation(
  user: SessionUser,
  meta: RequestMeta,
  id: string,
) {
  const ev = await prisma.evaluation.findFirst({
    where: { id, tenantId: user.tenantId, deletedAt: null },
    include: { employee: { select: { name: true } } },
  });
  if (!ev) throw AppError.notFound("التقييم غير موجود");
  // Approval is the owning manager alone (IT may act as a safety override).
  if (ev.evaluatorId !== user.id && user.role !== Role.ADMIN) {
    throw AppError.forbidden("الاعتماد من صلاحية المدير صاحب التقييم فقط");
  }
  const approvable: string[] = [
    EvaluationStatus.SENT_TO_EMPLOYEE,
    EvaluationStatus.EMPLOYEE_RESPONDED,
    EvaluationStatus.EMPLOYEE_ACKNOWLEDGED,
  ];
  if (!approvable.includes(ev.status)) {
    throw new AppError("CONFLICT", "لا يمكن اعتماد التقييم في حالته الحالية");
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.evaluation.update({
      where: { id },
      data: { status: EvaluationStatus.APPROVED, reviewerId: user.id, reviewedAt: now, lockedAt: now },
    });
    await tx.evaluationAccessToken.updateMany({
      where: { evaluationId: id, revokedAt: null },
      data: { revokedAt: now },
    });
  });
  await snapshotRevision(id, user.id, "الاعتماد النهائي");

  await writeAudit({
    tenantId: user.tenantId,
    actorId: user.id,
    action: AuditAction.APPROVE,
    entity: "Evaluation",
    entityId: id,
    before: { status: ev.status },
    after: { status: EvaluationStatus.APPROVED },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  // Best-effort: a mail outage can't fail a committed approval.
  void sendApprovedEvaluationToEmployee(id).catch((err) =>
    console.error(`[evaluations] result email for ${id} failed:`, err),
  );

  publishToTenant(user.tenantId, { type: "data-changed", entity: "evaluation" });
}

/**
 * Add a comment to the thread. The owning manager posts a reply the employee
 * can see; an HR user posts an internal feedback note on the manager that the
 * employee never sees. HR does not approve — only comments.
 */
export async function addEvaluationComment(
  user: SessionUser,
  meta: RequestMeta,
  id: string,
  body: string,
) {
  const ev = await prisma.evaluation.findFirst({
    where: { id, tenantId: user.tenantId, deletedAt: null },
    select: { id: true, evaluatorId: true, lockedAt: true, employee: { select: { name: true } } },
  });
  if (!ev) throw AppError.notFound("التقييم غير موجود");

  const isOwner = ev.evaluatorId === user.id;
  const isHr = can(user.role, Permission.EVALUATION_COMMENT_HR);
  if (!isOwner && !isHr) throw AppError.forbidden("لا تملك صلاحية التعليق على هذا التقييم");
  if (ev.lockedAt) throw new AppError("CONFLICT", "التقييم معتمد — لا يمكن إضافة تعليقات");

  // A manager who is also HR is acting as the manager on their own evaluation.
  const asManager = isOwner;
  const comment = await prisma.evaluationComment.create({
    data: {
      evaluationId: id,
      authorType: asManager ? CommentAuthor.MANAGER : CommentAuthor.HR,
      authorUserId: user.id,
      authorName: user.name,
      body: body.trim(),
      visibleToEmployee: asManager, // HR notes are internal
    },
  });

  // Tell the manager when HR leaves feedback on their evaluation.
  if (!asManager && ev.evaluatorId !== user.id) {
    await notify({
      tenantId: user.tenantId,
      userId: ev.evaluatorId,
      type: NotificationType.SYSTEM,
      title: "ملاحظة من الموارد البشرية",
      body: `أضافت الموارد البشرية ملاحظة على تقييمك للموظف ${ev.employee.name}.`,
      data: { evaluationId: id },
    });
  }

  await writeAudit({
    tenantId: user.tenantId,
    actorId: user.id,
    action: AuditAction.CREATE,
    entity: "EvaluationComment",
    entityId: comment.id,
    after: { evaluationId: id, authorType: comment.authorType },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  publishToTenant(user.tenantId, { type: "data-changed", entity: "evaluation" });
  return comment;
}

/**
 * The conversation for one evaluation. HR/IT/Management (EVALUATION_VIEW_THREAD)
 * see everything, always. The owning manager sees the thread only while the
 * evaluation is still open — once approved, the archive is hidden from them.
 */
export async function listEvaluationComments(user: SessionUser, id: string) {
  const ev = await prisma.evaluation.findFirst({
    where: { id, tenantId: user.tenantId, deletedAt: null, ...scopeForRole(user) },
    select: { id: true, evaluatorId: true, lockedAt: true },
  });
  if (!ev) throw AppError.notFound("التقييم غير موجود");

  const fullAccess = can(user.role, Permission.EVALUATION_VIEW_THREAD);
  if (!fullAccess) {
    const isOwner = ev.evaluatorId === user.id;
    if (!isOwner || ev.lockedAt) return [];
  }
  return prisma.evaluationComment.findMany({
    where: { evaluationId: id },
    orderBy: { createdAt: "asc" },
    select: { id: true, authorType: true, authorName: true, body: true, visibleToEmployee: true, createdAt: true },
  });
}

// ── Employee side (magic-link, no account) ───────────────────────────────────

/** Strict token check for actions (respond): rejects revoked/expired links. */
async function loadEmployeeToken(rawToken: string) {
  const rec = await prisma.evaluationAccessToken.findUnique({
    where: { tokenHash: sha256(rawToken) },
    select: { id: true, evaluationId: true, expiresAt: true, revokedAt: true },
  });
  if (!rec) throw AppError.notFound("الرابط غير صالح");
  if (rec.revokedAt) throw new AppError("CONFLICT", "انتهت صلاحية الرابط أو تم اعتماد التقييم");
  if (rec.expiresAt < new Date()) throw new AppError("CONFLICT", "انتهت صلاحية الرابط");
  return rec;
}

/**
 * The employee read view of their evaluation via the magic-link. Excludes the
 * recommendation, HR notes, and internal history — only what they may see.
 * An approved evaluation stays viewable read-only (so re-opening the link after
 * approval shows the approved screen); otherwise the token must still be valid.
 */
export async function getEvaluationForEmployee(rawToken: string) {
  const rec = await prisma.evaluationAccessToken.findUnique({
    where: { tokenHash: sha256(rawToken) },
    select: { id: true, evaluationId: true, expiresAt: true, revokedAt: true },
  });
  if (!rec) throw AppError.notFound("الرابط غير صالح");
  const ev = await prisma.evaluation.findFirst({
    where: { id: rec.evaluationId, deletedAt: null },
    select: {
      status: true,
      score: true,
      lockedAt: true,
      overallNote: true,
      employee: { select: { name: true } },
      evaluator: { select: { name: true } },
      template: { select: { title: true } },
      answers: {
        select: {
          valueNumber: true, valueText: true, valueBool: true, valueDate: true, valueJson: true, remarks: true,
          question: { select: { id: true, label: true, type: true, required: true, config: true, order: true } },
        },
      },
    },
  });
  if (!ev) throw AppError.notFound("التقييم غير موجود");

  // A finished (approved/locked) evaluation stays viewable via the link; an
  // unfinished one requires the link to still be live.
  const finished = ev.status === EvaluationStatus.APPROVED || Boolean(ev.lockedAt);
  if (!finished) {
    if (rec.revokedAt) throw new AppError("CONFLICT", "انتهت صلاحية الرابط");
    if (rec.expiresAt < new Date()) throw new AppError("CONFLICT", "انتهت صلاحية الرابط");
  }

  const items = ev.answers
    .slice()
    .sort((a, b) => a.question.order - b.question.order)
    .map((a) => {
      const q = toQuestionLike(a.question);
      let value = formatAnswerDisplay(q, {
        valueNumber: a.valueNumber, valueText: a.valueText, valueBool: a.valueBool,
        valueDate: a.valueDate, valueJson: a.valueJson,
      });
      // Show the word (ممتاز/جيد جداً…) beside a 5-star rating, like the app.
      if (a.question.type === QuestionType.STAR_RATING && a.valueNumber != null) {
        const max = (a.question.config as { max?: number } | null)?.max ?? 5;
        const label = max === 5 ? STAR_RATING_LABELS[a.valueNumber] : undefined;
        if (label) value = `${value} — ${label}`;
      }
      return { label: a.question.label, value, remarks: a.remarks };
    });

  const comments = await prisma.evaluationComment.findMany({
    where: { evaluationId: rec.evaluationId, visibleToEmployee: true },
    orderBy: { createdAt: "asc" },
    select: { authorType: true, authorName: true, body: true, createdAt: true },
  });

  return {
    employeeName: ev.employee.name,
    evaluatorName: ev.evaluator?.name ?? null,
    templateTitle: ev.template.title,
    score: ev.score,
    status: ev.status,
    locked: Boolean(ev.lockedAt),
    overallNote: ev.overallNote,
    items,
    comments,
  };
}

/**
 * The employee agrees to, or objects to, their evaluation via the magic-link.
 * OBJECT requires a comment. Notifies the manager either way.
 */
export async function employeeRespondToEvaluation(
  rawToken: string,
  decision: "ACKNOWLEDGE" | "OBJECT",
  comment?: string,
) {
  const rec = await loadEmployeeToken(rawToken);
  const ev = await prisma.evaluation.findFirst({
    where: { id: rec.evaluationId, deletedAt: null },
    select: { id: true, tenantId: true, lockedAt: true, evaluatorId: true, employee: { select: { name: true } } },
  });
  if (!ev) throw AppError.notFound("التقييم غير موجود");
  if (ev.lockedAt) throw new AppError("CONFLICT", "تم اعتماد التقييم");

  const trimmed = comment?.trim() ?? "";
  if (decision === "OBJECT" && trimmed.length < 3) {
    throw AppError.validation("الرجاء كتابة ملاحظتك");
  }

  const now = new Date();

  // Agreement finalizes the evaluation: it is the employee's acceptance, so it
  // approves, locks, revokes the link and emails the official result. Objecting
  // keeps the dialogue open for unlimited back-and-forth with the manager.
  if (decision === "ACKNOWLEDGE") {
    await prisma.$transaction(async (tx) => {
      if (trimmed) {
        await tx.evaluationComment.create({
          data: {
            evaluationId: ev.id,
            authorType: CommentAuthor.EMPLOYEE,
            authorName: ev.employee.name,
            body: trimmed,
            visibleToEmployee: true,
          },
        });
      }
      await tx.evaluation.update({
        where: { id: ev.id },
        data: {
          status: EvaluationStatus.APPROVED,
          employeeDecisionAt: now,
          reviewedAt: now,
          lockedAt: now,
        },
      });
      await tx.evaluationAccessToken.updateMany({
        where: { evaluationId: ev.id, revokedAt: null },
        data: { revokedAt: now },
      });
    });
    await snapshotRevision(ev.id, null, "موافقة الموظف — اعتماد نهائي");

    await notify({
      tenantId: ev.tenantId,
      userId: ev.evaluatorId,
      type: NotificationType.APPROVAL,
      title: "وافق الموظف واعتُمد التقييم",
      body: `وافق الموظف ${ev.employee.name} على تقييمه، وتم اعتماده وإرساله له.`,
      data: { evaluationId: ev.id },
    });
    void sendApprovedEvaluationToEmployee(ev.id).catch((err) =>
      console.error(`[evaluations] result email for ${ev.id} failed:`, err),
    );

    publishToTenant(ev.tenantId, { type: "data-changed", entity: "evaluation" });
    return { status: EvaluationStatus.APPROVED };
  }

  // OBJECT — record the message, keep the conversation open.
  await prisma.$transaction(async (tx) => {
    await tx.evaluationComment.create({
      data: {
        evaluationId: ev.id,
        authorType: CommentAuthor.EMPLOYEE,
        authorName: ev.employee.name,
        body: trimmed,
        visibleToEmployee: true,
      },
    });
    await tx.evaluation.update({
      where: { id: ev.id },
      data: { status: EvaluationStatus.EMPLOYEE_RESPONDED, employeeDecisionAt: now },
    });
    await tx.evaluationAccessToken.update({ where: { id: rec.id }, data: { consumedAt: now } });
  });

  await notify({
    tenantId: ev.tenantId,
    userId: ev.evaluatorId,
    type: NotificationType.REJECTION,
    title: "ردّ الموظف على التقييم",
    body: `أبدى الموظف ${ev.employee.name} ملاحظات على تقييمه.`,
    data: { evaluationId: ev.id },
  });

  publishToTenant(ev.tenantId, { type: "data-changed", entity: "evaluation" });
  return { status: EvaluationStatus.EMPLOYEE_RESPONDED };
}

// ─────────────────── Authenticated employee (portal, no token) ───────────────
// The same manager↔employee dialogue as the magic-link flow, but for an EMPLOYEE
// who is signed in (via portal SSO). Their evaluation is resolved by the
// employee↔user link instead of a one-time token, so it stays available.

/** Statuses at which an evaluation is visible to its own employee. */
const EMPLOYEE_VISIBLE_STATUSES: EvaluationStatus[] = [
  EvaluationStatus.SENT_TO_EMPLOYEE,
  EvaluationStatus.EMPLOYEE_RESPONDED,
  EvaluationStatus.EMPLOYEE_ACKNOWLEDGED,
  EvaluationStatus.APPROVED,
];

/**
 * The employee record for this signed-in user. Prefers the explicit user↔employee
 * link (set at SSO time), but falls back to matching by email so it still works
 * when the account and the HR record share an address that was never linked. On a
 * successful email match it back-fills the link so later reads are direct.
 */
async function linkedEmployee(user: SessionUser) {
  const byLink = await prisma.employee.findFirst({
    where: { tenantId: user.tenantId, deletedAt: null, userId: user.id },
    select: { id: true, name: true },
  });
  if (byLink) return byLink;

  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true },
  });
  const email = account?.email?.trim().toLowerCase();
  if (!email) return null;

  const byEmail = await prisma.employee.findFirst({
    where: { tenantId: user.tenantId, deletedAt: null, email: { equals: email, mode: "insensitive" } },
    select: { id: true, name: true, userId: true },
  });
  if (byEmail && !byEmail.userId) {
    await prisma.employee.update({ where: { id: byEmail.id }, data: { userId: user.id } }).catch(() => {});
  }
  return byEmail ? { id: byEmail.id, name: byEmail.name } : null;
}

/** The employee's most recent dispatched evaluation (id only), or null. */
async function myLatestEvaluationId(user: SessionUser): Promise<string | null> {
  const emp = await linkedEmployee(user);
  if (!emp) return null;
  const ev = await prisma.evaluation.findFirst({
    where: {
      tenantId: user.tenantId,
      deletedAt: null,
      employeeId: emp.id,
      status: { in: EMPLOYEE_VISIBLE_STATUSES },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return ev?.id ?? null;
}

/**
 * The signed-in employee's own evaluation + dialogue, in the same shape the
 * magic-link page uses. Returns null when they have no evaluation yet.
 */
export async function getMyEvaluation(user: SessionUser) {
  const evId = await myLatestEvaluationId(user);
  if (!evId) return null;

  const ev = await prisma.evaluation.findFirst({
    where: { id: evId, deletedAt: null },
    select: {
      status: true,
      score: true,
      lockedAt: true,
      overallNote: true,
      employee: { select: { name: true } },
      evaluator: { select: { name: true } },
      template: { select: { title: true } },
      answers: {
        select: {
          valueNumber: true, valueText: true, valueBool: true, valueDate: true, valueJson: true, remarks: true,
          question: { select: { id: true, label: true, type: true, required: true, config: true, order: true } },
        },
      },
    },
  });
  if (!ev) return null;

  const items = ev.answers
    .slice()
    .sort((a, b) => a.question.order - b.question.order)
    .map((a) => {
      const q = toQuestionLike(a.question);
      let value = formatAnswerDisplay(q, {
        valueNumber: a.valueNumber, valueText: a.valueText, valueBool: a.valueBool,
        valueDate: a.valueDate, valueJson: a.valueJson,
      });
      if (a.question.type === QuestionType.STAR_RATING && a.valueNumber != null) {
        const max = (a.question.config as { max?: number } | null)?.max ?? 5;
        const label = max === 5 ? STAR_RATING_LABELS[a.valueNumber] : undefined;
        if (label) value = `${value} — ${label}`;
      }
      return { label: a.question.label, value, remarks: a.remarks };
    });

  const comments = await prisma.evaluationComment.findMany({
    where: { evaluationId: evId, visibleToEmployee: true },
    orderBy: { createdAt: "asc" },
    select: { authorType: true, authorName: true, body: true, createdAt: true },
  });

  return {
    employeeName: ev.employee.name,
    evaluatorName: ev.evaluator?.name ?? null,
    templateTitle: ev.template.title,
    score: ev.score,
    status: ev.status,
    locked: Boolean(ev.lockedAt),
    overallNote: ev.overallNote,
    items,
    comments,
  };
}

/**
 * The signed-in employee agrees to / objects to their evaluation — the token-free
 * twin of employeeRespondToEvaluation. ACKNOWLEDGE finalizes (approve + lock +
 * result email); OBJECT records the message and keeps the dialogue open.
 */
export async function myEvaluationRespond(
  user: SessionUser,
  decision: "ACKNOWLEDGE" | "OBJECT",
  comment?: string,
) {
  const evId = await myLatestEvaluationId(user);
  if (!evId) throw AppError.notFound("لا يوجد تقييم لك");
  const ev = await prisma.evaluation.findFirst({
    where: { id: evId, deletedAt: null },
    select: { id: true, tenantId: true, lockedAt: true, evaluatorId: true, employee: { select: { name: true } } },
  });
  if (!ev) throw AppError.notFound("التقييم غير موجود");
  if (ev.lockedAt) throw new AppError("CONFLICT", "تم اعتماد التقييم");

  const trimmed = comment?.trim() ?? "";
  if (decision === "OBJECT" && trimmed.length < 3) {
    throw AppError.validation("الرجاء كتابة ملاحظتك");
  }
  const now = new Date();

  if (decision === "ACKNOWLEDGE") {
    await prisma.$transaction(async (tx) => {
      if (trimmed) {
        await tx.evaluationComment.create({
          data: { evaluationId: ev.id, authorType: CommentAuthor.EMPLOYEE, authorName: ev.employee.name, body: trimmed, visibleToEmployee: true },
        });
      }
      await tx.evaluation.update({
        where: { id: ev.id },
        data: { status: EvaluationStatus.APPROVED, employeeDecisionAt: now, reviewedAt: now, lockedAt: now },
      });
      await tx.evaluationAccessToken.updateMany({ where: { evaluationId: ev.id, revokedAt: null }, data: { revokedAt: now } });
    });
    await snapshotRevision(ev.id, null, "موافقة الموظف — اعتماد نهائي");
    await notify({
      tenantId: ev.tenantId, userId: ev.evaluatorId, type: NotificationType.APPROVAL,
      title: "وافق الموظف واعتُمد التقييم",
      body: `وافق الموظف ${ev.employee.name} على تقييمه، وتم اعتماده وإرساله له.`,
      data: { evaluationId: ev.id },
    });
    void sendApprovedEvaluationToEmployee(ev.id).catch((err) =>
      console.error(`[evaluations] result email for ${ev.id} failed:`, err),
    );
    publishToTenant(ev.tenantId, { type: "data-changed", entity: "evaluation" });
    return { status: EvaluationStatus.APPROVED };
  }

  // OBJECT
  await prisma.$transaction(async (tx) => {
    await tx.evaluationComment.create({
      data: { evaluationId: ev.id, authorType: CommentAuthor.EMPLOYEE, authorName: ev.employee.name, body: trimmed, visibleToEmployee: true },
    });
    await tx.evaluation.update({
      where: { id: ev.id },
      data: { status: EvaluationStatus.EMPLOYEE_RESPONDED, employeeDecisionAt: now },
    });
  });
  await notify({
    tenantId: ev.tenantId, userId: ev.evaluatorId, type: NotificationType.REJECTION,
    title: "ردّ الموظف على التقييم",
    body: `أبدى الموظف ${ev.employee.name} ملاحظات على تقييمه.`,
    data: { evaluationId: ev.id },
  });
  publishToTenant(ev.tenantId, { type: "data-changed", entity: "evaluation" });
  return { status: EvaluationStatus.EMPLOYEE_RESPONDED };
}
