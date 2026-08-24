import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

// Set default.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  const { id } = await ctx.params;
  const sig = await prisma.userSignature.findFirst({ where: { id, userId: session.sub }, select: { id: true } });
  if (!sig) return NextResponse.json({ error: "غير موجود." }, { status: 404 });
  await prisma.$transaction([
    prisma.userSignature.updateMany({ where: { userId: session.sub }, data: { isDefault: false } }),
    prisma.userSignature.update({ where: { id }, data: { isDefault: true } }),
  ]);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  const { id } = await ctx.params;
  await prisma.userSignature.deleteMany({ where: { id, userId: session.sub } });
  return NextResponse.json({ ok: true });
}
