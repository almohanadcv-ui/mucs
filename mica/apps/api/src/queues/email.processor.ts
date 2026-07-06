import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import type { Job } from "bullmq";
import { PrismaService } from "@/database/prisma/prisma.service";
import { MailerService } from "./mailer.service";
import { EMAIL_QUEUE } from "./bullmq.module";

export interface EmailJobData {
  notificationId?: string;
  to: string;
  subject: string;
  html: string;
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
    this.logger.log(`Processing email job ${job.id} (attempt ${job.attemptsMade + 1})`);
    await this.mailer.send(job.data);

    if (job.data.notificationId) {
      await this.prisma.notification.update({
        where: { id: job.data.notificationId },
        data: { status: "SENT", sentAt: new Date() },
      });
    }
  }

  @OnWorkerEvent("failed")
  async onFailed(job: Job<EmailJobData> | undefined): Promise<void> {
    if (!job?.data.notificationId) return;

    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade >= maxAttempts) {
      this.logger.error(`Email job ${job.id} exhausted retries; marking notification FAILED`);
      await this.prisma.notification.update({
        where: { id: job.data.notificationId },
        data: { status: "FAILED" },
      });
    }
  }
}
