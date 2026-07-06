import { z } from "zod";
import { withAuth, parseBody } from "@/lib/api-handler";
import { ok } from "@/lib/http";
import { disableTwoFactor } from "@/core/application/auth/twofactor-service";

export const runtime = "nodejs";

const schema = z.object({ password: z.string().min(1) });

export const POST = withAuth(async ({ user, req }) => {
  const { password } = await parseBody(req, schema);
  return ok(await disableTwoFactor(user, password));
});
