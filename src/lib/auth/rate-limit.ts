/**
 * Minimal in-memory fixed-window rate limiter. No external dependency. Suitable
 * for a single-instance local deployment (state is per-process, so it does not
 * coordinate across serverless instances — acceptable for this project's scope and
 * far better than nothing for slowing invite-code guessing).
 *
 * Never log the attempted value. Server-only.
 */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

/**
 * Returns whether an action keyed by `key` is allowed under `limit` attempts per
 * `windowMs`. Counts the current attempt when allowed.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (bucket.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  bucket.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Best-effort periodic cleanup so the map can't grow unbounded. */
export function sweepRateLimits(): void {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}
