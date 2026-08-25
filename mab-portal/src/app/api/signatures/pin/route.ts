import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { setSignPin, hasSignPin, resetSignPin, TxError } from "@/lib/transactions";

export const runtime = "nodejs";

// Whether the current user has a signing PIN set.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  return NextResponse.json({ hasPin: await hasSignPin(session.sub) });
}

// Set or clear (empty) the signing PIN (4 digits).
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { pin?: string };
  try {
    await setSignPin(session.sub, String(body.pin ?? "").trim() || null);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof TxError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

// Forgot the PIN → email a new 4-digit code to the current user.
export async function PUT() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  await resetSignPin(session.sub);
  return NextResponse.json({ ok: true });
}
