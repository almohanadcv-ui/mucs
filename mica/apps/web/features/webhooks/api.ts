import type { CreateWebhookInput, UpdateWebhookInput } from "@mica-mab/shared-types";
import { apiClient } from "@/lib/api-client";

export interface WebhookItem {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  lastTriggeredAt: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatedWebhook extends WebhookItem {
  secret: string;
}

export interface WebhookDeliveryItem {
  id: string;
  webhookId: string;
  event: string;
  payload: unknown;
  responseStatus: number | null;
  attempt: number;
  deliveredAt: string | null;
  status: "PENDING" | "SUCCESS" | "FAILED";
  createdAt: string;
}

export async function listWebhooks() {
  const { data } = await apiClient.get<WebhookItem[]>("/webhooks");
  return data;
}

export async function createWebhook(input: CreateWebhookInput) {
  const { data } = await apiClient.post<CreatedWebhook>("/webhooks", input);
  return data;
}

export async function updateWebhook(id: string, input: UpdateWebhookInput) {
  const { data } = await apiClient.patch<WebhookItem>(`/webhooks/${id}`, input);
  return data;
}

export async function deleteWebhook(id: string) {
  await apiClient.delete(`/webhooks/${id}`);
}

export async function testWebhook(id: string) {
  await apiClient.post(`/webhooks/${id}/test`);
}

export async function listWebhookDeliveries(id: string) {
  const { data } = await apiClient.get<WebhookDeliveryItem[]>(`/webhooks/${id}/deliveries`);
  return data;
}
