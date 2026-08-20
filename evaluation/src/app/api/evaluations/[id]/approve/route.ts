import { withAuth } from "@/lib/api-handler";
import { ok } from "@/lib/http";
import { Permission } from "@/core/domain/permissions";
import { managerApproveEvaluation } from "@/core/application/evaluations/evaluation-service";

export const runtime = "nodejs";

type Params = { id: string };

// The manager (owner) gives the final approval. The service enforces that only
// the owning manager (or IT) may approve — the permission here is the coarse gate.
export const POST = withAuth<Params>(
  async ({ user, meta, params }) => ok(await managerApproveEvaluation(user, meta, params.id)),
  { permission: Permission.EVALUATION_CREATE },
);
