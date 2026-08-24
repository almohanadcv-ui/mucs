import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { rejectStep, resubmitTransaction, TxError } from "@/lib/transactions";

export const runtime = "nodejs";

// Reject the current step (returns one step back). Body: { note }.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { note?: string };
  try {
    await rejectStep(id, session.sub, { note: String(body.note ?? "") });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof TxError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

// The initiator resubmits a RETURNED transaction. (Same route, PUT.)
export async function PUT(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    await resubmitTransaction(id, session.sub);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof TxError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
