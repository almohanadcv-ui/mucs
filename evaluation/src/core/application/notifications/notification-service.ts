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
