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
  'src/styles/warehouse-expansion.css',
  'docs/WAREHOUSE_EXPANSION_DESIGN.md',
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
  'export function createWarehouseSummary',
  'export function upgradeWarehouse',
  'player.stats.systemSinks',
  'player.credits -= cost',
  'player.warehouseLevel += 1',
]) requireText('server/src/warehouse.js', text);

for (const text of [
  'createWarehouseSummary',
  'ensureWarehouse',
  'upgradeWarehouse',
  "action === 'upgradeWarehouse'",
  '...createWarehouseSummary(player)',
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
]) requireText('src/types.ts', text);
forbidText('src/types.ts', 'version: 8;');

for (const text of [
  'upgradeWarehouse: () => Promise<ActionResult>;',
  "upgradeWarehouse: () => runAction('refresh', gameActions.upgradeWarehouse)",
  'localAssetEvents',
  'syncLocalActivity',
]) requireText('src/app/gameViewModel.ts', text);

for (const text of [
  'export function WarehouseUpgradeCard',
  'game.warehouseLevel',
  'game.warehouseMaxLevel',
  'game.warehouseUpgradeCost',
  'game.warehouseNextCapacity',
  'upgradeWarehouse()',
  '所有商品共用容量',
  '已达最高等级',
  '资金不足',
]) requireText('src/components/warehouse/WarehouseUpgradeCard.tsx', text);

requireText('src/pages/AssetsPage.tsx', '<WarehouseUpgradeCard model={model} className="span-3" />');
requireText('src/pages/SettingsPage.tsx', '<WarehouseUpgradeCard model={model} className="span-3" compact />');
requireText('src/pages/SettingsPage.tsx', '仓库等级');
requireText('src/pages/SettingsPage.tsx', '下次扩容费用');

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
  'warehouse upgrade deducts server funds and increases shared capacity',
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
  '绝不缩减旧玩家容量',
  '扩容费用计入系统回收',
  '服务器数据库不得保存仓库扩容历史日志',
  '未更新本设计、测试和架构检查的仓库规则修改不应合并',
]) requireText('docs/WAREHOUSE_EXPANSION_DESIGN.md', text);

for (const [path, forbidden] of [
  ['src/components/warehouse/WarehouseUpgradeCard.tsx', ['150 *', '500 +', 'WAREHOUSE_BASE_CAPACITY']],
  ['src/pages/AssetsPage.tsx', ['150 *', '500 +']],
  ['src/pages/SettingsPage.tsx', ['150 *', '500 +']],
  ['server/src/warehouse.js', ['player.trades', 'player.ledger', 'player.assetEvents']],
]) {
  for (const text of forbidden) forbidText(path, text);
}

if (failures.length) {
  console.error('仓库扩容架构验证失败:\n- ' + failures.join('\n- '));
  process.exit(1);
}

console.log('仓库扩容架构验证通过：等级、费用、迁移、事务、UI 与本地日志边界满足设计基线。');
