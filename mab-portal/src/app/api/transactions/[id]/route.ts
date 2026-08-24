import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getUserPerms } from "@/lib/access";
import { getTransaction, TxError } from "@/lib/transactions";

export const runtime = "nodejs";

// One transaction's full detail (steps + arrows + whether it's my turn).
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const perms = await getUserPerms(session.sub);
    const tx = await getTransaction(id, session.sub, perms.isAdmin);
    return NextResponse.json({ tx });
  } catch (e) {
    if (e instanceof TxError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
