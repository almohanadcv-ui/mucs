import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

// Upcoming occasions (everyone sees them on the home page).
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  const rows = await prisma.event.findMany({
    orderBy: { date: "asc" },
    take: 50,
    select: { id: true, type: true, title: true, note: true, date: true, recurring: true, personName: true },
  });
  return NextResponse.json({ rows });
}

// Add an occasion (IT only) — e.g. a birthday. A daily job emails on the day.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  if (!session.admin) return NextResponse.json({ error: "للمشرفين فقط" }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as {
    type?: string;
    title?: string;
    note?: string;
    date?: string;
    recurring?: boolean;
    personName?: string;
    personEmail?: string;
  };
  const title = String(b.title ?? "").trim();
  const date = b.date ? new Date(b.date) : null;
  if (!title) return NextResponse.json({ error: "العنوان مطلوب." }, { status: 400 });
  if (!date || Number.isNaN(date.getTime())) return NextResponse.json({ error: "التاريخ غير صالح." }, { status: 400 });

  const ev = await prisma.event.create({
    data: {
      type: ["BIRTHDAY", "ANNIVERSARY", "OCCASION"].includes(String(b.type)) ? String(b.type) : "OCCASION",
      title,
      note: b.note?.trim() || null,
      date,
      recurring: b.recurring ?? true,
      personName: b.personName?.trim() || null,
      personEmail: b.personEmail?.trim() || null,
      createdById: session.sub,
    },
  });
  return NextResponse.json({ ok: true, id: ev.id }, { status: 201 });
}
