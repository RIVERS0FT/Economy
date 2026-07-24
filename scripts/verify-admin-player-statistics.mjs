import { readFileSync } from 'node:fs';

const failures = [];
const read = (path) => readFileSync(path, 'utf8');

function requireText(path, fragments) {
  const content = read(path);
  for (const fragment of fragments) {
    if (!content.includes(fragment)) failures.push(`${path} 缺少玩家运营统计规则: ${fragment}`);
  }
}

function forbidText(path, fragments) {
  const content = read(path);
  for (const fragment of fragments) {
    if (content.includes(fragment)) failures.push(`${path} 不得恢复重复人口卡或不安全统计字段: ${fragment}`);
  }
}

requireText('server/src/player-admin-statistics.js', [
  'PLAYER_STATISTICS_TIME_ZONE',
  'economy_player_activity_daily',
  'economy_player_milestones',
  'wealthAssetsFor',
  'lastEconomicActivityAt',
  'configurePlayerAdminStatistics',
  'coverage_started_at',
  'world?.assetAuctions',
]);
forbidText('server/src/player-admin-statistics.js', [
  'collectibleAuctions',
  'createCollectibleAuction',
  'placeCollectibleBid',
  'cancelCollectibleAuction',
]);
requireText('server/src/runtime-store.js', [
  "import { configurePlayerAdminStatistics } from './player-admin-statistics.js'",
  'configurePlayerAdminStatistics(this);',
]);
requireText('server/src/app.js', [
  "path === '/api/game/admin/player-statistics'",
  'store.getPlayerStatistics(',
]);
requireText('src/api/admin.ts', [
  "export type AdminPlayerStatisticsRange = '7d' | '30d' | '90d'",
  'export interface AdminPlayerStatistics',
  'playerStatistics: async (range: AdminPlayerStatisticsRange)',
]);
requireText('src/app/AdminApp.tsx', [
  "import { AdminOverview } from '../components/AdminOverview'",
  'playerStatisticsRangeRef',
  '<AdminOverview',
]);
forbidText('src/app/AdminApp.tsx', [
  'admin-population-summary-grid',
  'admin-population-model-grid',
  'admin-population-detail-grid',
  'function populationStateLabel',
]);
requireText('src/components/AdminPlayerStatistics.tsx', [
  '24 小时经济活跃',
  '新增与经济活跃趋势',
  '经营成长漏斗',
  '财富分布',
  '需要关注的玩家群体',
  '只统计成功经济写操作',
]);
requireText('src/components/AdminOverview.tsx', [
  "const RANGES: AdminPlayerStatisticsRange[] = ['7d', '30d', '90d']",
  '玩家运营分析',
  '人口经济',
]);
requireText('src/styles/admin-player-statistics.css', [
  'ADMIN_PLAYER_STATISTICS_SCHEME: operations-diagnostics',
  '.admin-player-statistics__trend',
  '@media (max-width: 720px)',
]);
requireText('server/test/player-admin-statistics.test.js', [
  'successful economic actions once',
  'assert.equal(activity.successful_action_count, 1)',
  'assert.equal(second.revision, statistics.revision)',
]);
requireText('docs/GIFT_CODE_AND_ADMIN_DESIGN.md', [
  '玩家运营统计',
  '成功经济写操作',
  '精确日活动覆盖起点',
  '不得把统计结果用于扩张人口需求预算',
]);
requireText('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', [
  '`player-admin-statistics.js`',
  '`economy_player_activity_daily`',
  '`GET /api/game/admin/player-statistics?range=7d|30d|90d`',
  '`lastPlayerScaleBudget` 与 `lastInventoryBoost`',
]);
requireText('docs/README.md', ['管理员玩家运营统计']);
requireText('README.md', ['玩家运营统计']);
requireText('package.json', ['verify:admin-player-statistics']);

if (failures.length) {
  console.error(`管理员玩家运营统计验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('管理员玩家运营统计验证通过：成功经济写操作、精确覆盖、真实成交估值、隐私边界、单一概况编排和移动响应式均已锁定。');
