import { z } from "zod";
import { nanoid } from "nanoid";
import { prisma } from "@/infrastructure/db/prisma";
import { hashPassword } from "@/infrastructure/security/password";
import { writeAudit } from "@/infrastructure/audit/audit-log";
import { AppError } from "@/core/application/errors";
import { AuditAction, Role } from "@/core/domain/enums";
import { canCreateRole } from "@/core/domain/permissions";
import type { SessionUser } from "@/infrastructure/auth/session";
import type { RequestMeta } from "@/core/application/auth/dto";

export const createManagerSchema = z.object({
  name: z.string().trim().min(2, "الاسم مطلوب").max(150),
  email: z.string().trim().toLowerCase().email("بريد غير صالح").optional().or(z.literal("")),
  role: z.enum([Role.EVALUATOR, Role.SUPERVISOR, Role.MANAGEMENT]).default(Role.EVALUATOR),
});
export type CreateManagerInput = z.infer<typeof createManagerSchema>;

function tempPassword(): string {
  // Readable-ish temporary password the admin shares once.
  return `Mab@${nanoid(8)}`;
}

/**
 * Create a login for a direct-manager / evaluator by name, then auto-link every
 * employee whose `directManager` matches that name to the new account — so the
 * manager immediately sees exactly their own team.
 *
 * Who may create whom is decided by CREATABLE_ROLES, not here: a reviewer mints
 * evaluators, الإدارة also mints reviewers, IT mints anything. Requesting a role
 * above your own is rejected rather than silently downgraded — a silent
 * downgrade hands over an account with quietly different powers.
 */
export async function createManagerFromName(
  user: SessionUser,
  meta: RequestMeta,
  input: CreateManagerInput,
) {
  const role = input.role;
  if (!canCreateRole(user.role, role)) {
    throw AppError.forbidden("لا تملك صلاحية إنشاء حساب بهذا الدور");
  }
  const name = input.name.trim();

  // Resolve a unique email (provided or generated).
  let email = input.email?.trim();
  if (!email) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { slug: true },
    });
    email = `mgr-${nanoid(6).toLowerCase()}@${tenant?.slug ?? "ems"}.local`;
  }
  const clash = await prisma.user.findFirst({
    where: { tenantId: user.tenantId, email, deletedAt: null },
    select: { id: true },
  });
  if (clash) throw new AppError("CONFLICT", "البريد الإلكتروني مستخدم بالفعل");

  const password = tempPassword();
  const created = await prisma.user.create({
    data: {
      tenantId: user.tenantId,
      name,
      email,
      role,
      passwordHash: await hashPassword(password),
      isActive: true,
    },
    select: { id: true, name: true, email: true, role: true },
  });

  // Auto-link this manager's team: employees imported with a matching
  // directManager name. Supervisors are linked as supervisor; evaluators as evaluator.
  const linkField = role === Role.SUPERVISOR ? "supervisorId" : "evaluatorId";
  const linked = await prisma.employee.updateMany({
    where: {
      tenantId: user.tenantId,
      deletedAt: null,
      directManager: { equals: name, mode: "insensitive" },
    },
    data: { [linkField]: created.id },
  });

  await writeAudit({
    tenantId: user.tenantId,
    actorId: user.id,
    action: AuditAction.CREATE,
    entity: "User",
    entityId: created.id,
    after: { name, email, role, linkedEmployees: linked.count },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return { user: created, linkedCount: linked.count, temporaryPassword: password };
}
