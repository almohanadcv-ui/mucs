import { Prisma } from "@prisma/client";
import { prisma } from "@/infrastructure/db/prisma";
import { writeAudit } from "@/infrastructure/audit/audit-log";
import { AppError } from "@/core/application/errors";
import { AuditAction } from "@/core/domain/enums";
import { buildMeta, toSkipTake, type Paginated } from "@/lib/pagination";
import type { SessionUser } from "@/infrastructure/auth/session";
import type { RequestMeta } from "@/core/application/auth/dto";
import type {
  CreateTemplateInput,
  UpdateTemplateInput,
  QuestionInput,
  listTemplatesSchema,
} from "./dto";
import type { z } from "zod";

type ListInput = z.infer<typeof listTemplatesSchema>;

function questionCreateData(questions: QuestionInput[]) {
  return questions.map((q, i) => ({
    type: q.type,
    label: q.label,
    helpText: q.helpText ?? null,
    required: q.required,
    order: q.order ?? i,
    config: (q.config ?? undefined) as Prisma.InputJsonValue | undefined,
  }));
}

export async function listTemplates(
  user: SessionUser,
  input: ListInput,
): Promise<Paginated<unknown>> {
  const where: Prisma.EvaluationTemplateWhereInput = {
    tenantId: user.tenantId,
    deletedAt: null,
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    ...(input.search
      ? { title: { contains: input.search, mode: "insensitive" } }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.evaluationTemplate.findMany({
      where,
      orderBy: { createdAt: input.sortDir },
      ...toSkipTake(input),
      include: {
        createdBy: { select: { id: true, name: true } },
        _count: { select: { questions: true, evaluations: true } },
      },
    }),
    prisma.evaluationTemplate.count({ where }),
  ]);
  return { items, meta: buildMeta(input, total) };
}

export async function getTemplate(user: SessionUser, id: string) {
  const template = await prisma.evaluationTemplate.findFirst({
    where: { id, tenantId: user.tenantId, deletedAt: null },
    include: {
      createdBy: { select: { id: true, name: true } },
      questions: { orderBy: { order: "asc" } },
    },
  });
  if (!template) throw AppError.notFound("النموذج غير موجود");
  return template;
}

export async function createTemplate(
  user: SessionUser,
  meta: RequestMeta,
  input: CreateTemplateInput,
) {
  const template = await prisma.evaluationTemplate.create({
    data: {
      tenantId: user.tenantId,
      title: input.title,
      description: input.description ?? null,
      isActive: input.isActive,
      createdById: user.id,
      questions: { create: questionCreateData(input.questions) },
    },
    include: { questions: { orderBy: { order: "asc" } } },
  });
  await writeAudit({
    tenantId: user.tenantId,
    actorId: user.id,
    action: AuditAction.CREATE,
    entity: "EvaluationTemplate",
    entityId: template.id,
    after: { id: template.id, title: template.title, questions: template.questions.length },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  return template;
}

export async function updateTemplate(
  user: SessionUser,
  meta: RequestMeta,
  id: string,
  input: UpdateTemplateInput,
) {
  const before = await getTemplate(user, id);

  const template = await prisma.$transaction(async (tx) => {
    // If a new question set is supplied, replace atomically. Existing questions
    // are soft-detached by hard-deleting only when they have no answers; if any
    // are referenced by evaluations we keep them (guard against Restrict FK).
    if (input.questions) {
      const withAnswers = await tx.answer.findFirst({
        where: { question: { templateId: id } },
        select: { id: true },
      });
      if (withAnswers) {
        throw new AppError(
          "CONFLICT",
          "لا يمكن تعديل الأسئلة بعد استخدام النموذج في تقييمات. أنشئ نموذجاً جديداً.",
        );
      }
      await tx.question.deleteMany({ where: { templateId: id } });
      await tx.question.createMany({
        data: questionCreateData(input.questions).map((q) => ({
          ...q,
          templateId: id,
        })),
      });
    }
    return tx.evaluationTemplate.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
      include: { questions: { orderBy: { order: "asc" } } },
    });
  });

  await writeAudit({
    tenantId: user.tenantId,
    actorId: user.id,
    action: AuditAction.UPDATE,
    entity: "EvaluationTemplate",
    entityId: id,
    before: { title: before.title, questions: before.questions.length },
    after: { title: template.title, questions: template.questions.length },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  return template;
}

export async function deleteTemplate(
  user: SessionUser,
  meta: RequestMeta,
  id: string,
) {
  const before = await getTemplate(user, id);
  const template = await prisma.evaluationTemplate.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });
  await writeAudit({
    tenantId: user.tenantId,
    actorId: user.id,
    action: AuditAction.DELETE,
    entity: "EvaluationTemplate",
    entityId: id,
    before: { title: before.title },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  return template;
}
