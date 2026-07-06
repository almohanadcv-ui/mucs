export interface NotificationPayload {
  recipientId: string;
  type: string;
  title: string;
  body: string;
  payload?: Record<string, unknown>;
}

/** Every channel adapter (in-app, email, SMS, WhatsApp, push) implements this. */
export interface NotificationChannel {
  send(notification: NotificationPayload): Promise<void>;
}
