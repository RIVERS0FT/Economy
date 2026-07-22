from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT / path).read_text(encoding='utf-8')


def write(path, content):
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding='utf-8')


def replace_required(path, old, new):
    content = read(path)
    if old not in content:
        raise RuntimeError(f'{path}: required text not found:\n{old[:240]}')
    write(path, content.replace(old, new))


catalog = r'''const freezeOptions = (options) => Object.freeze(options.map((option) => Object.freeze(option)));
const freezeClasses = (classes) => Object.freeze(classes.map((demandClass) => Object.freeze({
  ...demandClass,
  products: freezeOptions(demandClass.products),
})));

export const MARKET_DEMAND_MODEL_VERSION = 9;
export const PRICE_WINDOW_MS = 30 * 60 * 1000;
export const ACTIVITY_WINDOW_MS = 24 * 60 * 60 * 1000;
export const ACTIVE_PLAYER_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const PLAYER_SCALE_MAX = 6;
export const BUDGET_SMOOTHING = 0.35;
export const BUDGET_MAX_RISE = 0.12;
export const BUDGET_MAX_FALL = 0.15;
export const SHARE_SMOOTHING = 0.30;
export const SHARE_MAX_CHANGE = 0.15;
export const DIRECT_BUDGET_SHARE = 0.70;
export const SYSTEM_ORDER_RETENTION_RATE = 0.35;
export const SYSTEM_ORDER_VALUE_CYCLES = 2.5;
export const PRODUCT_ORDER_VALUE_CYCLES = 1.5;
export const SYSTEM_ORDER_MAX_AGE_CYCLES = 2;
export const DEMAND_CURVE = Object.freeze([
  Object.freeze({ weight: 0.50, multiplier: 1.00 }),
  Object.freeze({ weight: 0.30, multiplier: 0.97 }),
  Object.freeze({ weight: 0.20, multiplier: 0.93 }),
]);
export const DEMAND_CURVE_SHORTAGE_MULTIPLIER = 1.03;
export const PRODUCT_PRESSURE_SMOOTHING = 0.30;
export const PRODUCT_PRESSURE_MIN = 0.75;
export const PRODUCT_PRESSURE_MAX = 1.35;
export const PRODUCT_PRESSURE_ACTIVE_IMBALANCE_WEIGHT = 0.08;
export const PRODUCT_PRESSURE_SUPPLY_RELIEF_WEIGHT = 0.10;
export const PRODUCT_PRESSURE_EVIDENCE_TARGET = 8;
export const DERIVED_UNMET_WEIGHT = 0.50;
export const DERIVED_BACKLOG_WEIGHT = 0.15;
export const RELATION_LAG_WEIGHTS = Object.freeze([0.60, 0.30, 0.10]);
export const PRICE_MIN_MULTIPLIER = 0.5;
export const PRICE_MAX_MULTIPLIER = 3;
export const PRICE_RISE_RATE = 0.30;
export const PRICE_FALL_RATE = 0.20;
export const PRICE_BASE_REVERSION = 0.02;
export const LIQUIDITY_BASE_SPREAD = 0.08;
export const LIQUIDITY_MIN_SPREAD = 0.04;
export const LIQUIDITY_MAX_SPREAD = 0.24;
export const LIQUIDITY_INVENTORY_SKEW = 0.10;
export const LIQUIDITY_QUOTE_BUDGET_SHARE = 0.25;
export const LIQUIDITY_MIN_QUOTE_BUDGET_SHARE = 0.05;
export const LIQUIDITY_TRADE_SHARE = 0.25;
export const LIQUIDITY_MIN_TARGET = 2;
export const LIQUIDITY_MAX_TARGET = 30;
export const LIQUIDITY_SIGNAL_WEIGHT = 0.50;

export const MARKET_DEMAND_GROUP_CATALOG = Object.freeze([
  Object.freeze({
    id: 'food',
    name: '食品市场',
    ownerName: '食品市场需求',
    cycleMs: 5 * 60 * 1000,
    baseBudget: 3_000,
    targetSatisfaction: 0.82,
    directBudgetShare: DIRECT_BUDGET_SHARE,
    quoteUtilityDepth: 12,
    classes: freezeClasses([
      {
        id: 'staples', name: '主食', budgetShare: 0.40, minBudgetShare: 0.30, maxBudgetShare: 0.55,
        elasticity: 1.8,
        products: [
          { productId: 'wheat', baseWeight: 0.25, utilityPerUnit: 1, minShare: 0.08 },
          { productId: 'rice', baseWeight: 0.25, utilityPerUnit: 1, minShare: 0.08 },
          { productId: 'flour', baseWeight: 0.20, utilityPerUnit: 2, minShare: 0.05 },
          { productId: 'food', baseWeight: 0.30, utilityPerUnit: 3, minShare: 0.10 },
        ],
      },
      {
        id: 'protein', name: '蛋白质', budgetShare: 0.30, minBudgetShare: 0.20, maxBudgetShare: 0.45,
        elasticity: 2.3,
        products: [
          { productId: 'meat', baseWeight: 0.32, utilityPerUnit: 2, minShare: 0.08 },
          { productId: 'eggs', baseWeight: 0.23, utilityPerUnit: 1, minShare: 0.08 },
          { productId: 'milk', baseWeight: 0.20, utilityPerUnit: 1, minShare: 0.08 },
          { productId: 'fish', baseWeight: 0.25, utilityPerUnit: 2, minShare: 0.08 },
        ],
      },
      {
        id: 'fresh-drinks', name: '新鲜与饮品', budgetShare: 0.15, minBudgetShare: 0.08, maxBudgetShare: 0.25,
        elasticity: 1.4,
        products: [
          { productId: 'fruit', baseWeight: 0.45, utilityPerUnit: 1, minShare: 0.20 },
          { productId: 'milk', baseWeight: 0.20, utilityPerUnit: 1, minShare: 0.10 },
          { productId: 'beverage', baseWeight: 0.35, utilityPerUnit: 2, minShare: 0.15 },
        ],
      },
      {
        id: 'convenience', name: '便利食品与糖类', budgetShare: 0.15, minBudgetShare: 0.08, maxBudgetShare: 0.30,
        elasticity: 0.8,
        products: [
          { productId: 'food', baseWeight: 0.30, utilityPerUnit: 3, minShare: 0.12 },
          { productId: 'prepared-meal', baseWeight: 0.35, utilityPerUnit: 3, minShare: 0.12 },
          { productId: 'sugarcane', baseWeight: 0.15, utilityPerUnit: 1, minShare: 0.05 },
          { productId: 'sugar', baseWeight: 0.20, utilityPerUnit: 2, minShare: 0.08 },
        ],
      },
    ]),
    seedDemandQuantities: Object.freeze({
      wheat: 14, rice: 14, food: 10, meat: 4, eggs: 7, milk: 7, flour: 5,
      fruit: 8, fish: 5, beverage: 5, 'prepared-meal': 4, sugarcane: 8, sugar: 3,
    }),
  }),
  Object.freeze({
    id: 'household',
    name: '社会消费市场',
    ownerName: '家庭消费市场需求',
    cycleMs: 5 * 60 * 1000,
    baseBudget: 2_700,
    targetSatisfaction: 0.78,
    directBudgetShare: DIRECT_BUDGET_SHARE,
    quoteUtilityDepth: 8,
    classes: freezeClasses([
      {
        id: 'home', name: '木材、纸品与家居', budgetShare: 0.25, minBudgetShare: 0.15, maxBudgetShare: 0.40,
        elasticity: 0.4,
        products: [
          { productId: 'timber', baseWeight: 0.20, utilityPerUnit: 1, minShare: 0.05 },
          { productId: 'lumber', baseWeight: 0.20, utilityPerUnit: 2, minShare: 0.05 },
          { productId: 'pulp', baseWeight: 0.15, utilityPerUnit: 2, minShare: 0.04 },
          { productId: 'furniture', baseWeight: 0.45, utilityPerUnit: 3, minShare: 0.12 },
        ],
      },
      {
        id: 'wear', name: '穿着与纺织', budgetShare: 0.25, minBudgetShare: 0.15, maxBudgetShare: 0.40,
        elasticity: 0.4,
        products: [
          { productId: 'cotton', baseWeight: 0.15, utilityPerUnit: 1, minShare: 0.05 },
          { productId: 'wool', baseWeight: 0.15, utilityPerUnit: 1, minShare: 0.05 },
          { productId: 'textile', baseWeight: 0.25, utilityPerUnit: 2, minShare: 0.08 },
          { productId: 'clothing', baseWeight: 0.45, utilityPerUnit: 3, minShare: 0.12 },
        ],
      },
      {
        id: 'daily', name: '能源、包装与日用消耗', budgetShare: 0.20, minBudgetShare: 0.10, maxBudgetShare: 0.35,
        elasticity: 0.9,
        products: [
          { productId: 'paper', baseWeight: 0.45, utilityPerUnit: 2, minShare: 0.15 },
          { productId: 'crude-oil', baseWeight: 0.20, utilityPerUnit: 1, minShare: 0.05 },
          { productId: 'plastic', baseWeight: 0.35, utilityPerUnit: 2, minShare: 0.10 },
        ],
      },
      {
        id: 'durables', name: '金属建设与耐用品', budgetShare: 0.30, minBudgetShare: 0.15, maxBudgetShare: 0.50,
        elasticity: 0.6,
        products: [
          { productId: 'ore', baseWeight: 0.08, utilityPerUnit: 1, minShare: 0.03 },
          { productId: 'copper-ore', baseWeight: 0.08, utilityPerUnit: 1, minShare: 0.03 },
          { productId: 'steel', baseWeight: 0.12, utilityPerUnit: 2, minShare: 0.04 },
          { productId: 'copper', baseWeight: 0.12, utilityPerUnit: 2, minShare: 0.04 },
          { productId: 'machinery', baseWeight: 0.18, utilityPerUnit: 3, minShare: 0.06 },
          { productId: 'electronics', baseWeight: 0.18, utilityPerUnit: 3, minShare: 0.06 },
          { productId: 'appliance', baseWeight: 0.24, utilityPerUnit: 4, minShare: 0.08 },
        ],
      },
    ]),
    seedDemandQuantities: Object.freeze({
      timber: 6, lumber: 3, pulp: 3, furniture: 7,
      cotton: 8, wool: 4, textile: 3, clothing: 5,
      paper: 7, 'crude-oil': 4, plastic: 3,
      ore: 5, 'copper-ore': 5, steel: 2, copper: 2, machinery: 1, electronics: 4, appliance: 3,
    }),
  }),
]);

export const MARKET_DEMAND_PRODUCT_IDS = Object.freeze([...new Set(
  MARKET_DEMAND_GROUP_CATALOG.flatMap((group) => group.classes.flatMap((demandClass) => (
    demandClass.products.map((option) => option.productId)
  ))),
)]);
'''
write('server/src/market-demand/catalog.js', catalog)

replace_required(
    'server/src/domain.js',
    "import { ensurePopulationEconomy } from './population-economy.js';",
    "import { ensurePopulationEconomy, releasePopulationOrderFunds } from './population-economy.js';",
)
replace_required(
    'server/src/domain.js',
    """  const migrated = core.migrateWorld(world, now);\n  balancedMarket.repairMissingMarkets(migrated, existingMarketIds, now, legacy);\n  migrated.orders = (migrated.orders || []).filter((order) => {""",
    """  const migrated = core.migrateWorld(world, now);\n  balancedMarket.repairMissingMarkets(migrated, existingMarketIds, now, legacy);\n  if (!hadCurrentMarketDemandModel) {\n    ensurePopulationEconomy(migrated, now);\n    for (const order of migrated.orders || []) {\n      if (order.ownerType !== 'population' || !balancedMarket.isOpenOrder(order)) continue;\n      if (order.demandTier !== 'direct' && order.demandTier !== 'derived-liquidity') continue;\n      releasePopulationOrderFunds(migrated, order);\n    }\n  }\n  migrated.orders = (migrated.orders || []).filter((order) => {""",
)

liquidity_test = read('server/test/market-liquidity.test.js')
liquidity_test = liquidity_test.replace('market model 8 creates', 'market model 9 creates')
liquidity_test = liquidity_test.replace('model 3 migrates directly to model 8', 'model 3 migrates directly to model 9')
liquidity_test = liquidity_test.replace('model 5 migrates to model 8', 'model 5 migrates to model 9')
liquidity_test = liquidity_test.replace('MARKET_DEMAND_MODEL_VERSION, 8', 'MARKET_DEMAND_MODEL_VERSION, 9')
liquidity_test = liquidity_test.replace('world.marketDemand.modelVersion, 8', 'world.marketDemand.modelVersion, 9')
write('server/test/market-liquidity.test.js', liquidity_test)

new_test = r'''import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createWorld,
  ensurePlayer,
  MARKET_DEMAND_GROUP_CATALOG,
  MARKET_DEMAND_MODEL_VERSION,
  MARKET_DEMAND_PRODUCT_IDS,
  migrateWorld,
  processWorld,
  PRODUCT_CATALOG,
} from '../src/domain.js';

const now = 1_700_000_000_000;
const cycleMs = 5 * 60 * 1000;
const alice = { id: 1, email: 'alice@example.com', name: 'Alice' };

test('market demand model 9 gives every product direct terminal demand', () => {
  assert.equal(MARKET_DEMAND_MODEL_VERSION, 9);
  assert.equal(MARKET_DEMAND_GROUP_CATALOG.reduce((sum, group) => sum + group.baseBudget, 0), 5_700);
  assert.equal(MARKET_DEMAND_GROUP_CATALOG.find((group) => group.id === 'household')?.name, '社会消费市场');

  const catalogIds = PRODUCT_CATALOG.map((product) => product.id).sort();
  const directIds = [...MARKET_DEMAND_PRODUCT_IDS].sort();
  assert.deepEqual(directIds, catalogIds);

  const groupsByProduct = new Map();
  for (const group of MARKET_DEMAND_GROUP_CATALOG) {
    for (const demandClass of group.classes) {
      const minimumTotal = demandClass.products.reduce((sum, option) => sum + Number(option.minShare || 0), 0);
      assert.ok(minimumTotal > 0 && minimumTotal <= 1, `${group.id}/${demandClass.id} 最低份额必须有效`);
      for (const option of demandClass.products) {
        assert.ok(Number(option.minShare || 0) > 0, `${option.productId} 必须有最低直接需求份额`);
        const groups = groupsByProduct.get(option.productId) || new Set();
        groups.add(group.id);
        groupsByProduct.set(option.productId, groups);
      }
    }
  }

  for (const product of PRODUCT_CATALOG) {
    assert.equal(product.marketDemandRole, 'direct', product.id);
    assert.equal(groupsByProduct.get(product.id)?.size, 1, `${product.id} 必须且只能属于一个直接需求市场`);
    assert.equal(product.marketDemandGroupId, [...groupsByProduct.get(product.id)][0], product.id);
  }
});

test('model 8 migration refunds population escrow before model 9 rebuild', () => {
  const world = createWorld(now);
  ensurePlayer(world, alice, now);
  for (const state of Object.values(world.demandGroups)) {
    state.nextDemandAt = now;
    state.lastCycleId = Math.floor(now / cycleMs) - 1;
  }
  processWorld(world, now + 1);

  const openConsumptionOrders = world.orders.filter((order) => (
    order.ownerType === 'population'
    && (order.demandTier === 'direct' || order.demandTier === 'derived-liquidity')
    && order.remaining > 0
    && (order.status === 'open' || order.status === 'partial')
  ));
  assert.ok(openConsumptionOrders.length > 0);
  const oldOrderIds = new Set(openConsumptionOrders.map((order) => order.id));
  const totalsBefore = Object.fromEntries(Object.entries(world.populationEconomy.models).map(([id, model]) => [
    id,
    model.credits + model.frozenCredits,
  ]));

  world.marketDemand.modelVersion = 8;
  migrateWorld(world, now + 2);

  assert.equal(world.marketDemand.modelVersion, 9);
  assert.equal(world.orders.some((order) => oldOrderIds.has(order.id)), false);
  for (const [id, model] of Object.entries(world.populationEconomy.models)) {
    assert.equal(model.frozenCredits, 0, id);
    assert.equal(model.credits, totalsBefore[id], id);
  }
});
'''
write('server/test/all-products-demand.test.js', new_test)

verify_path = 'scripts/verify-staple-crops-demand.mjs'
verify = read(verify_path)
verify = verify.replace('assert.equal(MARKET_DEMAND_MODEL_VERSION, 8);', 'assert.equal(MARKET_DEMAND_MODEL_VERSION, 9);')
verify = verify.replace("assert.deepEqual(MARKET_DEMAND_GROUP_CATALOG.map((group) => group.ownerName), ['食品市场需求', '家庭消费市场需求']);", "assert.deepEqual(MARKET_DEMAND_GROUP_CATALOG.map((group) => group.ownerName), ['食品市场需求', '家庭消费市场需求']);\nassert.deepEqual(MARKET_DEMAND_GROUP_CATALOG.map((group) => group.name), ['食品市场', '社会消费市场']);")
old_direct_block = """for (const id of ['wheat', 'rice', 'flour', 'food', 'meat', 'eggs', 'milk', 'fruit', 'fish', 'beverage', 'prepared-meal']) {\n  assert.equal(products.get(id)?.marketDemandGroupId, 'food', id);\n  assert.equal(products.get(id)?.marketDemandRole, 'direct', id);\n}\nfor (const id of ['furniture', 'clothing', 'electronics', 'paper', 'appliance']) {\n  assert.equal(products.get(id)?.marketDemandGroupId, 'household', id);\n  assert.equal(products.get(id)?.marketDemandRole, 'direct', id);\n}\nassert.ok(MARKET_DEMAND_PRODUCT_IDS.includes('fruit'));\nassert.ok(MARKET_DEMAND_PRODUCT_IDS.includes('appliance'));\nassert.equal(MARKET_DEMAND_PRODUCT_IDS.includes('sugar'), false);"""
new_direct_block = """assert.deepEqual([...MARKET_DEMAND_PRODUCT_IDS].sort(), PRODUCT_CATALOG.map((product) => product.id).sort());\nfor (const product of PRODUCT_CATALOG) {\n  assert.equal(product.marketDemandRole, 'direct', product.id);\n  assert.ok(product.marketDemandGroupId === 'food' || product.marketDemandGroupId === 'household', product.id);\n}\nfor (const group of MARKET_DEMAND_GROUP_CATALOG) {\n  for (const demandClass of group.classes) {\n    const minimumTotal = demandClass.products.reduce((sum, option) => sum + Number(option.minShare || 0), 0);\n    assert.ok(minimumTotal > 0 && minimumTotal <= 1, `${group.id}/${demandClass.id} 最低份额无效`);\n    assert.ok(demandClass.products.every((option) => Number(option.minShare || 0) > 0));\n  }\n}\nassert.equal(MARKET_DEMAND_GROUP_CATALOG.reduce((sum, group) => sum + group.baseBudget, 0), 5_700);"""
if old_direct_block not in verify:
    raise RuntimeError('verify direct-demand assertion block not found')
verify = verify.replace(old_direct_block, new_direct_block)
verify = verify.replace('MARKET_DEMAND_MODEL_VERSION = 8', 'MARKET_DEMAND_MODEL_VERSION = 9')
verify = verify.replace('市场需求模型版本：`8`', '市场需求模型版本：`9`')
verify = verify.replace('市场需求模型版本：8', '市场需求模型版本：9')
verify = verify.replace('市场需求模型 8', '市场需求模型 9')
verify = verify.replace('模型 8', '模型 9')
verify = verify.replace("console.log('市场需求验证通过：模型 9 使用三类人口真实钱包、受控稳定需求补充、85/15 基础需求、70/30 就业需求、证据置信度压力和最低储备买盘。');", "console.log('市场需求验证通过：模型 9 使用真实人口钱包覆盖全部 31 种商品，并保持既有总预算、派生流动性和市场储备约束。');")
verify = verify.replace("  ['docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', ['population-economy.js', '市场需求模型 9', '人口消费不得发行普通货币']],", "  ['docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', ['population-economy.js', '市场需求模型 9', '人口消费不得发行普通货币']],\n  ['docs/ALL_PRODUCTS_DIRECT_DEMAND_DESIGN.md', ['31 种商品', '总基础预算保持 5700', '升级冻结资金释放', '社会消费市场']],")
write(verify_path, verify)

# Current design documents: bump the authoritative market model version and record the new coverage rule.
for path in [
    'README.md',
    'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
    'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md',
    'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
    'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
]:
    content = read(path)
    content = content.replace('市场需求模型版本：`8`', '市场需求模型版本：`9`')
    content = content.replace('市场需求模型版本：8', '市场需求模型版本：9')
    content = content.replace('市场需求模型保持版本 8', '市场需求模型保持版本 9')
    content = content.replace('市场需求模型 8', '市场需求模型 9')
    content = content.replace('模型 8', '模型 9')
    write(path, content)

readme = read('README.md')
old_readme_rule = "- 商品订单只允许玩家订单、消费需求订单和市场储备订单；`food` 食品市场与 `household` 家庭消费市场继续只生成消费买单，市场储备使用真实资金和库存同时生成商品买单与卖单，不创建系统工厂订单。"
new_readme_rule = "- 商品订单只允许玩家订单、消费需求订单和市场储备订单；`food` 食品市场与内部 ID 保持为 `household` 的社会消费市场只生成终端消费买单，31 种商品全部至少属于一个直接需求类别；市场储备使用真实资金和库存同时生成商品买单与卖单，不创建系统工厂订单。"
if old_readme_rule in readme:
    readme = readme.replace(old_readme_rule, new_readme_rule)
anchor = "- 直接需求采用需求类别和替代关系；"
addition = "- 模型 9 将原材料、中间品和工业品纳入社会终端消耗：棉花、毛和纺织品对应穿着维护，木材、木板和纸浆对应装修包装，原油和塑料对应能源与日用材料，矿石、金属和机械对应建设维修；所有直接需求共享既有人口真实预算，总基础预算仍为 5700，不因商品数量增加而扩张。\n"
if addition not in readme:
    if anchor not in readme:
        raise RuntimeError('README demand anchor missing')
    readme = readme.replace(anchor, addition + anchor)
write('README.md', readme)

product_design = read('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md')
product_design = product_design.replace(
    "商品订单只允许玩家订单、消费需求订单和市场储备订单。消费需求固定分为 `food` 食品市场和 `household` 家庭消费市场，只创建买单并在成交后消费商品；市场储备继续使用独立真实资金池和商品库存，同时创建商品买单与卖单。",
    "商品订单只允许玩家订单、消费需求订单和市场储备订单。消费需求固定分为 `food` 食品市场和内部 ID 保持为 `household` 的社会消费市场，只创建买单并在成交后消耗商品；31 种正式商品全部至少属于一个直接终端需求类别。市场储备继续使用独立真实资金池和商品库存，同时创建商品买单与卖单。兼容字段 `ownerName` 继续使用“家庭消费市场需求”，不得据此恢复旧的五商品家庭目录。",
)
old_categories = "食品类别商品保持主食（小麦、水稻、面粉、食品）、蛋白质（肉、蛋、奶、鱼类）、新鲜与饮品（水果、奶、饮料）、便利食品（食品、预制餐）；家庭类别保持家居（家具）、穿着（服装）、日用消耗（纸品）、耐用消费（电子产品、家电）。类别内部继续按相对有效价格、可购性和替代弹性分配。"
new_categories = "食品类别保持主食（小麦、水稻、面粉、食品）、蛋白质（肉、蛋、奶、鱼类）、新鲜与饮品（水果、奶、饮料）、便利食品与糖类（食品、预制餐、甘蔗、砂糖）。社会消费类别保持木材、纸品与家居（木材、木板、纸浆、家具）、穿着与纺织（棉花、毛、纺织品、服装）、能源、包装与日用消耗（纸品、原油、塑料）、金属建设与耐用品（铁矿石、铜矿石、钢材、铜材、机械、电子产品、家电）。类别内部继续按相对有效价格、可购性和替代弹性分配。"
if old_categories in product_design:
    product_design = product_design.replace(old_categories, new_categories)
model9_rule = "\n模型 9 的全商品直接需求只重新分配同一人口周期预算：食品市场基础预算保持 3000，社会消费市场基础预算保持 2700，总基础预算保持 5700。每种商品必须配置正的类别内最低份额；同商品位于多个类别时先合并预算，直接需求与派生需求仍分别使用既有资金池，不得因商品目录扩大、库存、玩家数量或成交活跃度创造额外货币。原材料和中间品的直接需求表示建设、维修、能源、包装和设备更新等社会终端消耗，不表示居民直接食用或持有这些商品。\n"
marker = "同一商品可以出现在多个类别"
if model9_rule.strip() not in product_design:
    if marker not in product_design:
        raise RuntimeError('product design category marker missing')
    product_design = product_design.replace(marker, model9_rule + "\n" + marker)
write('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', product_design)

unified = read('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md')
unified_rule = "\n模型 9 保持 `food` / `household` 两个内部需求组和既有订单字段，但 `household` 的产品名称升级为社会消费市场。全部 31 种商品均可形成 `direct` 买单；成交后商品被终端消耗，不进入人口库存。模型升级必须先释放旧 `direct` / `derived-liquidity` 订单占用的人口冻结资金，再删除旧系统订单；市场储备的真实资金、库存和累计交易数据继续保留。\n"
if unified_rule.strip() not in unified:
    unified = unified.replace('\n## 1. 统一资产模型', unified_rule + '\n## 1. 统一资产模型')
write('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', unified)

industry = read('docs/INDUSTRY_AND_PRODUCTION_DESIGN.md')
industry_rule = "\n> 模型 9 需求覆盖规则：31 种商品全部具有直接终端需求，同时继续按正式配方产生逐边派生流动性。原材料和中间品的直接需求代表建设、维修、包装、能源和设备更新，不改变正式配方、生产成本、产量或参考分钟利润。\n"
if industry_rule.strip() not in industry:
    first_heading = industry.find('\n## ')
    if first_heading < 0:
        raise RuntimeError('industry design heading missing')
    industry = industry[:first_heading] + industry_rule + industry[first_heading:]
write('docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', industry)

server_design = read('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md')
server_rule = "\n> 市场需求模型 9 升级要求：部署后的首次权威状态迁移必须释放旧消费订单的人口冻结资金，撤销旧系统订单并重建 31 种商品的直接需求状态；市场储备资金和库存按既有迁移规则保留。\n"
if server_rule.strip() not in server_design:
    first_heading = server_design.find('\n## ')
    if first_heading < 0:
        raise RuntimeError('server design heading missing')
    server_design = server_design[:first_heading] + server_rule + server_design[first_heading:]
write('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', server_design)

all_products_design = r'''# 全商品直接需求设计

> 状态：市场需求模型 9 权威增补
> 适用项目：`RIVERS0FT/Economy`
> 更新时间：2026-07-22
> 客户端状态版本：16
> 世界状态版本：14
> 市场需求模型版本：9

## 1. 目标

31 种正式商品全部必须具有直接终端需求。食品和生活用品代表居民消费；原材料、中间品和工业品代表建设、维修、能源、包装、公共服务和设备更新形成的社会终端消耗。直接需求成交后商品被消耗，不进入人口或市场储备库存。

## 2. 兼容边界

- 保留内部需求组 ID `food` 与 `household`。
- `household` 的产品显示名称改为“社会消费市场”。
- 为兼容历史订单和审计，`ownerName` 保持“家庭消费市场需求”。
- 不新增人口账户、货币池或系统工厂订单。
- 所有商品继续保留生产链角色；具有直接需求不等于失去原料、中间品或下游输入角色。

## 3. 需求目录

食品市场：

- 主食：小麦、水稻、面粉、食品；
- 蛋白质：肉、蛋、奶、鱼类；
- 新鲜与饮品：水果、奶、饮料；
- 便利食品与糖类：食品、预制餐、甘蔗、砂糖。

社会消费市场：

- 木材、纸品与家居：木材、木板、纸浆、家具；
- 穿着与纺织：棉花、毛、纺织品、服装；
- 能源、包装与日用消耗：纸品、原油、塑料；
- 金属建设与耐用品：铁矿石、铜矿石、钢材、铜材、机械、电子产品、家电。

每种商品必须配置正的类别内最低份额。一个商品可在同一需求组的多个类别出现，但周期预算必须先合并后下单，不得重复创造预算。

## 4. 预算与价格规则

- 食品市场基础预算保持 3000；社会消费市场基础预算保持 2700；总基础预算保持 5700。
- 三类人口食品／社会消费比例、边际消费倾向、储蓄目标和稳定需求补充规则保持不变。
- 就业收入预算继续按 70% 直接需求／30% 派生流动性分配；稳定预算继续按 85%／15% 分配。
- 商品目录扩大只重新分配既有人口真实钱包预算，不得提高总预算或发行额。
- 直接需求、派生需求和市场储备可同时作用于同一商品，但必须分别使用真实冻结资金并受商品级和需求组级订单价值上限约束。
- 价格传导继续同时读取直接需求压力、真实成交、生产成本和下游净回值；不得因为全部商品具有直接需求而禁用生产链角色。

## 5. 升级与冻结资金释放

从模型 8 升级到模型 9 时：

1. 识别所有仍有效的 `direct` 与 `derived-liquidity` 人口订单；
2. 按订单剩余数量和限价退回对应人口账户冻结资金；
3. 删除旧人口系统订单；
4. 保留玩家订单、玩家资产、市场储备真实资金、库存和累计交易数据；
5. 清空旧类别份额和周期结算缓存；
6. 立即按模型 9 的 31 种商品目录重建需求周期。

任何升级路径都不得使人口 `credits + frozenCredits` 减少。

## 6. 验证

构建必须验证：

- `MARKET_DEMAND_PRODUCT_IDS` 与 `PRODUCT_CATALOG` 的 31 个 ID 完全一致；
- 每种商品只属于一个直接需求组，并具有正的 `minShare`；
- 每个类别的最低份额合计不超过 100%；
- 两组基础预算合计仍为 5700；
- 模型 8 升级后旧消费订单被移除、人口冻结资金归零且钱包总额守恒；
- 玩家资产和市场储备资产不因升级改变；
- 既有派生流动性、市场储备、系统订单防自成交和价格传导测试继续通过。
'''
write('docs/ALL_PRODUCTS_DIRECT_DEMAND_DESIGN.md', all_products_design)

# Reject stale current-version assertions in authoritative implementation and validation files.
for path in [
    'server/src/market-demand/catalog.js',
    'server/test/market-liquidity.test.js',
    'scripts/verify-staple-crops-demand.mjs',
    'README.md',
    'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
    'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md',
    'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
    'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
]:
    content = read(path)
    if '市场需求模型版本：8' in content or 'MARKET_DEMAND_MODEL_VERSION = 8' in content:
        raise RuntimeError(f'{path}: stale market demand model version 8')

print('Applied market demand model 9 with direct demand for all 31 products.')
