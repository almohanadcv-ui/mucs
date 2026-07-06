import { withAuth, parseBody } from "@/lib/api-handler";
import { ok } from "@/lib/http";
import { Permission } from "@/core/domain/permissions";
import { updateDepartmentSchema } from "@/core/application/departments/dto";
import {
  getDepartment,
  updateDepartment,
  deleteDepartment,
} from "@/core/application/departments/department-service";

export const runtime = "nodejs";

type Params = { id: string };

export const GET = withAuth<Params>(
  async ({ user, params }) => ok(await getDepartment(user, params.id)),
  { permission: Permission.DEPARTMENT_MANAGE },
);

export const PATCH = withAuth<Params>(
  async ({ user, meta, params, req }) =>
    ok(await updateDepartment(user, meta, params.id, await parseBody(req, updateDepartmentSchema))),
  { permission: Permission.DEPARTMENT_MANAGE },
);

export const DELETE = withAuth<Params>(
  async ({ user, meta, params }) =>
    ok(await deleteDepartment(user, meta, params.id)),
  { permission: Permission.DEPARTMENT_MANAGE },
);
