import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

// Update a task: toggle done, or stamp it reminded (so the client fires the
// browser notification only once). Scoped to the owner.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  const { id } = await ctx.params;

  const body = (await req.json().catch(() => ({}))) as { done?: boolean; reminded?: boolean };
  const task = await prisma.task.findFirst({ where: { id, userId: session.sub }, select: { id: true } });
  if (!task) return NextResponse.json({ error: "غير موجود." }, { status: 404 });

  await prisma.task.update({
    where: { id },
    data: {
      ...(body.done !== undefined ? { done: body.done } : {}),
      ...(body.reminded ? { remindedAt: new Date() } : {}),
    },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  const { id } = await ctx.params;
  await prisma.task.deleteMany({ where: { id, userId: session.sub } });
  return NextResponse.json({ ok: true });
}
