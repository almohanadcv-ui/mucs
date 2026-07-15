import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/infrastructure/auth/session";
import { subscribe, type RealtimeEvent } from "@/infrastructure/realtime/bus";

export const runtime = "nodejs";
// A stream must never be cached or statically analysed.
export const dynamic = "force-dynamic";

/** Idle gap after which we send a comment frame to keep the connection open. */
const HEARTBEAT_MS = 25_000;

/**
 * Server-sent events stream: one long-lived connection per browser tab, over
 * which the server pushes "something changed" so the client can refetch
 * immediately instead of waiting for a poll.
 *
 * Not wrapped in withAuth — that helper returns a JSON response, and this is a
 * stream that must own its own lifecycle.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) {
    return new Response("unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let open = true;
      const send = (chunk: string) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // Client vanished between the abort signal and this write.
          open = false;
        }
      };

      // Tell the browser to wait 3s before reconnecting, and prove the stream
      // is live so the client can flip its indicator to "connected".
      send("retry: 3000\n\n");
      send(`event: ready\ndata: {}\n\n`);

      const unsubscribe = subscribe(user.id, user.tenantId, (event: RealtimeEvent) => {
        send(`data: ${JSON.stringify(event)}\n\n`);
      });

      // Proxies and load balancers drop connections that go quiet; a comment
      // frame costs nothing and resets their idle timers.
      const heartbeat = setInterval(() => send(`: ping\n\n`), HEARTBEAT_MS);

      const close = () => {
        if (!open) return;
        open = false;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed by the runtime.
        }
      };

      req.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // nginx buffers proxied responses by default, which would hold events
      // back until the buffer fills — the exact opposite of the point.
      "X-Accel-Buffering": "no",
    },
  });
}
