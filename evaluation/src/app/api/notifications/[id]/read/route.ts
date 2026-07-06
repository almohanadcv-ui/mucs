import { withAuth } from "@/lib/api-handler";
import { ok } from "@/lib/http";
import { markRead } from "@/core/application/notifications/notification-service";

export const runtime = "nodejs";

type Params = { id: string };

export const POST = withAuth<Params>(async ({ user, params }) => {
  await markRead(user, params.id);
  return ok({ ok: true });
});
