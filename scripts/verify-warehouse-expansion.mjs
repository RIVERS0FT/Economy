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
  'src/utils/localActivityStore.ts',
  'src/styles/warehouse-expansion.css',
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
  '<WarehouseUpgradeCard model={model} className="span-3" />',
  "{ id: 'warehouse', label: '仓库' }",
  'event.warehouseChange',
  '等级 {event.warehouseChange.beforeLevel} → {event.warehouseChange.afterLevel}',
  'game.warehouseReservedQuantity',
]) requireText('src/pages/AssetsPage.tsx', text);

for (const text of [
  '<WarehouseUpgradeCard model={model} className="span-3" compact />',
  '仓库等级',
  '仓库使用',
  '实物库存',
  '买单预占',
  '剩余容量',
  '下次扩容费用',
]) requireText('src/pages/SettingsPage.tsx', text);

for (const text of [
  'game.warehouseUsedCapacity',
  'game.warehouseReservedQuantity',
  '买单预占',
]) requireText('src/app/GameApp.tsx', text);

for (const text of [
  '.warehouse-upgrade-card',
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
  '服务器数据库不得保存仓库扩容历史日志',
  '未更新本设计、测试和架构检查的仓库规则修改不应合并',
]) requireText('docs/WAREHOUSE_EXPANSION_DESIGN.md', text);

for (const text of [
  '仓库等级和容量变化',
  'warehouseChange?:',
  '旧本地快照没有 `warehouseLevel`',
  '本地日志参与资产、仓库或排名计算',
]) requireText('docs/LOCAL_ACTIVITY_LOG_DESIGN.md', text);

for (const [path, forbidden] of [
  ['src/components/warehouse/WarehouseUpgradeCard.tsx', ['150 *', '500 +', 'WAREHOUSE_BASE_CAPACITY', 'Object.values(game.inventories)']],
  ['src/pages/AssetsPage.tsx', ['150 *', '500 +', 'Object.values(game.inventories).reduce((sum, inventory) => sum + inventory.available + inventory.frozen']],
  ['src/pages/SettingsPage.tsx', ['150 *', '500 +', 'inventoryUsed']],
  ['src/app/GameApp.tsx', ['inventoryUsed']],
  ['server/src/warehouse.js', ['player.trades', 'player.ledger', 'player.assetEvents']],
]) {
  for (const text of forbidden) forbidText(path, text);
}

if (failures.length) {
  console.error('仓库扩容架构验证失败:\n- ' + failures.join('\n- '));
  process.exit(1);
}

console.log('仓库扩容架构验证通过：等级、费用、占用、预占、迁移、事务、UI 与本地日志满足设计基线。');
