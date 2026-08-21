import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  const rows = await prisma.department.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, _count: { select: { users: true } } },
  });
  return NextResponse.json({ rows });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.admin) return NextResponse.json({ error: "للمشرفين فقط" }, { status: 403 });
  const { name } = (await req.json().catch(() => ({}))) as { name?: string };
  const clean = String(name ?? "").trim();
  if (!clean) return NextResponse.json({ error: "اسم القسم مطلوب." }, { status: 400 });
  const existing = await prisma.department.findUnique({ where: { name: clean } });
  if (existing) return NextResponse.json({ error: "القسم موجود مسبقًا." }, { status: 409 });
  const d = await prisma.department.create({ data: { name: clean } });
  return NextResponse.json({ id: d.id }, { status: 201 });
}
