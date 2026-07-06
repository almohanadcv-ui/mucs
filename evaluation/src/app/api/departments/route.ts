import { withAuth, parseBody, parseQuery } from "@/lib/api-handler";
import { ok } from "@/lib/http";
import { Permission } from "@/core/domain/permissions";
import {
  createDepartmentSchema,
  listDepartmentsSchema,
} from "@/core/application/departments/dto";
import {
  createDepartment,
  listDepartments,
} from "@/core/application/departments/department-service";

export const runtime = "nodejs";

export const GET = withAuth(
  async ({ user, req }) =>
    ok(await listDepartments(user, parseQuery(req, listDepartmentsSchema))),
  { permission: Permission.DEPARTMENT_MANAGE },
);

export const POST = withAuth(
  async ({ user, meta, req }) =>
    ok(await createDepartment(user, meta, await parseBody(req, createDepartmentSchema)), {
      status: 201,
    }),
  { permission: Permission.DEPARTMENT_MANAGE },
);
