import "server-only";
import { prisma } from "./db";

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
