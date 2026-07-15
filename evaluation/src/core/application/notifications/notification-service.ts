import { Prisma } from "@prisma/client";
import { prisma } from "@/infrastructure/db/prisma";
import { publishToUser } from "@/infrastructure/realtime/bus";
import { buildMeta, toSkipTake, type PaginationInput, type Paginated } from "@/lib/pagination";
import type { NotificationType } from "@/core/domain/enums";
import type { SessionUser } from "@/infrastructure/auth/session";

export async function notify(params: {
  tenantId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  data?: Prisma.InputJsonValue;
}) {
  const notification = await prisma.notification.create({
    data: {
      tenantId: params.tenantId,
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body ?? null,
      data: params.data,
    },
  });

  // Every notification in the system is created here, so this is the one place
  // that has to push. Published after the write commits, or a client could
  // refetch before the row is visible and see nothing.
  publishToUser(params.userId, { type: "notification" });

  return notification;
}

/**
 * Notify several users of the same thing in one round trip.
 *
 * Returns the number of rows written. Callers should treat 0 as worth logging:
 * it means nobody was told, which is how "submitted for approval" silently
 * reached no one.
 */
export async function notifyMany(params: {
  tenantId: string;
  userIds: string[];
  type: NotificationType;
  title: string;
  body?: string;
  data?: Prisma.InputJsonValue;
}): Promise<number> {
  const userIds = [...new Set(params.userIds)];
  if (userIds.length === 0) return 0;

  const result = await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      tenantId: params.tenantId,
      userId,
      type: params.type,
      title: params.title,
      body: params.body ?? null,
      data: params.data,
    })),
  });

  for (const userId of userIds) publishToUser(userId, { type: "notification" });
  return result.count;
}

export async function listNotifications(
  user: SessionUser,
  input: PaginationInput & { unreadOnly?: boolean },
): Promise<Paginated<unknown>> {
  const where: Prisma.NotificationWhereInput = {
    userId: user.id,
    ...(input.unreadOnly ? { readAt: null } : {}),
  };
  // Concurrent, not transactional: a transaction would add a BEGIN/COMMIT round
  // trip to a remote database for three reads that don't need to agree exactly.
  const [items, total, unread] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...toSkipTake(input),
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);
  return { items, meta: { ...buildMeta(input, total), unread } as never };
}

export async function markRead(user: SessionUser, id: string) {
  await prisma.notification.updateMany({
    where: { id, userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function markAllRead(user: SessionUser) {
  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
}
