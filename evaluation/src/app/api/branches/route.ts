import { withAuth, parseBody, parseQuery } from "@/lib/api-handler";
import { ok } from "@/lib/http";
import { Permission } from "@/core/domain/permissions";
import {
  createBranchSchema,
  listBranchesSchema,
} from "@/core/application/branches/dto";
import {
  createBranch,
  listBranches,
} from "@/core/application/branches/branch-service";

export const runtime = "nodejs";

export const GET = withAuth(
  async ({ user, req }) => {
    const query = parseQuery(req, listBranchesSchema);
    return ok(await listBranches(user, query));
  },
  { permission: Permission.BRANCH_MANAGE },
);

export const POST = withAuth(
  async ({ user, meta, req }) => {
    const body = await parseBody(req, createBranchSchema);
    return ok(await createBranch(user, meta, body), { status: 201 });
  },
  { permission: Permission.BRANCH_MANAGE },
);
