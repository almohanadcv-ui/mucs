import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { sendMail, emailShell, esc } from "@/lib/email";

export const runtime = "nodejs";

/**
 * Daily job: email a greeting for every occasion happening today (birthdays,
 * anniversaries, occasions). Idempotent via `notifiedOn`. Protect with
 *   Authorization: Bearer $CRON_SECRET
 * and call once a day, e.g. from crontab:
 *   0 7 * * * curl -fsS -H "Authorization: Bearer <CRON_SECRET>" https://<portal>/api/cron/events
 */
export async function GET(req: NextRequest) {
  if (!env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  }

  const now = new Date();
  const yyyyMmDd = now.toISOString().slice(0, 10);
  const mm = now.getMonth();
  const dd = now.getDate();

  const events = await prisma.event.findMany();
  let sent = 0;

  for (const ev of events) {
    const d = new Date(ev.date);
    const matches = ev.recurring
      ? d.getMonth() === mm && d.getDate() === dd
      : d.toISOString().slice(0, 10) === yyyyMmDd;
    if (!matches) continue;
    if (ev.notifiedOn === yyyyMmDd) continue; // already sent today

    if (ev.personEmail) {
      const isBirthday = ev.type === "BIRTHDAY";
      const title = isBirthday
        ? `كل عام وأنت بخير 🎉`
        : ev.title;
      const bodyHtml = isBirthday
        ? `<p style="font-size:15px;line-height:1.9;">${esc(ev.personName || "")} — يسعدنا في MAB أن نهنّئك بمناسبة عيد ميلادك 🎂✨<br/>نتمنّى لك عامًا مليئًا بالصحة والنجاح.</p>`
        : `<p style="font-size:15px;line-height:1.9;">${esc(ev.note || ev.title)}</p>`;
      try {
        await sendMail(
          ev.personEmail,
          isBirthday ? "🎉 كل عام وأنت بخير — MAB" : `${ev.title} — MAB`,
          emailShell({ eyebrow: isBirthday ? "عيد ميلاد" : "مناسبة", accent: "#b45309", title, bodyHtml }),
        );
        sent++;
      } catch (err) {
        console.error("[portal] event email failed:", err);
      }
    }
    await prisma.event.update({ where: { id: ev.id }, data: { notifiedOn: yyyyMmDd } });
  }

  return NextResponse.json({ ok: true, sent });
}
