import "server-only";
import { prisma } from "./db";

/** May the user post announcements/occasions? Super-admins always; others only
 *  when IT has granted them canManageContent. */
export async function canManageContent(sub: string, admin: boolean): Promise<boolean> {
  if (admin) return true;
  const u = await prisma.portalUser.findFirst({
    where: { id: sub, isActive: true, deletedAt: null },
    select: { canManageContent: true },
  });
  return Boolean(u?.canManageContent);
}
