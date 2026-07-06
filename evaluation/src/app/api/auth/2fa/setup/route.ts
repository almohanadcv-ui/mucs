import { withAuth } from "@/lib/api-handler";
import { ok } from "@/lib/http";
import { beginTwoFactorSetup } from "@/core/application/auth/twofactor-service";

export const runtime = "nodejs";

export const POST = withAuth(async ({ user }) => ok(await beginTwoFactorSetup(user)));
