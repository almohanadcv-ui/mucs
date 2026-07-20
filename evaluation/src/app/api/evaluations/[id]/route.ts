import { withAuth, parseBody } from "@/lib/api-handler";
import { ok } from "@/lib/http";
import { Permission } from "@/core/domain/permissions";
import { updateEvaluationSchema } from "@/core/application/evaluations/dto";
import {
  deleteEvaluation,
  getEvaluation,
  updateEvaluation,
} from "@/core/application/evaluations/evaluation-service";

export const runtime = "nodejs";

type Params = { id: string };

export const GET = withAuth<Params>(
  async ({ user, params }) => ok(await getEvaluation(user, params.id)),
  {
    anyPermission: [
      Permission.EVALUATION_VIEW_OWN,
      Permission.EVALUATION_VIEW_TEAM,
      Permission.EVALUATION_VIEW_ALL,
    ],
  },
);

export const PATCH = withAuth<Params>(
  async ({ user, meta, params, req }) =>
    ok(await updateEvaluation(user, meta, params.id, await parseBody(req, updateEvaluationSchema))),
  { permission: Permission.EVALUATION_CREATE },
);

export const DELETE = withAuth<Params>(
  async ({ user, meta, params }) => ok(await deleteEvaluation(user, meta, params.id)),
  { permission: Permission.EVALUATION_DELETE },
);
