import { ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { NotificationChannel as NotificationChannelEnum } from "@prisma/client";
import { PrismaService } from "@/database/prisma/prisma.service";
import type { NotificationChannel, NotificationPayload } from "./notification-channel.interface";
import { InAppChannelAdapter } from "./adapters/in-app-channel.adapter";
import { EmailChannelAdapter } from "./adapters/email-channel.adapter";
import { SmsChannelAdapter } from "./adapters/sms-channel.adapter";
import { WhatsAppChannelAdapter } from "./adapters/whatsapp-channel.adapter";
import { PushChannelAdapter } from "./adapters/push-channel.adapter";

export interface NotifyOptions extends NotificationPayload {
  channels: NotificationChannelEnum[];
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly channels: Record<NotificationChannelEnum, NotificationChannel>;

  constructor(
    private readonly prisma: PrismaService,
    inApp: InAppChannelAdapter,
    email: EmailChannelAdapter,
    sms: SmsChannelAdapter,
    whatsapp: WhatsAppChannelAdapter,
    push: PushChannelAdapter,
  ) {
    this.channels = {
      IN_APP: inApp,
      EMAIL: email,
      SMS: sms,
      WHATSAPP: whatsapp,
      PUSH: push,
    };
  }

  async notify(options: NotifyOptions): Promise<void> {
    const { channels, ...payload } = options;
    // Await only the in-app channel (a single insert + socket emit) so user
    // actions return immediately. Email/SMS/etc. are dispatched in the
    // background — a slow SMTP/queue must never delay the request.
    const inApp = channels.filter((c) => c === "IN_APP");
    const background = channels.filter((c) => c !== "IN_APP");

    await Promise.all(inApp.map((c) => this.channels[c].send(payload)));

    if (background.length > 0) {
      void Promise.all(
        background.map((c) =>
          this.channels[c]
            .send(payload)
            .catch((e) => this.logger.warn(`notify:${c} failed: ${(e as Error).message}`)),
        ),
      );
    }
  }

  async list(userId: string, page: number, pageSize: number) {
    const where = { recipientId: userId };
    const [items, totalItems] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.notification.count({ where }),
    ]);
    return { items, meta: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) } };
  }

  unreadCount(userId: string) {
    return this.prisma.notification.count({
      where: { recipientId: userId, readAt: null, channel: "IN_APP" },
    });
  }

  async markRead(userId: string, id: string): Promise<void> {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification) throw new NotFoundException("Notification not found");
    if (notification.recipientId !== userId) {
      throw new ForbiddenException("Cannot modify another user's notification");
    }
    await this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date(), status: "READ" },
    });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { recipientId: userId, readAt: null },
      data: { readAt: new Date(), status: "READ" },
    });
  }
}
