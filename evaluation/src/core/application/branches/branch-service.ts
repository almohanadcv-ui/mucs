import { Prisma } from "@prisma/client";
import { prisma } from "@/infrastructure/db/prisma";
import { writeAudit } from "@/infrastructure/audit/audit-log";
import { AppError } from "@/core/application/errors";
import { AuditAction } from "@/core/domain/enums";
import {
  buildMeta,
  toSkipTake,
  type PaginationInput,
  type Paginated,
} from "@/lib/pagination";
import type { SessionUser } from "@/infrastructure/auth/session";
import type { RequestMeta } from "@/core/application/auth/dto";
import type { CreateBranchInput, UpdateBranchInput } from "./dto";

const SORTABLE = new Set(["name", "code", "createdAt"]);

function orderBy(input: PaginationInput): Prisma.BranchOrderByWithRelationInput {
  const field = input.sortBy && SORTABLE.has(input.sortBy) ? input.sortBy : "createdAt";
  return { [field]: input.sortDir };
}

export async function listBranches(
  user: SessionUser,
  input: PaginationInput,
): Promise<Paginated<unknown>> {
  const where: Prisma.BranchWhereInput = {
    tenantId: user.tenantId,
    deletedAt: null,
    ...(input.search
      ? {
          OR: [
            { name: { contains: input.search, mode: "insensitive" } },
            { code: { contains: input.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.branch.findMany({
      where,
      orderBy: orderBy(input),
      ...toSkipTake(input),
      include: { _count: { select: { departments: true, employees: true } } },
    }),
    prisma.branch.count({ where }),
  ]);

  return { items, meta: buildMeta(input, total) };
}

export async function getBranch(user: SessionUser, id: string) {
  const branch = await prisma.branch.findFirst({
    where: { id, tenantId: user.tenantId, deletedAt: null },
    include: { _count: { select: { departments: true, employees: true } } },
  });
  if (!branch) throw AppError.notFound("الفرع غير موجود");
  return branch;
}

export async function createBranch(
  user: SessionUser,
  meta: RequestMeta,
  input: CreateBranchInput,
) {
  const exists = await prisma.branch.findFirst({
    where: { tenantId: user.tenantId, code: input.code, deletedAt: null },
    select: { id: true },
  });
  if (exists) throw new AppError("CONFLICT", "رمز الفرع مستخدم بالفعل");

  const branch = await prisma.branch.create({
    data: {
      tenantId: user.tenantId,
      name: input.name,
      code: input.code,
      address: input.address ?? null,
    },
  });

  await writeAudit({
    tenantId: user.tenantId,
    actorId: user.id,
    action: AuditAction.CREATE,
    entity: "Branch",
    entityId: branch.id,
    after: branch,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  return branch;
}

export async function updateBranch(
  user: SessionUser,
  meta: RequestMeta,
  id: string,
  input: UpdateBranchInput,
) {
  const before = await getBranch(user, id);

  if (input.code && input.code !== before.code) {
    const clash = await prisma.branch.findFirst({
      where: {
        tenantId: user.tenantId,
        code: input.code,
        deletedAt: null,
        NOT: { id },
      },
      select: { id: true },
    });
    if (clash) throw new AppError("CONFLICT", "رمز الفرع مستخدم بالفعل");
  }

  const branch = await prisma.branch.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.code !== undefined ? { code: input.code } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
    },
  });

  await writeAudit({
    tenantId: user.tenantId,
    actorId: user.id,
    action: AuditAction.UPDATE,
    entity: "Branch",
    entityId: id,
    before,
    after: branch,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  return branch;
}

export async function deleteBranch(
  user: SessionUser,
  meta: RequestMeta,
  id: string,
) {
  const before = await getBranch(user, id);
  const branch = await prisma.branch.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  await writeAudit({
    tenantId: user.tenantId,
    actorId: user.id,
    action: AuditAction.DELETE,
    entity: "Branch",
    entityId: id,
    before,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  return branch;
}
