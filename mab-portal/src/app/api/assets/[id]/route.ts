import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { logAsset } from "@/lib/asset-log";

export const runtime = "nodejs";

// Asset detail + full history.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  const { id } = await ctx.params;
  const asset = await prisma.asset.findUnique({
    where: { id },
    include: {
      assignedTo: { select: { id: true, name: true } },
      logs: { orderBy: { createdAt: "desc" }, select: { id: true, action: true, summary: true, actorName: true, createdAt: true, detail: true } },
    },
  });
  if (!asset) return NextResponse.json({ error: "العهدة غير موجودة." }, { status: 404 });
  return NextResponse.json({ asset });
}

// Edit an asset (IT). Records exactly what changed.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.admin) return NextResponse.json({ error: "للمشرفين فقط" }, { status: 403 });
  const { id } = await ctx.params;
  const asset = await prisma.asset.findUnique({ where: { id } });
  if (!asset) return NextResponse.json({ error: "العهدة غير موجودة." }, { status: 404 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const FIELDS = ["nameAr", "nameEn", "brand", "serial", "location", "note", "type", "status"] as const;
  const data: Record<string, unknown> = {};
  const changes: { field: string; from: unknown; to: unknown }[] = [];
  for (const f of FIELDS) {
    if (b[f] !== undefined) {
      const to = b[f] === "" ? null : b[f];
      if ((asset as Record<string, unknown>)[f] !== to) {
        changes.push({ field: f, from: (asset as Record<string, unknown>)[f], to });
        data[f] = to;
      }
    }
  }
  if (b.purchaseCost !== undefined) data.purchaseCost = b.purchaseCost === "" ? null : Number(b.purchaseCost);

  if (Object.keys(data).length === 0) return NextResponse.json({ ok: true });
  await prisma.asset.update({ where: { id }, data });
  await logAsset({
    assetId: id, action: "UPDATE", actorId: session.sub, actorName: session.name,
    summary: `تعديل العهدة (${changes.map((c) => c.field).join("، ")})`,
    detail: { changes },
  });
  return NextResponse.json({ ok: true });
}
