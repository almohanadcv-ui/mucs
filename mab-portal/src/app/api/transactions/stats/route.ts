import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getUserPerms } from "@/lib/access";
import { transactionStats } from "@/lib/transactions";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  const perms = await getUserPerms(session.sub);
  const stats = await transactionStats(session.sub, perms.isAdmin);
  return NextResponse.json({ stats });
}
