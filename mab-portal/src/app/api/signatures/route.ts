import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

// The signed-in user's saved signatures/stamps.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  const rows = await prisma.userSignature.findMany({
    where: { userId: session.sub },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    select: { id: true, label: true, kind: true, imageData: true, isDefault: true },
  });
  return NextResponse.json({ rows });
}

// Save a new signature/stamp (drawn). Name is NOT stored — it comes from the
// account at sign time.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { label?: string; kind?: string; imageData?: string; isDefault?: boolean };
  const img = typeof body.imageData === "string" ? body.imageData : "";
  if (!img.startsWith("data:image/") || img.length > 400_000)
    return NextResponse.json({ error: "توقيع غير صالح." }, { status: 400 });
  const kind = body.kind === "STAMP" ? "STAMP" : "SIGNATURE";

  const created = await prisma.$transaction(async (tx) => {
    if (body.isDefault) await tx.userSignature.updateMany({ where: { userId: session.sub }, data: { isDefault: false } });
    const count = await tx.userSignature.count({ where: { userId: session.sub } });
    return tx.userSignature.create({
      data: {
        userId: session.sub,
        label: body.label?.trim() || null,
        kind,
        imageData: img,
        isDefault: body.isDefault ?? count === 0, // first one is default
      },
      select: { id: true },
    });
  });
  return NextResponse.json({ id: created.id }, { status: 201 });
}
