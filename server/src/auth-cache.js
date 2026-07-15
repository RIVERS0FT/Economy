export class AuthenticationCache {
  constructor({ maxEntries = 5_000, now = Date.now } = {}) {
    this.maxEntries = Math.max(1, Number(maxEntries) || 5_000);
    this.now = now;
    this.entries = new Map();
    this.inFlight = new Map();
  }

  get size() {
    return this.entries.size;
  }

  get pendingSize() {
    return this.inFlight.size;
  }

  get(key, maxAgeMs) {
    const allowedAge = Math.max(0, Number(maxAgeMs) || 0);
    if (allowedAge === 0) return { hit: false };
    const entry = this.entries.get(key);
    if (!entry) return { hit: false };
    const effectiveAge = Math.min(allowedAge, entry.ttlMs);
    if (effectiveAge <= 0 || this.now() - entry.verifiedAt >= effectiveAge) {
      return { hit: false };
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return {
      hit: true,
      user: entry.user ? { ...entry.user } : null,
    };
  }

  set(key, user, ttlMs) {
    const normalizedTtl = Math.max(0, Number(ttlMs) || 0);
    if (normalizedTtl === 0) return;
    const entry = {
      user: user ? Object.freeze({ ...user }) : null,
      verifiedAt: this.now(),
      ttlMs: normalizedTtl,
    };
    this.entries.delete(key);
    this.entries.set(key, entry);
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      this.entries.delete(oldest);
    }
  }

  async coalesce(key, factory) {
    const existing = this.inFlight.get(key);
    if (existing) return existing;
    if (this.inFlight.size >= this.maxEntries) return factory();
    const pending = Promise.resolve().then(factory);
    this.inFlight.set(key, pending);
    try {
      return await pending;
    } finally {
      if (this.inFlight.get(key) === pending) this.inFlight.delete(key);
    }
  }

  clear() {
    this.entries.clear();
    this.inFlight.clear();
  }
}
