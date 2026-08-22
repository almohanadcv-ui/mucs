import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getUserPerms } from "@/lib/access";

export const runtime = "nodejs";

// One employee's full profile: job data, custody (assets) + each asset's history.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  const perms = await getUserPerms(session.sub);
  if (!perms.canViewEmployees)
    return NextResponse.json({ error: "لا تملك صلاحية عرض الموظفين" }, { status: 403 });
  const { id } = await ctx.params;

  const user = await prisma.portalUser.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true, name: true, email: true, phone: true, nationalId: true,
      employeeNo: true, jobTitle: true, isActive: true, isSuperAdmin: true,
      hireDate: true, employmentType: true, workUnit: true, location: true,
      avatarUrl: true,
      department: { select: { name: true } },
      manager: { select: { id: true, name: true } },
    },
  });
  if (!user) return NextResponse.json({ error: "الموظف غير موجود." }, { status: 404 });

  const assets = await prisma.asset.findMany({
    where: { assignedToId: id },
    orderBy: { assignedAt: "desc" },
    select: {
      id: true, assetNo: true, type: true, nameAr: true, brand: true, serial: true,
      status: true, assignedAt: true, location: true,
    },
  });

  // History: every log across this employee's (current) assets.
  const logs = await prisma.assetLog.findMany({
    where: { asset: { assignedToId: id } },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, action: true, summary: true, actorName: true, createdAt: true, asset: { select: { assetNo: true } } },
  });

  return NextResponse.json({ user, assets, logs });
}
