import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  effectivePollingRate,
  normalizeConfiguredPollingRate,
  POLLING_IDLE_AFTER_MS,
} from '../src/app/adaptivePolling.js';

const read = (path) => readFileSync(path, 'utf8');
const failures = [];

function requireText(path, fragments) {
  const content = read(path);
  for (const fragment of fragments) {
    if (!content.includes(fragment)) failures.push(`${path} 缺少运行时效率规则: ${fragment}`);
  }
}

assert.equal(normalizeConfiguredPollingRate('3'), '3');
assert.equal(normalizeConfiguredPollingRate('invalid'), '5');
assert.equal(effectivePollingRate({ configuredRate: '10' }), '10');
assert.equal(effectivePollingRate({ configuredRate: '3', idle: true }), '15');
assert.equal(effectivePollingRate({ configuredRate: '3', hidden: true, idle: true }), '60');
assert.equal(POLLING_IDLE_AFTER_MS, 30_000);

requireText('src/app/GameApp.tsx', [
  "import { useAdaptivePolling } from './useAdaptivePolling'",
  'const pollingPreference = useAdaptivePolling(model);',
  'refreshRate: pollingPreference.refreshRate',
  'setRefreshRate: pollingPreference.setRefreshRate',
]);
requireText('src/app/useAdaptivePolling.ts', [
  "document.addEventListener('pointerdown'",
  "document.addEventListener('keydown'",
  "document.addEventListener('focusin'",
  "document.addEventListener('visibilitychange'",
  "window.addEventListener('online'",
  'void refresh();',
  'POLLING_IDLE_AFTER_MS',
]);
requireText('server/src/storage.js', [
  'new DatabaseSync(databasePath, { timeout: 5_000 })',
  'PRAGMA journal_mode = WAL;',
  'PRAGMA synchronous = NORMAL;',
  'PRAGMA foreign_keys = ON;',
]);
requireText('server/src/index.js', [
  "import './request-metrics-bootstrap.js';",
  "import './app.js';",
]);
requireText('server/src/request-metrics.js', [
  'createRequestMetricsCollector',
  'averageDurationMs',
  'averageResponseBytes',
  'Economy request outlier',
  'Economy request metrics',
  "response.getHeader('Content-Length')",
  'DEFAULT_MAX_ROUTE_KEYS = 256',
  "OVERFLOW_ROUTE = '/api/other'",
  'overflowedRequestCount',
]);
requireText('server/src/runtime-store.js', [
  'contractProjectionForState',
  'cached.revision === snapshot.revision',
  'saveWorld(revision, world, now)',
  'PersistentEconomyStore.prototype.saveWorldIfChanged.call(this, revision, world, now)',
]);
requireText('server/test/request-metrics.test.js', [
  'request metrics normalize route identifiers',
  'request metrics aggregate duration and application response bytes',
  'request metrics cap route cardinality and aggregate overflow',
]);
requireText('server/test/state-polling.test.js', [
  'runtime failed actions keep the world row unchanged',
  'runtime state delivery reuses the current revision cache',
]);
requireText('docs/README.md', [
  '状态刷新设置继续只保存和显示 `3s`／`5s`／`10s`',
  '连续 30 秒无交互后临时使用 15 秒',
  '页面隐藏时临时使用 60 秒',
  '重新可见、网络恢复或从限速状态恢复交互时立即请求一次权威状态',
  '每 60 秒输出一次按方法与归一化路由聚合的请求指标',
  '平均／最大处理时长和应用层 JSON 响应字节数',
  '超过 1 秒、超过 200 KB 或返回 5xx',
  '单个窗口最多保留 256 个方法／路由键',
  '`OTHER /api/other`',
  '合同分区必须复用当前修订缓存',
  '失败或无变化动作仍保存幂等确认但不得触发全服补拉',
  '`DatabaseSync` 的 5 秒超时是 SQLite 锁等待上限',
  '不得记录 Cookie、请求体、玩家资产或其他敏感内容',
]);

if (failures.length) {
  console.error(`运行时效率验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('运行时效率验证通过：自适应轮询、无变化动作不写世界、合同状态投影复用和有界请求指标均已锁定。');
