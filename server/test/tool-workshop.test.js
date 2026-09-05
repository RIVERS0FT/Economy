import assert from 'node:assert/strict';
import test from 'node:test';
import { ECONOMY_CONSTANTS, FACILITY_TYPE_CATALOG, MARKET_DEMAND_GROUP_CATALOG, MARKET_DEMAND_MODEL_VERSION, PRODUCT_CATALOG, createWorld, ensurePlayer, migrateWorld } from '../src/domain.js';
const standards = (facility) => facility.recipes.filter(
  (recipe) => recipe.productionMethodId === facility.productionMethodGroups[0].defaultMethodId,
);
test('工具与工具工坊进入正式目录并保持 C4 参考利润', () => {
  assert.equal(PRODUCT_CATALOG.length, 38); assert.equal(FACILITY_TYPE_CATALOG.length, 26); assert.equal(ECONOMY_CONSTANTS.maxOpenOrders, (PRODUCT_CATALOG.length + FACILITY_TYPE_CATALOG.length) * 10);
  assert.deepEqual(PRODUCT_CATALOG.find((x) => x.id === 'tools'), { id: 'tools', name: '工具', category: 'industrial', basePrice: 12, marketDemandGroupId: 'household', marketDemandRole: 'direct', marketDemandTier: 'final', populationDemandGroupId: 'household', populationDemandTier: 'final' });
  const f = FACILITY_TYPE_CATALOG.find((x) => x.id === 'tool-workshop'); assert.ok(f); assert.equal(f.complexity, 'C4'); assert.equal(f.buildCost, 136); assert.deepEqual(f.buildInputs, [{ productId: 'lumber', quantity: 4 }, { productId: 'steel', quantity: 4 }]); assert.equal(f.systemValue, 420);
  const r = standards(f)[0]; assert.deepEqual(r.inputs, [{ productId: 'steel', quantity: 1 }, { productId: 'lumber', quantity: 1 }]); assert.deepEqual(r.output, { productId: 'tools', quantity: 5 }); assert.equal(r.cycleMs, 60_000); assert.equal(r.operatingCost, 8); assert.equal((12 * 5 - 29 - 17 - 8) * 60_000 / r.cycleMs, 6);
  assert.deepEqual(f.recipes.map((x) => [x.productionMethodId, x.cycleMs, x.operatingCost, x.output.quantity]), [['forge-working',60000,8,5],['precision-machining',30000,11,5],['controlled-heat-treatment',90000,5,5],['automated-machining',60000,22,10]]);
  assert.deepEqual(standards(FACILITY_TYPE_CATALOG.find((x) => x.id === 'machine-factory'))[0].inputs, [{ productId: 'steel', quantity: 2 }]);
  const farm = FACILITY_TYPE_CATALOG.find((x) => x.id === 'farm');
  assert.deepEqual(farm.recipes.find((x) => x.id === 'wheat-crop--tool-tillage').inputs, [{ productId: 'tools', quantity: 1 }]);
});
test('市场需求模型 20 在固定耐用品预算内保留工具需求', () => {
  assert.equal(MARKET_DEMAND_MODEL_VERSION, 20); const h = MARKET_DEMAND_GROUP_CATALOG.find((x) => x.id === 'household'); const d = h.classes.find((x) => x.id === 'durables'); assert.equal(d.name, '金属、工具与耐用品'); assert.equal(d.budgetShare, .30); assert.equal(d.products.reduce((a,x)=>a+x.baseWeight,0), 1); assert.deepEqual(d.products.find((x)=>x.productId==='tools'), { productId:'tools', baseWeight:.14, utilityPerUnit:3, minShare:.06 }); assert.equal(h.seedDemandQuantities.tools,2);
});
test('世界版本 25 迁移补齐工具库存与市场且保留资产', () => {
  const now=1786100000000,w=createWorld(now),p=ensurePlayer(w,{id:8,name:'迁移玩家'},now); p.credits=23456;p.inventories.steel.available=11;delete p.inventories.tools;delete w.markets.tools;w.version=24;const m=migrateWorld(w,now+1000);assert.equal(m.version, 33);assert.equal(m.players['8'].credits,23456);assert.equal(m.players['8'].inventories.steel.available,11);assert.deepEqual(m.players['8'].inventories.tools,{available:0,frozen:0,inTransit:0});assert.equal(m.markets.tools.lastPrice,12);
});
