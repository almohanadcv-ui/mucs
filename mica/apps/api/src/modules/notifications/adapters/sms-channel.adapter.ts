import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "@/database/prisma/prisma.service";
import type { NotificationChannel, NotificationPayload } from "../notification-channel.interface";

/**
 * Stub — no SMS gateway is configured yet (Twilio, etc.). Swapping in a real
 * provider later means implementing this same interface; nothing that calls
 * NotificationsService needs to change.
 */
@Injectable()
export class SmsChannelAdapter implements NotificationChannel {
  private readonly logger = new Logger(SmsChannelAdapter.name);

  constructor(private readonly prisma: PrismaService) {}

  async send(notification: NotificationPayload): Promise<void> {
    this.logger.warn(`SMS channel not configured — skipping SMS to ${notification.recipientId}`);
    await this.prisma.notification.create({
      data: {
        recipientId: notification.recipientId,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        payload: (notification.payload as Prisma.InputJsonValue) ?? undefined,
        channel: "SMS",
        status: "FAILED",
      },
    });
  }
}
