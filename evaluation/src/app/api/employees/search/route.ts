import { withAuth } from "@/lib/api-handler";
import { ok } from "@/lib/http";
import { Permission } from "@/core/domain/permissions";
import { searchEmployeesForPicker } from "@/core/application/employees/employee-service";

export const runtime = "nodejs";

/** Type-ahead employee search for the evaluation picker. */
export const GET = withAuth(
  async ({ user, req }) => {
    const q = req.nextUrl.searchParams.get("q") ?? "";
    return ok(await searchEmployeesForPicker(user, q));
  },
  { anyPermission: [Permission.EMPLOYEE_VIEW, Permission.EMPLOYEE_VIEW_TEAM] },
);
