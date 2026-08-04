import "server-only";
import { cache } from "react";
import { verifyAccessToken } from "@/infrastructure/security/jwt";
import { readAccessToken } from "./cookies";
import { prisma } from "@/infrastructure/db/prisma";
import { AppError } from "@/core/application/errors";
import { can, canAll, canAny, type Permission } from "@/core/domain/permissions";
import type { Role } from "@/core/domain/enums";

export interface SessionUser {
  id: string;
  tenantId: string;
  role: Role;
  name: string;
}

/**
 * Resolve the current user from the access-token cookie. Returns null when
 * unauthenticated (does NOT attempt refresh — that happens at the API layer).
 * `cache` dedupes within a single server render/request.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = await readAccessToken();
  if (!token) return null;
  try {
    const claims = await verifyAccessToken(token);
    // Enforce account status live: a deleted or deactivated user is rejected on
    // their very next request — not only when the access token finally expires —
    // so removing someone signs them out for real. `cache` runs this once per
    // request. `role` comes from the DB too, so a role change takes effect now.
    const account = await prisma.user.findFirst({
      where: { id: claims.sub, deletedAt: null, isActive: true, tenant: { deletedAt: null, isActive: true } },
      select: { id: true, tenantId: true, role: true, name: true },
    });
    if (!account) return null;
    return {
      id: account.id,
      tenantId: account.tenantId,
      role: account.role,
      name: account.name,
    };
  } catch {
    return null;
  }
});

/** Require an authenticated user or throw 401. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw AppError.unauthorized();
  return user;
}

/** Require a specific permission or throw 403. */
export async function requirePermission(
  permission: Permission,
): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user.role, permission)) throw AppError.forbidden();
  return user;
}

export async function requireAnyPermission(
  permissions: Permission[],
): Promise<SessionUser> {
  const user = await requireUser();
  if (!canAny(user.role, permissions)) throw AppError.forbidden();
  return user;
}

export async function requireAllPermissions(
  permissions: Permission[],
): Promise<SessionUser> {
  const user = await requireUser();
  if (!canAll(user.role, permissions)) throw AppError.forbidden();
  return user;
}
