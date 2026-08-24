import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { audit } from "@/lib/audit";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

const PAGE_SIZE = 25;

// List portal users (paginated + searchable) — scales past 1000 users.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  if (!session.admin) return NextResponse.json({ error: "للمشرفين فقط" }, { status: 403 });

  const url = req.nextUrl.searchParams;
  const search = (url.get("search") ?? "").trim();
  const page = Math.max(1, Number(url.get("page")) || 1);

  const where: Prisma.PortalUserWhereInput = {
    deletedAt: null,
    ...(search
      ? {
          OR: [
            { email: { contains: search, mode: "insensitive" } },
            { name: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.portalUser.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        isSuperAdmin: true,
        canManageContent: true,
        canViewEmployees: true,
        canViewOrg: true,
        canSendNotifications: true,
        canUseTransactions: true,
        jobTitle: true,
        departmentId: true,
        managerId: true,
        department: { select: { name: true } },
        lastLoginAt: true,
        createdAt: true,
        _count: { select: { access: true, reports: true } },
      },
    }),
    prisma.portalUser.count({ where }),
  ]);

  return NextResponse.json({
    rows,
    total,
    page,
    pageSize: PAGE_SIZE,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  });
}

// Create a portal user (or revive a soft-deleted one with the same email).
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  if (!session.admin) return NextResponse.json({ error: "للمشرفين فقط" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    name?: string;
    isSuperAdmin?: boolean;
  };
  const email = String(body.email ?? "").trim().toLowerCase();
  const name = String(body.name ?? "").trim();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return NextResponse.json({ error: "بريد غير صالح." }, { status: 400 });
  if (!name) return NextResponse.json({ error: "الاسم مطلوب." }, { status: 400 });

  const existing = await prisma.portalUser.findUnique({ where: { email } });
  if (existing && !existing.deletedAt)
    return NextResponse.json({ error: "البريد مستخدم مسبقًا." }, { status: 409 });

  const user = existing
    ? await prisma.portalUser.update({
        where: { id: existing.id },
        data: { name, isActive: true, deletedAt: null, isSuperAdmin: Boolean(body.isSuperAdmin) },
      })
    : await prisma.portalUser.create({
        data: { email, name, isSuperAdmin: Boolean(body.isSuperAdmin) },
      });

  await audit({
    actorId: session.sub,
    actorEmail: session.email,
    action: "CREATE_USER",
    entityType: "PortalUser",
    entityId: user.id,
    meta: { email, name, isSuperAdmin: Boolean(body.isSuperAdmin) },
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });

  return NextResponse.json({ id: user.id }, { status: 201 });
}
