import { withAuth, parseBody } from "@/lib/api-handler";
import { ok } from "@/lib/http";
import { Permission } from "@/core/domain/permissions";
import { reviewEvaluationSchema } from "@/core/application/evaluations/dto";
import { reviewEvaluation } from "@/core/application/evaluations/evaluation-service";

export const runtime = "nodejs";

type Params = { id: string };

export const POST = withAuth<Params>(
  async ({ user, meta, params, req }) =>
    ok(await reviewEvaluation(user, meta, params.id, await parseBody(req, reviewEvaluationSchema))),
  { permission: Permission.EVALUATION_REVIEW },
);
