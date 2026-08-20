import { withAuth, parseBody } from "@/lib/api-handler";
import { ok } from "@/lib/http";
import { Permission } from "@/core/domain/permissions";
import { evaluationCommentSchema } from "@/core/application/evaluations/dto";
import {
  addEvaluationComment,
  listEvaluationComments,
} from "@/core/application/evaluations/evaluation-service";

export const runtime = "nodejs";

type Params = { id: string };

// The thread: manager (for their own open evaluation) or HR/IT/Management.
export const GET = withAuth<Params>(
  async ({ user, params }) => ok(await listEvaluationComments(user, params.id)),
  {
    anyPermission: [
      Permission.EVALUATION_VIEW_OWN,
      Permission.EVALUATION_VIEW_ALL,
      Permission.EVALUATION_VIEW_THREAD,
    ],
  },
);

// A manager reply (visible to the employee) or an internal HR note. The service
// decides which, from the caller's relationship to the evaluation.
export const POST = withAuth<Params>(
  async ({ user, meta, params, req }) =>
    ok(await addEvaluationComment(user, meta, params.id, (await parseBody(req, evaluationCommentSchema)).body)),
  { anyPermission: [Permission.EVALUATION_CREATE, Permission.EVALUATION_COMMENT_HR] },
);
