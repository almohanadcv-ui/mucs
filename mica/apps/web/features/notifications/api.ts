import { apiClient } from "@/lib/api-client";

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  payload: Record<string, unknown> | null;
  channel: string;
  status: string;
  readAt: string | null;
  sentAt: string | null;
  createdAt: string;
}

interface NotificationListResult {
  items: NotificationItem[];
  meta: { page: number; pageSize: number; totalItems: number; totalPages: number };
}

export async function listNotifications(page = 1, pageSize = 20) {
  const { data } = await apiClient.get<NotificationListResult>("/notifications", {
    params: { page, pageSize },
  });
  return data;
}

export async function unreadNotificationCount() {
  const { data } = await apiClient.get<{ count: number }>("/notifications/unread-count");
  return data.count;
}

export async function markNotificationRead(id: string) {
  await apiClient.patch(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead() {
  await apiClient.patch("/notifications/read-all");
}
