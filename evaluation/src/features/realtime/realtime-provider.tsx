"use client";

import { useRealtime } from "./use-realtime";

/**
 * Holds the events stream open for the whole authenticated shell. Mounted in
 * the dashboard layout so one connection serves every page — mounting it per
 * page would open and close a stream on each navigation.
 *
 * Renders nothing.
 */
export function RealtimeProvider() {
  useRealtime(true);
  return null;
}
