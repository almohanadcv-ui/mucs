const UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

/** Minimal duration-string parser (e.g. "15m", "1d", "30d") — intentionally
 * supports only the formats this codebase actually uses, not a general parser. */
export default function ms(value: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(value.trim());
  if (!match || !match[1] || !match[2]) {
    throw new Error(`Unsupported duration format: "${value}"`);
  }
  return Number(match[1]) * UNIT_MS[match[2] as keyof typeof UNIT_MS]!;
}
