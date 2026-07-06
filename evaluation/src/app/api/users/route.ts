import { withAuth, parseBody, parseQuery } from "@/lib/api-handler";
import { ok } from "@/lib/http";
import { Permission } from "@/core/domain/permissions";
import { createUserSchema, listUsersSchema } from "@/core/application/users/dto";
import { createUser, listUsers } from "@/core/application/users/user-service";

export const runtime = "nodejs";

export const GET = withAuth(
  async ({ user, req }) => ok(await listUsers(user, parseQuery(req, listUsersSchema))),
  { permission: Permission.USER_MANAGE },
);

export const POST = withAuth(
  async ({ user, meta, req }) =>
    ok(await createUser(user, meta, await parseBody(req, createUserSchema)), { status: 201 }),
  { permission: Permission.USER_MANAGE },
);
