import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  ALL_PRODUCTS_DEMAND_MODEL_VERSION,
  MARKET_DEMAND_MODEL_VERSION,
  MARKET_DEMAND_MODEL_VERSION_CURRENT,
  PRODUCT_CATALOG,
  STAPLE_CROP_PRODUCT_IDS,
} from '../server/src/market-demand/catalog.js';
import {
  consumptionStateByTier,
  resolveConsumptionShares,
} from '../server/src/population-demographics.js';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8').replace(/\r\n?/g, '\n');

assert.equal(MARKET_DEMAND_MODEL_VERSION, 20, 'current demand model version must be 20');
assert.equal(MARKET_DEMAND_MODEL_VERSION_CURRENT, 20, 'current demand model alias must be 20');
assert.equal(ALL_PRODUCTS_DEMAND_MODEL_VERSION, 20, 'all-products demand model must remain current');
assert.deepEqual(STAPLE_CROP_PRODUCT_IDS, ['wheat', 'rice', 'corn'], 'staple crop ids must stay wheat/rice/corn');
assert.equal(PRODUCT_CATALOG.length, 38, 'official product catalog must contain 38 products');

for (const tierId of ['basic', 'technical', 'professional']) {
  for (const state of ['lavish', 'prosperous', 'normal', 'strained', 'subsistence']) {
    const resolved = resolveConsumptionShares(tierId, state);
    assert.ok(resolved, `${tierId}/${state} must have consumption shares`);
    const foodTotal = Object.values(resolved.food || {}).reduce((sum, value) => sum + value, 0);
    const householdTotal = Object.values(resolved.household || {}).reduce((sum, value) => sum + value, 0);
    assert.equal(foodTotal, 100, `${tierId}/${state} food shares must sum to 100`);
    assert.equal(householdTotal, 100, `${tierId}/${state} household shares must sum to 100`);
  }
}
assert.equal(consumptionStateByTier('basic', 'lavish'), 'lavish');
assert.equal(consumptionStateByTier('technical', 'strained'), 'strained');
assert.equal(consumptionStateByTier('professional', 'subsistence'), 'subsistence');

const catalog = read('server/src/market-demand/catalog.js');
for (const text of [
  'MARKET_DEMAND_MODEL_VERSION = 20',
  'ALL_PRODUCTS_DEMAND_MODEL_VERSION = MARKET_DEMAND_MODEL_VERSION',
  'STAPLE_CROP_PRODUCT_IDS',
  'PRODUCT_CATALOG',
  '38',
]) assert.ok(catalog.includes(text), `需求目录缺少: ${text}`);

const economy = read('server/src/population-economy.js');
for (const text of [
  'STRUCTURAL_CAPACITY_PER_C1_FACILITY = 11',
  'BASELINE_POPULATION_TARGET_RATIO = 0.57',
  'POPULATION_MIGRATION_RATE = 0.02',
  'STABILIZATION_WALLET_TARGET_CYCLES = 3',
  'STABILIZATION_WALLET_GAP_CAP_CYCLES = 3',
  'populationTierAccounts',
  'populationStabilizationBudget',
  'lastStabilizationIssued',
]) assert.ok(economy.includes(text), `人口经济缺少: ${text}`);

const demographics = read('server/src/population-demographics.js');
for (const text of [
  "lavish: 'lavish'",
  "prosperous: 'prosperous'",
  "normal: 'normal'",
  "strained: 'strained'",
  "subsistence: 'subsistence'",
  'resolveConsumptionShares',
  'incomeHealthBps',
  'walletCoverageBps',
  'incomeCoverageBps',
]) assert.ok(demographics.includes(text), `人口状态缺少: ${text}`);

const demand = read('server/src/balanced-market.js');
for (const text of [
  'populationTierAccounts',
  'populationModelId',
  'fundingPool',
  'fundingSlices',
  'marketDemandModelVersion',
  'MARKET_DEMAND_MODEL_VERSION',
  'priceTransmission',
  'referencePrice',
  'liquidity',
]) assert.ok(demand.includes(text), `市场需求实现缺少: ${text}`);

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
for (const text of [
  'buildPopulationAdminSummary',
  'applyPopulationControl',
]) assert.ok(populationPolicy.includes(text) || populationControl.includes(text), `人口政策模块缺少: ${text}`);
for (const text of [
  'populationHealth',
  'populationDemographics',
]) assert.ok(runtimeStore.includes(text), `管理员人口投影缺少: ${text}`);
assert.ok(serverApp.includes('/api/admin/population'), '管理员人口 API 必须存在');
