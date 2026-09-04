import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const server = read('server/src/commercial-buildings.js');
const domain = read('server/src/domain.js');
const runtime = read('server/src/runtime-action-executor.js');
const routes = read('server/src/game-routes.js');
const registry = read('server/src/player-action-registry.js');
const province = read('src/pages/ProvincePage.tsx');
const commerce = read('src/pages/CommercePage.tsx');
const navigation = read('src/navigation/playerPageStack.ts');
const design = read('docs/COMMERCIAL_BUILDINGS_DESIGN.md');
const docsIndex = read('docs/README.md');

for (const token of [
  'COMMERCIAL_BUILDING_TYPE_CATALOG',
  'commercialBuildingGroups',
  'pendingRevenue',
  'pendingProfit',
  'processCommercialWorld',
  'applyCommercialBuildingAction',
  'inventoryForProvince',
  'officialPriceFor',
]) assert.ok(server.includes(token), `商业服务器实现缺少: ${token}`);

for (const token of [
  'migrateCommercialWorld',
  'processCommercialWorld(world, now)',
  'commercialBuildingTypes: clone(COMMERCIAL_BUILDING_TYPE_CATALOG)',
  'commercialBuildingGroups: clone(player?.commercialBuildingGroups || [])',
]) assert.ok(domain.includes(token), `商业状态投影缺少: ${token}`);

assert.ok(runtime.includes("action === 'commercialBuilding'"));
assert.ok(runtime.includes('applyCommercialBuildingAction'));
assert.ok(routes.includes("path === '/api/game/commercial-buildings'"));
assert.ok(registry.includes("commercialBuilding: defineAction({ mutationScope: 'local-player'"));

const marketIndex = province.indexOf("{ id: 'market', label: '市场' }");
const commerceIndex = province.indexOf("{ id: 'commerce', label: '商业' }");
const industryIndex = province.indexOf("{ id: 'buildings', label: '工业' }");
assert.ok(marketIndex >= 0 && commerceIndex > marketIndex && industryIndex > commerceIndex, '地区页必须保持市场 / 商业 / 工业顺序');
assert.ok(navigation.includes("'overview' | 'market' | 'commerce' | 'buildings' | 'warehouse'"));
assert.ok(navigation.includes("type: 'regional-commercial'"));

for (const token of [
  'production-build-card',
  'facility-cluster-selector-region',
  'facility-cluster-detail-card',
  '建设新商业建筑',
  '稳定利润',
]) assert.ok(commerce.includes(token), `商业页面缺少: ${token}`);

for (const token of [
  '商业建筑不是工厂的另一种配方',
  '不得跨州寻找库存',
  '固定商业利润是服务器目录声明的**绝对金额**',
  '不是市场成交',
]) assert.ok(design.includes(token), `商业权威设计缺少: ${token}`);
assert.ok(docsIndex.includes('`COMMERCIAL_BUILDINGS_DESIGN.md`'), '设计索引必须登记商业建筑权威文档');

console.log('commercial buildings verification passed');
