import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

// My latest notifications + unread count.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  const [rows, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: session.sub },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, type: true, title: true, body: true, link: true, readAt: true, createdAt: true },
    }),
    prisma.notification.count({ where: { userId: session.sub, readAt: null } }),
  ]);
  return NextResponse.json({ rows, unread });
}

// Mark all my notifications read.
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  void req;
  await prisma.notification.updateMany({
    where: { userId: session.sub, readAt: null },
    data: { readAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
