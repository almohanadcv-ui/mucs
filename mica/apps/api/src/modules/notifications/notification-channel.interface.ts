export interface NotificationPayload {
  recipientId: string;
  type: string;
  title: string;
  body: string;
  payload?: Record<string, unknown>;
  /**
   * Natural key of the business event this announces, e.g.
   * `MICA_INVOICE_ACCEPTED:{invoiceId}:{decidedAt}`. When given, a second
   * attempt to announce the same event is dropped instead of producing a
   * duplicate email — which is what a retried request or a re-queued job
   * would otherwise do. The recipient id is appended by the adapter, so one
   * event fanned out to several managers still reaches all of them.
   */
  idempotencyKey?: string;
  /** Groups the notifications produced by one business action. */
  correlationId?: string;
}

/** Every channel adapter (in-app, email, SMS, WhatsApp, push) implements this. */
export interface NotificationChannel {
  send(notification: NotificationPayload): Promise<void>;
}
