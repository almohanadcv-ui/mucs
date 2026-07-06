import { Prisma } from "@prisma/client";
import { prisma } from "@/infrastructure/db/prisma";
import { hashPassword } from "@/infrastructure/security/password";
import { writeAudit } from "@/infrastructure/audit/audit-log";
import { AppError } from "@/core/application/errors";
import { AuditAction } from "@/core/domain/enums";
import { buildMeta, toSkipTake, type Paginated } from "@/lib/pagination";
import type { SessionUser } from "@/infrastructure/auth/session";
import type { RequestMeta } from "@/core/application/auth/dto";
import type { CreateUserInput, UpdateUserInput, ListUsersInput } from "./dto";

const PUBLIC_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  twoFactorEnabled: true,
  lastLoginAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export async function listUsers(
  user: SessionUser,
  input: ListUsersInput,
): Promise<Paginated<unknown>> {
  const where: Prisma.UserWhereInput = {
    tenantId: user.tenantId,
    deletedAt: null,
    ...(input.role ? { role: input.role } : {}),
    ...(input.search
      ? {
          OR: [
            { name: { contains: input.search, mode: "insensitive" } },
            { email: { contains: input.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...toSkipTake(input),
      select: PUBLIC_SELECT,
    }),
    prisma.user.count({ where }),
  ]);
  return { items, meta: buildMeta(input, total) };
}

export async function createUser(
  user: SessionUser,
  meta: RequestMeta,
  input: CreateUserInput,
) {
  const clash = await prisma.user.findFirst({
    where: { tenantId: user.tenantId, email: input.email, deletedAt: null },
    select: { id: true },
  });
  if (clash) throw new AppError("CONFLICT", "البريد الإلكتروني مستخدم بالفعل");

  const created = await prisma.user.create({
    data: {
      tenantId: user.tenantId,
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      role: input.role,
      emailVerifiedAt: new Date(),
      isActive: true,
    },
    select: PUBLIC_SELECT,
  });
  await writeAudit({
    tenantId: user.tenantId,
    actorId: user.id,
    action: AuditAction.CREATE,
    entity: "User",
    entityId: created.id,
    after: { email: created.email, role: created.role },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  return created;
}

export async function updateUser(
  user: SessionUser,
  meta: RequestMeta,
  id: string,
  input: UpdateUserInput,
) {
  const target = await prisma.user.findFirst({
    where: { id, tenantId: user.tenantId, deletedAt: null },
    select: { id: true, role: true, isActive: true },
  });
  if (!target) throw AppError.notFound("المستخدم غير موجود");
  // Prevent an admin from demoting/deactivating themselves.
  if (id === user.id && (input.role || input.isActive === false)) {
    throw AppError.validation("لا يمكنك تعديل دورك أو تعطيل حسابك");
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.password ? { passwordHash: await hashPassword(input.password) } : {}),
    },
    select: PUBLIC_SELECT,
  });
  await writeAudit({
    tenantId: user.tenantId,
    actorId: user.id,
    action: AuditAction.UPDATE,
    entity: "User",
    entityId: id,
    after: { role: updated.role, isActive: updated.isActive, passwordChanged: !!input.password },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  return updated;
}

export async function deleteUser(
  user: SessionUser,
  meta: RequestMeta,
  id: string,
) {
  if (id === user.id) throw AppError.validation("لا يمكنك حذف حسابك");
  const target = await prisma.user.findFirst({
    where: { id, tenantId: user.tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!target) throw AppError.notFound("المستخدم غير موجود");

  const deleted = await prisma.user.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
    select: { id: true },
  });
  await writeAudit({
    tenantId: user.tenantId,
    actorId: user.id,
    action: AuditAction.DELETE,
    entity: "User",
    entityId: id,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  return deleted;
}
