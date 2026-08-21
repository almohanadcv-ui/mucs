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

// Update a user: rename, activate/deactivate, grant/revoke super-admin.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard();
  if (g.error) return g.error;
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    isActive?: boolean;
    isSuperAdmin?: boolean;
  };

  const user = await prisma.portalUser.findFirst({ where: { id, deletedAt: null } });
  if (!user) return NextResponse.json({ error: "المستخدم غير موجود." }, { status: 404 });

  // Never lock the platform out of its last active super-admin.
  const removingAdminRights =
    (body.isSuperAdmin === false || body.isActive === false) && user.isSuperAdmin;
  if (removingAdminRights) {
    const admins = await prisma.portalUser.count({
      where: { isSuperAdmin: true, isActive: true, deletedAt: null },
    });
    if (admins <= 1)
      return NextResponse.json({ error: "لا يمكن تعطيل آخر مشرف نظام." }, { status: 400 });
  }

  const updated = await prisma.portalUser.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      ...(body.isSuperAdmin !== undefined ? { isSuperAdmin: body.isSuperAdmin } : {}),
    },
  });

  await audit({
    actorId: g.session.sub,
    actorEmail: g.session.email,
    action: "UPDATE_USER",
    entityType: "PortalUser",
    entityId: id,
    meta: { name: body.name, isActive: body.isActive, isSuperAdmin: body.isSuperAdmin },
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });

  return NextResponse.json({ ok: true, isActive: updated.isActive, isSuperAdmin: updated.isSuperAdmin });
}

// Soft-delete a user (keeps the record + audit history; data is never lost).
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard();
  if (g.error) return g.error;
  const { id } = await ctx.params;

  const user = await prisma.portalUser.findFirst({ where: { id, deletedAt: null } });
  if (!user) return NextResponse.json({ error: "المستخدم غير موجود." }, { status: 404 });
  if (id === g.session.sub)
    return NextResponse.json({ error: "لا يمكنك حذف حسابك." }, { status: 400 });
  if (user.isSuperAdmin) {
    const admins = await prisma.portalUser.count({
      where: { isSuperAdmin: true, isActive: true, deletedAt: null },
    });
    if (admins <= 1)
      return NextResponse.json({ error: "لا يمكن حذف آخر مشرف نظام." }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
    prisma.portalUser.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } }),
  ]);

  await audit({
    actorId: g.session.sub,
    actorEmail: g.session.email,
    action: "DELETE_USER",
    entityType: "PortalUser",
    entityId: id,
    meta: { email: user.email },
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });

  return NextResponse.json({ ok: true });
}
