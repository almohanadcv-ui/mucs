import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { sendDraft, TxError } from "@/lib/transactions";

export const runtime = "nodejs";

// Send a DRAFT: set the ordered signers and start the approval flow.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { approverIds?: string[] };
  try {
    await sendDraft(id, session.sub, Array.isArray(body.approverIds) ? body.approverIds : []);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof TxError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
