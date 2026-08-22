import "server-only";
import { cache } from "react";
import { verifyAccessToken } from "@/infrastructure/security/jwt";
import { readAccessToken } from "./cookies";
import { prisma } from "@/infrastructure/db/prisma";
import { AppError } from "@/core/application/errors";
import { effectivePermissions, type Permission } from "@/core/domain/permissions";
import type { Role } from "@/core/domain/enums";

export interface SessionUser {
  id: string;
  tenantId: string;
  role: Role;
  name: string;
  /** Portal-granted section keys (add to the role's permissions). */
  features: string[];
}

/** Does this user hold a permission, counting role + portal sections? */
export function userCan(user: SessionUser, permission: Permission): boolean {
  return effectivePermissions(user.role, user.features).has(permission);
}
export function userCanAny(user: SessionUser, permissions: Permission[]): boolean {
  const set = effectivePermissions(user.role, user.features);
  return permissions.some((p) => set.has(p));
}
export function userCanAll(user: SessionUser, permissions: Permission[]): boolean {
  const set = effectivePermissions(user.role, user.features);
  return permissions.every((p) => set.has(p));
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
      select: { id: true, tenantId: true, role: true, name: true, portalFeatures: true },
    });
    if (!account) return null;
    return {
      id: account.id,
      tenantId: account.tenantId,
      role: account.role,
      name: account.name,
      features: account.portalFeatures ?? [],
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
  if (!userCan(user, permission)) throw AppError.forbidden();
  return user;
}

export async function requireAnyPermission(
  permissions: Permission[],
): Promise<SessionUser> {
  const user = await requireUser();
  if (!userCanAny(user, permissions)) throw AppError.forbidden();
  return user;
}

export async function requireAllPermissions(
  permissions: Permission[],
): Promise<SessionUser> {
  const user = await requireUser();
  if (!userCanAll(user, permissions)) throw AppError.forbidden();
  return user;
}
