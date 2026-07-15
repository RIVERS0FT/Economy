import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const failures = [];

function requireText(path, fragments) {
  const content = read(path);
  for (const fragment of fragments) {
    if (!content.includes(fragment)) failures.push(`${path} 缺少认证缓存规则: ${fragment}`);
  }
}

requireText('README.md', [
  '状态读取 10 秒、普通写操作最多 2 秒、管理员不使用缓存',
  'LRU 上限 5,000 条',
  'Cookie 的 SHA-256 摘要',
]);

requireText('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', [
  '`GET /api/game/state` 最多复用 10 秒',
  '普通写操作最多复用 2 秒',
  '`/api/game/admin/` 每次重新验证且不读取缓存',
  '401 只缓存 1 秒',
  '超时、无效响应、502 和 503 不缓存',
  '最多 5,000 条的 LRU',
  '共享一个上游验证 Promise',
  'ACCOUNT_AUTH_CACHE_MAX_ENTRIES=5000',
]);

requireText('server/src/auth.js', [
  "createHash('sha256').update(cookie).digest('base64url')",
  'ACCOUNT_AUTH_STATE_CACHE_TTL_MS, 10_000, 0, 10_000',
  'ACCOUNT_AUTH_WRITE_CACHE_TTL_MS, 2_000, 0, 2_000',
  'ACCOUNT_AUTH_NEGATIVE_CACHE_TTL_MS, 1_000, 0, 1_000',
  'ACCOUNT_AUTH_CACHE_MAX_ENTRIES, 5_000, 100, 5_000',
  "startsWith('/api/game/admin/')",
  'authenticationCache.coalesce(cacheKey',
]);

requireText('server/src/auth-cache.js', [
  'while (this.entries.size > this.maxEntries)',
  'const existing = this.inFlight.get(key)',
  'if (this.inFlight.size >= this.maxEntries) return factory()',
  'this.inFlight.delete(key)',
]);

requireText('server/src/index.js', [
  'authenticationCacheMaxAgeForRequest(method, path)',
]);

requireText('scripts/install-economy-api.py', [
  'Environment=ACCOUNT_AUTH_STATE_CACHE_TTL_MS=10000',
  'Environment=ACCOUNT_AUTH_WRITE_CACHE_TTL_MS=2000',
  'Environment=ACCOUNT_AUTH_NEGATIVE_CACHE_TTL_MS=1000',
  'Environment=ACCOUNT_AUTH_CACHE_MAX_ENTRIES=5000',
]);

requireText('server/test/auth-cache.test.js', [
  'enforces TTL, LRU order, and request coalescing',
  'never caches upstream failures',
  "'/api/game/admin/summary'",
]);

if (failures.length) {
  console.error(`认证缓存验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('认证缓存验证通过：状态 10 秒、写操作 2 秒、管理员零缓存、请求合并和 5000 条 LRU 已锁定。');
