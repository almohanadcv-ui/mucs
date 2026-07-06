import { getCurrentUser } from "@/infrastructure/auth/session";
import { permissionsFor } from "@/core/domain/permissions";
import { ok, fail } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHORIZED", "غير مصرّح", 401);
  return ok({
    id: user.id,
    name: user.name,
    role: user.role,
    tenantId: user.tenantId,
    permissions: [...permissionsFor(user.role)],
  });
}
