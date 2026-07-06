import { withAuth, parseBody, parseQuery } from "@/lib/api-handler";
import { ok } from "@/lib/http";
import { Permission } from "@/core/domain/permissions";
import {
  createEmployeeSchema,
  listEmployeesSchema,
} from "@/core/application/employees/dto";
import {
  createEmployee,
  listEmployees,
} from "@/core/application/employees/employee-service";

export const runtime = "nodejs";

export const GET = withAuth(
  async ({ user, req }) =>
    ok(await listEmployees(user, parseQuery(req, listEmployeesSchema))),
  { anyPermission: [Permission.EMPLOYEE_VIEW, Permission.EMPLOYEE_VIEW_TEAM] },
);

export const POST = withAuth(
  async ({ user, meta, req }) =>
    ok(await createEmployee(user, meta, await parseBody(req, createEmployeeSchema)), {
      status: 201,
    }),
  { permission: Permission.EMPLOYEE_MANAGE },
);
