import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/http";
import { AppError } from "@/core/application/errors";
import { employeeRespondSchema } from "@/core/application/evaluations/dto";
import { employeeRespondToEvaluation } from "@/core/application/evaluations/evaluation-service";

export const runtime = "nodejs";

// Public: the employee agrees to or objects to their evaluation via the token.
export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params;
    const raw = await req.json().catch(() => {
      throw AppError.validation("جسم الطلب غير صالح (JSON)");
    });
    const parsed = employeeRespondSchema.safeParse(raw);
    if (!parsed.success) throw AppError.validation("بيانات غير صالحة", parsed.error.flatten());
    return ok(
      await employeeRespondToEvaluation(token, parsed.data.decision, parsed.data.comment),
    );
  } catch (err) {
    return handleApiError(err);
  }
}
