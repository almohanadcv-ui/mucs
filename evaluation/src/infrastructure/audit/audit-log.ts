import { prisma } from "@/infrastructure/db/prisma";
import type { AuditAction } from "@/core/domain/enums";

export interface AuditContext {
  tenantId?: string | null;
  actorId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

export interface AuditEntry extends AuditContext {
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}

/**
 * Append an immutable audit record. Never throws into the caller's flow —
 * failing to write an audit line must not break the primary operation, but it
 * is logged to the server console for observability.
 */
export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: entry.tenantId ?? null,
        actorId: entry.actorId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        before: (entry.before ?? undefined) as never,
        after: (entry.after ?? undefined) as never,
        ip: entry.ip ?? null,
        userAgent: entry.userAgent ?? null,
      },
    });
  } catch (err) {
    console.error("[audit] failed to write audit log:", err);
  }
}
