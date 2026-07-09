import { withAuth } from "@/lib/api-handler";
import { ok } from "@/lib/http";
import { Permission } from "@/core/domain/permissions";
import { getEmployeeProfile } from "@/core/application/employees/employee-service";

export const runtime = "nodejs";

export const GET = withAuth<{ id: string }>(
  async ({ user, params }) => ok(await getEmployeeProfile(user, params.id)),
  { anyPermission: [Permission.EMPLOYEE_VIEW, Permission.EMPLOYEE_VIEW_TEAM] },
);
