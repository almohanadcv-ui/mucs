import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { Queue } from "bullmq";
import { PrismaService } from "@/database/prisma/prisma.service";
import { EMAIL_QUEUE } from "@/queues/bullmq.module";
import type { EmailJobData } from "@/queues/email.processor";
import type { NotificationChannel, NotificationPayload } from "../notification-channel.interface";

@Injectable()
export class EmailChannelAdapter implements NotificationChannel {
  private readonly logger = new Logger(EmailChannelAdapter.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(EMAIL_QUEUE) private readonly emailQueue: Queue<EmailJobData>,
  ) {}

  async send(notification: NotificationPayload): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: notification.recipientId } });
    if (!user) {
      this.logger.warn(`Skipping email: recipient ${notification.recipientId} not found`);
      return;
    }

    const row = await this.prisma.notification.create({
      data: {
        recipientId: notification.recipientId,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        payload: (notification.payload as Prisma.InputJsonValue) ?? undefined,
        channel: "EMAIL",
        status: "PENDING",
      },
    });

    await this.emailQueue.add("send", {
      notificationId: row.id,
      to: user.email,
      subject: notification.title,
      html: `<p>${notification.body}</p>`,
    });
  }
}
