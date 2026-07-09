import { withAuth } from "@/lib/api-handler";
import { ok } from "@/lib/http";
import { Permission } from "@/core/domain/permissions";
import { getTopEmployees } from "@/core/application/employees/employee-service";

export const runtime = "nodejs";

export const GET = withAuth(
  async ({ user, req }) => {
    const sp = req.nextUrl.searchParams;
    const threshold = sp.get("threshold");
    return ok(
      await getTopEmployees(user, {
        threshold: threshold != null ? Number(threshold) : undefined,
        departmentId: sp.get("departmentId") ?? undefined,
        branchId: sp.get("branchId") ?? undefined,
        evaluatorId: sp.get("evaluatorId") ?? undefined,
      }),
    );
  },
  { anyPermission: [Permission.EMPLOYEE_VIEW, Permission.EMPLOYEE_VIEW_TEAM] },
);
