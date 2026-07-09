import { withAuth, parseBody, parseQuery } from "@/lib/api-handler";
import { ok } from "@/lib/http";
import { Permission } from "@/core/domain/permissions";
import {
  createCustomEmployee,
  listCustomEmployees,
  createCustomEmployeeSchema,
  listCustomEmployeesSchema,
} from "@/core/application/employees/custom-employee-service";

export const runtime = "nodejs";

export const GET = withAuth(
  async ({ user, req }) =>
    ok(await listCustomEmployees(user, parseQuery(req, listCustomEmployeesSchema))),
  { anyPermission: [Permission.EMPLOYEE_VIEW, Permission.EMPLOYEE_VIEW_TEAM] },
);

export const POST = withAuth(
  async ({ user, meta, req }) =>
    ok(await createCustomEmployee(user, meta, await parseBody(req, createCustomEmployeeSchema)), {
      status: 201,
    }),
  { permission: Permission.EMPLOYEE_MANAGE },
);
