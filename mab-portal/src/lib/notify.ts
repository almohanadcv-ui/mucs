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

/**
 * Notify a targeted audience: everyone, specific departments, or specific
 * employees. Returns how many were reached and a human-readable summary.
 */
export async function notifyTargeted(opts: {
  audience: "ALL" | "DEPARTMENTS" | "USERS";
  departmentIds?: string[];
  userIds?: string[];
  type?: string;
  title: string;
  body?: string;
  link?: string;
  email?: boolean;
  accent?: string;
}): Promise<{ count: number; summary: string }> {
  let where: { isActive: boolean; deletedAt: null; departmentId?: { in: string[] }; id?: { in: string[] } };
  let summary = "الكل";
  if (opts.audience === "DEPARTMENTS" && opts.departmentIds?.length) {
    where = { isActive: true, deletedAt: null, departmentId: { in: opts.departmentIds } };
    const depts = await prisma.department.findMany({ where: { id: { in: opts.departmentIds } }, select: { name: true } });
    summary = `أقسام: ${depts.map((d) => d.name).join("، ")}`;
  } else if (opts.audience === "USERS" && opts.userIds?.length) {
    where = { isActive: true, deletedAt: null, id: { in: opts.userIds } };
    summary = `${opts.userIds.length} موظف محدد`;
  } else {
    where = { isActive: true, deletedAt: null };
  }

  const users = await prisma.portalUser.findMany({ where, select: { id: true, email: true } });
  for (const u of users) {
    await notifyUser({ type: opts.type, title: opts.title, body: opts.body, link: opts.link, email: opts.email, accent: opts.accent, userId: u.id, toEmail: u.email });
  }
  return { count: users.length, summary };
}
