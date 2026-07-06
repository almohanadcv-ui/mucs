import { z } from "zod";
import { withAuth, parseBody } from "@/lib/api-handler";
import { ok } from "@/lib/http";
import { enableTwoFactor } from "@/core/application/auth/twofactor-service";

export const runtime = "nodejs";

const schema = z.object({ token: z.string().regex(/^\d{6}$/u, "رمز من 6 أرقام") });

export const POST = withAuth(async ({ user, req }) => {
  const { token } = await parseBody(req, schema);
  return ok(await enableTwoFactor(user, token));
});
