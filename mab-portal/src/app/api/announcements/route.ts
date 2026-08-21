import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { notifyTargeted } from "@/lib/notify";
import { canManageContent } from "@/lib/content";

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

// Create an announcement (IT or content managers). Targets everyone, chosen
// departments, or chosen employees — always in-app, and by email when asked.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  if (!(await canManageContent(session.sub, session.admin))) {
    return NextResponse.json({ error: "لا تملك صلاحية النشر." }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    title?: string; body?: string; important?: boolean; email?: boolean;
    audience?: "ALL" | "DEPARTMENTS" | "USERS"; departmentIds?: string[]; userIds?: string[];
  };
  const title = String(body.title ?? "").trim();
  const text = String(body.body ?? "").trim();
  if (!title || !text) return NextResponse.json({ error: "العنوان والنص مطلوبان." }, { status: 400 });
  const audience = body.audience === "DEPARTMENTS" || body.audience === "USERS" ? body.audience : "ALL";

  const result = await notifyTargeted({
    audience,
    departmentIds: body.departmentIds,
    userIds: body.userIds,
    type: "ANNOUNCEMENT",
    title: `📢 ${title}`,
    body: text,
    email: Boolean(body.email),
    accent: body.important ? "#be123c" : "#1178b8",
  });

  const ann = await prisma.announcement.create({
    data: { title, body: text, important: Boolean(body.important), createdById: session.sub, emailSent: Boolean(body.email), audience: result.summary },
  });

  return NextResponse.json({ ok: true, id: ann.id, reached: result.count, audience: result.summary }, { status: 201 });
}
