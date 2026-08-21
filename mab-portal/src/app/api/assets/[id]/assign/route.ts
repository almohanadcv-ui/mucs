import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { logAsset } from "@/lib/asset-log";

export const runtime = "nodejs";

// Assign a custody item to an employee (IT). Logged.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.admin) return NextResponse.json({ error: "للمشرفين فقط" }, { status: 403 });
  const { id } = await ctx.params;
  const { userId } = (await req.json().catch(() => ({}))) as { userId?: string };
  if (!userId) return NextResponse.json({ error: "اختر الموظف." }, { status: 400 });

  const [asset, user] = await Promise.all([
    prisma.asset.findUnique({ where: { id }, select: { id: true, assetNo: true, assignedToId: true } }),
    prisma.portalUser.findFirst({ where: { id: userId, deletedAt: null }, select: { id: true, name: true } }),
  ]);
  if (!asset) return NextResponse.json({ error: "العهدة غير موجودة." }, { status: 404 });
  if (!user) return NextResponse.json({ error: "الموظف غير موجود." }, { status: 404 });

  await prisma.asset.update({
    where: { id },
    data: { assignedToId: userId, assignedAt: new Date(), status: "ASSIGNED" },
  });
  await logAsset({
    assetId: id, action: "ASSIGN", actorId: session.sub, actorName: session.name,
    summary: `إسناد العهدة ${asset.assetNo} إلى ${user.name}`,
    detail: { userId, userName: user.name },
  });
  return NextResponse.json({ ok: true });
}
