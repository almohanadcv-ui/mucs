import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getUserPerms } from "@/lib/access";
import { prisma } from "@/lib/db";
import { getTransaction, TxError } from "@/lib/transactions";
import { readUpload } from "@/lib/uploads";

export const runtime = "nodejs";

// Download the final signed PDF (all signatures burned in). Participants + admin.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const perms = await getUserPerms(session.sub);
    await getTransaction(id, session.sub, perms.isAdmin); // authorizes or throws
    const tx = await prisma.transaction.findUnique({ where: { id }, select: { signedFile: true, title: true } });
    if (!tx?.signedFile) return NextResponse.json({ error: "الملف الموقّع غير جاهز." }, { status: 404 });
    const buf = await readUpload("transactions", tx.signedFile);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(`${tx.title}-موقّع.pdf`)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    if (e instanceof TxError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
