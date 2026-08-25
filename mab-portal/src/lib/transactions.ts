import "server-only";
import { prisma } from "./db";
import { notifyUser } from "./notify";
import { readUpload, writeGenerated } from "./uploads";
import { buildSignedPdf } from "./signed-pdf";
import { sha256, safeEqual } from "./crypto";

/** Set/clear the current user's signing PIN (كلمة السر). */
export async function setSignPin(userId: string, pin: string | null) {
  const hash = pin && pin.trim().length >= 4 ? sha256(pin.trim()) : null;
  await prisma.portalUser.update({ where: { id: userId }, data: { signPinHash: hash } });
}
export async function hasSignPin(userId: string): Promise<boolean> {
  const u = await prisma.portalUser.findUnique({ where: { id: userId }, select: { signPinHash: true } });
  return !!u?.signPinHash;
}

const APP_URL = process.env.APP_URL || "https://portal.mucs.online";

/** Human-facing link to a transaction (used in notifications/emails). */
function txLink(id: string) {
  return `${APP_URL}/?tx=${id}`;
}

export class TxError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/* ────────────────────────────── create ─────────────────────────────── */

export interface ApproverInput { id: string; directive?: string }

export async function createTransaction(input: {
  initiatorId: string;
  title: string;
  type?: string | null;
  note?: string | null;
  secrecy?: string | null;
  importance?: string | null;
  content?: string | null;
  contentEnding?: string | null;
  signerName?: string | null;
  signerTitle?: string | null;
  enclosures?: string | null;
  internalCopies?: string | null;
  prepEntity?: string | null;
  approvalEntity?: string | null;
  recipients?: { name: string; ending?: string }[];
  approvers: ApproverInput[]; // ordered, top of the chain LAST
  originalFile?: string | null;
  originalName?: string | null;
  mimeType?: string | null;
  draft?: boolean; // save without sending
}) {
  const approvers = input.approvers.filter((a) => a.id);
  const approverIds = approvers.map((a) => a.id);
  if (!input.draft && approverIds.length === 0) throw new TxError("اختر موقّعًا واحدًا على الأقل.");

  const byId = new Map<string, { id: string; name: string; email: string | null }>();
  if (approverIds.length) {
    const found = await prisma.portalUser.findMany({
      where: { id: { in: approverIds }, isActive: true, deletedAt: null },
      select: { id: true, name: true, email: true },
    });
    for (const u of found) byId.set(u.id, u);
    if (approverIds.some((id) => !byId.has(id))) throw new TxError("أحد الموقّعين غير صالح.");
  }

  const status = input.draft ? "DRAFT" : "IN_PROGRESS";
  const number = `43${String(Date.now()).slice(-8)}`;
  const recipients = (input.recipients ?? [])
    .map((r) => ({ name: (r.name ?? "").trim(), ending: (r.ending ?? "").trim() }))
    .filter((r) => r.name);

  const tx = await prisma.transaction.create({
    data: {
      initiatorId: input.initiatorId,
      number,
      title: input.title.trim(),
      type: input.type?.trim() || null,
      note: input.note?.trim() || null,
      secrecy: input.secrecy?.trim() || "عادي",
      importance: input.importance?.trim() || "عادي",
      content: input.content?.trim() || null,
      contentEnding: input.contentEnding?.trim() || null,
      signerName: input.signerName?.trim() || null,
      signerTitle: input.signerTitle?.trim() || null,
      enclosures: input.enclosures?.trim() || null,
      internalCopies: input.internalCopies?.trim() || null,
      prepEntity: input.prepEntity?.trim() || null,
      approvalEntity: input.approvalEntity?.trim() || null,
      recipients: recipients.length ? recipients : undefined,
      originalFile: input.originalFile ?? null,
      originalName: input.originalName ?? null,
      mimeType: input.mimeType ?? null,
      currentStep: 0,
      status,
      steps: { create: approvers.map((a, order) => ({ approverId: a.id, order, directive: a.directive || "للتوقيع" })) },
    },
    select: { id: true },
  });

  if (!input.draft && approverIds.length) {
    const first = byId.get(approverIds[0])!;
    await notifyUser({
      userId: first.id, toEmail: first.email, type: "SYSTEM",
      title: "معاملة بانتظار توقيعك",
      body: `وصلتك معاملة «${input.title.trim()}» لمراجعتها وتوقيعها.`,
      link: txLink(tx.id), email: true, accent: "#1178b8",
    });
  }
  return tx.id;
}

/** Send a DRAFT: (re)set the ordered signers, start the flow, notify signer 1. */
export async function sendDraft(id: string, userId: string, approvers: ApproverInput[]) {
  approvers = approvers.filter((a) => a.id);
  const approverIds = approvers.map((a) => a.id);
  if (approverIds.length === 0) throw new TxError("اختر موقّعًا واحدًا على الأقل.");
  const t = await prisma.transaction.findUnique({ where: { id }, select: { id: true, initiatorId: true, status: true, title: true } });
  if (!t) throw new TxError("المعاملة غير موجودة.", 404);
  if (t.initiatorId !== userId) throw new TxError("للمُنشئ فقط.", 403);
  if (t.status !== "DRAFT") throw new TxError("ليست مسودة.", 409);
  const found = await prisma.portalUser.findMany({ where: { id: { in: approverIds }, isActive: true, deletedAt: null }, select: { id: true, email: true } });
  const byId = new Map(found.map((u) => [u.id, u]));
  if (approverIds.some((a) => !byId.has(a))) throw new TxError("أحد الموقّعين غير صالح.");

  await prisma.$transaction([
    prisma.transactionStep.deleteMany({ where: { transactionId: id } }),
    prisma.transactionStep.createMany({ data: approvers.map((a, order) => ({ transactionId: id, approverId: a.id, order, directive: a.directive || "للتوقيع" })) }),
    prisma.transaction.update({ where: { id }, data: { status: "IN_PROGRESS", currentStep: 0, version: { increment: 1 } } }),
  ]);
  const first = byId.get(approverIds[0])!;
  await notifyUser({ userId: first.id, toEmail: first.email, type: "SYSTEM", title: "معاملة بانتظار توقيعك", body: `وصلتك معاملة «${t.title}» لمراجعتها وتوقيعها.`, link: txLink(id), email: true, accent: "#1178b8" });
}

/* ────────────────────────────── read ───────────────────────────────── */

const STEP_SELECT = {
  id: true, order: true, status: true, directive: true, note: true, signatureImg: true, actedAt: true,
  approver: { select: { id: true, name: true, jobTitle: true } },
} as const;

export async function getTransaction(id: string, userId: string, isAdmin: boolean) {
  const tx = await prisma.transaction.findUnique({
    where: { id },
    select: {
      id: true, number: true, title: true, type: true, note: true, status: true, currentStep: true,
      secrecy: true, importance: true, content: true, contentEnding: true, signerName: true, signerTitle: true,
      enclosures: true, internalCopies: true, prepEntity: true, approvalEntity: true, recipients: true,
      version: true, originalFile: true, originalName: true, mimeType: true, signedFile: true, createdAt: true,
      initiator: { select: { id: true, name: true } },
      steps: { orderBy: { order: "asc" }, select: STEP_SELECT },
    },
  });
  if (!tx) throw new TxError("المعاملة غير موجودة.", 404);
  const isParticipant =
    tx.initiator.id === userId || tx.steps.some((s) => s.approver.id === userId);
  if (!isAdmin && !isParticipant) throw new TxError("لا تملك صلاحية عرض هذه المعاملة.", 403);
  const myStepIndex = tx.steps.findIndex((s) => s.approver.id === userId);
  const canActNow =
    tx.status === "IN_PROGRESS" &&
    myStepIndex === tx.currentStep &&
    tx.steps[tx.currentStep]?.status === "PENDING";
  return { ...tx, canActNow };
}

export type TxTab = "pending" | "mine" | "drafts" | "completed" | "all";

export async function listTransactions(userId: string, isAdmin: boolean, tab: TxTab) {
  if (tab === "all" && !isAdmin) tab = "mine";
  const where =
    tab === "mine"
      ? { initiatorId: userId, status: { not: "DRAFT" } }
      : tab === "drafts"
        ? { initiatorId: userId, status: "DRAFT" }
        : tab === "completed"
          ? { status: "COMPLETED", OR: [{ initiatorId: userId }, { steps: { some: { approverId: userId } } }] }
          : tab === "pending"
            ? { status: "IN_PROGRESS", steps: { some: { approverId: userId } } }
            : { status: { not: "DRAFT" } };
  const rows = await prisma.transaction.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true, number: true, title: true, type: true, status: true, currentStep: true, createdAt: true,
      initiator: { select: { name: true } },
      steps: { orderBy: { order: "asc" }, select: { status: true, approverId: true, approver: { select: { name: true } } } },
    },
  });
  // For the "pending" tab, keep only those where it's THIS user's turn now.
  const filtered =
    tab === "pending"
      ? rows.filter((t) => t.steps[t.currentStep]?.approverId === userId && t.steps[t.currentStep]?.status === "PENDING")
      : rows;
  return filtered.map((t) => ({
    id: t.id, number: t.number, title: t.title, type: t.type, status: t.status, currentStep: t.currentStep,
    createdAt: t.createdAt, initiatorName: t.initiator.name,
    steps: t.steps.map((s) => ({ status: s.status, name: s.approver.name })),
  }));
}

/** Dashboard counters for the current user. */
export async function transactionStats(userId: string, isAdmin: boolean) {
  const [mine, completed, returned, pendingRows] = await Promise.all([
    prisma.transaction.count({ where: { initiatorId: userId } }),
    prisma.transaction.count({ where: { initiatorId: userId, status: "COMPLETED" } }),
    prisma.transaction.count({ where: { initiatorId: userId, status: "RETURNED" } }),
    prisma.transaction.findMany({
      where: { status: "IN_PROGRESS", steps: { some: { approverId: userId } } },
      select: { currentStep: true, steps: { orderBy: { order: "asc" }, select: { approverId: true, status: true } } },
    }),
  ]);
  const awaitingMe = pendingRows.filter(
    (t) => t.steps[t.currentStep]?.approverId === userId && t.steps[t.currentStep]?.status === "PENDING",
  ).length;
  const all = isAdmin ? await prisma.transaction.count() : undefined;
  return { mine, completed, returned, awaitingMe, all };
}

/* ─────────────────────────── act: sign / reject ────────────────────── */

/** Load + authorize the current actionable step, all inside a tx callback. */
async function loadForAction(
  txdb: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  id: string,
  userId: string,
) {
  const t = await txdb.transaction.findUnique({
    where: { id },
    select: {
      id: true, status: true, currentStep: true, version: true, title: true,
      initiatorId: true,
      initiator: { select: { id: true, email: true } },
      steps: {
        orderBy: { order: "asc" },
        select: { id: true, order: true, status: true, approverId: true, approver: { select: { name: true, email: true } } },
      },
    },
  });
  if (!t) throw new TxError("المعاملة غير موجودة.", 404);
  if (t.status !== "IN_PROGRESS") throw new TxError("المعاملة غير نشطة.", 409);
  const step = t.steps[t.currentStep];
  if (!step || step.status !== "PENDING") throw new TxError("لا توجد خطوة نشطة.", 409);
  if (step.approverId !== userId) throw new TxError("ليس دورك في التوقيع.", 403);
  return { t, step };
}

/** Bump version conditionally; 0 rows means someone else acted first. */
async function bumpVersion(
  txdb: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  id: string,
  version: number,
  data: Record<string, unknown>,
) {
  const res = await txdb.transaction.updateMany({
    where: { id, version },
    data: { ...data, version: { increment: 1 } },
  });
  if (res.count === 0) throw new TxError("تم تحديث المعاملة من مستخدم آخر، حدّث الصفحة.", 409);
}

/** Approve the current step and advance (or complete). */
export async function signStep(
  id: string,
  userId: string,
  input: { note?: string; signatureImg?: string; pin?: string },
) {
  // If the signer set a PIN (كلمة السر), it must match to place a signature.
  const acct = await prisma.portalUser.findUnique({ where: { id: userId }, select: { signPinHash: true } });
  if (acct?.signPinHash) {
    if (!input.pin || !safeEqual(sha256(input.pin.trim()), acct.signPinHash))
      throw new TxError("الرمز السري غير صحيح.", 403);
  }

  const notifications: { userId: string; email: string | null; title: string; body: string }[] = [];
  let didComplete = false;

  await prisma.$transaction(async (txdb) => {
    const { t, step } = await loadForAction(txdb, id, userId);
    const isLast = t.currentStep >= t.steps.length - 1;

    await txdb.transactionStep.update({
      where: { id: step.id },
      data: {
        status: "SIGNED",
        note: input.note?.trim() || null,
        signatureImg: input.signatureImg ?? null,
        actedAt: new Date(),
      },
    });

    if (isLast) {
      didComplete = true;
      await bumpVersion(txdb, id, t.version, { status: "COMPLETED", currentStep: t.steps.length });
      notifications.push({
        userId: t.initiator.id, email: t.initiator.email,
        title: "اكتملت معاملتك ✅",
        body: `تم توقيع «${t.title}» من جميع المسؤولين. الملف النهائي جاهز.`,
      });
    } else {
      const next = t.steps[t.currentStep + 1];
      // The next step may carry a stale REJECTED state from an earlier round —
      // reopen it as PENDING so its approver can act on the revised file.
      await txdb.transactionStep.update({
        where: { id: next.id },
        data: { status: "PENDING", signatureImg: null, actedAt: null },
      });
      await bumpVersion(txdb, id, t.version, { currentStep: t.currentStep + 1 });
      notifications.push({
        userId: next.approverId, email: next.approver.email,
        title: "معاملة بانتظار توقيعك",
        body: `وصلتك معاملة «${t.title}» لمراجعتها وتوقيعها.`,
      });
    }
  });

  for (const n of notifications) {
    await notifyUser({ userId: n.userId, toEmail: n.email, type: "SYSTEM", title: n.title, body: n.body, link: txLink(id), email: true, accent: "#0f9d58" });
  }

  // On completion, burn every signature into the final document (best-effort —
  // a failure here never unwinds the approval, which is a committed fact).
  if (didComplete) {
    try { await generateSignedFile(id); }
    catch (err) { console.error(`[transactions] signed-file generation failed for ${id}:`, err); }
  }
}

/** Assemble the final signed PDF from the original + each step's signature. */
async function generateSignedFile(id: string) {
  const tx = await prisma.transaction.findUnique({
    where: { id },
    select: {
      originalFile: true, mimeType: true,
      steps: { orderBy: { order: "asc" }, select: { signatureImg: true, status: true } },
    },
  });
  if (!tx) return;
  const sigs = tx.steps
    .filter((s) => s.status === "SIGNED" && s.signatureImg)
    .map((s) => s.signatureImg as string);
  // A letter may carry no attachment → produce a signatures certificate only.
  const original = tx.originalFile ? await readUpload("transactions", tx.originalFile) : Buffer.alloc(0);
  const bytes = await buildSignedPdf(original, tx.mimeType ?? "application/octet-stream", sigs);
  const stored = await writeGenerated("transactions", ".pdf", Buffer.from(bytes));
  await prisma.transaction.update({ where: { id }, data: { signedFile: stored } });
}

/** The initiator restarts a RETURNED transaction from the top (after fixing the
 *  file/data). Resets every step to PENDING and re-notifies the first signer. */
export async function resubmitTransaction(id: string, userId: string) {
  const notify: { userId: string; email: string | null } = { userId: "", email: null };
  let title = "";

  await prisma.$transaction(async (txdb) => {
    const t = await txdb.transaction.findUnique({
      where: { id },
      select: {
        id: true, status: true, version: true, title: true, initiatorId: true,
        steps: { orderBy: { order: "asc" }, select: { id: true, approverId: true, approver: { select: { email: true } } } },
      },
    });
    if (!t) throw new TxError("المعاملة غير موجودة.", 404);
    if (t.initiatorId !== userId) throw new TxError("للمُنشئ فقط.", 403);
    if (t.status !== "RETURNED") throw new TxError("لا يمكن إعادة الإرسال في هذه الحالة.", 409);

    await txdb.transactionStep.updateMany({
      where: { transactionId: id },
      data: { status: "PENDING", signatureImg: null, note: null, actedAt: null },
    });
    await bumpVersion(txdb, id, t.version, { status: "IN_PROGRESS", currentStep: 0 });
    title = t.title;
    notify.userId = t.steps[0].approverId;
    notify.email = t.steps[0].approver.email;
  });

  await notifyUser({
    userId: notify.userId, toEmail: notify.email, type: "SYSTEM",
    title: "معاملة بانتظار توقيعك",
    body: `أُعيد إرسال معاملة «${title}» بعد التعديل.`,
    link: txLink(id), email: true, accent: "#1178b8",
  });
}

/** Reject the current step → return one step back for revision (or to the
 *  initiator if it's the first step). */
export async function rejectStep(id: string, userId: string, input: { note: string }) {
  const note = input.note?.trim() ?? "";
  if (note.length < 3) throw new TxError("اكتب سبب الإرجاع.");
  const notifications: { userId: string; email: string | null; title: string; body: string }[] = [];

  await prisma.$transaction(async (txdb) => {
    const { t, step } = await loadForAction(txdb, id, userId);

    await txdb.transactionStep.update({
      where: { id: step.id },
      data: { status: "REJECTED", note, actedAt: new Date() },
    });

    if (t.currentStep === 0) {
      // Back to the initiator to revise & resubmit.
      await bumpVersion(txdb, id, t.version, { status: "RETURNED" });
      notifications.push({
        userId: t.initiator.id, email: t.initiator.email,
        title: "أُعيدت معاملتك للتعديل",
        body: `أعاد ${step.approver.name} معاملة «${t.title}»: ${note}`,
      });
    } else {
      // Reopen the previous signer's step so they revise & re-sign.
      const prev = t.steps[t.currentStep - 1];
      await txdb.transactionStep.update({ where: { id: prev.id }, data: { status: "PENDING", signatureImg: null, actedAt: null } });
      await bumpVersion(txdb, id, t.version, { currentStep: t.currentStep - 1 });
      notifications.push({
        userId: prev.approverId, email: prev.approver.email,
        title: "أُعيدت معاملة للتعديل",
        body: `أعاد ${step.approver.name} معاملة «${t.title}» للتعديل: ${note}`,
      });
    }
  });

  for (const n of notifications) {
    await notifyUser({ userId: n.userId, toEmail: n.email, type: "SYSTEM", title: n.title, body: n.body, link: txLink(id), email: true, accent: "#be123c" });
  }
}
