import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';

function read(path) { return readFileSync(path, 'utf8'); }
function write(path, content) { writeFileSync(path, content.endsWith('\n') ? content : `${content}\n`); }
function replaceBetween(path, start, next, replacement) {
  let source = read(path);
  const startIndex = source.indexOf(start);
  if (startIndex < 0) throw new Error(`${path}: missing start ${start}`);
  const endIndex = source.indexOf(next, startIndex + start.length);
  if (endIndex < 0) throw new Error(`${path}: missing next ${next}`);
  source = `${source.slice(0, startIndex)}${replacement.trimEnd()}\n\n${source.slice(endIndex)}`;
  write(path, source);
}
function replaceOnce(path, oldText, newText) {
  let source = read(path);
  if (!source.includes(oldText)) throw new Error(`${path}: missing replacement target`);
  source = source.replace(oldText, newText);
  write(path, source);
}

replaceBetween(
  'server/src/market-state-delivery.js',
  'export function createMarketSummary(market, world, {',
  'export function createMarketSummaryStatesByProvince',
  `export function createMarketSummary(market, world, {
  provinceId,
  assetKind,
  assetId,
  now = Date.now(),
  economicEventWindows,
  includeOrderBook = true,
} = {}) {
  const trades = realTradePoints(market, now);
  const firstTrade = trades[0];
  const lastTrade = trades[trades.length - 1];
  const previousTrade = trades[trades.length - 2];
  let stableMarket;
  if (assetKind === 'commodity') {
    const officialPrice = Number(market?.officialPrice);
    const nextPriceAt = Number(market?.nextPriceAt);
    const todayBuyQuantity = Math.max(0, Number(market?.todayBuyQuantity || 0));
    const todaySellQuantity = Math.max(0, Number(market?.todaySellQuantity || 0));
    const lastPriceChangeBps = Math.trunc(Number(market?.lastPriceChangeBps || 0));
    const demandLastQuantity = Math.max(0, Number(market?.demand?.lastQuantity || 0));
    const demandSatisfaction = Math.max(0, Math.min(1, Number(market?.demand?.satisfaction || 0)));
    stableMarket = {
      lastPrice: Number(market?.lastPrice || 0),
      lastTradePrice: Number.isFinite(Number(market?.lastTradePrice)) ? Number(market.lastTradePrice) : null,
      ...(Number.isFinite(officialPrice) && officialPrice > 0 ? { officialPrice } : {}),
      ...(Number.isFinite(nextPriceAt) && nextPriceAt > 0 ? { nextPriceAt } : {}),
      ...(todayBuyQuantity > 0 ? { todayBuyQuantity } : {}),
      ...(todaySellQuantity > 0 ? { todaySellQuantity } : {}),
      ...(lastPriceChangeBps !== 0 ? { lastPriceChangeBps } : {}),
      ...(demandLastQuantity > 0 ? {
        demand: { lastQuantity: demandLastQuantity, satisfaction: demandSatisfaction },
      } : {}),
    };
  } else {
    const { priceHistory: _priceHistory, ...facilityMarket } = market || {};
    stableMarket = facilityMarket;
  }
  return {
    ...stableMarket,
    provinceId: normalizeProvinceId(provinceId),
    ...(assetKind === 'facility'
      ? { facilityTypeId: String(assetId || '') }
      : { productId: String(assetId || '') }),
    priceChange24h: firstTrade && lastTrade ? Number(lastTrade.price || 0) - Number(firstTrade.price || 0) : null,
    tradeVolume24h: trades.reduce((sum, point) => sum + Math.max(0, Number(point.quantity || 0)), 0),
    tradeCount24h: trades.length,
    previousTradePrice: previousTrade ? Number(previousTrade.price || 0) : null,
    lastTradeAt: lastTrade ? Number(lastTrade.createdAt || 0) : null,
    ...(assetKind === 'commodity' && economicEventWindows?.length > 0
      ? { eventTradeWindows: summarizeEventWindows(market, economicEventWindows) }
      : {}),
    ...(includeOrderBook
      ? (assetKind === 'commodity'
        ? EMPTY_PUBLIC_ORDER_BOOK
        : orderBookSummary(world, provinceId, assetKind, assetId))
      : {}),
  };
}`,
);
replaceOnce(
  'server/src/market-state-delivery.js',
  `      economicEventWindows: eventWindows.get(assetId),\n    });`,
  `      economicEventWindows: eventWindows.get(assetId),\n      includeOrderBook: assetKind !== 'commodity',\n    });`,
);

replaceOnce(
  'src/pages/MarketPage.tsx',
  `  const todayVolume = selectedProduct\n    ? Math.max(0, Number(selectedMarket?.cycleBuyQuantity || 0)) + Math.max(0, Number(selectedMarket?.cycleSellQuantity || 0))\n    : 0;`,
  `  const todayVolume = selectedProduct\n    ? Math.max(0, Number(selectedMarket?.todayBuyQuantity || 0)) + Math.max(0, Number(selectedMarket?.todaySellQuantity || 0))\n    : 0;`,
);

replaceOnce(
  'src/types.ts',
  `  /** Current official system price at which the system clears player orders in real time. */\n  officialPrice?: number;\n  /** Server timestamp of the next official price cycle. */\n  nextPriceAt?: number;\n  /** Quantity the system sold to players during the current price cycle. */\n  cycleBuyQuantity?: number;\n  /** Quantity the system bought from players during the current price cycle. */\n  cycleSellQuantity?: number;\n  /** Last cycle imbalance ((B - S) / (B + S + 2L)). */\n  lastImbalance?: number;\n  /** Last cycle official price change in signed basis points. */\n  lastPriceChangeBps?: number;`,
  `  /** Current state-product daily official price used for immediate player trades. */\n  officialPrice?: number;\n  /** Server timestamp of the next Beijing-midnight daily price adjustment. */\n  nextPriceAt?: number;\n  /** Quantity the system sold to players during the current Beijing calendar day. */\n  todayBuyQuantity?: number;\n  /** Quantity the system bought from players during the current Beijing calendar day. */\n  todaySellQuantity?: number;\n  /** @deprecated Server-only five-minute migration alias; not shipped in normal market summaries. */\n  cycleBuyQuantity?: number;\n  /** @deprecated Server-only five-minute migration alias; not shipped in normal market summaries. */\n  cycleSellQuantity?: number;\n  /** @deprecated Server-side pricing diagnostic; normal client summaries omit it. */\n  lastImbalance?: number;\n  /** Last daily official price change in signed basis points. */\n  lastPriceChangeBps?: number;`,
);
replaceOnce('src/types.ts', '  demand: DemandState;', '  demand?: Partial<DemandState>;');

replaceOnce(
  'server/test/market-state-delivery.test.js',
  `    assert.equal(getOrderBookRuntimeDiagnostics(committedWorld).builds, 1);`,
  `    assert.equal(getOrderBookRuntimeDiagnostics(committedWorld).builds, 0);`,
);
replaceOnce(
  'server/test/market-state-delivery.test.js',
  `      1,\n      'repeated market detail must reuse the committed-world order-book runtime',`,
  `      0,\n      'commodity market detail must not build a public order-book runtime',`,
);

replaceOnce(
  'server/test/save-deletion.test.js',
  `    assert.equal(preflight.autoClose.orders, 1);`,
  `    assert.equal(preflight.autoClose.orders, 0);`,
);

let facilityGroups = read('server/test/facility-groups.test.js');
if (!facilityGroups.includes("from '../src/provinces.js';")) {
  facilityGroups = facilityGroups.replace(
    "import { ensurePopulationEconomy } from '../src/population-economy.js';",
    "import { ensurePopulationEconomy } from '../src/population-economy.js';\nimport { DEFAULT_PROVINCE_ID, provinceScopedKey } from '../src/provinces.js';",
  );
  write('server/test/facility-groups.test.js', facilityGroups);
}
replaceBetween(
  'server/test/facility-groups.test.js',
  "test('asset valuation uses the latest order-book trade and ignores open bid prices', () => {",
  "test('factory automatically recovers after funds return'",
  `test('commodity valuation uses the daily official price and ignores retired open bid prices', () => {
  const world = createWorld(now);
  const buyer = ensurePlayer(world, alice, now);
  buyer.credits = 10_000;
  migrateFacilityGroupWorld(world, now);
  const market = world.markets[provinceScopedKey(DEFAULT_PROVINCE_ID, 'wheat')];

  const initial = createFacilityGroupClientState(world, alice.id, now);
  assert.equal(initial.valuationPrices['commodity:wheat'], market.officialPrice);

  market.lastTradePrice = 3;
  market.officialPrice = 11;
  world.orders.push({
    id: 'retired-open-bid', provinceId: DEFAULT_PROVINCE_ID, assetKind: 'commodity', assetId: 'wheat', productId: 'wheat',
    side: 'buy', ownerType: 'player', ownerId: 3, ownerName: 'Charlie', price: 999, quantity: 1, remaining: 1,
    status: 'open', createdAt: now + 1,
  });
  buyer.inventories.wheat.available = 10;

  const state = createFacilityGroupClientState(world, alice.id, now + 2);
  assert.equal(market.lastTradePrice, 3);
  assert.equal(state.valuationPrices['commodity:wheat'], 11);
  assert.equal(state.assetSummary.commodityValue, 110);
}`,
);

replaceBetween(
  'server/test/market-reserve-operations.test.js',
  "test('empty player sell book receives a small expensive emergency reserve ask backed by real inventory', () => {",
  "test('two shortage cycles publish a fixed-term market reserve procurement contract",
  `test('emergency reserve ask remains internal while player buying uses the daily system price', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, bidderUser, now);
  player.credits = 100_000;
  const reserve = reserveFor(world);
  reserve.inventory = 1;
  reserve.frozenInventory = 0;
  reserve.targetInventory = 20;
  for (const state of Object.values(world.demandGroups)) {
    state.nextDemandAt = now;
    state.lastCycleId = Math.floor(now / cycleMs) - 1;
  }
  processWorld(world, now + 1);

  const emergency = world.orders.find((order) => (
    order.productId === 'wheat'
      && order.demandTier === 'liquidity-emergency-sell'
      && ['open', 'partial'].includes(order.status)
  ));
  assert.ok(emergency);
  assert.ok(emergency.price > Number(world.marketDemand.priceTransmission.products.wheat.referencePrice || 0));
  assert.ok(emergency.quantity <= Math.max(1, Math.ceil(reserve.targetInventory * 0.05)));
  const remainingBefore = emergency.remaining;
  const inventoryBefore = reserve.inventory;
  const frozenBefore = reserve.frozenInventory;

  const result = applyAction(world, bidderUser, 'placeOrder', {
    productId: 'wheat', side: 'buy', quantity: 1, price: emergency.price,
  }, now + 2);
  assert.equal(result.ok, true);
  assert.equal(player.inventories.wheat.available, 1);
  assert.equal(emergency.remaining, remainingBefore);
  assert.ok(['open', 'partial'].includes(emergency.status));
  assert.equal(reserve.inventory, inventoryBefore);
  assert.equal(reserve.frozenInventory, frozenBefore);
  const latest = world.markets.wheat.priceHistory.at(-1);
  assert.equal(latest.marketRole, 'player');
  assert.equal(latest.signalWeight, 1);
}`,
);

replaceBetween(
  'server/test/market-liquidity.test.js',
  "test('selling to a reserve transfers reserve funds and does not count as consumption issuance', () => {",
  "test('buying from a reserve transfers real inventory and returns credits to the reserve'",
  `test('player immediate selling does not consume an internal reserve bid', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.inventories.wheat.available = 10;
  world.marketDemand.liquidity.groups.food.reserves.wheat.inventory = 6;
  prepareAllDemand(world);
  processWorld(world, now + 1);
  cancelConsumptionBuys(world, 'wheat');

  const buyOrder = liquidityOrders(world, 'food', 'wheat')
    .find((order) => order.demandTier === 'liquidity-buy' && order.remaining > 0);
  assert.ok(buyOrder);
  const group = world.marketDemand.liquidity.groups.food;
  const reserve = group.reserves.wheat;
  const creditsBefore = player.credits;
  const reserveInventoryBefore = reserve.inventory;
  const reserveFundsBefore = group.credits + group.frozenCredits;
  const reserveRemainingBefore = buyOrder.remaining;

  const result = applyAction(world, alice, 'placeOrder', {
    productId: 'wheat', side: 'sell', quantity: 1, price: buyOrder.price,
  }, now + 2);
  assert.equal(result.ok, true);
  assert.equal(player.credits, Number((creditsBefore + result.netTotal).toFixed(6)));
  assert.equal(reserve.inventory, reserveInventoryBefore);
  assert.equal(group.credits + group.frozenCredits, reserveFundsBefore);
  assert.equal(buyOrder.remaining, reserveRemainingBefore);
}`,
);
replaceBetween(
  'server/test/market-liquidity.test.js',
  "test('buying from a reserve transfers real inventory and returns credits to the reserve', () => {",
  "test('liquidity orders are cancelled and re-reserved on the next cycle'",
  `test('player immediate buying does not consume an internal reserve ask', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 10_000;
  prepareAllDemand(world);
  processWorld(world, now + 1);

  const sellOrder = liquidityOrders(world, 'food', 'wheat')
    .find((order) => order.demandTier === 'liquidity-sell' && order.remaining > 0);
  assert.ok(sellOrder);
  const group = world.marketDemand.liquidity.groups.food;
  const reserve = group.reserves.wheat;
  const frozenBefore = reserve.frozenInventory;
  const fundsBefore = group.credits + group.frozenCredits;
  const remainingBefore = sellOrder.remaining;

  const result = applyAction(world, alice, 'placeOrder', {
    productId: 'wheat', side: 'buy', quantity: 1, price: sellOrder.price,
  }, now + 2);
  assert.equal(result.ok, true);
  assert.equal(player.inventories.wheat.available, 1);
  assert.equal(reserve.frozenInventory, frozenBefore);
  assert.equal(group.credits + group.frozenCredits, fundsBefore);
  assert.equal(sellOrder.remaining, remainingBefore);
}`,
);

replaceBetween(
  'server/test/provinces.test.js',
  "test('same commodity cannot match across states while same-state price-time order remains authoritative', () => {",
  "test('construction and production consume and output only the selected province inventory'",
  `test('same commodity immediate trades use independent state daily prices and inventories', () => {
  const world = createWorld(NOW);
  world.orders = [];
  const buyer = ensurePlayer(world, alice, NOW);
  const seller = ensurePlayer(world, bob, NOW);
  buyer.credits = 1_000;
  seller.credits = 0;
  inventoryForProvince(seller, 'wheat', GEORGIA).available = 1;
  world.markets[provinceScopedKey(CALIFORNIA, 'wheat')].officialPrice = 1;
  world.markets[provinceScopedKey(GEORGIA, 'wheat')].officialPrice = 2;

  const georgiaSell = applySettledCommodityOrder(world, bob, {
    provinceId: GEORGIA, productId: 'wheat', side: 'sell', quantity: 1, price: 999,
  }, NOW + 1);
  const californiaBuy = applySettledCommodityOrder(world, alice, {
    provinceId: CALIFORNIA, productId: 'wheat', side: 'buy', quantity: 2, price: 999,
  }, NOW + 2);
  const georgiaBuy = applySettledCommodityOrder(world, alice, {
    provinceId: GEORGIA, productId: 'wheat', side: 'buy', quantity: 1, price: 0.01,
  }, NOW + 3);

  assert.equal(georgiaSell.ok, true);
  assert.equal(californiaBuy.ok, true);
  assert.equal(georgiaBuy.ok, true);
  assert.equal(georgiaSell.executedPrice, 2);
  assert.equal(californiaBuy.executedPrice, 1);
  assert.equal(georgiaBuy.executedPrice, 2);
  assert.equal(inventoryForProvince(buyer, 'wheat', CALIFORNIA).available, 2);
  assert.equal(inventoryForProvince(buyer, 'wheat', GEORGIA).available, 1);
  assert.equal(inventoryForProvince(seller, 'wheat', GEORGIA).available, 0);
  assert.equal(world.markets[provinceScopedKey(CALIFORNIA, 'wheat')].todayBuyQuantity, 2);
  assert.equal(world.markets[provinceScopedKey(CALIFORNIA, 'wheat')].todaySellQuantity, 0);
  assert.equal(world.markets[provinceScopedKey(GEORGIA, 'wheat')].todayBuyQuantity, 1);
  assert.equal(world.markets[provinceScopedKey(GEORGIA, 'wheat')].todaySellQuantity, 1);
  assert.equal(world.orders.some((order) => order.ownerType === 'player' && ['open', 'partial'].includes(order.status)), false);
}`,
);

const tempPaths = [
  'scripts/codex-bulk-immediate-market-test-migration.mjs',
  '.github/workflows/codex-bulk-immediate-market-test-migration.yml',
];
for (const path of tempPaths) if (existsSync(path)) unlinkSync(path);
