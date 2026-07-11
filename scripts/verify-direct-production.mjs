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

[
  'server/src/direct-production.js',
  'server/src/storage.js',
  'server/src/index.js',
  'server/test/direct-production.test.js',
  'src/types.ts',
  'src/api/game.ts',
  'src/app/gameViewModel.ts',
  'src/pages/ProductionPage.tsx',
  'src/pages/OverviewPage.tsx',
  'src/pages/MarketPage.tsx',
  'src/pages/AssetsPage.tsx',
  'src/utils/localActivityStore.ts',
  'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
  'docs/WAREHOUSE_EXPANSION_DESIGN.md',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/LOCAL_ACTIVITY_LOG_DESIGN.md',
].forEach(requireFile);

for (const text of [
  'export function migrateDirectOutputWorld',
  'export function stripFactoryStorageFields',
  'export function processDirectProductionWorld',
  'export function applyDirectProductionAction',
  'export function createDirectProductionClientState',
  'inventoryFor(player, facility.outputProductId).available += outputQuantity',
  'nextCycleNetStorage',
  'Math.max(0, Number(facility.outputPerCycle || 0) - Number(facility.inputPerCycle || 0))',
  'createWarehouseUsage(world, player)',
  "stopFacility(facility, 'full', 'output_full')",
  'delete facility.internalGoods',
  'delete facility.internalCapacity',
  'legacyGoods > 0',
  'inventoryFor(player, facility.outputProductId).available += legacyGoods',
  "action === 'collectFacility'",
  '工厂产成品会直接进入共享仓库，无需领取',
]) requireText('server/src/direct-production.js', text);

for (const text of [
  'processDirectProductionWorld',
  'applyDirectProductionAction',
  'createDirectProductionClientState',
  'migrateDirectOutputWorld',
  'stripFactoryStorageFields',
  "this.database.exec('BEGIN IMMEDIATE')",
]) requireText('server/src/storage.js', text);

for (const text of [
  "(start|pause|stop|list|plan)",
  "start: 'startFacility'",
  "plan: 'setProductionPlan'",
]) requireText('server/src/index.js', text);
forbidText('server/src/index.js', '|collect');
forbidText('server/src/index.js', "collect: 'collectFacility'");

for (const text of [
  'raw factory output moves directly into shared warehouse',
  'factory stops before producing when shared warehouse lacks one full cycle of space',
  'processing factory can run at full warehouse when input consumption frees enough space',
  'multiple factories share the same remaining warehouse capacity',
  'legacy internal factory goods migrate into shared warehouse without loss',
  'production state is stable when processed repeatedly at the same server time',
]) requireText('server/test/direct-production.test.js', text);

for (const [path, forbidden] of [
  ['src/types.ts', ['internalGoods: number;', 'internalCapacity: number;']],
  ['src/api/game.ts', ['collectFacility', '/collect']],
  ['src/app/gameViewModel.ts', ['pendingGoods', 'collectFacility', 'facility.internalGoods']],
  ['src/pages/ProductionPage.tsx', ['collectFacility', '领取{outputName}', 'internalGoods', 'internalCapacity', '内部容量']],
  ['src/pages/OverviewPage.tsx', ['待领取产成品', 'pendingGoods']],
  ['src/pages/MarketPage.tsx', ['internalCapacity', '内部容量']],
  ['src/utils/localActivityStore.ts', ["| 'collectFacility'", "collectFacility: 'inventory'", 'current.internalGoods', 'previous.internalGoods']],
]) {
  for (const text of forbidden) forbidText(path, text);
}

for (const text of [
  '产成品自动入仓',
  '直接进入共享仓库',
  '仓库{outputName}',
]) requireText('src/pages/ProductionPage.tsx', text);

for (const text of [
  '共享仓库已满',
  '共享仓库空间不足',
  'facilityValue = game.facilities.reduce((sum, facility) => sum + facility.systemValue, 0)',
  'inventoryUsed = game.warehouseStoredQuantity',
]) requireText('src/app/gameViewModel.ts', text);

for (const text of [
  'const completedQuantityDelta = current.completedQuantity - previous.completedQuantity',
  "action: 'produced'",
  'outputQuantity: completedQuantityDelta',
  '生产完成，产成品已直接进入共享仓库',
]) requireText('src/utils/localActivityStore.ts', text);

for (const text of [
  '所有工厂不设置内部产成品仓库或内部容量',
  '每个完整生产周期完成后，产成品直接进入玩家共享仓库',
  'netStoragePerCycle = max(0, outputPerCycle - inputPerCycle)',
  '不提供产成品领取操作',
  '旧内部商品无损且仅迁移一次',
]) requireText('docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', text);

for (const text of [
  '所有工厂产成品完成后直接进入共享仓库',
  '工厂没有 `internalGoods` 或 `internalCapacity`',
  '不存在从工厂领取产成品的操作',
]) requireText('docs/WAREHOUSE_EXPANSION_DESIGN.md', text);

for (const text of [
  '不得显示工厂内部商品、内部容量或领取按钮',
  '不再存在“领取产成品”模块',
]) requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', text);

for (const text of [
  '新生产事件不再比较工厂内部商品',
  'completedQuantity 增量 > 0',
  '新事件不得写入 `internalGoodsDelta`',
  '旧浏览器本地历史',
]) requireText('docs/LOCAL_ACTIVITY_LOG_DESIGN.md', text);

if (failures.length) {
  console.error('工厂直接入仓架构验证失败:\n- ' + failures.join('\n- '));
  process.exit(1);
}

console.log('工厂直接入仓架构验证通过：内部存储和领取流程已移除，共享仓库约束、迁移与本地日志满足设计基线。');
