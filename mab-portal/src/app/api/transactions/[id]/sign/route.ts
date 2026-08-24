import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { signStep, TxError } from "@/lib/transactions";

export const runtime = "nodejs";

// Approve the current step (with an optional drawn signature + note).
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { note?: string; signatureImg?: string };
  // Cap the signature data URL so an oversized payload can't be stored.
  const sig = typeof body.signatureImg === "string" && body.signatureImg.length < 400_000 ? body.signatureImg : undefined;
  try {
    await signStep(id, session.sub, { note: body.note, signatureImg: sig });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof TxError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
