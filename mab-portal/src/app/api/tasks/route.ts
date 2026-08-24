import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

// The signed-in user's own tasks (upcoming first). Optionally only pending.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  const pendingOnly = req.nextUrl.searchParams.get("pending") === "1";

  const rows = await prisma.task.findMany({
    where: { userId: session.sub, ...(pendingOnly ? { done: false } : {}) },
    orderBy: [{ done: "asc" }, { dueAt: "asc" }],
    take: 100,
    select: { id: true, title: true, note: true, dueAt: true, done: true, remindedAt: true },
  });
  return NextResponse.json({ rows });
}

// Create a task with a due time.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { title?: string; note?: string; dueAt?: string };
  const title = String(body.title ?? "").trim();
  const due = body.dueAt ? new Date(body.dueAt) : null;
  if (!title) return NextResponse.json({ error: "العنوان مطلوب." }, { status: 400 });
  if (!due || Number.isNaN(due.getTime())) return NextResponse.json({ error: "الوقت غير صالح." }, { status: 400 });

  const task = await prisma.task.create({
    data: { userId: session.sub, title, note: body.note?.trim() || null, dueAt: due },
    select: { id: true, title: true, note: true, dueAt: true, done: true, remindedAt: true },
  });
  return NextResponse.json({ task }, { status: 201 });
}
