import "server-only";
import { prisma } from "./db";
import { sendMail, emailShell, esc } from "./email";

/** Create an in-app notification for one user, optionally emailing it too. */
export async function notifyUser(opts: {
  userId: string;
  toEmail?: string | null;
  type?: string;
  title: string;
  body?: string;
  link?: string;
  email?: boolean;
  accent?: string;
}) {
  const n = await prisma.notification.create({
    data: {
      userId: opts.userId,
      type: opts.type ?? "INFO",
      title: opts.title,
      body: opts.body ?? null,
      link: opts.link ?? null,
    },
  });
  if (opts.email && opts.toEmail) {
    const html = emailShell({
      eyebrow: "تنبيه",
      accent: opts.accent,
      title: opts.title,
      bodyHtml: `<p style="font-size:15px;line-height:1.9;">${esc(opts.body ?? "")}</p>`,
    });
    try {
      await sendMail(opts.toEmail, opts.title, html);
      await prisma.notification.update({ where: { id: n.id }, data: { emailSent: true } });
    } catch (err) {
      console.error("[portal] notify email failed:", err);
    }
  }
  return n;
}

/** Notify every active user (announcements). Emails in batches when asked. */
export async function notifyAll(opts: {
  type?: string;
  title: string;
  body?: string;
  link?: string;
  email?: boolean;
  accent?: string;
}): Promise<number> {
  const users = await prisma.portalUser.findMany({
    where: { isActive: true, deletedAt: null },
    select: { id: true, email: true },
  });
  for (const u of users) {
    await notifyUser({ ...opts, userId: u.id, toEmail: u.email });
  }
  return users.length;
}
