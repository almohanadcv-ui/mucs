import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { logAsset } from "@/lib/asset-log";

export const runtime = "nodejs";

// List assets, optionally filtered by status or holder.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  const url = req.nextUrl.searchParams;
  const status = url.get("status");
  const assignedToId = url.get("assignedToId");
  const search = (url.get("search") ?? "").trim();

  const rows = await prisma.asset.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(assignedToId ? { assignedToId } : {}),
      ...(search
        ? { OR: [{ assetNo: { contains: search, mode: "insensitive" } }, { nameAr: { contains: search, mode: "insensitive" } }, { serial: { contains: search, mode: "insensitive" } }] }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 300,
    select: {
      id: true, assetNo: true, type: true, nameAr: true, brand: true, serial: true,
      status: true, location: true, assignedAt: true,
      assignedTo: { select: { id: true, name: true } },
    },
  });

  const counts = await prisma.asset.groupBy({ by: ["status"], _count: { _all: true } });
  const byStatus: Record<string, number> = {};
  for (const c of counts) byStatus[c.status] = c._count._all;
  return NextResponse.json({ rows, byStatus, total: rows.length });
}

// Create a custody item (IT). Optionally assign it on creation.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.admin) return NextResponse.json({ error: "للمشرفين فقط" }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const nameAr = String(b.nameAr ?? "").trim();
  if (!nameAr) return NextResponse.json({ error: "اسم العهدة مطلوب." }, { status: 400 });

  // Auto-generate a sequential asset number A-<n>.
  const count = await prisma.asset.count();
  const assetNo = String(b.assetNo ?? "").trim() || `A-${count + 1}`;

  const assignedToId = b.assignedToId ? String(b.assignedToId) : null;
  const asset = await prisma.asset.create({
    data: {
      assetNo,
      type: ["LAPTOP", "CAR", "PHONE", "OTHER"].includes(String(b.type)) ? String(b.type) : "OTHER",
      nameAr,
      nameEn: b.nameEn ? String(b.nameEn) : null,
      brand: b.brand ? String(b.brand) : null,
      serial: b.serial ? String(b.serial) : null,
      purchaseCost: b.purchaseCost != null && b.purchaseCost !== "" ? Number(b.purchaseCost) : null,
      purchaseDate: b.purchaseDate ? new Date(String(b.purchaseDate)) : null,
      warrantyEnd: b.warrantyEnd ? new Date(String(b.warrantyEnd)) : null,
      location: b.location ? String(b.location) : null,
      note: b.note ? String(b.note) : null,
      status: assignedToId ? "ASSIGNED" : "AVAILABLE",
      assignedToId,
      assignedAt: assignedToId ? new Date() : null,
      createdById: session.sub,
    },
  });

  await logAsset({
    assetId: asset.id, action: "CREATE", actorId: session.sub, actorName: session.name,
    summary: `إضافة العهدة ${assetNo} — ${nameAr}`,
    detail: { assetNo, type: asset.type, brand: asset.brand, serial: asset.serial, purchaseCost: asset.purchaseCost },
  });
  if (assignedToId) {
    const holder = await prisma.portalUser.findUnique({ where: { id: assignedToId }, select: { name: true } });
    await logAsset({ assetId: asset.id, action: "ASSIGN", actorId: session.sub, actorName: session.name, summary: `إسناد العهدة إلى ${holder?.name ?? ""}` });
  }

  return NextResponse.json({ id: asset.id, assetNo }, { status: 201 });
}
