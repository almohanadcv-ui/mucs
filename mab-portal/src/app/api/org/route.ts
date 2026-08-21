import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

// Org chart data: every active user with their manager + department. The tree is
// built on the client. Scales fine — one indexed read.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const users = await prisma.portalUser.findMany({
    where: { deletedAt: null, isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      jobTitle: true,
      avatarUrl: true,
      managerId: true,
      isSuperAdmin: true,
      department: { select: { name: true } },
    },
  });

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      jobTitle: u.jobTitle,
      avatarUrl: u.avatarUrl,
      managerId: u.managerId,
      isSuperAdmin: u.isSuperAdmin,
      department: u.department?.name ?? null,
    })),
  });
}
