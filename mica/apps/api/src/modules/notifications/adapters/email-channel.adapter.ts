import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { Queue } from "bullmq";
import { PrismaService } from "@/database/prisma/prisma.service";
import { EMAIL_QUEUE } from "@/queues/bullmq.module";
import type { EmailJobData } from "@/queues/email.processor";
import type { NotificationChannel, NotificationPayload } from "../notification-channel.interface";
import { escapeHtml } from "../escape-html";

@Injectable()
export class EmailChannelAdapter implements NotificationChannel {
  private readonly logger = new Logger(EmailChannelAdapter.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(EMAIL_QUEUE) private readonly emailQueue: Queue<EmailJobData>,
  ) {}

  async send(notification: NotificationPayload): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: notification.recipientId } });
    if (!user?.email) {
      // Recorded rather than dropped: a manager who never receives the mail
      // because their account has no address is an operational fact worth
      // seeing, not a silent no-op.
      this.logger.warn(`Skipping email: recipient ${notification.recipientId} has no address`);
      return;
    }

    // Scoped per recipient so one event fanned out to several managers still
    // reaches each of them, while a repeat of the same event reaches nobody twice.
    const idempotencyKey = notification.idempotencyKey
      ? `${notification.idempotencyKey}:${notification.recipientId}`
      : undefined;

    let row;
    try {
      row = await this.prisma.notification.create({
        data: {
          recipientId: notification.recipientId,
          type: notification.type,
          title: notification.title,
          body: notification.body,
          payload: (notification.payload as Prisma.InputJsonValue) ?? undefined,
          channel: "EMAIL",
          status: "PENDING",
          idempotencyKey,
          correlationId: notification.correlationId,
        },
      });
    } catch (e) {
      // P2002 = unique violation on idempotencyKey: this event was already
      // announced to this recipient, so there is nothing left to do. Any other
      // failure is real and must surface.
      if ((e as { code?: string }).code === "P2002") {
        this.logger.log(`Duplicate suppressed for ${idempotencyKey}`);
        return;
      }
      throw e;
    }

    await this.emailQueue.add("send", {
      notificationId: row.id,
      to: user.email,
      subject: notification.title,
      // Escaped: the body carries user-typed text (rejection reasons, workshop
      // names) and is interpolated straight into HTML.
      html: `<p dir="rtl">${escapeHtml(notification.body)}</p>`,
    });
  }
}
