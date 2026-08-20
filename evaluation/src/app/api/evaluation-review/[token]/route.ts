import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/http";
import { getEvaluationForEmployee } from "@/core/application/evaluations/evaluation-service";

export const runtime = "nodejs";

// Public: the employee opens their evaluation with the emailed magic-link token.
// No session — the token itself is the authorization, validated in the service.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params;
    return ok(await getEvaluationForEmployee(token));
  } catch (err) {
    return handleApiError(err);
  }
}
