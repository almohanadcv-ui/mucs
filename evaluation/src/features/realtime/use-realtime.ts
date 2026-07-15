"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface RealtimeEvent {
  type: "notification" | "data-changed";
  entity?: "evaluation" | "employee";
}

/** Reconnect backoff after a failed stream, in ms. */
const RETRY_MIN_MS = 2_000;
const RETRY_MAX_MS = 30_000;

/**
 * Keeps a server-sent-events stream open and refetches affected queries the
 * moment the server says something changed.
 *
 * The browser's own EventSource reconnect is not enough here: it retries
 * network drops, but a non-200 response (which is what an expired access token
 * produces) closes it for good. So failures are handled manually — refresh the
 * session, then reconnect with backoff.
 */
export function useRealtime(enabled: boolean) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryDelay = RETRY_MIN_MS;
    let stopped = false;

    const handle = (event: RealtimeEvent) => {
      switch (event.type) {
        case "notification":
          qc.invalidateQueries({ queryKey: ["notifications"] });
          break;
        case "data-changed":
          // Dashboard counters aggregate both, so it refreshes either way.
          qc.invalidateQueries({ queryKey: ["dashboard"] });
          if (event.entity === "evaluation") {
            qc.invalidateQueries({ queryKey: ["evaluations"] });
            qc.invalidateQueries({ queryKey: ["evaluation"] });
          } else if (event.entity === "employee") {
            qc.invalidateQueries({ queryKey: ["employees"] });
          }
          break;
      }
    };

    const scheduleReconnect = async () => {
      if (stopped) return;
      // An expired access token is the likeliest reason the stream died; renew
      // it before reconnecting, or every retry just 401s again.
      await fetch("/api/auth/refresh", { method: "POST" }).catch(() => {});
      if (stopped) return;
      retryTimer = setTimeout(connect, retryDelay);
      retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS);
    };

    const connect = () => {
      if (stopped) return;
      source = new EventSource("/api/events");

      source.addEventListener("ready", () => {
        // Stream is live — reset backoff so a later blip retries quickly.
        retryDelay = RETRY_MIN_MS;
      });

      source.onmessage = (e) => {
        try {
          handle(JSON.parse(e.data) as RealtimeEvent);
        } catch {
          // Ignore a frame we can't parse rather than kill the stream.
        }
      };

      source.onerror = () => {
        source?.close();
        source = null;
        void scheduleReconnect();
      };
    };

    // A backgrounded tab gets throttled and the stream usually dies; reconnect
    // as soon as the user comes back so they aren't looking at stale numbers.
    const onVisible = () => {
      if (document.visibilityState === "visible" && !source) {
        retryDelay = RETRY_MIN_MS;
        connect();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    connect();

    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisible);
      if (retryTimer) clearTimeout(retryTimer);
      source?.close();
    };
  }, [enabled, qc]);
}
