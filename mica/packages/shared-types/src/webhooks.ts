import { z } from "zod";

/** Domain events webhooks can subscribe to. Extend as more modules fire WebhooksService.trigger(). */
export const WEBHOOK_EVENTS = [
  "vehicle.created",
  "maintenance.transitioned",
  "maintenance.assigned",
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const createWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string().min(1)).min(1),
  isActive: z.boolean().default(true),
});
export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;

export const updateWebhookSchema = z.object({
  url: z.string().url().optional(),
  events: z.array(z.string().min(1)).min(1).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateWebhookInput = z.infer<typeof updateWebhookSchema>;
