import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { sendMail, emailShell, esc } from "@/lib/email";

export const runtime = "nodejs";

// List submitted suggestions & complaints (IT only).
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  if (!session.admin) return NextResponse.json({ error: "للمشرفين فقط" }, { status: 403 });
  const rows = await prisma.feedback.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, kind: true, subject: true, body: true, status: true, authorName: true, authorEmail: true, createdAt: true },
  });
  return NextResponse.json({ rows });
}

// Submit a suggestion or a complaint. Saved + emailed to IT/super-admins.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { kind?: string; subject?: string; body?: string };
  const kind = body.kind === "COMPLAINT" ? "COMPLAINT" : "SUGGESTION";
  const subject = String(body.subject ?? "").trim();
  const text = String(body.body ?? "").trim();
  if (!subject || subject.length < 2) return NextResponse.json({ error: "العنوان مطلوب." }, { status: 400 });
  if (!text || text.length < 3) return NextResponse.json({ error: "التفاصيل مطلوبة." }, { status: 400 });

  const fb = await prisma.feedback.create({
    data: {
      kind,
      subject,
      body: text,
      authorId: session.sub,
      authorName: session.name,
      authorEmail: session.email,
    },
  });

  // Email every active super-admin.
  const admins = await prisma.portalUser.findMany({
    where: { isSuperAdmin: true, isActive: true, deletedAt: null },
    select: { email: true },
  });
  const label = kind === "COMPLAINT" ? "شكوى" : "اقتراح";
  const accent = kind === "COMPLAINT" ? "#be123c" : "#0f766e";
  const html = emailShell({
    eyebrow: label,
    accent,
    title: `${label} جديد: ${subject}`,
    bodyHtml:
      `<p style="font-size:15px;line-height:1.9;white-space:pre-wrap;">${esc(text)}</p>` +
      `<p style="margin-top:16px;color:#64748b;font-size:13px;">من: ${esc(session.name)} — <span dir="ltr">${esc(session.email)}</span></p>`,
  });
  for (const a of admins) {
    try { await sendMail(a.email, `${label} جديد من ${session.name}`, html); }
    catch (err) { console.error("[portal] feedback email failed:", err); }
  }

  return NextResponse.json({ ok: true, id: fb.id }, { status: 201 });
}
