/**
 * Parse a short duration string ("15m", "7d", "3600s", "24h") into seconds.
 * Used to keep JWT TTL config and cookie max-age in sync.
 */
const UNIT_SECONDS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 3600,
  d: 86400,
};

export function durationToSeconds(input: string): number {
  const match = /^(\d+)\s*([smhd])$/.exec(input.trim());
  if (!match) {
    throw new Error(`Invalid duration: "${input}" (expected e.g. 15m, 7d)`);
  }
  const [, value, unit] = match;
  return Number(value) * UNIT_SECONDS[unit];
}
