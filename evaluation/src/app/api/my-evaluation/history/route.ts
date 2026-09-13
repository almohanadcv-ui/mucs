import { withAuth } from "@/lib/api-handler";
import { ok } from "@/lib/http";
import { listMyEvaluations } from "@/core/application/evaluations/evaluation-service";

export const runtime = "nodejs";

// The signed-in employee's full evaluation history (newest first) for the
// «تقييمي» list — id, template, score, status, date. Only ever theirs.
export const GET = withAuth(async ({ user }) => {
  const items = await listMyEvaluations(user);
  return ok({ items });
});
