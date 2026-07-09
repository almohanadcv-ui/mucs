import { z } from "zod";
import { prisma } from "@/infrastructure/db/prisma";
import { writeAudit } from "@/infrastructure/audit/audit-log";
import { AuditAction, Role } from "@/core/domain/enums";
import type { SessionUser } from "@/infrastructure/auth/session";
import type { RequestMeta } from "@/core/application/auth/dto";

export const createCustomEmployeeSchema = z.object({
  name: z.string().min(1, "الاسم مطلوب"),
  employeeNo: z.string().optional(),
  nameEn: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  nationalId: z.string().optional(),
  departmentName: z.string().optional(),
  jobTitle: z.string().optional(),
  evaluatorId: z.string().uuid().optional(),
});
export type CreateCustomEmployeeInput = z.infer<typeof createCustomEmployeeSchema>;

export const listCustomEmployeesSchema = z.object({
  search: z.string().optional(),
});
export type ListCustomEmployeesInput = z.infer<typeof listCustomEmployeesSchema>;

/**
 * Employees added manually by a Reviewer/Evaluator when they're missing from the
 * imported master file. Stored in a SEPARATE table so the authoritative company
 * data is never mutated. Evaluators only see (and own) the ones they created.
 */
export async function createCustomEmployee(
  user: SessionUser,
  meta: RequestMeta,
  input: CreateCustomEmployeeInput,
) {
  // Evaluators can only create custom employees linked to themselves.
  const evaluatorId =
    user.role === Role.EVALUATOR ? user.id : input.evaluatorId ?? null;

  const record = await prisma.customEmployee.create({
    data: {
      tenantId: user.tenantId,
      createdById: user.id,
      name: input.name,
      employeeNo: input.employeeNo || null,
      nameEn: input.nameEn || null,
      email: input.email || null,
      nationalId: input.nationalId || null,
      departmentName: input.departmentName || null,
      jobTitle: input.jobTitle || null,
      evaluatorId,
    },
  });
  await writeAudit({
    tenantId: user.tenantId,
    actorId: user.id,
    action: AuditAction.CREATE,
    entity: "CustomEmployee",
    entityId: record.id,
    after: record,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  return record;
}

export async function listCustomEmployees(
  user: SessionUser,
  input: ListCustomEmployeesInput,
) {
  const search = input.search?.trim();
  return prisma.customEmployee.findMany({
    where: {
      tenantId: user.tenantId,
      deletedAt: null,
      // Reviewers/Admins see all; Evaluators see only their own.
      ...(user.role === Role.EVALUATOR ? { evaluatorId: user.id } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { employeeNo: { contains: search, mode: "insensitive" } },
              { nationalId: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}
