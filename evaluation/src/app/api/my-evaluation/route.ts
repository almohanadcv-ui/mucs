import { withAuth } from "@/lib/api-handler";
import { ok } from "@/lib/http";
import { getMyEvaluation } from "@/core/application/evaluations/evaluation-service";

export const runtime = "nodejs";

// The signed-in employee's own evaluation + dialogue. Any authenticated user may
// call it; it only ever returns THEIR evaluation (resolved by the user↔employee
// link), so a manager with no employee record simply gets null.
export const GET = withAuth(async ({ user }) => {
  const data = await getMyEvaluation(user);
  return ok({ evaluation: data });
});
