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
 * Which employees belong to an evaluator: the ones explicitly linked to them,
 * plus the ones whose imported «المدير المباشر» is this evaluator's name.
 *
 * The name match exists because linking only happens when the account is
 * created — employees imported afterwards would otherwise never be linked, and
 * the evaluator would see an empty list.
 *
 * Single source of truth: `evaluatorOwns` must stay equivalent to this filter,
 * or an evaluator could see employees they cannot act on (or the reverse).
 */
export function evaluatorScope(user: SessionUser): Prisma.EmployeeWhereInput {
  return {
    OR: [
      { evaluatorId: user.id },
      { directManager: { equals: user.name, mode: "insensitive" } },
    ],
  };
}

/** In-memory counterpart of `evaluatorScope`, for checks on a loaded row. */
export function evaluatorOwns(
  user: SessionUser,
  employee: { evaluatorId: string | null; directManager: string | null },
): boolean {
  if (employee.evaluatorId === user.id) return true;
  const manager = employee.directManager?.trim().toLowerCase();
  return !!manager && manager === user.name.trim().toLowerCase();
}

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
      return evaluatorScope(user);
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
    ...(input.status ? { status: input.status } : {}),
    ...(input.branchId ? { branchId: input.branchId } : {}),
    ...(input.departmentId ? { departmentId: input.departmentId } : {}),
    ...(input.supervisorId ? { supervisorId: input.supervisorId } : {}),
    ...(input.evaluatorId ? { evaluatorId: input.evaluatorId } : {}),
    // AND-combined: the role scope and the search each carry their own OR, so
    // merging them at the top level would let the search clobber the scope.
    AND: [
      scopeForRole(user),
      input.search
        ? {
            OR: [
              { name: { contains: input.search, mode: "insensitive" } },
              { nameEn: { contains: input.search, mode: "insensitive" } },
              { employeeNo: { contains: input.search, mode: "insensitive" } },
              { nationalId: { contains: input.search, mode: "insensitive" } },
              { jobTitle: { contains: input.search, mode: "insensitive" } },
            ],
          }
        : {},
    ],
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

/**
 * Type-ahead search for the evaluation picker: matches name / English name /
 * employee number / national id, role-scoped, capped for speed. Returns the
 * minimal fields the dropdown needs so the evaluator picks once and everything
 * auto-fills.
 */
export async function searchEmployeesForPicker(
  user: SessionUser,
  q: string,
  limit = 20,
) {
  const term = q.trim();
  if (!term) return [];
  const where: Prisma.EmployeeWhereInput = {
    tenantId: user.tenantId,
    deletedAt: null,
    // AND-combined so the search terms can't clobber the role scope's OR.
    AND: [
      scopeForRole(user),
      {
        OR: [
          { name: { contains: term, mode: "insensitive" } },
          { nameEn: { contains: term, mode: "insensitive" } },
          { employeeNo: { contains: term, mode: "insensitive" } },
          { nationalId: { contains: term, mode: "insensitive" } },
        ],
      },
    ],
  };
  return prisma.employee.findMany({
    where,
    take: Math.min(limit, 50),
    orderBy: { name: "asc" },
    select: {
      id: true,
      employeeNo: true,
      name: true,
      nameEn: true,
      jobTitle: true,
      department: { select: { name: true } },
      branch: { select: { name: true } },
      evaluator: { select: { name: true } },
    },
  });
}

/** Full employee profile: master data + evaluation history + summary stats. */
export async function getEmployeeProfile(user: SessionUser, id: string) {
  const employee = await getEmployee(user, id); // enforces scope
  const evaluations = await prisma.evaluation.findMany({
    where: { employeeId: id, tenantId: user.tenantId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      score: true,
      status: true,
      submittedAt: true,
      createdAt: true,
      template: { select: { title: true } },
      evaluator: { select: { name: true } },
    },
  });
  const scored = evaluations.filter(
    (e) => e.score != null && (e.status === "APPROVED" || e.status === "PENDING"),
  );
  const average =
    scored.length > 0
      ? Math.round((scored.reduce((s, e) => s + (e.score ?? 0), 0) / scored.length) * 10) / 10
      : null;
  return {
    employee,
    evaluations,
    stats: {
      count: evaluations.length,
      scoredCount: scored.length,
      average,
      last: scored[0]?.score ?? null,
    },
  };
}

export interface TopEmployeesFilter {
  threshold?: number;
  departmentId?: string;
  branchId?: string;
  evaluatorId?: string;
}

/** Top 10 employees whose average (approved/pending) score meets a threshold. */
export async function getTopEmployees(user: SessionUser, opts: TopEmployeesFilter) {
  const threshold = opts.threshold ?? 90;
  const grouped = await prisma.evaluation.groupBy({
    by: ["employeeId"],
    where: {
      tenantId: user.tenantId,
      deletedAt: null,
      status: { in: ["APPROVED", "PENDING"] },
      score: { not: null },
      employee: {
        deletedAt: null,
        ...scopeForRole(user),
        ...(opts.departmentId ? { departmentId: opts.departmentId } : {}),
        ...(opts.branchId ? { branchId: opts.branchId } : {}),
        ...(opts.evaluatorId ? { evaluatorId: opts.evaluatorId } : {}),
      },
    },
    _avg: { score: true },
    _count: { _all: true },
  });

  const qualified = grouped
    .filter((g) => (g._avg.score ?? 0) >= threshold)
    .sort((a, b) => (b._avg.score ?? 0) - (a._avg.score ?? 0))
    .slice(0, 10);

  const ids = qualified.map((g) => g.employeeId);
  if (ids.length === 0) return [];
  const emps = await prisma.employee.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      name: true,
      employeeNo: true,
      department: { select: { name: true } },
    },
  });
  const byId = new Map(emps.map((e) => [e.id, e]));
  return qualified
    .map((g) => {
      const e = byId.get(g.employeeId);
      if (!e) return null;
      return {
        id: e.id,
        name: e.name,
        employeeNo: e.employeeNo,
        department: e.department?.name ?? null,
        average: Math.round((g._avg.score ?? 0) * 10) / 10,
        count: g._count._all,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
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
      nameEn: input.nameEn ?? null,
      email: input.email || null,
      nationalId: input.nationalId ?? null,
      nationality: input.nationality ?? null,
      gender: input.gender ?? null,
      jobTitle: input.jobTitle ?? null,
      directManager: input.directManager ?? null,
      birthDate: input.birthDate ?? null,
      contractEndDate: input.contractEndDate ?? null,
      probationStartDate: input.probationStartDate ?? null,
      probationEndDate: input.probationEndDate ?? null,
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
      ...(input.nameEn !== undefined ? { nameEn: input.nameEn } : {}),
      ...(input.email !== undefined ? { email: input.email || null } : {}),
      ...(input.nationalId !== undefined ? { nationalId: input.nationalId } : {}),
      ...(input.nationality !== undefined ? { nationality: input.nationality } : {}),
      ...(input.gender !== undefined ? { gender: input.gender } : {}),
      ...(input.jobTitle !== undefined ? { jobTitle: input.jobTitle } : {}),
      ...(input.directManager !== undefined ? { directManager: input.directManager } : {}),
      ...(input.birthDate !== undefined ? { birthDate: input.birthDate } : {}),
      ...(input.contractEndDate !== undefined ? { contractEndDate: input.contractEndDate } : {}),
      ...(input.probationStartDate !== undefined ? { probationStartDate: input.probationStartDate } : {}),
      ...(input.probationEndDate !== undefined ? { probationEndDate: input.probationEndDate } : {}),
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
