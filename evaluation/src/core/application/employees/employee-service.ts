import { Prisma } from "@prisma/client";
import { prisma } from "@/infrastructure/db/prisma";
import { writeAudit } from "@/infrastructure/audit/audit-log";
import { AppError } from "@/core/application/errors";
import { AuditAction, Role } from "@/core/domain/enums";
import { buildMeta, toSkipTake, type Paginated } from "@/lib/pagination";
import type { SessionUser } from "@/infrastructure/auth/session";
import type { RequestMeta } from "@/core/application/auth/dto";
import type {
  CreateEmployeeInput,
  UpdateEmployeeInput,
  ListEmployeesInput,
} from "./dto";

const EMPLOYEE_INCLUDE = {
  branch: { select: { id: true, name: true } },
  department: { select: { id: true, name: true } },
  supervisor: { select: { id: true, name: true } },
  evaluator: { select: { id: true, name: true } },
} satisfies Prisma.EmployeeInclude;

/**
 * Restrict visibility by role:
 * - ADMIN: entire tenant
 * - SUPERVISOR: only employees they supervise
 * - EVALUATOR: only employees assigned to them for evaluation
 */
function scopeForRole(user: SessionUser): Prisma.EmployeeWhereInput {
  switch (user.role) {
    case Role.ADMIN:
      return {};
    case Role.SUPERVISOR:
      return { supervisorId: user.id };
    case Role.EVALUATOR:
      return { evaluatorId: user.id };
    default:
      return { id: "__none__" };
  }
}

export async function listEmployees(
  user: SessionUser,
  input: ListEmployeesInput,
): Promise<Paginated<unknown>> {
  const where: Prisma.EmployeeWhereInput = {
    tenantId: user.tenantId,
    deletedAt: null,
    ...scopeForRole(user),
    ...(input.status ? { status: input.status } : {}),
    ...(input.branchId ? { branchId: input.branchId } : {}),
    ...(input.departmentId ? { departmentId: input.departmentId } : {}),
    ...(input.supervisorId ? { supervisorId: input.supervisorId } : {}),
    ...(input.evaluatorId ? { evaluatorId: input.evaluatorId } : {}),
    ...(input.search
      ? {
          OR: [
            { name: { contains: input.search, mode: "insensitive" } },
            { employeeNo: { contains: input.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.employee.findMany({
      where,
      orderBy: { createdAt: input.sortDir },
      ...toSkipTake(input),
      include: EMPLOYEE_INCLUDE,
    }),
    prisma.employee.count({ where }),
  ]);
  return { items, meta: buildMeta(input, total) };
}

export async function getEmployee(user: SessionUser, id: string) {
  const employee = await prisma.employee.findFirst({
    where: {
      id,
      tenantId: user.tenantId,
      deletedAt: null,
      ...scopeForRole(user),
    },
    include: EMPLOYEE_INCLUDE,
  });
  if (!employee) throw AppError.notFound("الموظف غير موجود");
  return employee;
}

/** Validate that referenced org/user rows belong to the same tenant. */
async function assertRefs(
  user: SessionUser,
  refs: Pick<
    CreateEmployeeInput,
    "branchId" | "departmentId" | "supervisorId" | "evaluatorId"
  >,
) {
  const checks: Promise<void>[] = [];
  if (refs.branchId) {
    checks.push(
      prisma.branch
        .findFirst({ where: { id: refs.branchId, tenantId: user.tenantId, deletedAt: null }, select: { id: true } })
        .then((b) => {
          if (!b) throw AppError.validation("الفرع غير موجود");
        }),
    );
  }
  if (refs.departmentId) {
    checks.push(
      prisma.department
        .findFirst({ where: { id: refs.departmentId, tenantId: user.tenantId, deletedAt: null }, select: { id: true } })
        .then((d) => {
          if (!d) throw AppError.validation("القسم غير موجود");
        }),
    );
  }
  for (const [key, role, label] of [
    ["supervisorId", Role.SUPERVISOR, "المشرف"],
    ["evaluatorId", Role.EVALUATOR, "المقيّم"],
  ] as const) {
    const val = refs[key];
    if (val) {
      checks.push(
        prisma.user
          .findFirst({ where: { id: val, tenantId: user.tenantId, deletedAt: null }, select: { role: true } })
          .then((u) => {
            if (!u) throw AppError.validation(`${label} غير موجود`);
          }),
      );
    }
  }
  await Promise.all(checks);
}

export async function createEmployee(
  user: SessionUser,
  meta: RequestMeta,
  input: CreateEmployeeInput,
) {
  // Supervisors can only create employees on their own team.
  const supervisorId =
    user.role === Role.SUPERVISOR ? user.id : input.supervisorId ?? null;
  // Evaluators can only create employees linked to themselves.
  const evaluatorId =
    user.role === Role.EVALUATOR ? user.id : input.evaluatorId ?? null;

  await assertRefs(user, { ...input, supervisorId, evaluatorId });

  const clash = await prisma.employee.findFirst({
    where: { tenantId: user.tenantId, employeeNo: input.employeeNo, deletedAt: null },
    select: { id: true },
  });
  if (clash) throw new AppError("CONFLICT", "الرقم الوظيفي مستخدم بالفعل");

  const employee = await prisma.employee.create({
    data: {
      tenantId: user.tenantId,
      employeeNo: input.employeeNo,
      name: input.name,
      avatarUrl: input.avatarUrl ?? null,
      status: input.status,
      joinedAt: input.joinedAt ?? null,
      contractStartDate: input.contractStartDate ?? null,
      contractMonths: input.contractMonths ?? null,
      probationMonths: input.probationMonths ?? null,
      branchId: input.branchId ?? null,
      departmentId: input.departmentId ?? null,
      supervisorId,
      evaluatorId,
    },
    include: EMPLOYEE_INCLUDE,
  });
  await writeAudit({
    tenantId: user.tenantId,
    actorId: user.id,
    action: AuditAction.CREATE,
    entity: "Employee",
    entityId: employee.id,
    after: employee,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  return employee;
}

export async function updateEmployee(
  user: SessionUser,
  meta: RequestMeta,
  id: string,
  input: UpdateEmployeeInput,
) {
  const before = await getEmployee(user, id); // enforces scope
  await assertRefs(user, input);

  if (input.employeeNo && input.employeeNo !== before.employeeNo) {
    const clash = await prisma.employee.findFirst({
      where: {
        tenantId: user.tenantId,
        employeeNo: input.employeeNo,
        deletedAt: null,
        NOT: { id },
      },
      select: { id: true },
    });
    if (clash) throw new AppError("CONFLICT", "الرقم الوظيفي مستخدم بالفعل");
  }

  const employee = await prisma.employee.update({
    where: { id },
    data: {
      ...(input.employeeNo !== undefined ? { employeeNo: input.employeeNo } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.joinedAt !== undefined ? { joinedAt: input.joinedAt } : {}),
      ...(input.contractStartDate !== undefined ? { contractStartDate: input.contractStartDate } : {}),
      ...(input.contractMonths !== undefined ? { contractMonths: input.contractMonths } : {}),
      ...(input.probationMonths !== undefined ? { probationMonths: input.probationMonths } : {}),
      ...(input.branchId !== undefined ? { branchId: input.branchId } : {}),
      ...(input.departmentId !== undefined ? { departmentId: input.departmentId } : {}),
      ...(input.supervisorId !== undefined && user.role === Role.ADMIN
        ? { supervisorId: input.supervisorId }
        : {}),
      ...(input.evaluatorId !== undefined ? { evaluatorId: input.evaluatorId } : {}),
    },
    include: EMPLOYEE_INCLUDE,
  });
  await writeAudit({
    tenantId: user.tenantId,
    actorId: user.id,
    action: AuditAction.UPDATE,
    entity: "Employee",
    entityId: id,
    before,
    after: employee,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  return employee;
}

export async function deleteEmployee(
  user: SessionUser,
  meta: RequestMeta,
  id: string,
) {
  const before = await getEmployee(user, id);
  const employee = await prisma.employee.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  await writeAudit({
    tenantId: user.tenantId,
    actorId: user.id,
    action: AuditAction.DELETE,
    entity: "Employee",
    entityId: id,
    before,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  return employee;
}
