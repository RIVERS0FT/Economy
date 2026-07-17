import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkRateLimit,
  clearRateLimitBuckets,
  rateLimitBucketCount,
} from '../src/rateLimit.js';

test('rate limit removes expired user buckets instead of growing forever', () => {
  clearRateLimitBuckets();
  for (let userId = 1; userId <= 200; userId += 1) {
    assert.equal(checkRateLimit(userId, 'general', 1_000), null);
  }
  assert.equal(rateLimitBucketCount(), 200);

  assert.equal(checkRateLimit(999, 'general', 62_000), null);
  assert.equal(rateLimitBucketCount(), 1);
});

test('rate limit still enforces the configured window after sweeping', () => {
  clearRateLimitBuckets();
  for (let request = 0; request < 30; request += 1) {
    assert.equal(checkRateLimit(7, 'orders', 10_000), null);
  }
  assert.equal(checkRateLimit(7, 'orders', 10_000), 60);
  assert.equal(checkRateLimit(7, 'orders', 70_000), null);
});
