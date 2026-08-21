import "server-only";
import { prisma } from "./db";

/** Record an admin/security event. Best-effort — never fails the caller. */
export async function audit(entry: {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  meta?: unknown;
  ip?: string | null;
}): Promise<void> {
  try {
    await prisma.portalAuditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        actorEmail: entry.actorEmail ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        meta: (entry.meta ?? undefined) as never,
        ip: entry.ip ?? null,
      },
    });
  } catch (err) {
    console.error("[portal] audit write failed:", err);
  }
}
