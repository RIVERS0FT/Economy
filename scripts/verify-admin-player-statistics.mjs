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
  'first_research_at',
  'first_bank_deposit_at',
  'gameplay_strategy_funnel_coverage_started_at',
  'completion_source',
  'wealthAssetsFor',
  'lastEconomicActivityAt',
  'configurePlayerAdminStatistics',
  'coverage_started_at',
  'world?.assetAuctions',
  'buildFrozenFacilityQuantityIndex',
  'scopedPlayerIds',
  'committedWorldForPlayerStatistics',
  "measureRequestPhase('playerStatisticsProjectionMs'",
  'store.saveWorld = (revision, world, savedAt, mutationScope)',
  'store.saveWorldIfChanged = (revision, world, savedAt, previousStateJson, mutationScope)',
  'recordWorldDeltas(state, beforeWorld, world, savedAt, mutationScope)',
]);
forbidText('server/src/player-admin-statistics.js', [
  'collectibleAuctions',
  'createCollectibleAuction',
  'placeCollectibleBid',
  'cancelCollectibleAuction',
  'function frozenFacilityQuantity(world, userId, facilityTypeId)',
  "action === 'work'",
  'work_count',
  'counts.work',
]);
const playerStatisticsSource = read('server/src/player-admin-statistics.js');
const playerStatisticsReadStart = playerStatisticsSource.indexOf('  store.getPlayerStatistics = function getPlayerStatistics');
const playerStatisticsReadEnd = playerStatisticsSource.indexOf('\n\n  return store;', playerStatisticsReadStart);
const playerStatisticsRead = playerStatisticsSource.slice(playerStatisticsReadStart, playerStatisticsReadEnd);
for (const forbidden of ['processWorldIfDue(', 'saveWorldIfChanged(', 'const { revision, stateJson, world } = this.loadWorld']) {
  if (playerStatisticsRead.includes(forbidden)) failures.push(`管理员玩家运营统计只读路径不得包含: ${forbidden}`);
}
const runtimeStoreSource = `${read('server/src/runtime-store-core.js')}\n${read('server/src/runtime-store.js')}`;
for (const fragment of ["import { configurePlayerAdminStatistics } from './player-admin-statistics.js'", 'configurePlayerAdminStatistics(this);']) {
  if (!runtimeStoreSource.includes(fragment)) failures.push(`runtime store 缺少玩家运营统计规则: ${fragment}`);
}
requireText('server/src/app.js', [
  "path === '/api/game/admin/player-statistics'",
  'store.getPlayerStatistics(',
]);
requireText('server/src/world-storage-v2.js', [
  'getPlayerActionMetadata(action)',
  'finalizeInteractiveMutationScope',
]);
requireText('server/src/player-action-registry.js', [
  "setFacilityRecipe: defineAction({ mutationScope: 'factory'",
]);
requireText('src/api/admin.ts', [
  "export type AdminPlayerStatisticsRange = '7d' | '30d' | '90d'",
  'export interface AdminPlayerStatistics',
  'playerStatistics: async (range: AdminPlayerStatisticsRange)',
]);
requireText('src/app/AdminApp.tsx', [
  "import { AdminPlayerSection } from '../components/AdminPlayerSection'",
  "visitedSections.has('players')",
  '<AdminPlayerSection',
]);
forbidText('src/app/AdminApp.tsx', [
  'playerStatisticsRangeRef',
  'admin-population-summary-grid',
  'admin-population-model-grid',
  'admin-population-detail-grid',
  'function populationStateLabel',
]);
requireText('src/components/AdminPlayerStatistics.tsx', [
  "from './charts/AdminCharts'",
  'DonutChart', 'HorizontalPercentChart', 'NumberBarChart', 'PlayerActivityChart',
  '<PlayerActivityChart', '<HorizontalPercentChart', '<DonutChart', '<NumberBarChart',
  '24 小时经济活跃',
  '新增与经济活跃趋势',
  '经营成长漏斗',
  '教程完成时效',
  'funnel.completion24h',
  'funnel.completion7d',
  '财富分布',
  '需要关注的玩家群体',
  '只统计成功经济写操作',
]);
requireText('src/components/AdminPlayerSection.tsx', [
  "const RANGES: AdminPlayerStatisticsRange[] = ['7d', '30d', '90d']",
  '玩家运营分析',
  'adminApi.playerStatistics(nextRange)',
]);
requireText('src/components/AdminOverview.tsx', [
  'AdminCommunityLinkPanel',
  'admin-summary-grid',
]);
forbidText('src/components/AdminOverview.tsx', [
  'AdminPlayerStatistics',
  'AdminPopulationControl',
  '玩家运营分析',
  '人口经济',
]);
requireText('src/components/charts/AdminCharts.tsx', [
  "type: 'bar'", "type: 'pie'", "point.activePlayers === null ? '精确记录未覆盖'",
  '覆盖不足', 'accessibleSummary',
]);
forbidText('src/components/AdminPlayerStatistics.tsx', ['function RatioBar', 'admin-player-statistics__trend-bars']);
requireText('src/styles/admin-player-statistics.css', [
  'ADMIN_PLAYER_STATISTICS_SCHEME: operations-diagnostics',
  '.admin-player-statistics__wealth-charts',
  '@media (max-width: 720px)',
]);
forbidText('src/styles/admin-player-statistics.css', ['.admin-player-statistics__trend-bars', '.admin-player-statistics__bar']);
requireText('server/test/player-admin-statistics.test.js', [
  'successful economic actions once',
  'assert.equal(activity.successful_action_count, 1)',
  "assert.equal(activityColumns.includes('work_count'), false)",
  'assert.equal(loadWorldCalls, 0)',
  'assert.equal(processWorldCalls, 0)',
  'assert.equal(saveWorldCalls, 0)',
  'persistence wrappers preserve local mutation scopes',
  "assert.equal(capturedScope.label, 'local:bankDeposit')",
  'assert.equal(second.revision, statistics.revision)',
]);
requireText('server/test/runtime-hotpath-architecture.test.js', [
  'facility recipe changes use the bounded factory copy-on-write scope',
  "assert.equal(scope.label, 'facility:auto-operation-rebuild')",
]);
requireText('tests/browser/admin-runtime.spec.ts', [
  'coverageStartsAt:',
  'completion24h:',
  'completion7d:',
  "id: 'first-research'",
  "id: 'first-bank-deposit'",
  "id: 'growth-line-complete'",
]);
requireText('docs/GIFT_CODE_AND_ADMIN_DESIGN.md', [
  '玩家运营统计固定归属“玩家”分区',
  '成功经济写操作',
  '新的日活动表不再创建或写入 `work_count`',
  '精确日活动覆盖起点',
  '完整经营漏斗覆盖起点',
  '不得把统计结果用于扩张人口需求预算',
  'ECharts',
  '7／30／90 日',
]);
requireText('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', [
  '`player-admin-statistics.js`',
  '`economy_player_activity_daily`',
  '`GET /api/game/admin/player-statistics?range=7d|30d|90d`',
  '`lastPlayerScaleBudget` 与 `lastInventoryBoost`',
]);
requireText('package.json', ['verify:admin-player-statistics']);

requireText('server/src/player-admin-statistics.js', [
  "if (kind === 'commodity') return safeNonNegativeMoney(market?.officialPrice);",
  'const inTransitQuantity = safeNonNegativeInteger(inventory?.inTransit);',
]);
requireText('src/components/AdminPlayerStatistics.tsx', ['商品按当日官方价、工厂按最近产权成交价估值']);
forbidText('src/components/AdminPlayerStatistics.tsx', ['商品与工厂只按最近一次订单簿真实成交价估值']);

if (failures.length) {
  console.error(`管理员玩家运营统计验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('管理员玩家运营统计验证通过：运营统计保持 committed world 只读，写入透传 Mutation Scope，冻结工厂索引只扫描一次，并保留 ECharts、精确覆盖和隐私边界。');
