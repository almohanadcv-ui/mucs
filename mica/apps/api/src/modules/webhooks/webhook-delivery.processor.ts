import { createHmac } from "node:crypto";
import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import type { Job } from "bullmq";
import { PrismaService } from "@/database/prisma/prisma.service";
import { WEBHOOK_DELIVERY_QUEUE } from "@/queues/bullmq.module";

export interface WebhookDeliveryJobData {
  deliveryId: string;
  webhookId: string;
  event: string;
  payload: Record<string, unknown>;
}

const DELIVERY_TIMEOUT_MS = 10_000;

function sign(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

@Processor(WEBHOOK_DELIVERY_QUEUE)
export class WebhookDeliveryProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookDeliveryProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<WebhookDeliveryJobData>): Promise<void> {
    const { deliveryId, webhookId, event, payload } = job.data;
    const webhook = await this.prisma.webhook.findUnique({ where: { id: webhookId } });
    if (!webhook || !webhook.isActive) {
      await this.prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: { status: "FAILED", attempt: job.attemptsMade + 1 },
      });
      return;
    }

    const body = JSON.stringify({ event, payload, deliveredAt: new Date().toISOString() });
    const signature = sign(webhook.secret, body);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

    try {
      const response = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-MICA-Event": event,
          "X-MICA-Signature": `sha256=${signature}`,
          "X-MICA-Delivery": deliveryId,
        },
        body,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Webhook endpoint responded with ${response.status}`);
      }

      await this.prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: "SUCCESS",
          responseStatus: response.status,
          attempt: job.attemptsMade + 1,
          deliveredAt: new Date(),
        },
      });
      await this.prisma.webhook.update({ where: { id: webhookId }, data: { lastTriggeredAt: new Date() } });
    } catch (error) {
      await this.prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: { attempt: job.attemptsMade + 1 },
      });
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  @OnWorkerEvent("failed")
  async onFailed(job: Job<WebhookDeliveryJobData> | undefined): Promise<void> {
    if (!job) return;
    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade >= maxAttempts) {
      this.logger.error(`Webhook delivery ${job.data.deliveryId} exhausted retries`);
      await this.prisma.webhookDelivery.update({
        where: { id: job.data.deliveryId },
        data: { status: "FAILED" },
      });
    }
  }
}
