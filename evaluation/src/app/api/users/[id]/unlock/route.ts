import { withAuth } from "@/lib/api-handler";
import { ok } from "@/lib/http";
import { Permission } from "@/core/domain/permissions";
import { unlockUser } from "@/core/application/users/user-service";

export const runtime = "nodejs";

type Params = { id: string };

/** Clear a user's lockout (IT). */
export const POST = withAuth<Params>(
  async ({ user, meta, params }) => ok(await unlockUser(user, meta, params.id)),
  { permission: Permission.USER_MANAGE },
);
