import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  FACILITY_TYPE_CATALOG,
  MARKET_DEMAND_GROUP_CATALOG,
  MARKET_DEMAND_MODEL_VERSION,
  MARKET_DEMAND_PRODUCT_IDS,
  PRODUCT_CATALOG,
} from '../server/src/domain.js';
import {
  POPULATION_BASE_WORLD,
  POPULATION_C1_CAPACITY,
  POPULATION_COMPLEXITY_WEIGHTS_BPS,
  POPULATION_MIGRATION_IN_BPS,
  POPULATION_MIGRATION_OUT_BPS,
  POPULATION_STANDARD_BUDGET,
  POPULATION_STANDARD_POPULATION,
} from '../server/src/population-demographics.js';

const read = (path) => readFileSync(path, 'utf8');
const stateEconomicBaselines = JSON.parse(read('shared/us-state-economic-baselines.json'));
assert.equal(stateEconomicBaselines.version, 1);
assert.equal(stateEconomicBaselines.states.length, 48);
assert.equal(new Set(stateEconomicBaselines.states.map((row) => row.provinceId)).size, 48);
assert.equal(stateEconomicBaselines.sources.population.period, '2025-07-01');
assert.equal(stateEconomicBaselines.sources.wage.period, '2025-Q4');
assert.equal(stateEconomicBaselines.sources.consumption.period, '2023');
assert.deepEqual(
  stateEconomicBaselines.states.find((row) => row.provinceId === '110000'),
  { provinceId: '110000', state: 'California', shortName: 'CA', population: 39_355_309, averageWeeklyWage: 1_954, pceMillions: 2_526_290 },
);
const products = new Map(PRODUCT_CATALOG.map((product) => [product.id, product]));
assert.equal(PRODUCT_CATALOG.length, 38);
assert.equal(MARKET_DEMAND_MODEL_VERSION, 20);
assert.deepEqual(MARKET_DEMAND_GROUP_CATALOG.map((group) => group.id), ['food', 'household']);
assert.deepEqual(MARKET_DEMAND_GROUP_CATALOG.map((group) => group.ownerName), ['食品市场需求', '家庭消费市场需求']);
assert.deepEqual(MARKET_DEMAND_GROUP_CATALOG.map((group) => group.name), ['食品市场', '社会消费市场']);
assert.ok(MARKET_DEMAND_GROUP_CATALOG.every((group) => group.directBudgetShare === 0.70));

const groups = new Map(MARKET_DEMAND_GROUP_CATALOG.map((group) => [group.id, group]));
assert.deepEqual(groups.get('food').classes.map((item) => item.id), ['staples', 'protein', 'fresh-drinks', 'convenience']);
assert.deepEqual(groups.get('household').classes.map((item) => item.id), ['home', 'wear', 'daily', 'durables']);
assert.ok(groups.get('food').classes.find((item) => item.id === 'fresh-drinks').products.some((item) => item.productId === 'fruit'));
assert.ok(groups.get('household').classes.find((item) => item.id === 'durables').products.some((item) => item.productId === 'appliance'));
assert.ok(groups.get('household').classes.find((item) => item.id === 'daily').products.some((item) => item.productId === 'industrial-fuel'));
assert.ok(groups.get('household').classes.find((item) => item.id === 'daily').products.some((item) => item.productId === 'industrial-chemicals'));

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
assert.equal(POPULATION_BASE_WORLD, 1_000);
assert.equal(POPULATION_C1_CAPACITY, 11);
assert.equal(POPULATION_STANDARD_POPULATION, 10_000);
assert.equal(POPULATION_STANDARD_BUDGET, 5_700);
assert.equal(POPULATION_MIGRATION_IN_BPS, 200);
assert.equal(POPULATION_MIGRATION_OUT_BPS, 50);
assert.deepEqual(POPULATION_COMPLEXITY_WEIGHTS_BPS, { C1: 10_000, C2: 15_000, C3: 22_000, C4: 32_000, C5: 45_000, C6: 62_000, C7: 85_000 });

const runtime = [
  'server/src/population-economy.js',
  'server/src/population-demographics.js',
  'server/src/state-economic-baselines.js',
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
  'MARKET_DEMAND_MODEL_VERSION = 20',
  'MARKET_DEMAND_PRESERVE_STATE_FROM_VERSION = 20',
  'DIRECT_BUDGET_SHARE = 0.70',
  "POPULATION_MODEL_IDS = Object.freeze(['basic', 'skilled', 'professional'])",
  "POPULATION_CONSUMPTION_STATES = Object.freeze(['lavish', 'prosperous', 'normal', 'strained', 'subsistence'])",
  'POPULATION_ECONOMY_VERSION = 7',
  'POPULATION_BASE_WORLD = 1_000',
  'POPULATION_C1_CAPACITY = 11',
  'POPULATION_MIGRATION_IN_BPS = 200',
  'POPULATION_MIGRATION_OUT_BPS = 50',
  'POPULATION_CLASS_CONVERSION_BPS = 100',
  'POPULATION_LABOR_PARTICIPATION_BPS = 5_500',
  'populationReferenceBudget',
  'advancePopulationDemographics',
  'POPULATION_GROUP_SHARES_BY_STATE',
  'PROSPEROUS_ENTRY_CYCLES = 2',
  'LAVISH_ENTRY_CYCLES = 3',
  'UPPER_STATE_DOWNGRADE_CYCLES = 2',
  'model.recentPeakIncome = Math.max(model.incomeEma',
  "setConsumptionState(model, 'strained'",
  "setConsumptionState(model, 'subsistence'",
  "const CONSTRUCTION_PROFILE = Object.freeze({ basic: 0.60, skilled: 0.30, professional: 0.10 })",
  'preparePopulationDemandCycle',
  'populationDemandProvinceWeights',
  'lastProvinceBudgets',
  'populationClassShares',
  'reservePopulationOrder',
  'settlePopulationPurchase',
  'populationModelId',
  'fundingPool',
  'fundingSlices',
  'productBudgetDeficits',
  "direct: 'direct'",
  "'derived-liquidity': 'derived'",
  'marginalPropensityToConsume: 0.95',
  'marginalPropensityToConsume: 0.85',
  'marginalPropensityToConsume: 0.72',
  'LIQUIDITY_BASE_SPREAD = 0.08',
  'LIQUIDITY_MIN_SPREAD = 0.04',
  'LIQUIDITY_MAX_SPREAD = 0.24',
  'LIQUIDITY_TARGET_MAX_RISE = 0.50',
  'LIQUIDITY_TARGET_MAX_FALL = 0.25',
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
  'groupState.frozenCredits = roundMoney(groupState.frozenCredits + reservedCredits)',
  'reserve.frozenInventory += sellQuantity',
  "resting.ownerType === 'population' && incoming.ownerType === 'population'",
  'settleLiquidityBuy',
  'settleLiquiditySell',
  'matchIncomingOrder({',
  'SYSTEM_ORDER_RETENTION_RATE',
  'DEMAND_CURVE',
  'DIRECT_DEMAND_UNFILLED_PRICE_STEP = 1.0025',
  'DIRECT_DEMAND_UNFILLED_REFERENCE_GAP_RATE = 0.02',
  'DIRECT_DEMAND_BELOW_REFERENCE_RECOVERY_RATE = 0.01',
  'DIRECT_DEMAND_UNFILLED_REFERENCE_MAX_RATE = 0.0075',
  'DIRECT_DEMAND_SHORTAGE_PRICE_STEP = 1.0025',
  'DIRECT_DEMAND_PRICE_RECOVERY_RATE = 0.30',
  'DIRECT_DEMAND_OVERSUPPLY_PRICE_STEP = 0.98',
  'DIRECT_DEMAND_OVERSUPPLY_ENTRY_CYCLES = 2',
  'DIRECT_DEMAND_OVERSUPPLY_FILL_RATIO = 0.95',
  'DIRECT_DEMAND_OVERSUPPLY_DELAY_SCORE = 0.85',
  'DIRECT_DEMAND_MIN_PRICE = 0.01',
  'directQuoteAnchors',
  'requiresDemandRebuild',
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
for (const forbidden of ['DEMAND_INVENTORY_BOOST_RATE', 'stockSnapshot.totalValue', 'inventoryFactor', 'playerScaleBudget * tradeActivityFactor', 'totalPopulationBaseBudget']) {
  assert.equal(runtime.includes(forbidden), false, '人口需求不得恢复库存或活跃玩家增发预算: ' + forbidden);
}
const marketSignalSource = read('server/src/market-demand/signals.js');
for (const text of ['playerSellQuantity', 'market?.officialPrice', 'available / targetDepth']) {
  assert.ok(marketSignalSource.includes(text), '人口需求即时市场信号缺少: ' + text);
}
assert.equal(marketSignalSource.includes('iterateOrderBookSide'), false, '人口需求即时市场信号不得扫描玩家开放卖单');
assert.equal(marketSignalSource.includes('recordOrderBookVisit'), false, '人口需求即时市场信号不得伪装成盘口访问');

const domain = read('server/src/domain.js');
for (const text of [
  'buildMarketDemandMetadata',
  'reachableGroups',
  'MARKET_DEMAND_MODEL_VERSION',
  'marketDemand.initializeWorld',
  'marketDemand.normalizeWorld',
  'marketDemand.process',
  'ensurePopulationEconomy',
  'world.version = 32',
]) assert.ok(domain.includes(text), 'domain.js 缺少: ' + text);
for (const forbidden of [
  'balancedMarket.matchOrder(world, incoming, now)',
  'reconcileCommodityOrderBook',
]) assert.equal(domain.includes(forbidden), false, `玩家 domain 不得恢复旧统一商品挂单路径: ${forbidden}`);

const facilities = new Map(FACILITY_TYPE_CATALOG.map((facility) => [facility.id, facility]));
const standardRecipes = (facility) => facility.recipes.filter((recipe) => (
  recipe.productionMethodId === facility.productionMethodGroups[0].defaultMethodId
));
assert.deepEqual(standardRecipes(facilities.get('beverage-factory')).map((recipe) => recipe.inputs), [
  [{ productId: 'sugar', quantity: 1 }, { productId: 'milk', quantity: 1 }],
  [{ productId: 'fruit', quantity: 2 }, { productId: 'sugar', quantity: 1 }],
]);
assert.deepEqual(standardRecipes(facilities.get('appliance-factory'))[0].inputs, [
  { productId: 'machinery', quantity: 1 }, { productId: 'electronics', quantity: 1 },
]);

const stateBaselineTests = read('server/test/state-economic-baselines.test.js');
for (const text of [
  'official state economic baseline covers every contiguous state with explicit source periods',
  'population demand uses PCE weights to create state-local orders without duplicating wallet budget',
]) assert.ok(stateBaselineTests.includes(text), '州级人口经济测试缺少: ' + text);

const domainDemandTests = read('server/test/domain.test.js');
for (const text of [
  'consumer substitutes shift demand toward the cheaper grain without changing total budget',
  'complement gating prioritizes the bottleneck input for electronics',
]) assert.ok(domainDemandTests.includes(text), '人口需求即时市场回归缺少: ' + text);
const marketDemandTests = read('server/test/market-demand-v6.test.js');
for (const text of [
  'direct demand quote anchor accumulates fractional no-fill increases and recovers after service',
  'sustained fast full service lowers all direct demand tiers below reference price',
  'direct demand quote anchor stops at one cent',
  'zero fill below reference recovers slowly while partial service recovers more gently',
  'no direct demand converges toward reference and derived liquidity ignores a low direct anchor',
  'shortage pressure approaches the reference premium by at most a quarter percent per cycle',
  'market model 20 rebuilds model 19 population demand escrow but preserves player orders',
]) assert.ok(marketDemandTests.includes(text), '市场需求测试缺少模型 19 回归: ' + text);

const populationTests = read('server/test/population-economy.test.js')
  + read('server/test/population-demographics.test.js')
  + read('server/test/all-products-demand.test.js');
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
  'version 3 cautious state migrates to version 5 strained without reissuing bootstrap funds',
  'one C1 factory adds exactly eleven structural capacity and transfer keeps world capacity',
  'population migration is directional, bounded, and idempotent within one cycle',
  'dynamic stabilization budget follows actual population and preserves wallet-gap cap',
  'model 17 to current rebalance rebuilds system demand without losing population or reserve assets',
  'population model 6 migration refunds current demand escrow before rebuilding demand',
]) assert.ok(populationTests.includes(text), '人口经济测试缺少: ' + text);

const liquidityTests = read('server/test/market-liquidity.test.js');
for (const text of [
  'market model 19 creates inventory-backed buy and sell orders without system self-trades',
  'system liquidity asks reprice above retained consumption bids instead of crossing',
  'player immediate selling does not consume an internal reserve bid',
  'player immediate buying does not consume an internal reserve ask',
]) assert.ok(liquidityTests.includes(text), '储备测试缺少: ' + text);

for (const [path, texts] of [
  ['docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', ['最近 30 分钟真实玩家向官方系统完成的卖出数量', '同州当日 `officialPrice`']],
  ['docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', ['内部可执行供给信号', '最近 30 分钟真实玩家向官方系统完成的卖出数量', '同州当日 `officialPrice`']],
  ['docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', ['内部需求规划不得再扫描玩家开放卖单', '最近 30 分钟真实玩家向官方系统完成的卖出数量', '同州当前 `officialPrice`']],
]) {
  const source = read(path);
  for (const text of texts) assert.ok(source.includes(text), `${path} 缺少即时市场人口需求规则: ${text}`);
}
for (const [path, texts] of [
  ['docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', ['市场需求模型版本：20', '38 种正式商品', '单座 C1 工厂人口承载基数固定为 **11**', '每五分钟迁入剩余缺口的 **2%**', '实际人口 × 0.57', '三类人口账户', '`lavish` 奢靡', '自动稳定补充发生前', '状态只重新分配同一周期预算', '真实冻结资金', '稳定需求补充', '三周期目标钱包', '双向报价锚点', '上一锚点的 0.25%', '参考价缺口的 2%', '最多为参考价的 0.75%', '只恢复 1% 缺口', '当前报价锚点上追涨 0.25%']],
  ['docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', ['服务器内部人口与储备订单', '`populationModelId`', '`fundingPool`', '内部订单字段只服务服务器模拟和审计', '玩家即时商品交易不得经过该共享撮合内核']],
  ['docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', ['population-economy.js', 'population-demographics.js', '人口经济内部版本固定为 7', '五档状态只重新分配食品／家庭与类别份额', '人口消费不得发行普通货币']],
  ['src/api/admin.ts', ["'lavish' | 'prosperous' | 'normal' | 'strained' | 'subsistence'", 'PopulationDemographicsAdminSummary', 'currentPopulation', 'targetPopulation', 'structuralCapacityByComplexity', 'laborForce', 'employed', 'unemployed', 'vacancies', 'perCapitaIncomeEma', 'stateCycles', 'incomeHealthBps', 'walletCoverageBps', 'incomeCoverageBps', 'stabilizationBudget', 'lastStabilizationIssued', 'stabilization: number']],
  ['src/components/AdminPopulationHealth.tsx', ['实际／目标人口', '结构人口承载', '活跃承载 EMA', '就业／失业／岗位缺口', '人均收入 EMA', '产业人口承载', '累计稳定需求补充', '累计管理员人口补充', '稳定预算／自动补充']],
  ['src/components/AdminPopulationSection.tsx', ['AdminPopulationControl']],
  ['tests/browser/admin-runtime.spec.ts', ["consumptionState: 'lavish'", "consumptionState: 'prosperous'", "consumptionState: 'strained'", '状态判定指标', 'stabilization: 684', 'adminPopulation: 0', '累计稳定需求补充', '累计管理员人口补充', '稳定预算／自动补充', '人口政策调控']],
]) {
  const content = read(path);
  for (const text of texts) assert.ok(content.includes(text), path + ' 缺少: ' + text);
}

console.log('市场需求验证通过：模型 20 使用工厂承载驱动的实际人口与真实钱包覆盖全部 38 种商品，并按州级 PCE 权重生成本地需求；共享撮合只服务服务器内部人口／储备模拟，玩家商品交易保持每日系统价即时成交。');

const populationPolicy = read('server/src/population-policy.js');
const populationControl = read('server/src/population-admin-control.js');
const runtimeStore = `${read('server/src/runtime-store-core.js')}\n${read('server/src/runtime-store.js')}`;
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
