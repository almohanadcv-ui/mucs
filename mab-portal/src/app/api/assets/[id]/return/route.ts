import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { logAsset } from "@/lib/asset-log";

export const runtime = "nodejs";

// Return a custody item (IT) — back to available. Logged.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.admin) return NextResponse.json({ error: "للمشرفين فقط" }, { status: 403 });
  const { id } = await ctx.params;
  const asset = await prisma.asset.findUnique({
    where: { id },
    select: { id: true, assetNo: true, assignedTo: { select: { name: true } } },
  });
  if (!asset) return NextResponse.json({ error: "العهدة غير موجودة." }, { status: 404 });

  await prisma.asset.update({
    where: { id },
    data: { assignedToId: null, assignedAt: null, status: "AVAILABLE" },
  });
  await logAsset({
    assetId: id, action: "RETURN", actorId: session.sub, actorName: session.name,
    summary: `استرجاع العهدة ${asset.assetNo}${asset.assignedTo ? ` من ${asset.assignedTo.name}` : ""}`,
  });
  return NextResponse.json({ ok: true });
}
