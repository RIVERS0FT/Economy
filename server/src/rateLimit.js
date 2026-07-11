const WINDOW_MS = 60_000;
const buckets = new Map();

export function checkRateLimit(userId, category = 'general') {
  const now = Date.now();
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
