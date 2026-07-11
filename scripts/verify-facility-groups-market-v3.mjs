import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const failures = [];
function requireFile(path) { if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`); }
function forbidFile(path) { if (existsSync(resolve(root, path))) failures.push(`不应存在文件: ${path}`); }
function requireText(path, text) { if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`); }
function forbidText(path, text) { if (read(path).includes(text)) failures.push(`${path} 不应包含: ${text}`); }
function requireOrderedText(path, earlier, later) {
  const content = read(path); const first = content.indexOf(earlier); const second = content.indexOf(later);
  if (first < 0 || second < 0 || first >= second) failures.push(`${path} 必须先包含 ${earlier}，再包含 ${later}`);
}

[
  'server/src/facility-groups.js',
  'server/src/storage.js',
  'server/src/index.js',
  'server/test/facility-groups.test.js',
  'src/types.ts',
  'src/api/game.ts',
  'src/app/gameViewModel.ts',
  'src/components/facilities/FacilityProgress.tsx',
  'src/pages/ProductionPage.tsx',
  'src/pages/MarketPage.tsx',
  'src/utils/localActivityStore.ts',
  'src/styles/industry-system.css',
  'src/styles/market-funds.css',
  'docs/FACILITY_GROUP_AND_MARKET_V3_DESIGN.md',
  'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/MARKET_AND_ASSET_INFORMATION_ARCHITECTURE.md',
].forEach(requireFile);

forbidFile('server/src/direct-production.js');
forbidFile('server/test/direct-production.test.js');

for (const text of [
  'export function migrateFacilityGroupWorld',
  'export function stripLegacyFacilityInstances',
  'export function processFacilityGroupWorld',
  'export function applyFacilityGroupAction',
  'export function createFacilityGroupClientState',
  'facilityGroups',
  'participatingCount',
  'pendingJoinCount',
  'nextCycleCount',
  'group.participatingCount += group.pendingJoinCount',
  'group.pendingJoinCount = 0',
  'groupRequirements',
  'type.output.quantity * participating',
  'type.operatingCost * participating',
  'stopGroup(group',
  'plan_adjustment_required',
  'listFacilityGroup',
  'buyFacilityGroup',
  'listing.quantity -= quantity',
  'buyer.credits -= total',
  'seller.credits += total',
  'stripLegacyFacilityInstances(world)',
  'world.version = 4',
]) requireText('server/src/facility-groups.js', text);

for (const text of [
  'processFacilityGroupWorld', 'applyFacilityGroupAction', 'createFacilityGroupClientState',
  'migrateFacilityGroupWorld', 'stripLegacyFacilityInstances', 'version: 8',
  "this.database.exec('BEGIN IMMEDIATE')",
]) requireText('server/src/storage.js', text);

for (const text of [
  '(start|pause|stop|list|plan)',
  'routePayload: { facilityTypeId:',
  "action: 'buyFacility'",
]) requireText('server/src/index.js', text);
forbidText('server/src/index.js', '|collect');

for (const text of [
  'version: 8;', 'export interface FacilityGroup', 'facilityGroups: FacilityGroup[];',
  'export interface FacilityConstruction', 'export interface FacilityListing',
  'quantity: number;', 'unitPrice: number;', 'plan_adjustment_required',
]) requireText('src/types.ts', text);
for (const text of ['ProductionFacility', 'facilities: ProductionFacility[];', 'internalGoods', 'internalCapacity']) forbidText('src/types.ts', text);

for (const text of [
  'startFacility: (facilityTypeId: string)',
  'setProductionPlan:',
  'listFacility:',
  'quantity: number',
  'unitPrice: number',
  'buyFacility: (listingId: string, quantity: number)',
]) requireText('src/api/game.ts', text);
for (const text of ['collectFacility', '/collect']) forbidText('src/api/game.ts', text);

for (const text of [
  'game.facilityGroups.map', 'FacilityGroupProgress', '当前参与', '下一周期', '待加入', '已挂牌',
  '周期产量', '周期成本', '原料库存', '统一生产计划', '启动全部', '停止全部',
  '挂牌数量', '单座价格', '下一生产周期加入同类工厂集群',
]) requireText('src/pages/ProductionPage.tsx', text);
for (const text of [
  'facility.id', 'facility.name', '展开管理', '实例列表', '小时产量', '小时运营费',
  '累计产量', '系统参考估值', 'collectFacility', '领取产成品',
]) forbidText('src/pages/ProductionPage.tsx', text);

for (const text of [
  'order-quick-fill', '1/4 仓', '1/2 仓', '全仓',
  'const maxBuyQuantity', 'game.warehouseAvailableCapacity', 'Math.floor(game.credits / orderPrice)',
  'const maxSellQuantity = selectedInventory.available',
  'const bestAsks = derived.asks.slice(0, 5).reverse()',
  'const bestBids = derived.bids.slice(0, 5)',
  'single-order-book', 'order-book-midpoint', '工厂数量市场',
]) requireText('src/pages/MarketPage.tsx', text);
requireOrderedText('src/pages/MarketPage.tsx', '限价', '数量');
requireOrderedText('src/pages/MarketPage.tsx', '数量', 'order-quick-fill');
for (const text of ['book-columns', 'aggregateOrderBook', 'listing.facility', 'facilityId']) forbidText('src/pages/MarketPage.tsx', text);

for (const text of [
  'same-type factories share one cycle',
  'newly completed factory joins after the current cycle without resetting progress',
  'same-type group starts and stops uniformly',
  'processing group consumes input and charges cost for all participating factories',
  'factory quantity listing and partial purchase transfer exact counts',
  'purchased factories join a running group on the next cycle',
  'pending join pauses an incompatible target plan after the current cycle',
  'facility group actions remain idempotent',
]) requireText('server/test/facility-groups.test.js', text);

for (const text of [
  '.facility-group-list', '.facility-group-card', '.facility-group-counts', '.facility-group-specs',
  '.facility-group-listing-control', '@media (max-width: 1380px)', '@media (max-width: 720px)',
]) requireText('src/styles/industry-system.css', text);
for (const text of [
  '.order-quick-fill', '.single-order-book', '.order-book-stack', '.book-order-row',
  '.order-book-midpoint', '.listing-purchase-control',
]) requireText('src/styles/market-funds.css', text);

for (const text of [
  '# Economy 工厂集群与市场第三版设计',
  '不存在单座工厂实例', '完成当前周期后从下一周期参与生产',
  '同类型工厂统一启动、统一停止', '工厂挂牌和购买按类型、数量和单座价格',
  '限价输入位于数量输入之前', '订单簿为单列', '买卖盘各最多 5 笔',
]) requireText('docs/FACILITY_GROUP_AND_MARKET_V3_DESIGN.md', text);

if (failures.length) {
  console.error('工厂集群与市场第三版验证失败:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('工厂集群与市场第三版验证通过：统一周期、下一周期加入、数量交易、快捷仓位和单列订单簿满足设计。');
