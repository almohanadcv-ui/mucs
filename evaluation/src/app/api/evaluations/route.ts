import { withAuth, parseBody, parseQuery } from "@/lib/api-handler";
import { ok } from "@/lib/http";
import { Permission } from "@/core/domain/permissions";
import {
  createEvaluationSchema,
  listEvaluationsSchema,
} from "@/core/application/evaluations/dto";
import {
  createEvaluation,
  listEvaluations,
} from "@/core/application/evaluations/evaluation-service";

export const runtime = "nodejs";

export const GET = withAuth(
  async ({ user, req }) =>
    ok(await listEvaluations(user, parseQuery(req, listEvaluationsSchema))),
  {
    anyPermission: [
      Permission.EVALUATION_VIEW_OWN,
      Permission.EVALUATION_VIEW_TEAM,
      Permission.EVALUATION_VIEW_ALL,
    ],
  },
);

export const POST = withAuth(
  async ({ user, meta, req }) =>
    ok(await createEvaluation(user, meta, await parseBody(req, createEvaluationSchema)), {
      status: 201,
    }),
  { permission: Permission.EVALUATION_CREATE },
);
