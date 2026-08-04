import { withAuth, parseBody } from "@/lib/api-handler";
import { ok } from "@/lib/http";
import { REVIEW_PERMISSIONS } from "@/core/domain/permissions";
import { reviewEvaluationSchema } from "@/core/application/evaluations/dto";
import { reviewEvaluation } from "@/core/application/evaluations/evaluation-service";

export const runtime = "nodejs";

type Params = { id: string };

export const POST = withAuth<Params>(
  async ({ user, meta, params, req }) =>
    ok(await reviewEvaluation(user, meta, params.id, await parseBody(req, reviewEvaluationSchema))),
  // The specific action (preliminary/final approve, or return) is authorized
  // per-status inside the service; any review capability may reach the route.
  { anyPermission: REVIEW_PERMISSIONS },
);
