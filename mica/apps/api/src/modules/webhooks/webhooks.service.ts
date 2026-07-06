import { randomBytes } from "node:crypto";
import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import type { CreateWebhookInput, UpdateWebhookInput } from "@mica-mab/shared-types";
import { PrismaService } from "@/database/prisma/prisma.service";
import { WEBHOOK_DELIVERY_QUEUE } from "@/queues/bullmq.module";
import type { WebhookDeliveryJobData } from "./webhook-delivery.processor";

const LIST_SELECT = {
  id: true,
  url: true,
  events: true,
  isActive: true,
  lastTriggeredAt: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class WebhooksService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(WEBHOOK_DELIVERY_QUEUE) private readonly queue: Queue<WebhookDeliveryJobData>,
  ) {}

  list() {
    return this.prisma.webhook.findMany({ select: LIST_SELECT, orderBy: { createdAt: "desc" } });
  }

  /** Returns the signing secret exactly once — it is never returned by list/get again. */
  async create(dto: CreateWebhookInput, createdById: string) {
    const secret = randomBytes(32).toString("hex");
    const webhook = await this.prisma.webhook.create({
      data: { url: dto.url, events: dto.events, isActive: dto.isActive, secret, createdById },
      select: LIST_SELECT,
    });
    return { ...webhook, secret };
  }

  async update(id: string, dto: UpdateWebhookInput) {
    await this.findOrThrow(id);
    return this.prisma.webhook.update({ where: { id }, data: dto, select: LIST_SELECT });
  }

  async remove(id: string): Promise<void> {
    await this.findOrThrow(id);
    await this.prisma.webhook.delete({ where: { id } });
  }

  listDeliveries(webhookId: string) {
    return this.prisma.webhookDelivery.findMany({
      where: { webhookId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  /** Manually fires a one-off "webhook.test" delivery to a single webhook, bypassing its event subscriptions. */
  async test(id: string): Promise<void> {
    const webhook = await this.findOrThrow(id);
    await this.enqueueDelivery(webhook.id, "webhook.test", { message: "This is a test delivery from MICA MAB Fleet." });
  }

  /** Fans out a domain event to every active webhook subscribed to it. */
  async trigger(event: string, payload: Record<string, unknown>): Promise<void> {
    const webhooks = await this.prisma.webhook.findMany({
      where: { isActive: true, events: { has: event } },
    });
    await Promise.all(webhooks.map((webhook) => this.enqueueDelivery(webhook.id, event, payload)));
  }

  private async enqueueDelivery(
    webhookId: string,
    event: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const delivery = await this.prisma.webhookDelivery.create({
      data: { webhookId, event, payload: payload as never, status: "PENDING" },
    });
    await this.queue.add("deliver", { deliveryId: delivery.id, webhookId, event, payload });
  }

  private async findOrThrow(id: string) {
    const webhook = await this.prisma.webhook.findUnique({ where: { id } });
    if (!webhook) throw new NotFoundException("Webhook not found");
    return webhook;
  }
}
