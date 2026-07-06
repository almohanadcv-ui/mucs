import { Prisma } from "@prisma/client";
import { prisma } from "@/infrastructure/db/prisma";
import { buildMeta, toSkipTake, type Paginated } from "@/lib/pagination";
import type { SessionUser } from "@/infrastructure/auth/session";

export interface AuditQuery {
  page: number;
  pageSize: number;
  action?: string;
  entity?: string;
  from?: Date;
  to?: Date;
}

export async function listAuditLogs(
  user: SessionUser,
  q: AuditQuery,
): Promise<Paginated<unknown>> {
  const where: Prisma.AuditLogWhereInput = {
    tenantId: user.tenantId,
    ...(q.action ? { action: q.action as Prisma.EnumAuditActionFilter } : {}),
    ...(q.entity ? { entity: q.entity } : {}),
    ...(q.from || q.to
      ? { createdAt: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) } }
      : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...toSkipTake(q),
      include: { actor: { select: { id: true, name: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);
  return { items, meta: buildMeta(q, total) };
}
