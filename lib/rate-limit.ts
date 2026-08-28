/**
 * rate-limit.ts — server-only, dependency-free rate limiting.
 *
 * Two primitives:
 *  - TokenBucketLimiter: per-key (per-IP) burst-friendly limiter.
 *  - GlobalWindowLimiter: fixed window across ALL keys — protects the
 *    shared upstream quota (e.g. the Pexels key's 200 req/h) even when
 *    many different IPs each stay under their own per-IP limit.
 *
 * Vercel caveat: serverless instances keep separate maps, so these are
 * per-instance limits. That is enough to stop single-client abuse
 * scripts and quota drains; a shared store (Upstash Redis) is the
 * upgrade path if strictly-global limits are ever required.
 */

interface Bucket {
  tokens: number;
  updatedAt: number;
}

export class TokenBucketLimiter {
  private buckets = new Map<string, Bucket>();
  private lastPrune = Date.now();

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number,
    private readonly idleTtlMs = 10 * 60 * 1000,
  ) {}

  consume(key: string): { allowed: boolean; retryAfterSec: number } {
    const t = Date.now();
    if (t - this.lastPrune > 60_000) {
      this.prune(t);
      this.lastPrune = t;
    }

    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { tokens: this.capacity, updatedAt: t };
      this.buckets.set(key, bucket);
    }

    const refill = ((t - bucket.updatedAt) / 1000) * this.refillPerSecond;
    bucket.tokens = Math.min(this.capacity, bucket.tokens + refill);
    bucket.updatedAt = t;

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return { allowed: true, retryAfterSec: 0 };
    }
    return {
      allowed: false,
      retryAfterSec: Math.ceil((1 - bucket.tokens) / this.refillPerSecond),
    };
  }

  private prune(t: number): void {
    for (const [key, bucket] of this.buckets) {
      if (t - bucket.updatedAt > this.idleTtlMs) this.buckets.delete(key);
    }
  }
}

export class GlobalWindowLimiter {
  private count = 0;
  private windowStart = Date.now();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  consume(): boolean {
    const t = Date.now();
    if (t - this.windowStart >= this.windowMs) {
      this.windowStart = t;
      this.count = 0;
    }
    if (this.count >= this.limit) return false;
    this.count++;
    return true;
  }
}

/** Best-effort client IP behind Vercel/proxies. */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
