import "server-only";
import { prisma } from "./db";
import { catalogFor, effectiveFeatures } from "./system-catalog";

/** Per-section permissions for a portal user, read fresh from the DB. */
export interface UserPerms {
  isAdmin: boolean;
  canManageContent: boolean;
  canViewEmployees: boolean;
  canViewOrg: boolean;
  canSendNotifications: boolean;
  canUseTransactions: boolean;
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
      canUseTransactions: true,
    },
  });
  const admin = !!u?.isSuperAdmin;
  return {
    isAdmin: admin,
    canManageContent: admin || !!u?.canManageContent,
    canViewEmployees: admin || !!u?.canViewEmployees,
    canViewOrg: admin || !!u?.canViewOrg,
    canSendNotifications: admin || !!u?.canSendNotifications,
    canUseTransactions: admin || !!u?.canUseTransactions,
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
  /** True when the sub-links come from the catalog (filtered by the user's
   *  granted sections) — the shell then hides its hard-coded "الرئيسية". */
  catalogDriven: boolean;
}

/**
 * The systems a portal user may see, ordered. A super-admin (IT) sees every
 * active system; everyone else sees only what UserSystemAccess grants them.
 *
 * For a system with a catalog, the rail sub-links are the sections the user is
 * granted (role default or per-user override) — so a user with only "تقييمي +
 * التقارير" sees exactly those, not the whole menu.
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
      access: { where: { userId }, select: { role: true, features: true } },
    },
  });

  return systems.map((s) => {
    const cat = catalogFor(s.key);
    if (cat) {
      const grant = s.access[0];
      // Admins (no grant row) see every catalog section.
      const allowed = isAdmin
        ? cat.features.map((f) => f.key)
        : effectiveFeatures(s.key, grant?.role ?? null, grant?.features ?? []);
      const links = cat.features
        .filter((f) => allowed.includes(f.key))
        .map((f) => ({ id: `${s.key}:${f.key}`, label: f.label, path: f.path, icon: null }));
      return {
        id: s.id, key: s.key, name: s.name, description: s.description, icon: s.icon,
        color: s.color, baseUrl: s.baseUrl, ssoPath: s.ssoPath, links, catalogDriven: true,
      };
    }
    return {
      id: s.id, key: s.key, name: s.name, description: s.description, icon: s.icon,
      color: s.color, baseUrl: s.baseUrl, ssoPath: s.ssoPath, links: s.links, catalogDriven: false,
    };
  });
}
