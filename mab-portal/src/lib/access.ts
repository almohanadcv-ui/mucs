import "server-only";
import { prisma } from "./db";

/** Per-section permissions for a portal user, read fresh from the DB. */
export interface UserPerms {
  isAdmin: boolean;
  canManageContent: boolean;
  canViewEmployees: boolean;
  canViewOrg: boolean;
  canSendNotifications: boolean;
}

/**
 * Resolve a user's live permissions from the database (not the session token),
 * so an IT change applies on the next request without forcing a re-login. A
 * super-admin implicitly has every permission.
 */
export async function getUserPerms(userId: string): Promise<UserPerms> {
  const u = await prisma.portalUser.findUnique({
    where: { id: userId },
    select: {
      isSuperAdmin: true,
      canManageContent: true,
      canViewEmployees: true,
      canViewOrg: true,
      canSendNotifications: true,
    },
  });
  const admin = !!u?.isSuperAdmin;
  return {
    isAdmin: admin,
    canManageContent: admin || !!u?.canManageContent,
    canViewEmployees: admin || !!u?.canViewEmployees,
    canViewOrg: admin || !!u?.canViewOrg,
    canSendNotifications: admin || !!u?.canSendNotifications,
  };
}

export interface LauncherSystem {
  id: string;
  key: string;
  name: string;
  description: string | null;
  icon: string;
  color: string | null;
  baseUrl: string;
  ssoPath: string;
  links: { id: string; label: string; path: string; icon: string | null }[];
}

/**
 * The systems a portal user may see, ordered. A super-admin (IT) sees every
 * active system; everyone else sees only what UserSystemAccess grants them.
 */
export async function systemsForUser(userId: string, isAdmin: boolean): Promise<LauncherSystem[]> {
  const systems = await prisma.system.findMany({
    where: {
      isActive: true,
      ...(isAdmin ? {} : { access: { some: { userId } } }),
    },
    orderBy: { order: "asc" },
    include: {
      links: { orderBy: { order: "asc" }, select: { id: true, label: true, path: true, icon: true } },
    },
  });
  return systems.map((s) => ({
    id: s.id,
    key: s.key,
    name: s.name,
    description: s.description,
    icon: s.icon,
    color: s.color,
    baseUrl: s.baseUrl,
    ssoPath: s.ssoPath,
    links: s.links,
  }));
}
