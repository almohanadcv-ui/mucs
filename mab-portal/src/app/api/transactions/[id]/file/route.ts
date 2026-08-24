import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getUserPerms } from "@/lib/access";
import { prisma } from "@/lib/db";
import { getTransaction, TxError } from "@/lib/transactions";
import { readUpload } from "@/lib/uploads";

export const runtime = "nodejs";

// Stream a transaction's document — only to a participant or an admin.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const perms = await getUserPerms(session.sub);
    // Authorization: getTransaction throws 403 for non-participants.
    await getTransaction(id, session.sub, perms.isAdmin);
    const tx = await prisma.transaction.findUnique({
      where: { id },
      select: { originalFile: true, originalName: true, mimeType: true },
    });
    if (!tx) throw new TxError("غير موجود.", 404);
    const buf = await readUpload("transactions", tx.originalFile);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": tx.mimeType || "application/octet-stream",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(tx.originalName)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    if (e instanceof TxError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
