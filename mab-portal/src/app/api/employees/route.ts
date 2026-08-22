import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getUserPerms } from "@/lib/access";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

const PAGE_SIZE = 30;

// The employee directory (portal users) with their job data. Searchable + paged.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  const perms = await getUserPerms(session.sub);
  if (!perms.canViewEmployees)
    return NextResponse.json({ error: "لا تملك صلاحية عرض الموظفين" }, { status: 403 });

  const url = req.nextUrl.searchParams;
  const search = (url.get("search") ?? "").trim();
  const page = Math.max(1, Number(url.get("page")) || 1);

  const where: Prisma.PortalUserWhereInput = {
    deletedAt: null,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { employeeNo: { contains: search, mode: "insensitive" } },
            { jobTitle: { contains: search, mode: "insensitive" } },
            { nationalId: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total, active, probation] = await Promise.all([
    prisma.portalUser.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, name: true, email: true, employeeNo: true, jobTitle: true,
        nationalId: true, isActive: true, hireDate: true,
        department: { select: { name: true } },
        manager: { select: { name: true } },
      },
    }),
    prisma.portalUser.count({ where }),
    prisma.portalUser.count({ where: { deletedAt: null, isActive: true } }),
    prisma.portalUser.count({ where: { deletedAt: null } }),
  ]);

  return NextResponse.json({
    rows, total, page, pageSize: PAGE_SIZE,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    stats: { active, all: probation },
  });
}
