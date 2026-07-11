import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const failures = [];

function requireFile(path) {
  if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`);
}

function requireText(path, text) {
  if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`);
}

function forbidText(path, text) {
  if (read(path).includes(text)) failures.push(`${path} 不应包含: ${text}`);
}

function requireOrderedText(path, earlier, later) {
  const content = read(path);
  const first = content.indexOf(earlier);
  const second = content.indexOf(later);
  if (first < 0 || second < 0 || first >= second) {
    failures.push(`${path} 必须先包含 ${earlier}，再包含 ${later}`);
  }
}

[
  'server/src/warehouse.js',
  'server/test/warehouse.test.js',
  'src/components/warehouse/WarehouseUpgradeCard.tsx',
  'src/pages/ProductionPage.tsx',
  'src/pages/AssetsPage.tsx',
  'src/pages/SettingsPage.tsx',
  'src/utils/localActivityStore.ts',
  'src/styles/warehouse-expansion.css',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/WAREHOUSE_EXPANSION_DESIGN.md',
  'docs/LOCAL_ACTIVITY_LOG_DESIGN.md',
].forEach(requireFile);

for (const text of [
  'WAREHOUSE_BASE_CAPACITY = 500',
  'WAREHOUSE_CAPACITY_STEP = 250',
  'WAREHOUSE_MAX_LEVEL = 12',
  'WAREHOUSE_BASE_UPGRADE_COST = 150',
  'WAREHOUSE_BASE_UPGRADE_COST * normalized * normalized',
  'export function warehouseCapacityForLevel',
  'export function warehouseUpgradeCostForLevel',
  'export function ensureWarehouse',
  'export function createWarehouseUsage',
  'export function createWarehouseSummary',
  'export function upgradeWarehouse',
  'warehouseStoredQuantity: stored',
  'warehouseReservedQuantity: reserved',
  'warehouseUsedCapacity: used',
  'warehouseAvailableCapacity: Math.max(0, player.inventoryCapacity - used)',
  "order?.side !== 'buy'",
  "order?.status === 'open' || order?.status === 'partial'",
  'player.stats.systemSinks',
  'player.credits -= cost',
  'player.warehouseLevel += 1',
]) requireText('server/src/warehouse.js', text);

for (const text of [
  'createWarehouseSummary',
  'ensureWarehouse',
  'upgradeWarehouse',
  "action === 'upgradeWarehouse'",
  '...createWarehouseSummary(world, player)',
  'version: 7',
  "this.database.exec('BEGIN IMMEDIATE')",
  'stripPlayerLogs',
]) requireText('server/src/storage.js', text);

for (const text of [
  "path === '/api/game/warehouse/upgrade'",
  "action: 'upgradeWarehouse'",
  'requireIdempotencyKey(request)',
]) requireText('server/src/index.js', text);

requireText('src/api/game.ts', "upgradeWarehouse: () => postAction('/warehouse/upgrade')");

for (const text of [
  'version: 7;',
  'warehouseLevel: number;',
  'warehouseMaxLevel: number;',
  'warehouseUpgradeCost: number | null;',
  'warehouseNextCapacity: number;',
  'inventoryCapacity: number;',
  'warehouseStoredQuantity: number;',
  'warehouseReservedQuantity: number;',
  'warehouseUsedCapacity: number;',
  'warehouseAvailableCapacity: number;',
  "| 'warehouse'",
  'export interface AssetWarehouseChange',
  'warehouseChange?: AssetWarehouseChange;',
  "'warehouse' | 'facility'",
]) requireText('src/types.ts', text);
forbidText('src/types.ts', 'version: 8;');

for (const text of [
  'upgradeWarehouse: () => Promise<ActionResult>;',
  "upgradeWarehouse: () => runAction('refresh', gameActions.upgradeWarehouse)",
  'localAssetEvents',
  'syncLocalActivity',
]) requireText('src/app/gameViewModel.ts', text);

for (const text of [
  "| 'upgradeWarehouse'",
  "upgradeWarehouse: 'warehouse'",
  'warehouseLevel?: number;',
  'warehouseLevel: state.warehouseLevel',
  'function diffWarehouse',
  'if (!Number.isFinite(beforeLevel) || !Number.isFinite(afterLevel)) return undefined;',
  'const warehouseChange = diffWarehouse(before, after);',
  'warehouseChange,',
  "if (warehouseChange) return 'warehouse';",
  "if (action === 'upgradeWarehouse') return '共享仓库已扩容';",
]) requireText('src/utils/localActivityStore.ts', text);

for (const text of [
  'export function WarehouseUpgradeCard',
  'game.warehouseLevel',
  'game.warehouseMaxLevel',
  'game.warehouseUpgradeCost',
  'game.warehouseNextCapacity',
  'game.warehouseStoredQuantity',
  'game.warehouseReservedQuantity',
  'game.warehouseUsedCapacity',
  'game.warehouseAvailableCapacity',
  'upgradeWarehouse()',
  '所有商品共用容量',
  '买单预占',
  '容量超限',
  '已达最高等级',
  '资金不足',
]) requireText('src/components/warehouse/WarehouseUpgradeCard.tsx', text);

for (const text of [
  "import { WarehouseUpgradeCard } from '../components/warehouse/WarehouseUpgradeCard';",
  'title="工厂"',
  '管理共享仓库、建设工厂、设置生产计划',
  '<WarehouseUpgradeCard model={model} className="factory-warehouse-card" />',
  '<WidgetHeading title="建设新工厂" />',
  'game.facilities.map',
]) requireText('src/pages/ProductionPage.tsx', text);
requireOrderedText(
  'src/pages/ProductionPage.tsx',
  '<WarehouseUpgradeCard model={model} className="factory-warehouse-card" />',
  '<WidgetHeading title="建设新工厂" />',
);

for (const text of [
  "{ id: 'warehouse', label: '仓库' }",
  'event.warehouseChange',
  '等级 {event.warehouseChange.beforeLevel} → {event.warehouseChange.afterLevel}',
]) requireText('src/pages/AssetsPage.tsx', text);

for (const text of [
  '仓库使用',
  'game.warehouseUsedCapacity',
  'game.inventoryCapacity',
]) requireText('src/pages/SettingsPage.tsx', text);

for (const text of [
  'game.warehouseUsedCapacity',
  'game.warehouseReservedQuantity',
  '买单预占',
]) requireText('src/app/GameApp.tsx', text);

for (const text of [
  '.warehouse-upgrade-card',
  '.factory-warehouse-card',
  '.warehouse-capacity-progress',
  '.warehouse-upgrade-metrics',
  '.warehouse-upgrade-action',
  '@media (max-width: 960px)',
  '@media (max-width: 720px)',
]) requireText('src/styles/warehouse-expansion.css', text);

requireText('src/main.tsx', "import './styles/warehouse-expansion.css'");
requireOrderedText(
  'src/main.tsx',
  "import './styles/warehouse-expansion.css'",
  "import './styles/design-system.css'",
);

for (const text of [
  'warehouse state defaults to level 1 and client version 7',
  'warehouse usage counts stored goods and remaining open buy orders',
  'warehouse upgrade deducts server funds and increases shared capacity',
  'warehouse upgrade preserves stored and reserved usage while adding free capacity',
  'warehouse upgrade rejects insufficient funds without changing capacity',
  'legacy custom capacity infers a non-decreasing warehouse level',
  'maximum warehouse level cannot be upgraded again',
  'warehouse upgrade is idempotent',
]) requireText('server/test/warehouse.test.js', text);

for (const text of [
  '# Economy 仓库扩容设计',
  '初始容量：500',
  '每级增加：250',
  '最高等级：12',
  'cost(level) = 150 × level²',
  'POST /api/game/warehouse/upgrade',
  'warehouseStoredQuantity: number;',
  'warehouseReservedQuantity: number;',
  'warehouseUsedCapacity: number;',
  'warehouseAvailableCapacity: number;',
  '绝不缩减旧玩家容量',
  '扩容费用计入系统回收',
  '`WarehouseUpgradeCard` 只能由 `ProductionPage` 渲染',
  '服务器数据库不得保存仓库扩容历史日志',
  '未更新本设计、页面职责设计、测试和架构检查的仓库规则修改不应合并',
]) requireText('docs/WAREHOUSE_EXPANSION_DESIGN.md', text);

for (const text of [
  '# Economy 页面内容与导航职责设计',
  '共享仓库与工厂管理',
  '`WarehouseUpgradeCard` 只能由 `ProductionPage` 渲染',
  '资金页不负责仓库管理',
  '设置页的一行“仓库使用”只是只读账号摘要',
]) requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', text);

for (const text of [
  '仓库等级和容量变化',
  'warehouseChange?:',
  '旧本地快照没有 `warehouseLevel`',
  '本地日志参与资产、仓库或排名计算',
]) requireText('docs/LOCAL_ACTIVITY_LOG_DESIGN.md', text);

for (const [path, forbidden] of [
  ['src/components/warehouse/WarehouseUpgradeCard.tsx', ['150 *', '500 +', 'WAREHOUSE_BASE_CAPACITY', 'Object.values(game.inventories)']],
  ['src/pages/OverviewPage.tsx', ['WarehouseUpgradeCard']],
  ['src/pages/MarketPage.tsx', ['WarehouseUpgradeCard']],
  ['src/pages/AssetsPage.tsx', ['WarehouseUpgradeCard', 'upgradeWarehouse()', '150 *', '500 +']],
  ['src/pages/LeaderboardPage.tsx', ['WarehouseUpgradeCard']],
  ['src/pages/SettingsPage.tsx', ['WarehouseUpgradeCard', 'warehouseLevel', 'warehouseUpgradeCost', 'warehouseNextCapacity', '扩容按钮']],
  ['src/app/GameApp.tsx', ['inventoryUsed']],
  ['server/src/warehouse.js', ['player.trades', 'player.ledger', 'player.assetEvents']],
]) {
  for (const text of forbidden) forbidText(path, text);
}

if (failures.length) {
  console.error('仓库扩容架构验证失败:\n- ' + failures.join('\n- '));
  process.exit(1);
}

console.log('仓库扩容架构验证通过：服务器权威规则、生产页唯一管理入口、只读摘要和本地历史均满足设计基线。');
