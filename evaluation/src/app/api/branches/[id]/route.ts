import { withAuth, parseBody } from "@/lib/api-handler";
import { ok } from "@/lib/http";
import { Permission } from "@/core/domain/permissions";
import { updateBranchSchema } from "@/core/application/branches/dto";
import {
  getBranch,
  updateBranch,
  deleteBranch,
} from "@/core/application/branches/branch-service";

export const runtime = "nodejs";

type Params = { id: string };

export const GET = withAuth<Params>(
  async ({ user, params }) => ok(await getBranch(user, params.id)),
  { permission: Permission.BRANCH_MANAGE },
);

export const PATCH = withAuth<Params>(
  async ({ user, meta, params, req }) => {
    const body = await parseBody(req, updateBranchSchema);
    return ok(await updateBranch(user, meta, params.id, body));
  },
  { permission: Permission.BRANCH_MANAGE },
);

export const DELETE = withAuth<Params>(
  async ({ user, meta, params }) => ok(await deleteBranch(user, meta, params.id)),
  { permission: Permission.BRANCH_MANAGE },
);
