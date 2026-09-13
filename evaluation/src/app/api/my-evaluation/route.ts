import { withAuth } from "@/lib/api-handler";
import { ok } from "@/lib/http";
import { getMyEvaluation } from "@/core/application/evaluations/evaluation-service";

export const runtime = "nodejs";

// The signed-in employee's own evaluation + dialogue. Any authenticated user may
// call it; it only ever returns THEIR evaluation (resolved by the user↔employee
// link), so a manager with no employee record simply gets null. Pass ?id=<id>
// to open a specific past evaluation (validated to belong to them).
export const GET = withAuth(async ({ user, req }) => {
  const id = new URL(req.url).searchParams.get("id") || undefined;
  const data = await getMyEvaluation(user, id);
  return ok({ evaluation: data });
});
