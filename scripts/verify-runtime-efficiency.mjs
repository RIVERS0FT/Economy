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
]);
requireText('server/test/request-metrics.test.js', [
  'request metrics normalize route identifiers',
  'request metrics aggregate duration and application response bytes',
]);
requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', [
  '前台活跃时继续使用玩家选择的 3／5／10 秒间隔',
  '连续 30 秒无交互后使用 15 秒间隔',
  '页面隐藏时使用 60 秒间隔',
  '重新可见或网络恢复时立即请求一次权威状态',
]);
requireText('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', [
  '每 60 秒输出一次按方法与归一化路由聚合的请求指标',
  '平均／最大处理时长和应用层 JSON 响应字节数',
  '超过 1 秒、超过 200 KB 或返回 5xx',
  '`DatabaseSync` 的 5 秒超时是 SQLite 锁等待上限',
]);

if (failures.length) {
  console.error(`运行时效率验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('运行时效率验证通过：自适应轮询、可见性恢复、SQLite 锁等待和接口指标聚合均已锁定。');
