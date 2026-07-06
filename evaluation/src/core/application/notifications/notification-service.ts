import { Prisma } from "@prisma/client";
import { prisma } from "@/infrastructure/db/prisma";
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
  return prisma.notification.create({
    data: {
      tenantId: params.tenantId,
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body ?? null,
      data: params.data,
    },
  });
}

export async function listNotifications(
  user: SessionUser,
  input: PaginationInput & { unreadOnly?: boolean },
): Promise<Paginated<unknown>> {
  const where: Prisma.NotificationWhereInput = {
    userId: user.id,
    ...(input.unreadOnly ? { readAt: null } : {}),
  };
  const [items, total, unread] = await prisma.$transaction([
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
