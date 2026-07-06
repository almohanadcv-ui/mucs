import { withAuth, parseBody } from "@/lib/api-handler";
import { ok } from "@/lib/http";
import { Permission } from "@/core/domain/permissions";
import { updateUserSchema } from "@/core/application/users/dto";
import { updateUser, deleteUser } from "@/core/application/users/user-service";

export const runtime = "nodejs";

type Params = { id: string };

export const PATCH = withAuth<Params>(
  async ({ user, meta, params, req }) =>
    ok(await updateUser(user, meta, params.id, await parseBody(req, updateUserSchema))),
  { permission: Permission.USER_MANAGE },
);

export const DELETE = withAuth<Params>(
  async ({ user, meta, params }) => ok(await deleteUser(user, meta, params.id)),
  { permission: Permission.USER_MANAGE },
);
