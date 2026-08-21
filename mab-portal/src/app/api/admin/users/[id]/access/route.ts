import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

async function guard() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "غير مصرّح" }, { status: 401 }) };
  if (!session.admin) return { error: NextResponse.json({ error: "للمشرفين فقط" }, { status: 403 }) };
  return { session };
}

// The systems catalogue + which ones this user is granted (the permission grid).
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard();
  if (g.error) return g.error;
  const { id } = await ctx.params;

  const [user, systems, granted] = await Promise.all([
    prisma.portalUser.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, name: true, email: true, isSuperAdmin: true },
    }),
    prisma.system.findMany({
      orderBy: { order: "asc" },
      select: { id: true, key: true, name: true, isActive: true },
    }),
    prisma.userSystemAccess.findMany({ where: { userId: id }, select: { systemId: true } }),
  ]);
  if (!user) return NextResponse.json({ error: "المستخدم غير موجود." }, { status: 404 });

  const grantedIds = new Set(granted.map((a) => a.systemId));
  return NextResponse.json({
    user,
    systems: systems.map((s) => ({ ...s, granted: grantedIds.has(s.id) })),
  });
}

// Replace the user's granted systems with the provided list.
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard();
  if (g.error) return g.error;
  const { id } = await ctx.params;

  const body = (await req.json().catch(() => ({}))) as { systemIds?: string[] };
  const requested = Array.isArray(body.systemIds) ? [...new Set(body.systemIds)] : [];

  const user = await prisma.portalUser.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "المستخدم غير موجود." }, { status: 404 });

  // Keep only real system ids.
  const valid = await prisma.system.findMany({
    where: { id: { in: requested } },
    select: { id: true },
  });
  const validIds = valid.map((s) => s.id);

  await prisma.$transaction([
    prisma.userSystemAccess.deleteMany({ where: { userId: id } }),
    ...(validIds.length
      ? [
          prisma.userSystemAccess.createMany({
            data: validIds.map((systemId) => ({ userId: id, systemId, grantedById: g.session.sub })),
            skipDuplicates: true,
          }),
        ]
      : []),
  ]);

  await audit({
    actorId: g.session.sub,
    actorEmail: g.session.email,
    action: "SET_ACCESS",
    entityType: "Access",
    entityId: id,
    meta: { systemIds: validIds },
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });

  return NextResponse.json({ ok: true, granted: validIds });
}
