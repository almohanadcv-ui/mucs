import { z } from "zod";
import { withAuth, parseBody } from "@/lib/api-handler";
import { ok } from "@/lib/http";
import { myEvaluationRespond } from "@/core/application/evaluations/evaluation-service";

export const runtime = "nodejs";

const schema = z.object({
  decision: z.enum(["ACKNOWLEDGE", "OBJECT"]),
  comment: z.string().max(4000).optional(),
});

// The signed-in employee agrees to / objects to their own evaluation.
export const POST = withAuth(async ({ user, req }) => {
  const { decision, comment } = await parseBody(req, schema);
  const result = await myEvaluationRespond(user, decision, comment);
  return ok(result);
});
