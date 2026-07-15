import "server-only";
import { EventEmitter } from "node:events";

/**
 * What a connected client is told happened. Deliberately thin: the event says
 * something changed, the client refetches. Pushing entities through here would
 * mean re-implementing every read query's role scoping in the publish path —
 * one mistake and a user is handed data they may not see.
 */
export type RealtimeEvent =
  | { type: "notification" }
  | { type: "data-changed"; entity: "evaluation" | "employee" };

/**
 * In-process pub/sub backing the SSE stream.
 *
 * IMPORTANT: this only reaches clients connected to *this* Node process, which
 * is correct for PM2 fork mode (one instance). Under `pm2 -i` (cluster mode) a
 * user connected to worker A would not see events published by worker B; that
 * would need a shared broker (Postgres LISTEN/NOTIFY over DIRECT_URL, or Redis).
 *
 * Cached on globalThis so dev HMR doesn't strand subscribers on a dead emitter.
 */
const globalForBus = globalThis as unknown as { realtimeBus?: EventEmitter };

const bus =
  globalForBus.realtimeBus ??
  (() => {
    const e = new EventEmitter();
    // One listener per connected browser tab; the default cap of 10 would warn
    // as soon as a handful of people are logged in.
    e.setMaxListeners(0);
    return e;
  })();

if (process.env.NODE_ENV !== "production") globalForBus.realtimeBus = bus;

const userChannel = (userId: string) => `user:${userId}`;
const tenantChannel = (tenantId: string) => `tenant:${tenantId}`;

/** Notify one user (their notifications, their own records). */
export function publishToUser(userId: string, event: RealtimeEvent): void {
  bus.emit(userChannel(userId), event);
}

/** Notify everyone in a tenant that shared data moved. */
export function publishToTenant(tenantId: string, event: RealtimeEvent): void {
  bus.emit(tenantChannel(tenantId), event);
}

/** Subscribe a connection to its user + tenant channels. Returns an unsubscribe. */
export function subscribe(
  userId: string,
  tenantId: string,
  handler: (event: RealtimeEvent) => void,
): () => void {
  const channels = [userChannel(userId), tenantChannel(tenantId)];
  for (const c of channels) bus.on(c, handler);
  return () => {
    for (const c of channels) bus.off(c, handler);
  };
}
