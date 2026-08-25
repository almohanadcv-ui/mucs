import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getUserPerms } from "@/lib/access";
import { saveUpload, MAX_UPLOAD_BYTES } from "@/lib/uploads";
import { createTransaction, listTransactions, TxError, type TxTab } from "@/lib/transactions";

export const runtime = "nodejs";

// List transactions for a tab: mine | pending | all (all = admin only).
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  const perms = await getUserPerms(session.sub);
  if (!perms.canUseTransactions) return NextResponse.json({ error: "لا تملك صلاحية المعاملات." }, { status: 403 });
  const tabParam = req.nextUrl.searchParams.get("tab") ?? "";
  const valid: TxTab[] = ["pending", "mine", "drafts", "completed", "all"];
  const tab: TxTab = (valid as string[]).includes(tabParam) ? (tabParam as TxTab) : "mine";
  const rows = await listTransactions(session.sub, perms.isAdmin, tab);
  return NextResponse.json({ rows });
}

// Create a transaction: multipart form with file + title + ordered approverIds.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  const perms = await getUserPerms(session.sub);
  if (!perms.canUseTransactions) return NextResponse.json({ error: "لا تملك صلاحية المعاملات." }, { status: 403 });

  try {
    const form = await req.formData();
    const g = (k: string) => String(form.get(k) ?? "").trim();
    const parseJson = <T,>(k: string, fb: T): T => { try { return JSON.parse(String(form.get(k) ?? "")) as T; } catch { return fb; } };
    const title = g("title");
    const draft = g("draft") === "1";
    const approvers = parseJson<{ id: string; directive?: string }[]>("approvers", []);
    const recipients = parseJson<{ name: string; ending?: string }[]>("recipients", []);
    const file = form.get("file");

    if (!title) return NextResponse.json({ error: "الموضوع مطلوب." }, { status: 400 });

    let stored: string | null = null;
    let originalName: string | null = null;
    let mimeType: string | null = null;
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "الملف أكبر من 25MB." }, { status: 400 });
      stored = await saveUpload(file, "transactions");
      originalName = file.name;
      mimeType = file.type || "application/octet-stream";
    }

    const id = await createTransaction({
      initiatorId: session.sub,
      title, type: g("type"), note: g("note"),
      secrecy: g("secrecy"), importance: g("importance"),
      content: g("content"), contentEnding: g("contentEnding"),
      signerName: g("signerName"), signerTitle: g("signerTitle"),
      enclosures: g("enclosures"), internalCopies: g("internalCopies"),
      prepEntity: g("prepEntity"), approvalEntity: g("approvalEntity"),
      recipients, approvers, draft,
      originalFile: stored, originalName, mimeType,
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    if (e instanceof TxError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[transactions] create failed:", e);
    return NextResponse.json({ error: "تعذّر إنشاء المعاملة." }, { status: 500 });
  }
}
