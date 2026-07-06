import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "@/database/prisma/prisma.service";
import type { NotificationChannel, NotificationPayload } from "../notification-channel.interface";
import { NotificationsGateway } from "../notifications.gateway";

@Injectable()
export class InAppChannelAdapter implements NotificationChannel {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
  ) {}

  async send(notification: NotificationPayload): Promise<void> {
    const row = await this.prisma.notification.create({
      data: {
        recipientId: notification.recipientId,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        payload: (notification.payload as Prisma.InputJsonValue) ?? undefined,
        channel: "IN_APP",
        status: "SENT",
        sentAt: new Date(),
      },
    });

    this.gateway.emitToUser(notification.recipientId, "notification", row);
  }
}
