/**
 * Rate limiting with a fixed-window counter.
 * The default store is in-memory (per-instance). The RateLimitStore interface
 * lets you swap in Redis for multi-instance deployments without changing callers.
 */
export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: number; // epoch ms
}

interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<{ count: number; resetAt: number }>;
}

class MemoryStore implements RateLimitStore {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();

  async increment(key: string, windowMs: number) {
    const now = Date.now();
    const existing = this.buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      const fresh = { count: 1, resetAt: now + windowMs };
      this.buckets.set(key, fresh);
      this.sweep(now);
      return fresh;
    }
    existing.count += 1;
    return existing;
  }

  private sweep(now: number) {
    if (this.buckets.size < 10_000) return; // cheap guard against unbounded growth
    for (const [k, v] of this.buckets) {
      if (v.resetAt <= now) this.buckets.delete(k);
    }
  }
}

const store: RateLimitStore = new MemoryStore();

export async function rateLimit(
  key: string,
  options: { limit: number; windowMs: number },
): Promise<RateLimitResult> {
  const { count, resetAt } = await store.increment(key, options.windowMs);
  return {
    success: count <= options.limit,
    limit: options.limit,
    remaining: Math.max(0, options.limit - count),
    resetAt,
  };
}
