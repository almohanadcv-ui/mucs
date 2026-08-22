import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { audit } from "@/lib/audit";
import { catalogFor } from "@/lib/system-catalog";

export const runtime = "nodejs";

async function guard() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "غير مصرّح" }, { status: 401 }) };
  if (!session.admin) return { error: NextResponse.json({ error: "للمشرفين فقط" }, { status: 403 }) };
  return { session };
}

// The systems + this user's grant for each: granted?, role, chosen features, and
// the system's catalog (available roles + toggleable sections) so the portal can
// render "system → role → sections".
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard();
  if (g.error) return g.error;
  const { id } = await ctx.params;

  const [user, systems, granted] = await Promise.all([
    prisma.portalUser.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, name: true, email: true, isSuperAdmin: true },
    }),
    prisma.system.findMany({
      orderBy: { order: "asc" },
      select: { id: true, key: true, name: true, isActive: true },
    }),
    prisma.userSystemAccess.findMany({
      where: { userId: id },
      select: { systemId: true, role: true, features: true },
    }),
  ]);
  if (!user) return NextResponse.json({ error: "المستخدم غير موجود." }, { status: 404 });

  const grantMap = new Map(granted.map((a) => [a.systemId, a]));
  return NextResponse.json({
    user,
    systems: systems.map((s) => {
      const grant = grantMap.get(s.id);
      const cat = catalogFor(s.key);
      return {
        id: s.id,
        key: s.key,
        name: s.name,
        isActive: s.isActive,
        granted: !!grant,
        role: grant?.role ?? cat?.defaultRole ?? null,
        features: grant?.features ?? [],
        catalog: cat, // null when the system has no configurable roles yet
      };
    }),
  });
}

// Replace the user's grants. Body: { grants: [{ systemId, role?, features? }] }.
// (Back-compat: { systemIds: [...] } grants with default role/features.)
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard();
  if (g.error) return g.error;
  const { id } = await ctx.params;

  const body = (await req.json().catch(() => ({}))) as {
    grants?: { systemId: string; role?: string | null; features?: string[] }[];
    systemIds?: string[];
  };
  const grants =
    Array.isArray(body.grants)
      ? body.grants
      : Array.isArray(body.systemIds)
        ? body.systemIds.map((systemId) => ({ systemId, role: null, features: [] as string[] }))
        : [];

  const user = await prisma.portalUser.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "المستخدم غير موجود." }, { status: 404 });

  // Keep only real systems, and validate role/features against each catalog.
  const systems = await prisma.system.findMany({ select: { id: true, key: true } });
  const byId = new Map(systems.map((s) => [s.id, s]));
  const seen = new Set<string>();
  const rows = grants
    .filter((grant) => byId.has(grant.systemId) && !seen.has(grant.systemId) && seen.add(grant.systemId))
    .map((grant) => {
      const sys = byId.get(grant.systemId)!;
      const cat = catalogFor(sys.key);
      let role: string | null = grant.role ?? null;
      let features: string[] = Array.isArray(grant.features) ? [...new Set(grant.features)] : [];
      if (cat) {
        if (role && !cat.roles.some((r) => r.key === role)) role = cat.defaultRole;
        const allowed = new Set(cat.features.map((f) => f.key));
        features = features.filter((f) => allowed.has(f));
      }
      return { userId: id, systemId: grant.systemId, role, features, grantedById: g.session.sub };
    });

  await prisma.$transaction([
    prisma.userSystemAccess.deleteMany({ where: { userId: id } }),
    ...(rows.length ? [prisma.userSystemAccess.createMany({ data: rows, skipDuplicates: true })] : []),
  ]);

  await audit({
    actorId: g.session.sub,
    actorEmail: g.session.email,
    action: "SET_ACCESS",
    entityType: "Access",
    entityId: id,
    meta: { grants: rows.map((r) => ({ systemId: r.systemId, role: r.role, features: r.features })) },
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });

  return NextResponse.json({ ok: true });
}
