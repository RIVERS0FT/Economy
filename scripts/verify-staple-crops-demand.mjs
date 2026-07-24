import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  FACILITY_TYPE_CATALOG,
  MARKET_DEMAND_GROUP_CATALOG,
  MARKET_DEMAND_MODEL_VERSION,
  MARKET_DEMAND_PRODUCT_IDS,
  PRODUCT_CATALOG,
} from '../server/src/domain.js';

const read = (path) => readFileSync(path, 'utf8');
const products = new Map(PRODUCT_CATALOG.map((product) => [product.id, product]));
assert.equal(PRODUCT_CATALOG.length, 31);
assert.equal(MARKET_DEMAND_MODEL_VERSION, 10);
assert.deepEqual(MARKET_DEMAND_GROUP_CATALOG.map((group) => group.id), ['food', 'household']);
assert.deepEqual(MARKET_DEMAND_GROUP_CATALOG.map((group) => group.ownerName), ['食品市场需求', '家庭消费市场需求']);
assert.deepEqual(MARKET_DEMAND_GROUP_CATALOG.map((group) => group.name), ['食品市场', '社会消费市场']);
assert.ok(MARKET_DEMAND_GROUP_CATALOG.every((group) => group.directBudgetShare === 0.70));

const groups = new Map(MARKET_DEMAND_GROUP_CATALOG.map((group) => [group.id, group]));
assert.deepEqual(groups.get('food').classes.map((item) => item.id), ['staples', 'protein', 'fresh-drinks', 'convenience']);
assert.deepEqual(groups.get('household').classes.map((item) => item.id), ['home', 'wear', 'daily', 'durables']);
assert.ok(groups.get('food').classes.find((item) => item.id === 'fresh-drinks').products.some((item) => item.productId === 'fruit'));
assert.ok(groups.get('household').classes.find((item) => item.id === 'durables').products.some((item) => item.productId === 'appliance'));

assert.deepEqual([...MARKET_DEMAND_PRODUCT_IDS].sort(), PRODUCT_CATALOG.map((product) => product.id).sort());
for (const product of PRODUCT_CATALOG) {
  assert.equal(product.marketDemandRole, 'direct', product.id);
  assert.ok(product.marketDemandGroupId === 'food' || product.marketDemandGroupId === 'household', product.id);
}
for (const group of MARKET_DEMAND_GROUP_CATALOG) {
  for (const demandClass of group.classes) {
    const minimumTotal = demandClass.products.reduce((sum, option) => sum + Number(option.minShare || 0), 0);
    assert.ok(minimumTotal > 0 && minimumTotal <= 1, `${group.id}/${demandClass.id} 最低份额无效`);
    assert.ok(demandClass.products.every((option) => Number(option.minShare || 0) > 0));
  }
}
assert.equal(MARKET_DEMAND_GROUP_CATALOG.reduce((sum, group) => sum + group.baseBudget, 0), 5_700);

const runtime = [
  'server/src/population-economy.js',
  'server/src/market-demand.js',
  'server/src/market-liquidity.js',
  'server/src/market-demand/catalog.js',
  'server/src/market-demand/math.js',
  'server/src/market-demand/signals.js',
  'server/src/market-demand/state.js',
  'server/src/market-demand/price-transmission.js',
  'server/src/market-demand/allocation.js',
  'server/src/balanced-market.js',
  'server/src/order-matching.js',
  'server/src/order-book-integrity.js',
].map(read).join('\n');
for (const text of [
  'MARKET_DEMAND_MODEL_VERSION = 10',
  'DIRECT_BUDGET_SHARE = 0.70',
  "POPULATION_MODEL_IDS = Object.freeze(['basic', 'skilled', 'professional'])",
  "POPULATION_CONSUMPTION_STATES = Object.freeze(['lavish', 'prosperous', 'normal', 'strained', 'subsistence'])",
  'POPULATION_ECONOMY_VERSION = 4',
  'POPULATION_GROUP_SHARES_BY_STATE',
  'PROSPEROUS_ENTRY_CYCLES = 2',
  'LAVISH_ENTRY_CYCLES = 3',
  'UPPER_STATE_DOWNGRADE_CYCLES = 2',
  'model.recentPeakIncome = Math.max(model.incomeEma',
  "setConsumptionState(model, 'strained'",
  "setConsumptionState(model, 'subsistence'",
  "const CONSTRUCTION_PROFILE = Object.freeze({ basic: 0.60, skilled: 0.30, professional: 0.10 })",
  'preparePopulationDemandCycle',
  'populationClassShares',
  'reservePopulationOrder',
  'settlePopulationPurchase',
  'populationModelId',
  'fundingPool',
  "direct: 'direct'",
  "'derived-liquidity': 'derived'",
  'marginalPropensityToConsume: 0.95',
  'marginalPropensityToConsume: 0.85',
  'marginalPropensityToConsume: 0.72',
  'LIQUIDITY_BASE_SPREAD = 0.08',
  'LIQUIDITY_MIN_SPREAD = 0.04',
  'LIQUIDITY_MAX_SPREAD = 0.24',
  'LIQUIDITY_QUOTE_BUDGET_SHARE = 0.25',
  'LIQUIDITY_MIN_QUOTE_BUDGET_SHARE = 0.05',
  'POPULATION_STABILIZATION_BUDGET_SHARE = 0.12',
  'POPULATION_STABILIZATION_TARGET_CYCLES = 3',
  'POPULATION_STABILIZATION_DIRECT_SHARE = 0.85',
  'INCOME_EMA_PREVIOUS_WEIGHT = 0.85',
  'BUDGET_MAX_FALL = 0.12',
  'PRODUCT_PRESSURE_ACTIVE_IMBALANCE_WEIGHT = 0.08',
  'PRODUCT_PRESSURE_SUPPLY_RELIEF_WEIGHT = 0.10',
  'PRODUCT_PRESSURE_EVIDENCE_TARGET = 8',
  'LIQUIDITY_SIGNAL_WEIGHT = 0.50',
  "LIQUIDITY_BUY = 'liquidity-buy'",
  "LIQUIDITY_SELL = 'liquidity-sell'",
  'seeded: wasSeeded || seedNow',
  'groupState.frozenCredits += reservedCredits',
  'reserve.frozenInventory += sellQuantity',
  "resting.ownerType === 'population' && incoming.ownerType === 'population'",
  'settleLiquidityBuy',
  'settleLiquiditySell',
  'SYSTEM_ORDER_RETENTION_RATE',
  'DEMAND_CURVE',
  'DIRECT_DEMAND_UNFILLED_PRICE_STEP = 1.03',
  'DIRECT_DEMAND_UNFILLED_REFERENCE_GAP_RATE = 0.25',
  'DIRECT_DEMAND_BELOW_REFERENCE_RECOVERY_RATE = 0.10',
  'DIRECT_DEMAND_PRICE_RECOVERY_RATE = 0.30',
  'DIRECT_DEMAND_OVERSUPPLY_PRICE_STEP = 0.98',
  'DIRECT_DEMAND_OVERSUPPLY_ENTRY_CYCLES = 2',
  'DIRECT_DEMAND_OVERSUPPLY_FILL_RATIO = 0.95',
  'DIRECT_DEMAND_OVERSUPPLY_DELAY_SCORE = 0.85',
  'DIRECT_DEMAND_MIN_PRICE = 1',
  'directQuoteAnchors',
  'directOversupplyCycles',
  'directDelayScore',
  'PRODUCT_ORDER_VALUE_CYCLES',
  'PRODUCT_PRESSURE_SMOOTHING',
  'DERIVED_UNMET_WEIGHT',
  'recipeSharesFor',
  'complementGate',
  'derivedRequirements',
  'previousDemandQuantities',
  'processPriceTransmission',
]) assert.ok(runtime.includes(text), '市场需求实现缺少: ' + text);
for (const forbidden of ['DEMAND_INVENTORY_BOOST_RATE', 'stockSnapshot.totalValue', 'inventoryFactor', 'playerScaleBudget * tradeActivityFactor']) {
  assert.equal(runtime.includes(forbidden), false, '人口需求不得恢复库存或活跃玩家增发预算: ' + forbidden);
}

const domain = read('server/src/domain.js');
for (const text of [
  'buildMarketDemandMetadata',
  'reachableGroups',
  'MARKET_DEMAND_MODEL_VERSION',
  'marketDemand.initializeWorld',
  'marketDemand.normalizeWorld',
  'marketDemand.process',
  'balancedMarket.matchOrder(world, incoming, now)',
  'reconcileCommodityOrderBook',
  'ensurePopulationEconomy',
  'world.version = 15',
]) assert.ok(domain.includes(text), 'domain.js 缺少: ' + text);

const facilities = new Map(FACILITY_TYPE_CATALOG.map((facility) => [facility.id, facility]));
assert.deepEqual(facilities.get('beverage-factory').recipes.map((recipe) => recipe.inputs), [
  [{ productId: 'sugar', quantity: 1 }, { productId: 'milk', quantity: 1 }],
  [{ productId: 'fruit', quantity: 2 }, { productId: 'sugar', quantity: 1 }],
]);
assert.deepEqual(facilities.get('appliance-factory').recipes[0].inputs, [
  { productId: 'machinery', quantity: 1 }, { productId: 'electronics', quantity: 1 },
]);

const marketDemandTests = read('server/test/market-demand-v6.test.js');
for (const text of [
  'direct demand quote anchor accumulates fractional no-fill increases and recovers after service',
  'sustained fast full service lowers all direct demand tiers below reference price',
  'direct demand quote anchor stops at absolute price one',
  'zero fill below reference accelerates recovery while partial service recovers gently',
  'no direct demand converges toward reference and derived liquidity ignores a low direct anchor',
]) assert.ok(marketDemandTests.includes(text), '市场需求测试缺少模型 10 双向报价回归: ' + text);

const populationTests = read('server/test/population-economy.test.js');
for (const text of [
  'production employment uses factory complexity and preserves every integer credit',
  'construction employment is fixed at 60/30/10 and ignores factory complexity',
  'population buy orders use real escrow and refund price improvement and cancellation',
  'stabilization budget refills wallet gaps with a capped three-cycle target',
  'five consumption states use the authoritative food and household budget shares',
  'five consumption states expose complete food and household class shares',
  'population enters prosperous and lavish only after sustained qualification',
  'a single income spike does not immediately create prosperity and peak follows EMA',
  'lavish and prosperous states use two-cycle downgrade grace',
  'income stress downgrades immediately and two zero-income cycles enter subsistence',
  'consumption state changes allocation but not the spendable budget formula',
  'version 3 cautious state migrates to strained without reissuing bootstrap funds',
]) assert.ok(populationTests.includes(text), '人口经济测试缺少: ' + text);

const liquidityTests = read('server/test/market-liquidity.test.js');
for (const text of [
  'system liquidity asks reprice above retained consumption bids instead of crossing',
  'selling to a reserve transfers reserve funds and does not count as consumption issuance',
  'buying from a reserve transfers real inventory and returns credits to the reserve',
]) assert.ok(liquidityTests.includes(text), '储备测试缺少: ' + text);

for (const [path, texts] of [
  ['README.md', ['市场需求模型版本：`10`', '三类人口使用真实余额', '奢靡、繁荣、正常、拮据、生存五档', '稳定需求补充', '人口消费成交不再发行普通货币', '双向报价锚点']],
  ['docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', ['市场需求模型版本：10', '三类人口账户', '`lavish` 奢靡', '自动稳定补充发生前', '状态只重新分配同一周期预算', '真实冻结资金', '稳定需求补充', '三周期目标钱包', '双向报价锚点']],
  ['docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', ['市场需求模型版本：10', '`populationModelId`', '`fundingPool`', '真实人口冻结资金', '双向报价锚点']],
  ['docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', ['population-economy.js', '人口经济内部版本固定为 4', '五档状态只重新分配食品／家庭与类别份额', '市场需求模型 10', '人口消费不得发行普通货币']],
  ['src/api/admin.ts', ["'lavish' | 'prosperous' | 'normal' | 'strained' | 'subsistence'", 'stateCycles', 'incomeHealthBps', 'walletCoverageBps', 'incomeCoverageBps', 'stabilizationBudget', 'lastStabilizationIssued', 'stabilization: number']],
  ['src/components/AdminPopulationHealth.tsx', ['累计稳定需求补充', '累计管理员人口补充', '稳定预算／自动补充']],
  ['src/components/AdminOverview.tsx', ['AdminPopulationControl']],
  ['tests/browser/admin-runtime.spec.ts', ["consumptionState: 'lavish'", "consumptionState: 'prosperous'", "consumptionState: 'strained'", '状态判定指标', 'stabilization: 684', 'adminPopulation: 0', '累计稳定需求补充', '累计管理员人口补充', '稳定预算／自动补充', '人口政策调控']],
]) {
  const content = read(path);
  for (const text of texts) assert.ok(content.includes(text), path + ' 缺少: ' + text);
}

console.log('市场需求验证通过：模型 10 使用真实人口钱包覆盖全部 31 种商品，并保持双向直接需求报价、既有总预算、派生流动性和市场储备约束。');

const populationPolicy = read('server/src/population-policy.js');
const populationControl = read('server/src/population-admin-control.js');
const runtimeStore = read('server/src/runtime-store.js');
const serverApp = read('server/src/app.js');
const adminPopulationUi = read('src/components/AdminPopulationControl.tsx');
for (const required of [
  'POPULATION_POLICY_DEFAULTS',
  'stabilizationShareBps: 1_200',
  'targetWalletCycles: 3',
  'refillCapBps: 10_000',
  'durationCycles: Object.freeze({ min: 1 })',
  'validatePopulationPolicyCapacity',
  'safeMultiplyDivideFloor',
]) {
  if (!populationPolicy.includes(required)) throw new Error(`人口政策默认值或安全边界缺失: ${required}`);
}
for (const forbidden of ['max: 2_000', 'max: 5', 'max: 15_000', 'max: 288', 'noteLength', 'normalizePopulationAdminNote']) {
  assert.equal(populationPolicy.includes(forbidden), false, `人口政策不得恢复业务上限或管理备注: ${forbidden}`);
}
for (const required of [
  'topUpPopulationByPolicy',
  'policyCycle.issuedByModel',
  'state.stats.adminPopulationIssued',
  'populationPolicyWalletTarget',
]) {
  if (!populationControl.includes(required)) throw new Error(`人口主动调控约束缺失: ${required}`);
}
for (const required of [
  'class EconomyStore extends PersistentEconomyStore',
  'updatePopulationPolicy',
  'resetPopulationPolicy',
  'topUpPopulation',
]) {
  if (!runtimeStore.includes(required)) throw new Error(`运行时人口政策存储缺失: ${required}`);
}
assert.ok(serverApp.includes("from './runtime-store.js'"), '生产服务必须使用不写入人口调控记录的运行时存储');
assert.equal(serverApp.includes('/population-economy/audit'), false, '人口调控记录接口不得恢复');
for (const required of [
  '人口政策调控',
  '当前政策',
  '基础／技术／专业人口倍率',
  '总持续时间',
  '按当前政策立即补充',
  '参数不设业务上限',
]) {
  if (!adminPopulationUi.includes(required)) throw new Error(`管理员人口调控界面缺失: ${required}`);
}
for (const forbidden of ['管理备注', '人口调控记录', 'populationPolicyAudit', 'max={20}', 'max={150}', 'max={288}']) {
  assert.equal(adminPopulationUi.includes(forbidden), false, `管理员人口政策界面不得恢复: ${forbidden}`);
}
