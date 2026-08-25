import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { setSignPin, hasSignPin } from "@/lib/transactions";

export const runtime = "nodejs";

// Whether the current user has a signing PIN set.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  return NextResponse.json({ hasPin: await hasSignPin(session.sub) });
}

// Set or clear (empty) the signing PIN (كلمة السر).
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { pin?: string };
  const pin = String(body.pin ?? "").trim();
  if (pin && pin.length < 4) return NextResponse.json({ error: "الرمز ٤ خانات على الأقل." }, { status: 400 });
  await setSignPin(session.sub, pin || null);
  return NextResponse.json({ ok: true });
}
