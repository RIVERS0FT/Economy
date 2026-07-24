from pathlib import Path
import re


def read(path):
    return Path(path).read_text()


def write(path, content):
    Path(path).write_text(content)


def replace_once(path, old, new):
    content = read(path)
    if old not in content:
        raise RuntimeError(f'missing expected text in {path}: {old[:160]!r}')
    write(path, content.replace(old, new, 1))


def regex_once(path, pattern, replacement):
    content = read(path)
    next_content, count = re.subn(pattern, replacement, content, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f'expected one regex match in {path}, got {count}: {pattern[:120]!r}')
    write(path, next_content)


replace_once('server/src/market-demand/catalog.js',
             'export const MARKET_DEMAND_MODEL_VERSION = 9;',
             'export const MARKET_DEMAND_MODEL_VERSION = 10;')
replace_once('server/src/market-demand/catalog.js',
             'export const DIRECT_DEMAND_UNFILLED_PRICE_STEP = 1.03;\nexport const DIRECT_DEMAND_PRICE_RECOVERY_RATE = 0.30;',
             '''export const DIRECT_DEMAND_UNFILLED_PRICE_STEP = 1.03;
export const DIRECT_DEMAND_UNFILLED_REFERENCE_GAP_RATE = 0.25;
export const DIRECT_DEMAND_UNFILLED_REFERENCE_MAX_RATE = 0.10;
export const DIRECT_DEMAND_BELOW_REFERENCE_RECOVERY_RATE = 0.10;
export const DIRECT_DEMAND_PRICE_RECOVERY_RATE = 0.30;
export const DIRECT_DEMAND_OVERSUPPLY_PRICE_STEP = 0.98;
export const DIRECT_DEMAND_OVERSUPPLY_ENTRY_CYCLES = 2;
export const DIRECT_DEMAND_OVERSUPPLY_FILL_RATIO = 0.95;
export const DIRECT_DEMAND_OVERSUPPLY_DELAY_SCORE = 0.85;
export const DIRECT_DEMAND_MIN_PRICE = 1;''')

replace_once('server/src/market-demand.js',
             '  DIRECT_DEMAND_PRICE_RECOVERY_RATE,\n  DIRECT_DEMAND_UNFILLED_PRICE_STEP,',
             '''  DIRECT_DEMAND_BELOW_REFERENCE_RECOVERY_RATE,
  DIRECT_DEMAND_MIN_PRICE,
  DIRECT_DEMAND_OVERSUPPLY_DELAY_SCORE,
  DIRECT_DEMAND_OVERSUPPLY_ENTRY_CYCLES,
  DIRECT_DEMAND_OVERSUPPLY_FILL_RATIO,
  DIRECT_DEMAND_OVERSUPPLY_PRICE_STEP,
  DIRECT_DEMAND_PRICE_RECOVERY_RATE,
  DIRECT_DEMAND_UNFILLED_PRICE_STEP,
  DIRECT_DEMAND_UNFILLED_REFERENCE_GAP_RATE,
  DIRECT_DEMAND_UNFILLED_REFERENCE_MAX_RATE,''')
market = read('server/src/market-demand.js')
initializer = '        directRequested: 0,\n        directFilled: 0,'
if market.count(initializer) != 2:
    raise RuntimeError(f'unexpected direct stat initializer count: {market.count(initializer)}')
market = market.replace(initializer,
                        '        directRequested: 0,\n'
                        '        directFilled: 0,\n'
                        '        directDelayWeight: 0,\n'
                        '        directDelayScoreTotal: 0,')
write('server/src/market-demand.js', market)
replace_once('server/src/market-demand.js',
             "      if (order.demandTier === 'direct') {\n"
             '        stats.directRequested += quantity;\n'
             '        stats.directFilled += filled;\n'
             '        const utility = Math.max(1, Number(utilities.get(productId) || 1));',
             "      if (order.demandTier === 'direct') {\n"
             '        stats.directRequested += quantity;\n'
             '        stats.directFilled += filled;\n'
             '        if (filled > 0) {\n'
             '          const directDelay = Math.max(0, Number(order.lastFilledAt || order.createdAt || now) - Number(order.createdAt || now));\n'
             '          const directDelayScore = Math.exp(-directDelay / Math.max(1, group.cycleMs));\n'
             '          stats.directDelayWeight += filled;\n'
             '          stats.directDelayScoreTotal += filled * directDelayScore;\n'
             '        }\n'
             '        const utility = Math.max(1, Number(utilities.get(productId) || 1));')
replace_once('server/src/market-demand.js',
             '        directFillRatio: stats.directRequested <= 0 ? null : round4(stats.directFilled / stats.directRequested),\n'
             '        delayScore: round4(productDelayScore),',
             '        directFillRatio: stats.directRequested <= 0 ? null : round4(stats.directFilled / stats.directRequested),\n'
             '        directDelayScore: stats.directDelayWeight <= 0 ? 0 : round4(stats.directDelayScoreTotal / stats.directDelayWeight),\n'
             '        delayScore: round4(productDelayScore),')

new_anchor_runtime = '''  function updateDirectQuoteAnchors(world, group, state, settlement) {
    state.directQuoteAnchors ||= {};
    state.directOversupplyCycles ||= {};
    const productIds = new Set(group.classes.flatMap((demandClass) => (
      demandClass.products.map((option) => option.productId)
    )));
    for (const productId of productIds) {
      const product = productFor(productId);
      const referencePrice = Math.max(DIRECT_DEMAND_MIN_PRICE, Number(
        world.marketDemand.priceTransmission.products[productId]?.referencePrice || product.basePrice,
      ));
      const maximum = Math.max(DIRECT_DEMAND_MIN_PRICE, product.basePrice * PRICE_MAX_MULTIPLIER);
      const stored = Number(state.directQuoteAnchors[productId]);
      const previous = clamp(
        DIRECT_DEMAND_MIN_PRICE,
        maximum,
        Number.isFinite(stored) && stored > 0 ? stored : referencePrice,
      );
      const stats = settlement.products?.[productId];
      const requested = Math.max(0, Number(stats?.directRequested || 0));
      const filled = Math.max(0, Number(stats?.directFilled || 0));
      const fillRatio = requested <= 0 ? null : clamp(0, 1, filled / requested);
      const directDelayScore = Math.max(0, Number(stats?.directDelayScore || 0));
      let oversupplyCycles = Math.max(0, Math.floor(Number(state.directOversupplyCycles[productId] || 0)));
      let next = previous;

      if (requested > 0 && filled <= 0) {
        const referenceGap = Math.max(0, referencePrice - previous);
        const increase = Math.max(
          previous * (DIRECT_DEMAND_UNFILLED_PRICE_STEP - 1),
          Math.min(
            referenceGap * DIRECT_DEMAND_UNFILLED_REFERENCE_GAP_RATE,
            referencePrice * DIRECT_DEMAND_UNFILLED_REFERENCE_MAX_RATE,
          ),
        );
        next = previous + increase;
        oversupplyCycles = 0;
      } else if (requested > 0 && fillRatio < group.targetSatisfaction) {
        next = previous < referencePrice
          ? previous + (referencePrice - previous) * DIRECT_DEMAND_BELOW_REFERENCE_RECOVERY_RATE
          : previous;
        oversupplyCycles = 0;
      } else if (
        requested > 0
        && fillRatio >= DIRECT_DEMAND_OVERSUPPLY_FILL_RATIO
        && directDelayScore >= DIRECT_DEMAND_OVERSUPPLY_DELAY_SCORE
      ) {
        oversupplyCycles += 1;
        next = oversupplyCycles >= DIRECT_DEMAND_OVERSUPPLY_ENTRY_CYCLES
          ? previous * DIRECT_DEMAND_OVERSUPPLY_PRICE_STEP
          : previous + (referencePrice - previous) * DIRECT_DEMAND_PRICE_RECOVERY_RATE;
      } else {
        next = previous + (referencePrice - previous) * DIRECT_DEMAND_PRICE_RECOVERY_RATE;
        oversupplyCycles = 0;
      }

      state.directQuoteAnchors[productId] = round4(clamp(
        DIRECT_DEMAND_MIN_PRICE,
        maximum,
        next,
      ));
      state.directOversupplyCycles[productId] = oversupplyCycles;
    }
  }

  function prepareGroupOrders'''
regex_once('server/src/market-demand.js',
           r'  function updateDirectQuoteAnchors\(world, group, state, settlement\) \{.*?\n  \}\n\n  function prepareGroupOrders',
           new_anchor_runtime)

new_curve = '''  function priceCurveFor(product, referencePrice, pressure, role, directQuoteAnchor = referencePrice) {
    const cap = Math.max(DIRECT_DEMAND_MIN_PRICE, Math.floor(product.basePrice * PRICE_MAX_MULTIPLIER));
    const shortageMultiplier = pressure >= 1.15 ? DEMAND_CURVE_SHORTAGE_MULTIPLIER : 1;
    const directBase = role === 'direct'
      ? (pressure >= 1.15 ? Math.max(directQuoteAnchor, referencePrice * shortageMultiplier) : directQuoteAnchor)
      : referencePrice;
    return DEMAND_CURVE.map((tier, index) => {
      const targetPrice = role === 'direct'
        ? directBase * tier.multiplier
        : referencePrice * tier.multiplier * (index === 0 ? shortageMultiplier : 1);
      return {
        weight: tier.weight,
        price: Math.min(cap, Math.max(DIRECT_DEMAND_MIN_PRICE, Math.round(targetPrice))),
      };
    });
  }

  function applyChoices'''
regex_once('server/src/market-demand.js',
           r'  function priceCurveFor\(product, referencePrice, pressure, directQuoteAnchor = referencePrice\) \{.*?\n  \}\n\n  function applyChoices',
           new_curve)
replace_once('server/src/market-demand.js',
             "      const directQuoteAnchor = role === 'direct'\n"
             '        ? Math.max(referencePrice, Number(world.marketDemand.groups[group.id]?.directQuoteAnchors?.[productId] || referencePrice))\n'
             '        : referencePrice;\n'
             '      const curve = priceCurveFor(product, referencePrice, pressure, directQuoteAnchor);',
             "      const directQuoteAnchor = role === 'direct'\n"
             '        ? Number(world.marketDemand.groups[group.id]?.directQuoteAnchors?.[productId] || referencePrice)\n'
             '        : referencePrice;\n'
             '      const curve = priceCurveFor(product, referencePrice, pressure, role, directQuoteAnchor);')

replace_once('server/src/market-demand/state.js',
             "import { MARKET_DEMAND_GROUP_CATALOG, MARKET_DEMAND_MODEL_VERSION, PRICE_MAX_MULTIPLIER } from './catalog.js';",
             "import { DIRECT_DEMAND_MIN_PRICE, MARKET_DEMAND_GROUP_CATALOG, MARKET_DEMAND_MODEL_VERSION, PRICE_MAX_MULTIPLIER } from './catalog.js';")
regex_once('server/src/market-demand/state.js',
           r'(  function defaultDirectQuoteAnchors\(group\) \{.*?\n  \}\n)\n  function normalizePlayerActivity',
           r"\1\n  function defaultDirectOversupplyCycles(group) {\n    return Object.fromEntries(Object.keys(defaultDirectQuoteAnchors(group)).map((productId) => [productId, 0]));\n  }\n\n  function normalizePlayerActivity")
replace_once('server/src/market-demand/state.js',
             '      directQuoteAnchors: defaultDirectQuoteAnchors(group),\n      previousDemandQuantities:',
             '      directQuoteAnchors: defaultDirectQuoteAnchors(group),\n'
             '      directOversupplyCycles: defaultDirectOversupplyCycles(group),\n'
             '      previousDemandQuantities:')
replace_once('server/src/market-demand/state.js',
             '        return [productId, clamp(0.01, Number(product?.basePrice || fallbackPrice) * PRICE_MAX_MULTIPLIER, normalized)];\n'
             '      }));\n'
             '      state.previousDemandQuantities =',
             '        return [productId, clamp(DIRECT_DEMAND_MIN_PRICE, Number(product?.basePrice || fallbackPrice) * PRICE_MAX_MULTIPLIER, normalized)];\n'
             '      }));\n'
             "      const previousOversupplyCycles = state.directOversupplyCycles && typeof state.directOversupplyCycles === 'object'\n"
             '        ? state.directOversupplyCycles\n'
             '        : {};\n'
             '      state.directOversupplyCycles = Object.fromEntries(Object.keys(defaultAnchors).map((productId) => [\n'
             '        productId,\n'
             '        Math.max(0, Math.floor(Number(previousOversupplyCycles[productId] || 0))),\n'
             '      ]));\n'
             '      state.previousDemandQuantities =')
replace_once('server/src/market-demand/state.js',
             '        state.directQuoteAnchors = defaultDirectQuoteAnchors(group);\n'
             '        state.previousDemandQuantities =',
             '        state.directQuoteAnchors = defaultDirectQuoteAnchors(group);\n'
             '        state.directOversupplyCycles = defaultDirectOversupplyCycles(group);\n'
             '        state.previousDemandQuantities =')
replace_once('server/src/market-demand/state.js',
             '    world.marketDemand.priceTransmission = transmission;\n'
             '    world.demandGroups = world.marketDemand.groups;',
             '''    world.marketDemand.priceTransmission = transmission;
    if (isUpgrade) {
      for (const group of MARKET_DEMAND_GROUP_CATALOG) {
        const groupState = world.marketDemand.groups[group.id];
        const defaults = defaultDirectQuoteAnchors(group);
        groupState.directQuoteAnchors = Object.fromEntries(Object.keys(defaults).map((productId) => {
          const product = productMap.get(productId);
          const referencePrice = Number(transmission.products[productId]?.referencePrice || product?.basePrice || defaults[productId]);
          return [productId, clamp(
            DIRECT_DEMAND_MIN_PRICE,
            Number(product?.basePrice || defaults[productId]) * PRICE_MAX_MULTIPLIER,
            referencePrice,
          )];
        }));
        groupState.directOversupplyCycles = defaultDirectOversupplyCycles(group);
      }
    }
    world.demandGroups = world.marketDemand.groups;''')

# Market runtime regression tests.
test_path = Path('server/test/market-demand-v6.test.js')
tests = test_path.read_text()
tests = tests.replace('market model 8 settles fills that happen after demand orders are created',
                      'market model 10 settles fills that happen after demand orders are created')
tests = tests.replace('market model 8 uses funded population wallets when no player is active',
                      'market model 10 uses funded population wallets when no player is active')
marker = "test('market model 10 uses funded population wallets when no player is active', () => {"
if marker not in tests:
    raise RuntimeError('market test insertion marker missing')
inserted = r'''
function demandOrdersFor(world, groupId, productId, cycleId, demandTier = 'direct') {
  return world.orders.filter((order) => order.demandGroupId === groupId
    && order.demandTier === demandTier
    && order.productId === productId
    && Number(order.demandCycleId) === cycleId);
}

function fillDemandQuantity(orders, requestedFill, delayMs = 0) {
  let remainingFill = requestedFill;
  for (const order of orders) {
    const quantity = Math.max(0, Number(order.quantity || 0));
    const filled = Math.min(quantity, remainingFill);
    order.remaining = quantity - filled;
    order.status = order.remaining <= 0 ? 'filled' : filled > 0 ? 'partial' : 'open';
    if (filled > 0) order.lastFilledAt = Number(order.createdAt || 0) + delayMs;
    remainingFill -= filled;
  }
  assert.equal(remainingFill, 0);
}

test('sustained fast full service lowers all direct demand tiers below reference price', () => {
  const now = 1_700_000_000_000;
  const runtime = createRuntime();
  const world = createTestWorld(now);
  runtime.initializeWorld(world, now);
  world.marketDemand.groups.food.nextDemandAt = now;
  runtime.processGroup(world, 'food', now);

  for (let cycle = 0; cycle < 3; cycle += 1) {
    const cycleAt = now + cycle * constants.demandCycleMs;
    const cycleId = Math.floor(cycleAt / constants.demandCycleMs);
    const orders = demandOrdersFor(world, 'food', 'food', cycleId);
    assert.ok(orders.length > 0);
    fillDemandQuantity(orders, orders.reduce((sum, order) => sum + Number(order.quantity || 0), 0));
    runtime.processGroup(world, 'food', cycleAt + constants.demandCycleMs);
  }

  const state = world.marketDemand.groups.food;
  const reference = world.marketDemand.priceTransmission.products.food.referencePrice;
  assert.equal(state.directOversupplyCycles.food, 3);
  assert.ok(state.directQuoteAnchors.food < reference);
  const currentCycleId = Math.floor((now + 3 * constants.demandCycleMs) / constants.demandCycleMs);
  const prices = [...new Set(demandOrdersFor(world, 'food', 'food', currentCycleId).map((order) => order.price))]
    .sort((left, right) => right - left);
  assert.ok(prices.length > 0);
  assert.ok(prices.every((price) => price >= 1 && price < reference));
});

test('direct demand quote anchor stops at absolute price one', () => {
  const now = 1_700_000_000_000;
  const runtime = createRuntime();
  const world = createTestWorld(now);
  runtime.initializeWorld(world, now);
  world.marketDemand.groups.food.nextDemandAt = now;
  runtime.processGroup(world, 'food', now);
  const cycleId = Math.floor(now / constants.demandCycleMs);
  const orders = demandOrdersFor(world, 'food', 'food', cycleId);
  assert.ok(orders.length > 0);
  world.marketDemand.groups.food.directQuoteAnchors.food = 1.01;
  world.marketDemand.groups.food.directOversupplyCycles.food = 1;
  fillDemandQuantity(orders, orders.reduce((sum, order) => sum + Number(order.quantity || 0), 0));

  runtime.processGroup(world, 'food', now + constants.demandCycleMs);

  assert.equal(world.marketDemand.groups.food.directQuoteAnchors.food, 1);
  const nextCycleId = Math.floor((now + constants.demandCycleMs) / constants.demandCycleMs);
  const prices = demandOrdersFor(world, 'food', 'food', nextCycleId).map((order) => order.price);
  assert.ok(prices.length > 0);
  assert.ok(prices.every((price) => price === 1));
});

test('zero fill below reference accelerates recovery while partial service recovers gently', () => {
  const now = 1_700_000_000_000;
  const zeroRuntime = createRuntime();
  const zeroWorld = createTestWorld(now);
  zeroRuntime.initializeWorld(zeroWorld, now);
  zeroWorld.marketDemand.groups.food.nextDemandAt = now;
  zeroRuntime.processGroup(zeroWorld, 'food', now);
  zeroWorld.marketDemand.priceTransmission.products.food.referencePrice = 10;
  zeroWorld.marketDemand.groups.food.directQuoteAnchors.food = 6;
  const historyBefore = zeroWorld.markets.food.priceHistory.length;
  const tradePriceBefore = zeroWorld.markets.food.lastTradePrice;
  zeroRuntime.processGroup(zeroWorld, 'food', now + constants.demandCycleMs);
  assert.equal(zeroWorld.marketDemand.groups.food.directQuoteAnchors.food, 7);
  assert.equal(zeroWorld.markets.food.priceHistory.length, historyBefore);
  assert.equal(zeroWorld.markets.food.lastTradePrice, tradePriceBefore);

  const partialRuntime = createRuntime();
  const partialWorld = createTestWorld(now);
  partialRuntime.initializeWorld(partialWorld, now);
  partialWorld.marketDemand.groups.food.nextDemandAt = now;
  partialRuntime.processGroup(partialWorld, 'food', now);
  partialWorld.marketDemand.priceTransmission.products.food.referencePrice = 10;
  partialWorld.marketDemand.groups.food.directQuoteAnchors.food = 6;
  const cycleId = Math.floor(now / constants.demandCycleMs);
  const orders = demandOrdersFor(partialWorld, 'food', 'food', cycleId);
  const total = orders.reduce((sum, order) => sum + Number(order.quantity || 0), 0);
  assert.ok(total >= 2);
  fillDemandQuantity(orders, Math.floor(total / 2));
  partialRuntime.processGroup(partialWorld, 'food', now + constants.demandCycleMs);
  assert.equal(partialWorld.marketDemand.groups.food.directQuoteAnchors.food, 6.4);
  assert.equal(partialWorld.marketDemand.groups.food.directOversupplyCycles.food, 0);
});

test('no direct demand converges toward reference and derived liquidity ignores a low direct anchor', () => {
  const now = 1_700_000_000_000;
  const runtime = createRuntime();
  const world = createTestWorld(now);
  runtime.initializeWorld(world, now);
  world.marketDemand.priceTransmission.products.food.referencePrice = 10;
  world.marketDemand.groups.food.directQuoteAnchors.food = 6;
  world.marketDemand.priceTransmission.products.wheat.referencePrice = 2;
  world.marketDemand.groups.food.directQuoteAnchors.wheat = 1;
  world.marketDemand.groups.food.nextDemandAt = now;

  runtime.processGroup(world, 'food', now);

  assert.equal(world.marketDemand.groups.food.directQuoteAnchors.food, 7.2);
  const cycleId = Math.floor(now / constants.demandCycleMs);
  const directPrices = demandOrdersFor(world, 'food', 'wheat', cycleId, 'direct').map((order) => order.price);
  const derivedPrices = demandOrdersFor(world, 'food', 'wheat', cycleId, 'derived-liquidity').map((order) => order.price);
  assert.ok(directPrices.length > 0);
  assert.ok(derivedPrices.length > 0);
  assert.equal(Math.max(...directPrices), 1);
  assert.equal(Math.max(...derivedPrices), 2);
});

'''
tests = tests.replace(marker, inserted + marker, 1)
test_path.write_text(tests)

# Upgrade migration test.
all_products = read('server/test/all-products-demand.test.js')
all_products = all_products.replace('market demand model 9 gives every product direct terminal demand',
                                    'market demand model 10 gives every product direct terminal demand')
all_products = all_products.replace('assert.equal(MARKET_DEMAND_MODEL_VERSION, 9);',
                                    'assert.equal(MARKET_DEMAND_MODEL_VERSION, 10);')
all_products = all_products.replace('model 8 migration refunds population escrow before model 9 rebuild',
                                    'model 9 migration refunds population escrow before model 10 rebuild')
old_migration = '''  world.marketDemand.modelVersion = 8;
  migrateWorld(world, now + 2);

  assert.equal(world.marketDemand.modelVersion, 9);'''
new_migration = '''  const wheatReference = world.marketDemand.priceTransmission.products.wheat.referencePrice;
  world.marketDemand.groups.food.directQuoteAnchors.wheat = wheatReference * 2;
  world.marketDemand.groups.food.directOversupplyCycles.wheat = 4;
  world.marketDemand.modelVersion = 9;
  migrateWorld(world, now + 2);

  assert.equal(world.marketDemand.modelVersion, 10);
  assert.equal(world.marketDemand.groups.food.directQuoteAnchors.wheat, wheatReference);
  assert.equal(world.marketDemand.groups.food.directOversupplyCycles.wheat, 0);'''
if old_migration not in all_products:
    raise RuntimeError('migration replacement marker missing')
all_products = all_products.replace(old_migration, new_migration, 1)
write('server/test/all-products-demand.test.js', all_products)

# Current-version labels and assertions.
text_files = [Path('README.md')]
text_files += list(Path('docs').glob('*.md'))
text_files += list(Path('scripts').glob('*.mjs'))
text_files += list(Path('server').rglob('*.js'))
text_files += list(Path('src').rglob('*.ts')) + list(Path('src').rglob('*.tsx')) + list(Path('src').rglob('*.css'))
for path in text_files:
    content = path.read_text()
    content = content.replace('市场需求模型版本：`9`', '市场需求模型版本：`10`')
    content = content.replace('市场需求模型版本：9', '市场需求模型版本：10')
    content = content.replace('市场需求模型 9', '市场需求模型 10')
    content = content.replace('MARKET_DEMAND_MODEL_VERSION, 9', 'MARKET_DEMAND_MODEL_VERSION, 10')
    content = content.replace("'MARKET_DEMAND_MODEL_VERSION = 9'", "'MARKET_DEMAND_MODEL_VERSION = 10'")
    path.write_text(content)

replace_once('README.md',
             '- 直接需求为每项商品持久化未取整的未满足需求报价锚点：完整周期零成交累计提高 3%，部分成交未达目标时保持，达标或无直接需求时每周期向参考价回落 30% 的差额；只有第一档直接需求买价使用该锚点，预算、最近成交价和估值不因此增加。',
             '- 直接需求为每项商品持久化未取整的双向报价锚点和连续过剩周期：零成交时按 3% 与参考价缺口恢复量中的较大值上涨，成交不足时从参考价下方温和恢复，普通达标或无直接需求时双向回归参考价；直接成交率至少 95%、直接成交延迟得分至少 85% 连续两个周期后，每周期下调 2%，允许跌穿参考价但不得低于 1。三档直接需求买价全部以该锚点为基准；派生流动性、预算、最近成交价和估值不受影响。')
replace_once('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
             '新周期每项商品预算按 50%／30%／20% 拆成三档买盘，基准倍率为 100%／97%／93%；压力达到 1.15 时第一档普通曲线允许提高到参考价的 103%。每项直接需求商品额外保存未满足需求报价锚点，锚点使用未取整小数：上一完整周期存在直接需求且零成交时，以 `max(上一锚点, 当前参考价) × 103%` 累计；存在部分成交但直接成交率仍低于需求组目标时保持锚点且不得低于参考价；达到目标或当周期没有直接需求时，每周期消除锚点与参考价差额的 30%。只有直接需求第一档取普通曲线与锚点的较高值后再取整数，派生流动性不使用该阶梯；报价仍不得超过基础价的 300%，周期预算不增加，涨价只会减少可购买数量。同价档合并，未形成整数数量的预算不结转。',
             '新周期每项商品预算按 50%／30%／20% 拆成三档买盘，倍率固定为 100%／97%／93%。每项直接需求商品保存未取整的双向报价锚点与连续过剩周期，锚点合法范围为绝对价格 1 至基础价的 300%：上一完整周期存在直接需求且零成交时，上涨量取“上一锚点的 3%”与“参考价缺口的 25%、但最多为参考价的 10%”中的较大值；存在成交但直接成交率低于需求组目标时，锚点低于参考价则恢复 10% 缺口，高于参考价则保持；成交达到目标但尚未形成持续过剩，或当周期没有直接需求时，锚点按 30% 差额双向回归参考价。只有直接成交率至少 95%、直接成交延迟得分至少 85% 连续满足两个周期，才从第二个周期起按 98% 乘数下降，允许跌穿参考价但不得低于 1。压力达到 1.15 时，直接需求曲线基准至少为参考价的 103%；三档直接需求价格必须全部基于同一曲线基准，禁止第二、第三档继续使用参考价造成倒挂。派生流动性继续使用参考价和既有短缺保护，不读取直接需求锚点。周期预算不增加，价格变化只改变可购买数量；同价档合并，未形成整数数量的预算不结转。')
replace_once('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md',
             '消费需求买单只能与同商品的玩家卖单成交；市场储备买单和卖单只能与玩家订单成交，任何两个 `ownerType = population` 的系统订单都必须排除，禁止消费需求与储备、不同储备方向或同组系统订单互相制造成交。消费需求成交必须记录 `lastFilledAt` 并在下一完整周期统一结算。直接需求为每项商品保存未取整的未满足需求报价锚点：完整周期零成交时在当前参考价与上一锚点的较高值上累计提高 3%，部分成交但未达到需求组目标时保持，达到目标或没有直接需求时每周期向参考价回落 30% 的差额；只有直接需求第一档使用该锚点，派生流动性不得使用。旧消费买单最多存在两个周期，无成交时只保留 35%；单商品有效消费买盘价值最多为本周期分配预算的 1.5 倍，需求组总有效消费买盘价值最多为本周期预算的 2.5 倍。报价锚点和挂单不得修改最近成交价、价格历史或正式估值。',
             '消费需求买单只能与同商品的玩家卖单成交；市场储备买单和卖单只能与玩家订单成交，任何两个 `ownerType = population` 的系统订单都必须排除，禁止消费需求与储备、不同储备方向或同组系统订单互相制造成交。消费需求成交必须记录 `lastFilledAt` 并在下一完整周期统一结算，直接需求还必须独立累计 `directRequested`、`directFilled` 与只读取直接成交的延迟得分。每项直接需求商品保存未取整的双向报价锚点与连续过剩周期：零成交上涨，成交不足时保持或从参考价下方恢复，普通达标与无直接需求时双向回归参考价；直接成交率至少 95%、直接成交延迟得分至少 85% 连续两个周期后按每周期 2% 下调，允许跌穿参考价但最低为 1、最高为基础价 300%。三档直接需求买盘全部基于同一锚点曲线，派生流动性不得读取该锚点。旧消费买单最多存在两个周期，无成交时只保留 35%；单商品有效消费买盘价值最多为本周期分配预算的 1.5 倍，需求组总有效消费买盘价值最多为本周期预算的 2.5 倍。报价锚点和挂单不得修改最近成交价、价格历史或正式估值。')

architecture = Path('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md')
architecture_text = architecture.read_text()
architecture_rule = '> 模型 10 状态迁移规则：`marketDemand.groups[*]` 持久化 `directQuoteAnchors` 与 `directOversupplyCycles`；报价锚点按绝对下限 1 和基础价 300% 上限规范化。由旧模型升级时必须释放并撤销既有系统订单，保留玩家订单、玩家资产、人口钱包与市场储备真实资产，并以迁移时价格传导参考价重置锚点、以 0 重置连续过剩周期。直接成交延迟证据不得混入派生流动性成交。'
if architecture_rule not in architecture_text:
    marker = '市场需求模型 10'
    index = architecture_text.find(marker)
    if index < 0:
        raise RuntimeError('server architecture model marker missing')
    line_end = architecture_text.find('\n', index)
    architecture_text = architecture_text[:line_end + 1] + '\n' + architecture_rule + '\n' + architecture_text[line_end + 1:]
    architecture.write_text(architecture_text)

verify = read('scripts/verify-staple-crops-demand.mjs')
old_verify_constants = "  'DIRECT_DEMAND_UNFILLED_PRICE_STEP = 1.03',\n  'DIRECT_DEMAND_PRICE_RECOVERY_RATE = 0.30',\n  'directQuoteAnchors',"
new_verify_constants = "  'DIRECT_DEMAND_UNFILLED_PRICE_STEP = 1.03',\n  'DIRECT_DEMAND_UNFILLED_REFERENCE_GAP_RATE = 0.25',\n  'DIRECT_DEMAND_BELOW_REFERENCE_RECOVERY_RATE = 0.10',\n  'DIRECT_DEMAND_PRICE_RECOVERY_RATE = 0.30',\n  'DIRECT_DEMAND_OVERSUPPLY_PRICE_STEP = 0.98',\n  'DIRECT_DEMAND_OVERSUPPLY_ENTRY_CYCLES = 2',\n  'DIRECT_DEMAND_OVERSUPPLY_FILL_RATIO = 0.95',\n  'DIRECT_DEMAND_OVERSUPPLY_DELAY_SCORE = 0.85',\n  'DIRECT_DEMAND_MIN_PRICE = 1',\n  'directQuoteAnchors',\n  'directOversupplyCycles',\n  'directDelayScore',"
if old_verify_constants not in verify:
    raise RuntimeError('verification constants marker missing')
verify = verify.replace(old_verify_constants, new_verify_constants, 1)
old_test_check = "assert.ok(marketDemandTests.includes('direct demand quote anchor accumulates fractional no-fill increases and recovers after service'), '市场需求测试缺少未成交报价阶梯回归');"
new_test_check = "for (const text of [\n  'direct demand quote anchor accumulates fractional no-fill increases and recovers after service',\n  'sustained fast full service lowers all direct demand tiers below reference price',\n  'direct demand quote anchor stops at absolute price one',\n  'zero fill below reference accelerates recovery while partial service recovers gently',\n  'no direct demand converges toward reference and derived liquidity ignores a low direct anchor',\n]) assert.ok(marketDemandTests.includes(text), '市场需求测试缺少模型 10 双向报价回归: ' + text);"
if old_test_check not in verify:
    raise RuntimeError('verification test marker missing')
verify = verify.replace(old_test_check, new_test_check, 1)
write('scripts/verify-staple-crops-demand.mjs', verify)

stale = []
for path in [Path('README.md'), *Path('docs').glob('*.md'), Path('scripts/verify-document-authority.mjs'), Path('scripts/verify-staple-crops-demand.mjs')]:
    content = path.read_text()
    if '市场需求模型版本：9' in content or '市场需求模型版本：`9`' in content:
        stale.append(str(path))
if stale:
    raise RuntimeError('stale market demand version labels: ' + ', '.join(stale))
