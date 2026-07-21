import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { Job } from "bullmq";
import { PrismaService } from "@/database/prisma/prisma.service";
import { MailerService } from "./mailer.service";
import { EMAIL_QUEUE } from "./bullmq.module";

export interface EmailJobData {
  notificationId?: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Processor(EMAIL_QUEUE)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    private readonly mailer: MailerService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<EmailJobData>): Promise<void> {
    const attempt = job.attemptsMade + 1;
    this.logger.log(`Processing email job ${job.id} (attempt ${attempt})`);

    const { notificationId } = job.data;
    if (notificationId) {
      // Marks the row as claimed, so a send stuck mid-flight is
      // distinguishable from one the worker never picked up.
      await this.touch(notificationId, { status: "PROCESSING", attempts: attempt });
    }

    const result = await this.mailer.send(job.data);

    if (notificationId) {
      await this.touch(notificationId, {
        status: "SENT",
        sentAt: new Date(),
        providerMessageId: result.messageId ?? null,
        lastError: null,
        nextAttemptAt: null,
      });
    }
  }

  @OnWorkerEvent("failed")
  async onFailed(job: Job<EmailJobData> | undefined, error: Error): Promise<void> {
    if (!job?.data.notificationId) return;

    const maxAttempts = job.opts.attempts ?? 1;
    const exhausted = job.attemptsMade >= maxAttempts;

    // Truncated: an SMTP transcript can be long and may quote message content,
    // and this column is read by operators, not by the mail flow.
    const lastError = (error?.message ?? "unknown error").slice(0, 500);

    if (exhausted) {
      this.logger.error(`Email job ${job.id} exhausted ${maxAttempts} attempts`);
      await this.touch(job.data.notificationId, {
        status: "DEAD",
        failedAt: new Date(),
        lastError,
        nextAttemptAt: null,
      });
      return;
    }

    // BullMQ owns the retry schedule; nextAttemptAt mirrors it for anyone
    // reading the database, following the queue's exponential backoff.
    const delayMs = (job.opts.backoff as { delay?: number } | undefined)?.delay ?? 2000;
    await this.touch(job.data.notificationId, {
      status: "RETRY",
      lastError,
      nextAttemptAt: new Date(Date.now() + delayMs * 2 ** job.attemptsMade),
    });
  }

  /**
   * Bookkeeping must never fail a send that already succeeded, so an error
   * here is logged and swallowed rather than rethrown — rethrowing would make
   * BullMQ retry a message the provider has already accepted, and the
   * recipient would get it twice.
   */
  private async touch(id: string, data: Prisma.NotificationUpdateInput): Promise<void> {
    try {
      await this.prisma.notification.update({ where: { id }, data });
    } catch (e) {
      this.logger.warn(`Could not update notification ${id}: ${(e as Error).message}`);
    }
  }
}
