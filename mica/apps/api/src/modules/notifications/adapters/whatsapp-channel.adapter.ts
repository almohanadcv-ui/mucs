import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "@/database/prisma/prisma.service";
import type { NotificationChannel, NotificationPayload } from "../notification-channel.interface";

/** Stub — no WhatsApp Business API provider configured yet. Same swap-in pattern as SmsChannelAdapter. */
@Injectable()
export class WhatsAppChannelAdapter implements NotificationChannel {
  private readonly logger = new Logger(WhatsAppChannelAdapter.name);

  constructor(private readonly prisma: PrismaService) {}

  async send(notification: NotificationPayload): Promise<void> {
    this.logger.warn(`WhatsApp channel not configured — skipping message to ${notification.recipientId}`);
    await this.prisma.notification.create({
      data: {
        recipientId: notification.recipientId,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        payload: (notification.payload as Prisma.InputJsonValue) ?? undefined,
        channel: "WHATSAPP",
        status: "FAILED",
      },
    });
  }
}
