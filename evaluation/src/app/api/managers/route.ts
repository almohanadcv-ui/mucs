import { withAuth, parseBody } from "@/lib/api-handler";
import { ok } from "@/lib/http";
import { Permission } from "@/core/domain/permissions";
import {
  createManagerFromName,
  createManagerSchema,
} from "@/core/application/employees/manager-service";

export const runtime = "nodejs";

/** Create an evaluator/manager login by name and auto-link their team. */
export const POST = withAuth(
  async ({ user, meta, req }) =>
    ok(await createManagerFromName(user, meta, await parseBody(req, createManagerSchema)), {
      status: 201,
    }),
  { permission: Permission.MANAGER_CREATE },
);
