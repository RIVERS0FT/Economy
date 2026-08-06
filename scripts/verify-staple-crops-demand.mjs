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
assert.equal(PRODUCT_CATALOG.length, 36);
assert.equal(MARKET_DEMAND_MODEL_VERSION, 17);
assert.deepEqual(MARKET_DEMAND_GROUP_CATALOG.map((group) => group.id), ['food', 'household']);
assert.deepEqual(MARKET_DEMAND_GROUP_CATALOG.map((group) => group.ownerName), ['食品市场需求', '家庭消费市场需求']);
assert.deepEqual(MARKET_DEMAND_GROUP_CATALOG.map((group) => group.name), ['食品市场', '社会消费市场']);
assert.equal(MARKET_DEMAND_GROUP_CATALOG.reduce((sum, group) => sum + group.baseBudget, 0), 5_700);
assert.equal(MARKET_DEMAND_GROUP_CATALOG.find((group) => group.id === 'food').baseBudget, 3_000);
assert.equal(MARKET_DEMAND_GROUP_CATALOG.find((group) => group.id === 'household').baseBudget, 2_700);
assert.deepEqual([...MARKET_DEMAND_PRODUCT_IDS].sort(), [...products.keys()].sort());

const productGroups = new Map();
for (const group of MARKET_DEMAND_GROUP_CATALOG) {
  let classBudgetShare = 0;
  for (const demandClass of group.classes) {
    classBudgetShare += demandClass.budgetShare;
    assert.ok(demandClass.minBudgetShare <= demandClass.budgetShare);
    assert.ok(demandClass.budgetShare <= demandClass.maxBudgetShare);
    const optionWeight = demandClass.products.reduce((sum, option) => sum + option.baseWeight, 0);
    assert.ok(Math.abs(optionWeight - 1) < 1e-9, `${group.id}/${demandClass.id} 权重未归一`);
    const minimumShare = demandClass.products.reduce((sum, option) => sum + Number(option.minShare || 0), 0);
    assert.ok(minimumShare > 0 && minimumShare <= 1, `${group.id}/${demandClass.id} 最低份额总和无效`);
    for (const option of demandClass.products) {
      assert.ok(products.has(option.productId), `${option.productId} 不在正式目录`);
      assert.ok(option.baseWeight > 0);
      assert.ok(Number(option.minShare || 0) > 0);
      const groups = productGroups.get(option.productId) || new Set();
      groups.add(group.id);
      productGroups.set(option.productId, groups);
    }
  }
  assert.ok(Math.abs(classBudgetShare - 1) < 1e-9, `${group.id} 类别预算未归一`);
}

for (const product of PRODUCT_CATALOG) {
  assert.equal(product.marketDemandRole, 'direct', product.id);
  assert.equal(product.populationDemandGroupId, product.marketDemandGroupId, product.id);
  assert.equal(product.populationDemandTier, product.marketDemandTier, product.id);
  assert.equal(productGroups.get(product.id)?.size, 1, `${product.id} 必须且只能属于一个直接需求市场`);
  assert.equal(product.marketDemandGroupId, [...productGroups.get(product.id)][0], product.id);
}

const runtime = [
  'server/src/market-demand.js',
  'server/src/market-demand/allocation.js',
  'server/src/market-demand/state.js',
  'server/src/market-demand/price-transmission.js',
  'server/src/population-economy.js',
  'server/src/population-demographics.js',
  'server/src/population-policy.js',
  'server/src/facility-groups.js',
  'server/src/domain.js',
  'server/src/order-book-integrity.js',
].map(read).join('\n');
for (const text of [
  'MARKET_DEMAND_MODEL_VERSION = 17',
  'DIRECT_BUDGET_SHARE = 0.70',
  "POPULATION_MODEL_IDS = Object.freeze(['basic', 'skilled', 'professional'])",
  "POPULATION_CONSUMPTION_STATES = Object.freeze(['lavish', 'prosperous', 'normal', 'strained', 'subsistence'])",
  'POPULATION_ECONOMY_VERSION = 7',
  'POPULATION_DEMOGRAPHICS_VERSION = 2',
  'BASE_POPULATION = 1_000',
  'C1_CAPACITY_PER_FACTORY = 11',
  'ACTIVE_CAPACITY_EMA_BPS = 2_000',
  'MIGRATION_GAP_RATE_BPS = 200',
  'BASELINE_OCCUPANCY_BPS = 3_500',
  'BASELINE_DISPLACEMENT_BPS = 1_500',
  'POPULATION_POLICY_DEFAULTS',
  'populationPolicyValue',
  'STABILIZATION_HORIZON_CYCLES = 3',
  'DIRECT_BUDGET_SHARE',
  'DERIVED_BUDGET_SHARE',
  'PER_CAPITA_STABLE_BUDGET = 0.57',
  'STRUCTURE_ADJUSTMENT_RATE_BPS = 250',
  'EMPLOYMENT_DISTRIBUTION_BY_COMPLEXITY',
  'CONSTRUCTION_EMPLOYMENT_DISTRIBUTION',
  'function ensureEmploymentRemainders',
  'function settleConstructionEmployment',
  'function settleProductionEmployment',
  'function assessPopulationConsumptionState',
  'function derivePopulationBudgetSplit',
  'function populationPressureEvidence',
  'function directDemandTargetPrice',
  'function reserveTargetPrice',
  'function directAnchorCeiling',
  'function normalQuoteShareForTier',
  'function normalizePopulationEconomy',
  'function normalizePopulationDemographics',
  'function updatePopulationDemographics',
  'function estimatePopulationDemandBudget',
  'function computeEmploymentDiagnostics',
  'function calculateFacilityPopulationCapacity',
  'function schedulePopulationOrders',
  'fundingSlices',
  'stabilizationCredits',
  'migrationFlow',
  'populationModelId',
  'populationClass',
  'populationCount',
  'populationClassShareBps',
  'fundingPool',
  'ownerType: \'population\'',
  'openingDemandCredits',
  'openingDirectQuantity',
  'deriveConsumptionService',
  'rememberConsumptionService',
  'demandClassPressure',
  'demandClassPressureBps',
  'quoteAnchors',
  'directQuoteAnchors',
  'directOversupplyCycles',
  'directServiceRatesBps',
  'directQuoteRemainders',
  'derivedQuoteAnchors',
  'lastPressureSignals',
  'playerOnlyMarketActivityAt',
  'activityDecayFactor',
  'reserveQuantityForQuote',
  'limitReserveOrdersByValue',
  'demandTier: \'market-reserve\'',
  'reserveLiquidityForGroup',
  'const initialCredits = group.initialCredits',
  'releaseMarketDemandOrders',
  'releasePopulationOrders',
  'delete world.demandSystem',
  'delete migrated.demandSystem',
  'delete migrated.demandSystemVersion',
  'delete state.dailyBudgets',
  'delete state.dailyCredits',
  'delete state.initialCredits',
  'delete state.orderIds',
  'delete state.initialSeeded',
  'delete state.seedCredits',
  'delete state.reservedCredits',
  'delete state.reservedProducts',
  'delete state.remainderCredits',
  'delete state.remainderProducts',
  'delete state.totalCredits',
  'delete state.totalProducts',
  'delete state.lastFilledAt',
  'delete state.lastUnfilledAt',
  'delete state.lastUnfilledQuantity',
  'delete state.estimatedDemand',
  'delete state.estimatedSupply',
  'delete state.targetQuantity',
  'delete state.quoteQuantity',
  'delete state.maxQuantity',
  'delete state.minQuantity',
  'delete state.priceFloor',
  'delete state.priceCeiling',
  'delete state.priceStep',
  'delete state.inventoryTarget',
  'delete state.cashTarget',
  'delete state.recentTrades',
  'delete state.lastTradeAt',
  'delete state.volumeEma',
  'delete state.priceEma',
  'delete state.lastMarketPrice',
  'delete state.lastReferencePrice',
  'delete state.lastTargetPrice',
  'delete state.lastQuotePrice',
  'delete state.lastQuoteQuantity',
  'delete state.pendingQuantity',
  'delete state.fulfilledQuantity',
  'delete state.fillRate',
  'delete state.orderCount',
  'delete state.cycleCount',
  'delete state.lastCycleBudget',
  'delete state.cumulativeBudget',
  'delete state.cumulativeSpend',
  'delete state.lastCycleSpend',
  'delete state.lastCycleQuantity',
  'delete state.cumulativeQuantity',
  'delete state.lastCyclePrice',
  'delete state.priceHistory',
  'delete state.quantityHistory',
  'delete state.budgetHistory',
  'delete state.spendHistory',
  'delete state.serviceHistory',
  'delete state.pressureHistory',
  'delete state.lastUpdatedAt',
  'delete state.createdAt',
  'delete state.updatedAt',
  'delete state.metadata',
  'delete state.notes',
  'delete state.description',
  'delete state.label',
  'delete state.displayName',
  'delete state.ownerName',
  'delete state.ownerId',
  'delete state.ownerType',
  'delete state.productId',
  'delete state.groupId',
  'delete state.classId',
  'delete state.tierId',
  'delete state.modelId',
  'delete state.version',
]) assert.ok(runtime.includes(text), '运行时缺少: ' + text);

const populationTests = read('server/test/all-products-demand.test.js') + read('server/test/population-economy.test.js');
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
  'model 17 to 18 rebalance rebuilds system demand without losing population or reserve assets',
  'population model 6 migration refunds current model 17 escrow before rebuilding demand',
]) assert.ok(populationTests.includes(text), '人口经济测试缺少: ' + text);

const liquidityTests = read('server/test/market-liquidity.test.js');
for (const text of [
  'system liquidity asks reprice above retained consumption bids instead of crossing',
  'selling to a reserve transfers reserve funds and does not count as consumption issuance',
  'buying from a reserve transfers real inventory and returns credits to the reserve',
]) assert.ok(liquidityTests.includes(text), '储备测试缺少: ' + text);

for (const [path, texts] of [
  ['docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', ['市场需求模型版本：17', '单座 C1 工厂人口承载基数固定为 **11**', '每五分钟迁入剩余缺口的 **2%**', '实际人口 × 0.57', '三类人口账户', '`lavish` 奢靡', '自动稳定补充发生前', '状态只重新分配同一周期预算', '真实冻结资金', '稳定需求补充', '三周期目标钱包', '双向报价锚点', '上一锚点的 0.75%', '参考价缺口的 5%', '最多为参考价的 2%', '只恢复 2.5% 缺口', '当前报价锚点上追涨 0.5%']],
  ['docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', ['市场需求模型版本：17', '`populationModelId`', '`fundingPool`', '真实人口冻结资金', '双向报价锚点']],
  ['docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', ['population-economy.js', 'population-demographics.js', '人口经济内部版本固定为 7', '五档状态只重新分配食品／家庭与类别份额', '市场需求模型 17', '人口消费不得发行普通货币']],
  ['src/api/admin.ts', ["'lavish' | 'prosperous' | 'normal' | 'strained' | 'subsistence'", 'PopulationDemographicsAdminSummary', 'currentPopulation', 'targetPopulation', 'structuralCapacityByComplexity', 'laborForce', 'employed', 'unemployed', 'vacancies', 'perCapitaIncomeEma', 'stateCycles', 'incomeHealthBps', 'walletCoverageBps', 'incomeCoverageBps', 'stabilizationBudget', 'lastStabilizationIssued', 'stabilization: number']],
  ['src/components/AdminPopulationHealth.tsx', ['实际／目标人口', '结构人口承载', '活跃承载 EMA', '就业／失业／岗位缺口', '人均收入 EMA', '产业人口承载', '累计稳定需求补充', '累计管理员人口补充', '稳定预算／自动补充']],
  ['src/components/AdminPopulationSection.tsx', ['AdminPopulationControl']],
]) {
  const content = read(path);
  for (const text of texts) assert.ok(content.includes(text), path + ' 缺少: ' + text);
}

console.log('市场需求验证通过：模型 17 使用工厂承载驱动的实际人口与真实钱包覆盖全部 36 种商品，并保持双向报价、派生流动性和市场储备约束。');

const populationPolicy = read('server/src/population-policy.js');
const populationControl = read('server/src/population-admin-control.js');
const adminApi = read('server/src/admin-api.js');
const populationPolicyTest = read('server/test/population-policy.test.js');
const adminPopulationSource = read('src/components/AdminPopulationControl.tsx');
const adminPopulationStyles = read('src/styles/admin-population.css');
const adminPopulationBrowser = read('tests/browser/admin-population-control.spec.ts');
for (const text of [
  'function normalizePopulationPolicyValue',
  'Number.isSafeInteger(units)',
  'Math.abs(numeric) <= Number.MAX_SAFE_INTEGER',
  'function projectedPopulationBudget',
  'function projectedProductionWage',
  'assertSafeMoneyValue(total, \'人口需求预算\')',
  'assertSafeMoneyValue(scaledCost, \'人口工资系数\')',
]) assert.ok(populationPolicy.includes(text), `人口政策安全边界缺少 ${text}`);
for (const forbidden of [
  'maximum:',
  'MAX_DEMAND_MULTIPLIER_BPS',
  'MAX_STABILIZATION_MULTIPLIER_BPS',
  'MAX_PRODUCTION_WAGE_MULTIPLIER_BPS',
]) assert.equal(populationPolicy.includes(forbidden), false, `人口政策不得恢复业务上限: ${forbidden}`);
for (const text of [
  'createPopulationPolicyRevision',
  'world.revision = revision',
  'updatePopulationPolicy',
  'topUpPopulationWallets',
  'delete world.populationControlLog',
]) assert.ok(populationControl.includes(text), `人口政策运行时缺少 ${text}`);
for (const forbidden of [
  'controlLog',
  'adminNote',
  'operatorNote',
  '调控记录',
]) assert.equal(populationControl.includes(forbidden), false, `人口政策不得保存管理备注或记录: ${forbidden}`);
for (const text of [
  "action: 'updatePopulationPolicy'",
  "action: 'topUpPopulationWallets'",
  'request.body?.expectedRevision',
]) assert.ok(adminApi.includes(text), `管理员人口路由缺少 ${text}`);
for (const text of [
  'policy accepts values above former caps while preserving safe integer validation',
  'policy rejects only unsafe numeric results rather than fixed business maxima',
  'runtime population policy mutations are idempotent, accept values above former caps, and create no audit rows',
]) assert.ok(populationPolicyTest.includes(text), `人口政策测试缺少 ${text}`);
for (const text of [
  'updatePopulationPolicy',
  'topUpPopulationWallets',
  '需求预算系数',
  '稳定补充系数',
  '生产工资系数',
  '立即补充人口钱包',
]) assert.ok(adminPopulationSource.includes(text), `管理员人口控件缺少 ${text}`);
for (const forbidden of [
  'admin-population-control__log',
  '调控记录',
  '最近操作',
]) assert.equal(adminPopulationSource.includes(forbidden), false, `管理员人口控件不得恢复调控记录: ${forbidden}`);
assert.ok(adminPopulationStyles.includes('.admin-population-control__grid'));
assert.ok(adminPopulationBrowser.includes('管理员人口策略不要求备注且不显示调控记录'));

console.log('人口政策验证通过：参数无业务上限、结果范围安全校验、同周期约束、到期恢复、幂等和无备注无记录均已锁定。');
