const WINDOW_MS = 60_000;
const SWEEP_INTERVAL_MS = 60_000;
const MAX_BUCKETS = 10_000;
const buckets = new Map();
let nextSweepAt = 0;

function sweepExpiredBuckets(now) {
  if (now < nextSweepAt && buckets.size <= MAX_BUCKETS) return;

  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }

  if (buckets.size > MAX_BUCKETS) {
    const overflow = buckets.size - MAX_BUCKETS;
    const oldest = [...buckets.entries()]
      .sort((left, right) => left[1].resetAt - right[1].resetAt)
      .slice(0, overflow);
    for (const [key] of oldest) buckets.delete(key);
  }

  nextSweepAt = now + SWEEP_INTERVAL_MS;
}

export function checkRateLimit(userId, category = 'general', now = Date.now()) {
  sweepExpiredBuckets(now);
  const limit = category === 'orders' ? 30 : 90;
  const key = `${userId}:${category}`;
  const current = buckets.get(key);
  if (!current || now >= current.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return null;
  }
  current.count += 1;
  if (current.count <= limit) return null;
  return Math.max(1, Math.ceil((current.resetAt - now) / 1_000));
}

export function clearRateLimitBuckets() {
  buckets.clear();
  nextSweepAt = 0;
}

export function rateLimitBucketCount() {
  return buckets.size;
}
