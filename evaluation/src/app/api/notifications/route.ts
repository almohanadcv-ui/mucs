import { withAuth, parseQuery } from "@/lib/api-handler";
import { ok } from "@/lib/http";
import { z } from "zod";
import { paginationSchema } from "@/lib/pagination";
import {
  listNotifications,
  markAllRead,
} from "@/core/application/notifications/notification-service";

export const runtime = "nodejs";

const querySchema = paginationSchema.extend({
  unreadOnly: z.coerce.boolean().optional(),
});

export const GET = withAuth(async ({ user, req }) =>
  ok(await listNotifications(user, parseQuery(req, querySchema))),
);

// Mark all as read
export const POST = withAuth(async ({ user }) => {
  await markAllRead(user);
  return ok({ ok: true });
});
