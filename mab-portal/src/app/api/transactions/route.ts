import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getUserPerms } from "@/lib/access";
import { saveUpload, MAX_UPLOAD_BYTES } from "@/lib/uploads";
import { createTransaction, listTransactions, TxError } from "@/lib/transactions";

export const runtime = "nodejs";

// List transactions for a tab: mine | pending | all (all = admin only).
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  const perms = await getUserPerms(session.sub);
  if (!perms.canUseTransactions) return NextResponse.json({ error: "لا تملك صلاحية المعاملات." }, { status: 403 });
  const tabParam = req.nextUrl.searchParams.get("tab");
  const tab = tabParam === "pending" || tabParam === "all" ? tabParam : "mine";
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
    const title = String(form.get("title") ?? "").trim();
    const type = String(form.get("type") ?? "").trim();
    const note = String(form.get("note") ?? "").trim();
    const approverIds = String(form.get("approverIds") ?? "")
      .split(",").map((s) => s.trim()).filter(Boolean);
    const file = form.get("file");

    if (!title) return NextResponse.json({ error: "العنوان مطلوب." }, { status: 400 });
    if (!(file instanceof File) || file.size === 0)
      return NextResponse.json({ error: "أرفق ملفًا." }, { status: 400 });
    if (file.size > MAX_UPLOAD_BYTES)
      return NextResponse.json({ error: "الملف أكبر من 25MB." }, { status: 400 });

    const stored = await saveUpload(file, "transactions");
    const id = await createTransaction({
      initiatorId: session.sub,
      title, type, note, approverIds,
      originalFile: stored,
      originalName: file.name,
      mimeType: file.type || "application/octet-stream",
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    if (e instanceof TxError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[transactions] create failed:", e);
    return NextResponse.json({ error: "تعذّر إنشاء المعاملة." }, { status: 500 });
  }
}
