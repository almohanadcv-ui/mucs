import { Prisma } from "@prisma/client";
import { prisma } from "@/infrastructure/db/prisma";
import { writeAudit } from "@/infrastructure/audit/audit-log";
import { publishToTenant } from "@/infrastructure/realtime/bus";
import { notify, notifyMany } from "@/core/application/notifications/notification-service";
import { evaluatorOwns } from "@/core/application/employees/employee-service";
import { AppError } from "@/core/application/errors";
import {
  AuditAction,
  EvaluationStatus,
  NotificationType,
  Role,
} from "@/core/domain/enums";
import {
  normalizeAnswer,
  computeScore,
  AnswerValidationError,
  type QuestionLike,
  type NormalizedAnswer,
} from "@/core/domain/answers";
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

  const rows: { questionId: string; normalized: NormalizedAnswer }[] = [];
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
      if (empty && !q.required) continue;
      rows.push({ questionId: q.id, normalized });
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

function answerCreateData(rows: { questionId: string; normalized: NormalizedAnswer }[]) {
  return rows.map((r) => ({
    questionId: r.questionId,
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
    case Role.ADMIN:
      return {};
    case Role.SUPERVISOR:
      // A supervisor is a reviewer. Scoping them to employee.supervisorId alone
      // hid the approval queue almost entirely, because that link is set for
      // barely any employee — so submitted evaluations were invisible to the
      // very people meant to approve them. They see their own team, anything
      // awaiting review, and whatever they have already ruled on.
      return {
        OR: [
          { employee: { supervisorId: user.id } },
          { status: EvaluationStatus.PENDING },
          { reviewerId: user.id },
        ],
      };
    case Role.EVALUATOR:
      return { evaluatorId: user.id };
    default:
      return { id: "__none__" };
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

/**
 * Everyone who should be told an evaluation is waiting for approval: the
 * employee's own supervisor if they have one, plus every reviewer (SUPERVISOR)
 * and support account (ADMIN) in the tenant.
 *
 * It deliberately does not rely on employee.supervisorId alone. That column is
 * only set when an employee is linked to a supervisor by hand, and in practice
 * almost none are — so submissions were notifying nobody at all and sat unseen.
 * The submitter is excluded; they don't need telling about their own work.
 */
async function notifyReviewers(
  user: SessionUser,
  employeeName: string,
  evaluationId: string,
  extra: { supervisorId?: string | null; isDocument?: boolean },
) {
  const reviewers = await prisma.user.findMany({
    where: {
      tenantId: user.tenantId,
      deletedAt: null,
      isActive: true,
      role: { in: [Role.SUPERVISOR, Role.ADMIN] },
      id: { not: user.id },
    },
    select: { id: true },
  });

  const userIds = reviewers.map((r) => r.id);
  if (extra.supervisorId && extra.supervisorId !== user.id) {
    userIds.push(extra.supervisorId);
  }

  const sent = await notifyMany({
    tenantId: user.tenantId,
    userIds,
    type: NotificationType.ASSIGNMENT,
    title: "تقييم بانتظار الاعتماد",
    body: `تقييم جديد${extra.isDocument ? " (ملف وورد)" : ""} للموظف ${employeeName} بانتظار مراجعتك.`,
    data: { evaluationId },
  });

  if (sent === 0) {
    console.error(
      `[evaluations] ${evaluationId} submitted but no reviewer or admin exists in tenant ${user.tenantId} — nobody was notified`,
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

  const status = input.submit ? EvaluationStatus.PENDING : EvaluationStatus.DRAFT;

  const evaluation = await prisma.evaluation.create({
    data: {
      tenantId: user.tenantId,
      templateId: template.id,
      employeeId: employee.id,
      evaluatorId: user.id,
      status,
      score,
      submittedAt: input.submit ? new Date() : null,
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
    await notifyReviewers(user, employee.name, evaluation.id, {
      supervisorId: employee.supervisorId,
    });
  }

  publishToTenant(user.tenantId, { type: "data-changed", entity: "evaluation" });
  return evaluation;
}

/** Update a DRAFT evaluation's answers, optionally submitting it for review. */
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
  if (existing.status !== EvaluationStatus.DRAFT) {
    throw new AppError("CONFLICT", "لا يمكن تعديل تقييم تم إرساله");
  }
  if (!existing.template) {
    throw new AppError("CONFLICT", "التقييم غير مرتبط بنموذج");
  }

  const questions = existing.template.questions.map(toQuestionLike);
  const { rows, score } = buildAnswers(questions, input.answers, input.submit);
  const status = input.submit ? EvaluationStatus.PENDING : EvaluationStatus.DRAFT;

  const evaluation = await prisma.$transaction(async (tx) => {
    await tx.answer.deleteMany({ where: { evaluationId: id } });
    return tx.evaluation.update({
      where: { id },
      data: {
        status,
        score,
        submittedAt: input.submit ? new Date() : null,
        answers: { create: answerCreateData(rows) },
      },
      include: LIST_INCLUDE,
    });
  });

  if (input.submit) {
    await notifyReviewers(user, existing.employee.name, id, {
      supervisorId: existing.employee.supervisorId,
    });
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

export async function reviewEvaluation(
  user: SessionUser,
  meta: RequestMeta,
  id: string,
  input: ReviewEvaluationInput,
) {
  // Must match what scopeForRole lets a supervisor see, or the approval queue
  // shows rows that answer "التقييم غير موجود" when acted on. Reviewers act on
  // the pending queue regardless of whether the employee is linked to them.
  const evaluation = await prisma.evaluation.findFirst({
    where: {
      id,
      tenantId: user.tenantId,
      deletedAt: null,
      ...scopeForRole(user),
    },
    include: { evaluator: { select: { id: true } }, employee: { select: { name: true } } },
  });
  if (!evaluation) throw AppError.notFound("التقييم غير موجود");
  if (evaluation.status !== EvaluationStatus.PENDING) {
    throw new AppError("CONFLICT", "لا يمكن مراجعة تقييم ليس بحالة الانتظار");
  }

  const approved = input.decision === "APPROVE";
  const updated = await prisma.evaluation.update({
    where: { id },
    data: {
      status: approved ? EvaluationStatus.APPROVED : EvaluationStatus.REJECTED,
      reviewerId: user.id,
      reviewedAt: new Date(),
      rejectionReason: approved ? null : input.reason ?? null,
    },
    include: LIST_INCLUDE,
  });

  await notify({
    tenantId: user.tenantId,
    userId: evaluation.evaluator.id,
    type: approved ? NotificationType.APPROVAL : NotificationType.REJECTION,
    title: approved ? "تم اعتماد التقييم" : "تم رفض التقييم",
    body: approved
      ? `تم اعتماد تقييمك للموظف ${evaluation.employee.name}.`
      : `تم رفض تقييمك للموظف ${evaluation.employee.name}. السبب: ${input.reason}`,
    data: { evaluationId: id },
  });

  await writeAudit({
    tenantId: user.tenantId,
    actorId: user.id,
    action: approved ? AuditAction.APPROVE : AuditAction.REJECT,
    entity: "Evaluation",
    entityId: id,
    before: { status: EvaluationStatus.PENDING },
    after: { status: updated.status, reason: input.reason },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  publishToTenant(user.tenantId, { type: "data-changed", entity: "evaluation" });
  return updated;
}
