import { Prisma } from "@prisma/client";
import { prisma } from "@/infrastructure/db/prisma";
import { writeAudit } from "@/infrastructure/audit/audit-log";
import { AppError } from "@/core/application/errors";
import { AuditAction } from "@/core/domain/enums";
import { buildMeta, toSkipTake, type Paginated } from "@/lib/pagination";
import type { SessionUser } from "@/infrastructure/auth/session";
import type { RequestMeta } from "@/core/application/auth/dto";
import type {
  CreateDepartmentInput,
  UpdateDepartmentInput,
  ListDepartmentsInput,
} from "./dto";

async function assertBranch(user: SessionUser, branchId?: string | null) {
  if (!branchId) return;
  const branch = await prisma.branch.findFirst({
    where: { id: branchId, tenantId: user.tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!branch) throw AppError.validation("الفرع المحدد غير موجود");
}

export async function listDepartments(
  user: SessionUser,
  input: ListDepartmentsInput,
): Promise<Paginated<unknown>> {
  const where: Prisma.DepartmentWhereInput = {
    tenantId: user.tenantId,
    deletedAt: null,
    ...(input.branchId ? { branchId: input.branchId } : {}),
    ...(input.search
      ? {
          OR: [
            { name: { contains: input.search, mode: "insensitive" } },
            { code: { contains: input.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.department.findMany({
      where,
      orderBy: { createdAt: input.sortDir },
      ...toSkipTake(input),
      include: {
        branch: { select: { id: true, name: true } },
        _count: { select: { employees: true } },
      },
    }),
    prisma.department.count({ where }),
  ]);
  return { items, meta: buildMeta(input, total) };
}

export async function getDepartment(user: SessionUser, id: string) {
  const dept = await prisma.department.findFirst({
    where: { id, tenantId: user.tenantId, deletedAt: null },
    include: { branch: { select: { id: true, name: true } } },
  });
  if (!dept) throw AppError.notFound("القسم غير موجود");
  return dept;
}

export async function createDepartment(
  user: SessionUser,
  meta: RequestMeta,
  input: CreateDepartmentInput,
) {
  await assertBranch(user, input.branchId);
  const clash = await prisma.department.findFirst({
    where: { tenantId: user.tenantId, code: input.code, deletedAt: null },
    select: { id: true },
  });
  if (clash) throw new AppError("CONFLICT", "رمز القسم مستخدم بالفعل");

  const dept = await prisma.department.create({
    data: {
      tenantId: user.tenantId,
      name: input.name,
      code: input.code,
      branchId: input.branchId ?? null,
    },
  });
  await writeAudit({
    tenantId: user.tenantId,
    actorId: user.id,
    action: AuditAction.CREATE,
    entity: "Department",
    entityId: dept.id,
    after: dept,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  return dept;
}

export async function updateDepartment(
  user: SessionUser,
  meta: RequestMeta,
  id: string,
  input: UpdateDepartmentInput,
) {
  const before = await getDepartment(user, id);
  if (input.branchId !== undefined) await assertBranch(user, input.branchId);
  if (input.code && input.code !== before.code) {
    const clash = await prisma.department.findFirst({
      where: {
        tenantId: user.tenantId,
        code: input.code,
        deletedAt: null,
        NOT: { id },
      },
      select: { id: true },
    });
    if (clash) throw new AppError("CONFLICT", "رمز القسم مستخدم بالفعل");
  }
  const dept = await prisma.department.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.code !== undefined ? { code: input.code } : {}),
      ...(input.branchId !== undefined ? { branchId: input.branchId } : {}),
    },
  });
  await writeAudit({
    tenantId: user.tenantId,
    actorId: user.id,
    action: AuditAction.UPDATE,
    entity: "Department",
    entityId: id,
    before,
    after: dept,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  return dept;
}

export async function deleteDepartment(
  user: SessionUser,
  meta: RequestMeta,
  id: string,
) {
  const before = await getDepartment(user, id);
  const dept = await prisma.department.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  await writeAudit({
    tenantId: user.tenantId,
    actorId: user.id,
    action: AuditAction.DELETE,
    entity: "Department",
    entityId: id,
    before,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  return dept;
}
