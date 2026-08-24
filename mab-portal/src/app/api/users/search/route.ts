import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

// A minimal people-picker for choosing approvers. Any signed-in user may search
// the directory (name/jobTitle/email) — it returns only display fields.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();

  const rows = await prisma.portalUser.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      id: { not: session.sub },
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { jobTitle: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
    take: 20,
    select: { id: true, name: true, jobTitle: true },
  });
  return NextResponse.json({ rows });
}
