import { withAuth, parseBody } from "@/lib/api-handler";
import { ok } from "@/lib/http";
import { Permission } from "@/core/domain/permissions";
import { updateEmployeeSchema } from "@/core/application/employees/dto";
import {
  getEmployee,
  updateEmployee,
  deleteEmployee,
} from "@/core/application/employees/employee-service";

export const runtime = "nodejs";

type Params = { id: string };

export const GET = withAuth<Params>(
  async ({ user, params }) => ok(await getEmployee(user, params.id)),
  { anyPermission: [Permission.EMPLOYEE_VIEW, Permission.EMPLOYEE_VIEW_TEAM] },
);

export const PATCH = withAuth<Params>(
  async ({ user, meta, params, req }) =>
    ok(await updateEmployee(user, meta, params.id, await parseBody(req, updateEmployeeSchema))),
  { permission: Permission.EMPLOYEE_MANAGE },
);

export const DELETE = withAuth<Params>(
  async ({ user, meta, params }) =>
    ok(await deleteEmployee(user, meta, params.id)),
  { permission: Permission.EMPLOYEE_MANAGE },
);
