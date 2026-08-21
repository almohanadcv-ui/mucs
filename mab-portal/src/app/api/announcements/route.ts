import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { notifyAll } from "@/lib/notify";

export const runtime = "nodejs";

// Latest announcements (everyone sees them on the home page).
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  const rows = await prisma.announcement.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, title: true, body: true, important: true, createdAt: true },
  });
  return NextResponse.json({ rows });
}

// Create an announcement (IT only). Optionally emails + notifies every user.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  if (!session.admin) return NextResponse.json({ error: "للمشرفين فقط" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    body?: string;
    important?: boolean;
    email?: boolean;
  };
  const title = String(body.title ?? "").trim();
  const text = String(body.body ?? "").trim();
  if (!title || !text) return NextResponse.json({ error: "العنوان والنص مطلوبان." }, { status: 400 });

  const ann = await prisma.announcement.create({
    data: { title, body: text, important: Boolean(body.important), createdById: session.sub, emailSent: Boolean(body.email) },
  });

  if (body.email) {
    // Notify + email everyone (best-effort).
    void notifyAll({
      type: "ANNOUNCEMENT",
      title: `📢 ${title}`,
      body: text,
      email: true,
      accent: body.important ? "#be123c" : "#1178b8",
    }).catch((err) => console.error("[portal] announcement broadcast failed:", err));
  }

  return NextResponse.json({ ok: true, id: ann.id }, { status: 201 });
}
