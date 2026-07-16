import { randomUUID } from 'node:crypto';

export const ECONOMY_CONSTANTS = Object.freeze({
  maxOpenOrders: 10,
  maxOrderQuantity: 10_000,
  workCooldownMs: 10_000,
  demandCycleMs: 5 * 60 * 1000,
  maxPricePoints: 288,
  maxTradesPerPlayer: 240,
  maxLedgerPerPlayer: 360,
  defaultInventoryCapacity: 500,
  maxFacilitiesProcessedPerTick: 10_000,
});

export const PRODUCT_CATALOG = Object.freeze([
  { id: 'wheat', name: '小麦', category: 'raw', family: 'staple', substitutionGroupId: 'staples', basePrice: 6 },
  { id: 'rice', name: '水稻', category: 'raw', family: 'staple', substitutionGroupId: 'staples', basePrice: 6 },
  { id: 'timber', name: '木材', category: 'raw', basePrice: 7 },
  { id: 'ore', name: '铁矿石', category: 'raw', basePrice: 8 },
  { id: 'crude-oil', name: '原油', category: 'raw', basePrice: 10 },
  { id: 'flour', name: '面粉', category: 'intermediate', basePrice: 13 },
  { id: 'lumber', name: '木板', category: 'intermediate', basePrice: 16 },
  { id: 'steel', name: '钢材', category: 'intermediate', basePrice: 20 },
  { id: 'plastic', name: '塑料', category: 'intermediate', basePrice: 30 },
  { id: 'food', name: '食品', category: 'consumer', basePrice: 18 },
  { id: 'furniture', name: '家具', category: 'consumer', basePrice: 38 },
  { id: 'machinery', name: '机械', category: 'industrial', basePrice: 45 },
  { id: 'electronics', name: '电子产品', category: 'industrial', basePrice: 72 },
]);

const FACILITY_TYPE_BASE_CATALOG = [
  {
    id: 'farm',
    name: '农场',
    category: 'raw',
    buildCost: 60,
    buildTimeMs: 5 * 60 * 1000,
    cycleMs: 30_000,
    operatingCost: 1,
    input: null,
    output: { productId: 'wheat', quantity: 2 },
    defaultRecipeId: 'wheat-crop',
    recipes: [
      {
        id: 'wheat-crop',
        name: '种植小麦',
        cycleMs: 30_000,
        operatingCost: 1,
        input: null,
        output: { productId: 'wheat', quantity: 2 },
      },
      {
        id: 'rice-crop',
        name: '种植水稻',
        cycleMs: 30_000,
        operatingCost: 1,
        input: null,
        output: { productId: 'rice', quantity: 2 },
      },
    ],
    internalCapacity: 40,
    systemValue: 80,
  },
  {
    id: 'logging-camp',
    name: '伐木场',
    category: 'raw',
    buildCost: 65,
    buildTimeMs: 5 * 60 * 1000,
    cycleMs: 32_000,
    operatingCost: 1,
    input: null,
    output: { productId: 'timber', quantity: 2 },
    internalCapacity: 40,
    systemValue: 85,
  },
  {
    id: 'mine',
    name: '矿场',
    category: 'raw',
    buildCost: 70,
    buildTimeMs: 5 * 60 * 1000,
    cycleMs: 35_000,
    operatingCost: 1,
    input: null,
    output: { productId: 'ore', quantity: 2 },
    internalCapacity: 40,
    systemValue: 90,
  },
  {
    id: 'oil-field',
    name: '油田',
    category: 'raw',
    buildCost: 95,
    buildTimeMs: 7 * 60 * 1000,
    cycleMs: 42_000,
    operatingCost: 2,
    input: null,
    output: { productId: 'crude-oil', quantity: 2 },
    internalCapacity: 40,
    systemValue: 120,
  },
  {
    id: 'mill',
    name: '面粉厂',
    category: 'processing',
    buildCost: 100,
    buildTimeMs: 8 * 60 * 1000,
    cycleMs: 40_000,
    operatingCost: 2,
    input: { productId: 'wheat', quantity: 2 },
    output: { productId: 'flour', quantity: 1 },
    internalCapacity: 30,
    systemValue: 130,
  },
  {
    id: 'sawmill',
    name: '锯木厂',
    category: 'processing',
    buildCost: 115,
    buildTimeMs: 8 * 60 * 1000,
    cycleMs: 45_000,
    operatingCost: 2,
    input: { productId: 'timber', quantity: 2 },
    output: { productId: 'lumber', quantity: 1 },
    internalCapacity: 30,
    systemValue: 150,
  },
  {
    id: 'steelworks',
    name: '钢铁厂',
    category: 'processing',
    buildCost: 140,
    buildTimeMs: 10 * 60 * 1000,
    cycleMs: 50_000,
    operatingCost: 3,
    input: { productId: 'ore', quantity: 3 },
    output: { productId: 'steel', quantity: 1 },
    internalCapacity: 25,
    systemValue: 180,
  },
  {
    id: 'refinery',
    name: '炼油厂',
    category: 'processing',
    buildCost: 185,
    buildTimeMs: 12 * 60 * 1000,
    cycleMs: 65_000,
    operatingCost: 4,
    input: { productId: 'crude-oil', quantity: 2 },
    output: { productId: 'plastic', quantity: 1 },
    internalCapacity: 25,
    systemValue: 240,
  },
  {
    id: 'food-factory',
    name: '食品厂',
    category: 'consumer',
    buildCost: 160,
    buildTimeMs: 10 * 60 * 1000,
    cycleMs: 45_000,
    operatingCost: 3,
    input: { productId: 'flour', quantity: 2 },
    output: { productId: 'food', quantity: 3 },
    internalCapacity: 45,
    systemValue: 210,
  },
  {
    id: 'furniture-factory',
    name: '家具厂',
    category: 'consumer',
    buildCost: 210,
    buildTimeMs: 12 * 60 * 1000,
    cycleMs: 60_000,
    operatingCost: 4,
    input: { productId: 'lumber', quantity: 2 },
    output: { productId: 'furniture', quantity: 2 },
    internalCapacity: 35,
    systemValue: 275,
  },
  {
    id: 'machine-factory',
    name: '机械厂',
    category: 'industrial',
    buildCost: 240,
    buildTimeMs: 15 * 60 * 1000,
    cycleMs: 90_000,
    operatingCost: 6,
    input: { productId: 'steel', quantity: 2 },
    output: { productId: 'machinery', quantity: 1 },
    internalCapacity: 15,
    systemValue: 320,
  },
  {
    id: 'electronics-factory',
    name: '电子工厂',
    category: 'industrial',
    buildCost: 320,
    buildTimeMs: 18 * 60 * 1000,
    cycleMs: 110_000,
    operatingCost: 8,
    input: { productId: 'plastic', quantity: 2 },
    output: { productId: 'electronics', quantity: 1 },
    internalCapacity: 15,
    systemValue: 420,
  },

];

const FACILITY_PRODUCT_NAMES = new Map(PRODUCT_CATALOG.map((product) => [product.id, product.name]));

export const FACILITY_TYPE_CATALOG = Object.freeze(FACILITY_TYPE_BASE_CATALOG.map((facility) => {
  const recipes = Array.isArray(facility.recipes) && facility.recipes.length > 0
    ? facility.recipes
    : [{
      id: `${facility.id}-default`,
      name: `生产${FACILITY_PRODUCT_NAMES.get(facility.output.productId) || facility.name}`,
      cycleMs: facility.cycleMs,
      operatingCost: facility.operatingCost,
      input: facility.input,
      output: facility.output,
    }];
  return Object.freeze({
    ...facility,
    defaultRecipeId: facility.defaultRecipeId || recipes[0].id,
    recipes: Object.freeze(recipes.map((recipe) => Object.freeze({ ...recipe }))),
  });
}));

export const DEMAND_GROUP_CATALOG = Object.freeze([
  {
    id: 'staples',
    name: '人口主食需求',
    ownerName: '人口主食需求',
    cycleMs: ECONOMY_CONSTANTS.demandCycleMs,
    baseBudget: 60,
    priceElasticity: 3,
    maxPriceIndex: 2,
    quoteDepth: 4,
    products: [
      { productId: 'wheat', preferenceWeight: 1 },
      { productId: 'rice', preferenceWeight: 1 },
    ],
  },
]);

const PRODUCTS = new Map(PRODUCT_CATALOG.map((product) => [product.id, product]));
const FACILITY_TYPES = new Map(FACILITY_TYPE_CATALOG.map((facility) => [facility.id, facility]));
const DEMAND_GROUPS = new Map(DEMAND_GROUP_CATALOG.map((group) => [group.id, group]));

function createId(prefix) {
  return `${prefix}-${randomUUID()}`;
}

function clone(value) {
  return structuredClone(value);
}

function productDefinition(productId) {
  return PRODUCTS.get(productId) || PRODUCTS.get('wheat');
}

function facilityTypeDefinition(typeId) {
  return FACILITY_TYPES.get(typeId) || FACILITY_TYPES.get('farm');
}

function createInventories() {
  return Object.fromEntries(PRODUCT_CATALOG.map((product) => [product.id, { available: 0, frozen: 0 }]));
}

function inventoryFor(player, productId) {
  const id = productDefinition(productId).id;
  player.inventories ||= createInventories();
  player.inventories[id] ||= { available: 0, frozen: 0 };
  return player.inventories[id];
}

function inventoryUsed(player) {
  return Object.values(player.inventories || {}).reduce(
    (sum, inventory) => sum + Number(inventory.available || 0) + Number(inventory.frozen || 0),
    0,
  );
}

function addLedger(player, category, amount, description, createdAt = Date.now()) {
  player.ledger.unshift({
    id: createId('ledger'),
    category,
    amount,
    balanceAfter: player.credits,
    createdAt,
    description,
  });
  player.ledger = player.ledger.slice(0, ECONOMY_CONSTANTS.maxLedgerPerPlayer);
}

function addTrade(player, trade) {
  player.trades.unshift({ id: createId('trade'), ...trade });
  player.trades = player.trades.slice(0, ECONOMY_CONSTANTS.maxTradesPerPlayer);
}

function seedPriceHistory(product, now) {
  const offsets = [-1, 0, 1, 0, 1, 1, 0, -1, 0, 1, 0, 0, 1, -1, 0, 1, 0, 1, 0, -1, 0, 1, 0, 0];
  return offsets.map((offset, index) => ({
    price: Math.max(1, product.basePrice + offset),
    quantity: 3 + (index % 5),
    createdAt: now - 60_000 * (offsets.length - index),
  }));
}

function createMarket(product, now) {
  return {
    productId: product.id,
    lastPrice: product.basePrice,
    priceHistory: seedPriceHistory(product, now),
    demand: {
      cycleMs: ECONOMY_CONSTANTS.demandCycleMs,
      nextDemandAt: now + ECONOMY_CONSTANTS.demandCycleMs,
      lastBudget: product.basePrice * 8,
      lastQuantity: 8,
      lastPrice: product.basePrice,
      satisfaction: 0.7,
    },
  };
}

function createMarkets(now) {
  return Object.fromEntries(PRODUCT_CATALOG.map((product) => [product.id, createMarket(product, now)]));
}

function createDemandGroups(now) {
  return Object.fromEntries(DEMAND_GROUP_CATALOG.map((group) => [group.id, {
    demandGroupId: group.id,
    cycleMs: group.cycleMs,
    nextDemandAt: now + group.cycleMs,
    lastCycleId: -1,
    lastBudget: group.baseBudget,
    lastCommitted: 0,
    satisfaction: 0,
    lastAllocation: {},
  }]));
}

function marketFor(world, productId) {
  const product = productDefinition(productId);
  world.markets ||= createMarkets(Date.now());
  world.markets[product.id] ||= createMarket(product, Date.now());
  return world.markets[product.id];
}

function seedOrders(now) {
  return PRODUCT_CATALOG.flatMap((product, index) => [
    {
      id: createId('market-order'),
      productId: product.id,
      side: 'buy',
      ownerType: 'market',
      ownerName: '市场流动采购',
      price: Math.max(1, product.basePrice - 1),
      quantity: 18,
      remaining: 18,
      status: 'open',
      createdAt: now - 8_000 + index,
    },
    {
      id: createId('market-order'),
      productId: product.id,
      side: 'sell',
      ownerType: 'market',
      ownerName: '市场流动供给',
      price: product.basePrice + 1,
      quantity: 14,
      remaining: 14,
      status: 'open',
      createdAt: now - 5_000 + index,
    },
  ]);
}

function createFacilityFromType(typeId, ownerId, now, overrides = {}) {
  const type = facilityTypeDefinition(typeId);
  return {
    id: overrides.id || createId('facility'),
    facilityTypeId: type.id,
    name: overrides.name || type.name,
    ownerId,
    level: Number(overrides.level || 1),
    status: overrides.status || 'constructing',
    stopReason: overrides.stopReason,
    builtAt: Number(overrides.builtAt || 0),
    constructionCompletesAt: overrides.constructionCompletesAt,
    cycleStartedAt: overrides.cycleStartedAt,
    cycleMs: type.cycleMs,
    outputProductId: type.output.productId,
    outputPerCycle: type.output.quantity,
    inputProductId: type.input?.productId,
    inputPerCycle: type.input?.quantity || 0,
    operatingCost: type.operatingCost,
    internalGoods: Number(overrides.internalGoods || 0),
    internalCapacity: type.internalCapacity,
    lifetimeOutput: Number(overrides.lifetimeOutput || 0),
    systemValue: type.systemValue,
    listedOrderId: overrides.listedOrderId,
  };
}

function facilitySnapshot(facility) {
  return {
    id: facility.id,
    facilityTypeId: facility.facilityTypeId,
    name: facility.name,
    level: facility.level,
    cycleMs: facility.cycleMs,
    outputProductId: facility.outputProductId,
    outputPerCycle: facility.outputPerCycle,
    inputProductId: facility.inputProductId,
    inputPerCycle: facility.inputPerCycle,
    operatingCost: facility.operatingCost,
    internalCapacity: facility.internalCapacity,
    lifetimeOutput: facility.lifetimeOutput,
    systemValue: facility.systemValue,
  };
}

function seedFacilityListings(now) {
  const facility = createFacilityFromType('farm', 0, now, {
    id: createId('market-facility'),
    name: '成熟农场 A-17',
    status: 'paused',
    builtAt: now - 86_400_000,
    lifetimeOutput: 74,
  });
  return [{
    id: createId('facility-listing'),
    facilityId: facility.id,
    ownerType: 'market',
    ownerName: '系统资产市场',
    price: 86,
    createdAt: now - 30_000,
    facility: facilitySnapshot(facility),
  }];
}

export function createWorld(now = Date.now()) {
  return {
    version: 8,
    players: {},
    orders: seedOrders(now),
    facilityListings: seedFacilityListings(now),
    markets: createMarkets(now),
    demandGroups: createDemandGroups(now),
    lastProcessedAt: now,
  };
}

function createPlayer(user, now) {
  const player = {
    userId: Number(user.id),
    playerName: String(user.name || user.email?.split('@')[0] || '新玩家').trim().slice(0, 32) || '新玩家',
    registeredAt: now,
    credits: 100,
    frozenCredits: 0,
    inventories: createInventories(),
    inventoryCapacity: ECONOMY_CONSTANTS.defaultInventoryCapacity,
    facilities: [],
    trades: [],
    ledger: [],
    work: { cooldownUntil: 0, lastWorkedAt: 0, streak: 0, totalClicks: 0 },
    stats: {
      workIssued: 0,
      populationIssued: 0,
      systemSinks: 0,
      commodityVolume: 0,
      facilityVolume: 0,
      workClicks: 0,
      producedGoods: 0,
      boughtGoods: 0,
      soldGoods: 0,
      giftIssued: 0,
    },
  };
  addLedger(player, 'system', 100, '服务器发放玩家启动资金', now);
  return player;
}

function migrateFacility(facility, ownerId) {
  if (facility.facilityTypeId) {
    const type = facilityTypeDefinition(facility.facilityTypeId);
    if (facility.outputProductId === 'grain') facility.outputProductId = 'wheat';
    if (facility.inputProductId === 'grain') facility.inputProductId = 'wheat';
    facility.outputProductId ||= type.output.productId;
    facility.outputPerCycle ||= type.output.quantity;
    facility.inputProductId ||= type.input?.productId;
    facility.inputPerCycle ||= type.input?.quantity || 0;
    delete facility.productionMode;
    delete facility.targetQuantity;
    delete facility.completedQuantity;
    return facility;
  }
  const statusMap = {
    constructing: 'constructing',
    running: 'running',
    listed: 'listed',
    ready: 'ready',
    paused: 'paused',
    full: 'full',
    insufficient_funds: 'insufficient_funds',
  };
  return createFacilityFromType('farm', ownerId, Date.now(), {
    ...facility,
    status: statusMap[facility.status] || 'paused',
  });
}

export function migrateWorld(world, now = Date.now()) {
  if (!world || typeof world !== 'object') return createWorld(now);

  if (!world.markets) {
    const markets = createMarkets(now);
    if (Number.isFinite(world.marketPrice)) markets.wheat.lastPrice = Number(world.marketPrice);
    if (Array.isArray(world.marketPriceHistory) && world.marketPriceHistory.length) {
      markets.wheat.priceHistory = world.marketPriceHistory.map((point) => ({
        price: Number(point.price || markets.wheat.lastPrice),
        quantity: Number(point.quantity || 1),
        createdAt: Number(point.createdAt || now),
      }));
    }
    if (world.demand) markets.wheat.demand = { ...markets.wheat.demand, ...world.demand };
    world.markets = markets;
  }

  if (world.markets.grain) {
    if (!world.markets.wheat) world.markets.wheat = world.markets.grain;
    world.markets.wheat.productId = 'wheat';
    delete world.markets.grain;
  }
  for (const product of PRODUCT_CATALOG) world.markets[product.id] ||= createMarket(product, now);

  world.orders ||= [];
  for (const order of world.orders) {
    if (order.productId === 'grain') order.productId = 'wheat';
    if (order.assetId === 'grain') order.assetId = 'wheat';
    order.productId ||= 'wheat';
    order.fills = Array.isArray(order.fills) ? order.fills : [];
  }

  world.facilityListings ||= [];
  for (const listing of world.facilityListings) {
    listing.facility ||= {};
    listing.facility.facilityTypeId ||= 'farm';
    if (listing.facility.outputProductId === 'grain') listing.facility.outputProductId = 'wheat';
    listing.facility.outputProductId ||= 'wheat';
    listing.facility.outputPerCycle ||= 1;
    listing.facility.inputPerCycle ||= 0;
  }

  world.players ||= {};
  for (const player of Object.values(world.players)) {
    if (!player.inventories) {
      player.inventories = createInventories();
      player.inventories.wheat.available = Number(player.inventory || 0);
      player.inventories.wheat.frozen = Number(player.frozenInventory || 0);
    }
    if (player.inventories.grain) {
      player.inventories.wheat ||= { available: 0, frozen: 0 };
      player.inventories.wheat.available += Number(player.inventories.grain.available || 0);
      player.inventories.wheat.frozen += Number(player.inventories.grain.frozen || 0);
      delete player.inventories.grain;
    }
    for (const product of PRODUCT_CATALOG) inventoryFor(player, product.id);
    player.inventoryCapacity = Number(player.inventoryCapacity || ECONOMY_CONSTANTS.defaultInventoryCapacity);
    player.facilities = (player.facilities || []).map((facility) => migrateFacility(facility, player.userId));
    player.trades ||= [];
    for (const trade of player.trades) {
      if (trade.productId === 'grain') trade.productId = 'wheat';
      if (trade.type === 'commodity') trade.productId ||= 'wheat';
    }
    player.ledger ||= [];
    player.work ||= { cooldownUntil: 0, lastWorkedAt: 0, streak: 0, totalClicks: 0 };
    player.work.streak = 0;
    player.stats ||= {};
    player.stats.workIssued = Number(player.stats.workIssued || 0);
    player.stats.populationIssued = Number(player.stats.populationIssued || 0);
    player.stats.systemSinks = Number(player.stats.systemSinks || 0);
    player.stats.commodityVolume = Number(player.stats.commodityVolume || 0);
    player.stats.facilityVolume = Number(player.stats.facilityVolume || 0);
    player.stats.workClicks = Number(player.stats.workClicks ?? player.work.totalClicks ?? 0);
    player.stats.producedGoods = Number(player.stats.producedGoods || 0);
    player.stats.boughtGoods = Number(player.stats.boughtGoods || 0);
    player.stats.soldGoods = Number(player.stats.soldGoods || 0);
    player.stats.giftIssued = Number(player.stats.giftIssued || 0);
    delete player.inventory;
    delete player.frozenInventory;
    delete player.facilitySlots;
  }

  delete world.marketPrice;
  delete world.marketPriceHistory;
  delete world.demand;
  world.demandGroups ||= createDemandGroups(now);
  for (const group of DEMAND_GROUP_CATALOG) {
    world.demandGroups[group.id] = { ...createDemandGroups(now)[group.id], ...world.demandGroups[group.id] };
  }
  world.version = 8;
  return world;
}

export function ensurePlayer(world, user, now = Date.now()) {
  migrateWorld(world, now);
  const key = String(user.id);
  if (!world.players[key]) world.players[key] = createPlayer(user, now);
  return world.players[key];
}

function isOpenOrder(order) {
  return order.remaining > 0 && (order.status === 'open' || order.status === 'partial');
}

function recordPrice(world, productId, price, quantity, createdAt) {
  const market = marketFor(world, productId);
  market.lastPrice = price;
  market.priceHistory.push({ price, quantity, createdAt });
  market.priceHistory = market.priceHistory.slice(-ECONOMY_CONSTANTS.maxPricePoints);
}

function totalAssets(world, player) {
  const inventoryValue = PRODUCT_CATALOG.reduce((sum, product) => {
    const inventory = inventoryFor(player, product.id);
    return sum + (inventory.available + inventory.frozen) * marketFor(world, product.id).lastPrice;
  }, 0);
  const facilityValue = player.facilities.reduce((sum, facility) => (
    sum + facility.systemValue + facility.internalGoods * marketFor(world, facility.outputProductId).lastPrice
  ), 0);
  return player.credits + player.frozenCredits + inventoryValue + facilityValue;
}

function pendingBuyQuantity(world, userId) {
  return world.orders
    .filter((order) => order.ownerId === userId && order.side === 'buy' && order.assetKind !== 'facility' && isOpenOrder(order))
    .reduce((sum, order) => sum + order.remaining, 0);
}

function sortCandidates(orders, side) {
  return [...orders].sort((left, right) => {
    if (left.price !== right.price) return side === 'buy' ? left.price - right.price : right.price - left.price;
    return left.createdAt - right.createdAt;
  });
}

function describeCounterparty(order) {
  return order.ownerName || (order.ownerType === 'population' ? '人口需求' : '市场');
}

function appendPlayerOrderFill(order, fill) {
  if (order.ownerType !== 'player') return;
  order.fills = Array.isArray(order.fills) ? order.fills : [];
  order.fills.push(fill);
  order.fills = order.fills.slice(-120);
}

function settlePlayerBuy(world, order, quantity, tradePrice, sellerName, createdAt) {
  const player = world.players[String(order.ownerId)];
  if (!player) throw new Error(`Missing buyer ${order.ownerId}`);
  const reserved = quantity * order.price;
  const actual = quantity * tradePrice;
  player.frozenCredits -= reserved;
  player.credits += reserved - actual;
  inventoryFor(player, order.productId).available += quantity;
  player.stats.commodityVolume += quantity;
  player.stats.boughtGoods = Number(player.stats.boughtGoods || 0) + quantity;
  const product = productDefinition(order.productId);
  addTrade(player, {
    type: 'commodity',
    productId: product.id,
    side: 'buy',
    quantity,
    price: tradePrice,
    total: actual,
    counterparty: sellerName,
    createdAt,
    description: `买入 ${product.name}`,
  });
  addLedger(player, 'market_trade', -actual, `买入 ${quantity} 个${product.name}，成交价 ${tradePrice}`, createdAt);
}

function settlePlayerSell(world, order, quantity, tradePrice, buyer, createdAt) {
  const player = world.players[String(order.ownerId)];
  if (!player) throw new Error(`Missing seller ${order.ownerId}`);
  const inventory = inventoryFor(player, order.productId);
  const total = quantity * tradePrice;
  inventory.frozen -= quantity;
  player.credits += total;
  player.stats.commodityVolume += quantity;
  player.stats.soldGoods = Number(player.stats.soldGoods || 0) + quantity;
  if (buyer.ownerType === 'population') player.stats.populationIssued += total;
  const product = productDefinition(order.productId);
  addTrade(player, {
    type: 'commodity',
    productId: product.id,
    side: 'sell',
    quantity,
    price: tradePrice,
    total,
    counterparty: describeCounterparty(buyer),
    createdAt,
    description: `卖出 ${product.name}`,
  });
  addLedger(
    player,
    buyer.ownerType === 'population' ? 'population_income' : 'market_trade',
    total,
    `${buyer.ownerType === 'population' ? '人口需求消费' : '卖出'} ${quantity} 个${product.name}，成交价 ${tradePrice}`,
    createdAt,
  );
}

function executeTrade(world, incoming, resting, quantity, createdAt) {
  const buy = incoming.side === 'buy' ? incoming : resting;
  const sell = incoming.side === 'sell' ? incoming : resting;
  const price = resting.price;
  const fillId = createId('order-fill');
  const fillBase = {
    id: fillId,
    quantity,
    price,
    total: quantity * price,
    createdAt,
    makerOrderId: resting.id,
    takerOrderId: incoming.id,
  };
  incoming.remaining -= quantity;
  resting.remaining -= quantity;
  incoming.status = incoming.remaining === 0 ? 'filled' : 'partial';
  resting.status = resting.remaining === 0 ? 'filled' : 'partial';
  appendPlayerOrderFill(buy, {
    ...fillBase,
    counterparty: describeCounterparty(sell),
    liquidity: buy.id === resting.id ? 'maker' : 'taker',
  });
  appendPlayerOrderFill(sell, {
    ...fillBase,
    counterparty: describeCounterparty(buy),
    liquidity: sell.id === resting.id ? 'maker' : 'taker',
  });
  if (buy.ownerType === 'player') settlePlayerBuy(world, buy, quantity, price, describeCounterparty(sell), createdAt);
  if (sell.ownerType === 'player') settlePlayerSell(world, sell, quantity, price, buy, createdAt);
  recordPrice(world, incoming.productId, price, quantity, createdAt);
}

function matchOrder(world, incoming, createdAt) {
  const opposite = incoming.side === 'buy' ? 'sell' : 'buy';
  const candidates = sortCandidates(
    world.orders.filter((order) => (
      order.id !== incoming.id
      && order.productId === incoming.productId
      && order.side === opposite
      && isOpenOrder(order)
      && !(order.ownerType === 'player' && incoming.ownerType === 'player' && order.ownerId === incoming.ownerId)
      && (incoming.side === 'buy' ? order.price <= incoming.price : order.price >= incoming.price)
    )),
    incoming.side,
  );
  for (const candidate of candidates) {
    if (!isOpenOrder(incoming)) break;
    executeTrade(world, incoming, candidate, Math.min(incoming.remaining, candidate.remaining), createdAt);
  }
}

function expirePopulationOrders(world, productId) {
  for (const order of world.orders) {
    if (order.productId === productId && order.ownerType === 'population' && isOpenOrder(order)) {
      order.status = 'cancelled';
    }
  }
}

function createPopulationDemand(world, productId, now) {
  const product = productDefinition(productId);
  const market = marketFor(world, product.id);
  expirePopulationOrders(world, product.id);
  const tick = Math.floor(now / market.demand.cycleMs);
  const price = Math.max(1, product.basePrice + ((tick + product.id.length) % 3) - 1);
  const baseQuantity = product.category === 'consumer' ? 14 : product.category === 'industrial' ? 4 : 8;
  const quantity = baseQuantity + (tick % 4);
  const order = {
    id: createId('population-order'),
    productId: product.id,
    side: 'buy',
    ownerType: 'population',
    ownerName: product.category === 'industrial' ? '企业采购' : '人口需求',
    price,
    quantity,
    remaining: quantity,
    status: 'open',
    createdAt: now,
  };
  world.orders.push(order);
  market.demand.lastPrice = price;
  market.demand.lastQuantity = quantity;
  market.demand.lastBudget = price * quantity;
  market.demand.nextDemandAt = now + market.demand.cycleMs;
  matchOrder(world, order, now);
  market.demand.satisfaction = quantity === 0 ? 1 : Math.max(0.2, Math.min(1, (quantity - order.remaining) / quantity));
}

function commodityBookPrices(world, productId) {
  let bestBid;
  let bestAsk;
  for (const order of world.orders || []) {
    const price = Number(order.price);
    if (order.productId !== productId || !isOpenOrder(order) || !Number.isInteger(price) || price < 1) continue;
    if (order.side === 'buy') bestBid = bestBid === undefined ? price : Math.max(bestBid, price);
    if (order.side === 'sell') bestAsk = bestAsk === undefined ? price : Math.min(bestAsk, price);
  }
  return { bestBid, bestAsk };
}

function commodityLiquidityPrices(product, bestBid, bestAsk) {
  let buyPrice = bestBid ?? (bestAsk === undefined ? Math.max(1, product.basePrice - 1) : bestAsk - 1);
  let sellPrice = bestAsk ?? (bestBid === undefined ? product.basePrice + 1 : bestBid + 1);

  if (bestAsk !== undefined) buyPrice = Math.min(buyPrice, bestAsk - 1);
  if (bestBid !== undefined) sellPrice = Math.max(sellPrice, bestBid + 1);

  return {
    buyPrice: Number.isInteger(buyPrice) && buyPrice >= 1 ? buyPrice : null,
    sellPrice: Math.max(1, Math.floor(sellPrice)),
  };
}

function refreshExternalLiquidity(world, now) {
  for (const product of PRODUCT_CATALOG) {
    const openBuy = world.orders.filter((order) => (
      order.productId === product.id && order.ownerType === 'market' && order.side === 'buy' && isOpenOrder(order)
    ));
    const openSell = world.orders.filter((order) => (
      order.productId === product.id && order.ownerType === 'market' && order.side === 'sell' && isOpenOrder(order)
    ));
    if (openBuy.length > 0 && openSell.length > 0) continue;

    const { bestBid, bestAsk } = commodityBookPrices(world, product.id);
    const { buyPrice, sellPrice } = commodityLiquidityPrices(product, bestBid, bestAsk);

    if (openBuy.length < 1 && buyPrice !== null) {
      const order = {
        id: createId('market-order'),
        productId: product.id,
        side: 'buy',
        ownerType: 'market',
        ownerName: '市场流动采购',
        price: buyPrice,
        quantity: 18,
        remaining: 18,
        status: 'open',
        createdAt: now,
      };
      world.orders.push(order);
      matchOrder(world, order, now);
    }
    if (openSell.length < 1) {
      const order = {
        id: createId('market-order'),
        productId: product.id,
        side: 'sell',
        ownerType: 'market',
        ownerName: '市场流动供给',
        price: sellPrice,
        quantity: 14,
        remaining: 14,
        status: 'open',
        createdAt: now,
      };
      world.orders.push(order);
      matchOrder(world, order, now);
    }
  }
}

function stopFacility(facility, status, reason) {
  facility.status = status;
  facility.stopReason = reason;
  delete facility.cycleStartedAt;
}

function processFacilities(player, now) {
  for (const facility of player.facilities.slice(0, ECONOMY_CONSTANTS.maxFacilitiesProcessedPerTick)) {
    if (facility.status === 'constructing' && facility.constructionCompletesAt && now >= facility.constructionCompletesAt) {
      facility.status = 'ready';
      facility.stopReason = 'manual';
      facility.builtAt = facility.constructionCompletesAt;
      delete facility.constructionCompletesAt;
      addLedger(player, 'system', 0, `${facility.name} 已完成施工，等待手动启动`, now);
    }

    if (facility.status !== 'running' || !facility.cycleStartedAt) continue;
    const elapsedCycles = Math.max(0, Math.floor((now - facility.cycleStartedAt) / facility.cycleMs));
    if (elapsedCycles < 1) continue;

    const outputCapacityCycles = Math.max(0, Math.floor(
      (facility.internalCapacity - facility.internalGoods) / facility.outputPerCycle,
    ));
    const fundsCycles = facility.operatingCost > 0
      ? Math.max(0, Math.floor(player.credits / facility.operatingCost))
      : elapsedCycles;
    const inputInventory = facility.inputProductId ? inventoryFor(player, facility.inputProductId) : null;
    const inputCycles = facility.inputPerCycle > 0
      ? Math.max(0, Math.floor(inputInventory.available / facility.inputPerCycle))
      : elapsedCycles;
    const completedCycles = Math.min(
      elapsedCycles,
      outputCapacityCycles,
      fundsCycles,
      inputCycles,
      50_000,
    );

    if (completedCycles > 0) {
      const operationCost = completedCycles * facility.operatingCost;
      const outputQuantity = completedCycles * facility.outputPerCycle;
      const inputQuantity = completedCycles * facility.inputPerCycle;
      player.credits -= operationCost;
      player.stats.systemSinks += operationCost;
      if (inputInventory) inputInventory.available -= inputQuantity;
      facility.internalGoods += outputQuantity;
      facility.lifetimeOutput += outputQuantity;
      facility.cycleStartedAt += completedCycles * facility.cycleMs;
      addLedger(
        player,
        'facility_operation',
        -operationCost,
        `${facility.name} 完成 ${completedCycles} 个生产周期，产出 ${outputQuantity} 个${productDefinition(facility.outputProductId).name}`,
        facility.cycleStartedAt,
      );
    }

    if (facility.internalGoods + facility.outputPerCycle > facility.internalCapacity) {
      stopFacility(facility, 'full', 'output_full');
      continue;
    }
    if (player.credits < facility.operatingCost) {
      stopFacility(facility, 'insufficient_funds', 'insufficient_funds');
      continue;
    }
    if (facility.inputProductId && inventoryFor(player, facility.inputProductId).available < facility.inputPerCycle) {
      stopFacility(facility, 'insufficient_input', 'insufficient_input');
    }
  }
}

function pruneWorld(world, now) {
  const cutoff = now - 24 * 60 * 60 * 1000;
  const openOrders = world.orders.filter(isOpenOrder);
  const recentClosed = world.orders.filter((order) => !isOpenOrder(order) && order.createdAt >= cutoff).slice(-800);
  world.orders = [...recentClosed, ...openOrders].slice(-4_000);
  world.facilityListings = world.facilityListings.slice(-800);
}

export function processWorld(world, now = Date.now()) {
  migrateWorld(world, now);
  for (const player of Object.values(world.players)) processFacilities(player, now);
  const stapleDemand = world.demandGroups?.staples;
  if (!stapleDemand || now >= stapleDemand.nextDemandAt) createGroupedDemand(world, 'staples', now);
  for (const product of PRODUCT_CATALOG) {
    if (product.substitutionGroupId === 'staples') continue;
    const market = marketFor(world, product.id);
    if (now >= market.demand.nextDemandAt) createPopulationDemand(world, product.id, now);
  }
  refreshExternalLiquidity(world, now);
  pruneWorld(world, now);
  return world;
}

function expireDemandGroupOrders(world, demandGroupId) {
  const productIds = new Set(DEMAND_GROUPS.get(demandGroupId)?.products.map((item) => item.productId) || []);
  for (const order of world.orders) {
    if (order.ownerType === 'population' && isOpenOrder(order)
      && (order.demandGroupId === demandGroupId || productIds.has(order.productId))) {
      order.status = 'cancelled';
    }
  }
}

function demandQuote(world, product, group) {
  const asks = sortCandidates(world.orders.filter((order) => (
    order.productId === product.id && order.side === 'sell' && isOpenOrder(order)
  )), 'buy');
  let remaining = group.quoteDepth;
  let cost = 0;
  let highestPrice = Math.max(1, Number(marketFor(world, product.id).lastPrice || product.basePrice));
  for (const ask of asks) {
    if (remaining <= 0) break;
    const quantity = Math.min(remaining, Math.max(0, Number(ask.remaining || 0)));
    if (quantity <= 0) continue;
    highestPrice = Math.max(highestPrice, Number(ask.price || product.basePrice));
    cost += quantity * Number(ask.price || product.basePrice);
    remaining -= quantity;
  }
  if (remaining > 0) cost += remaining * Math.ceil(highestPrice * (1 + 0.25 * remaining / group.quoteDepth));
  return Math.max(1, Math.ceil(cost / group.quoteDepth));
}

function createGroupedDemand(world, groupId, now) {
  const group = DEMAND_GROUPS.get(groupId);
  if (!group) return;
  world.demandGroups ||= createDemandGroups(now);
  const state = world.demandGroups[group.id] ||= createDemandGroups(now)[group.id];
  const cycleId = Math.floor(now / group.cycleMs);
  if (Number(state.lastCycleId) === cycleId) {
    state.nextDemandAt = (cycleId + 1) * group.cycleMs;
    return;
  }

  expireDemandGroupOrders(world, group.id);
  const choices = group.products.map((option) => {
    const product = productDefinition(option.productId);
    const quote = demandQuote(world, product, group);
    const priceIndex = quote / product.basePrice;
    const score = priceIndex <= group.maxPriceIndex
      ? option.preferenceWeight * priceIndex ** -group.priceElasticity
      : 0;
    return { option, product, quote, priceIndex, score };
  });
  const totalScore = choices.reduce((sum, choice) => sum + choice.score, 0);
  let remainingBudget = group.baseBudget;
  let totalQuantity = 0;
  let filledQuantity = 0;
  const allocation = {};

  for (const [index, choice] of choices.entries()) {
    const isLastEligible = choices.slice(index + 1).every((candidate) => candidate.score <= 0);
    const requestedBudget = totalScore > 0
      ? (isLastEligible ? remainingBudget : Math.floor(group.baseBudget * choice.score / totalScore))
      : 0;
    const budget = Math.max(0, Math.min(remainingBudget, requestedBudget));
    const limitPrice = Math.min(
      Math.floor(choice.product.basePrice * group.maxPriceIndex),
      Math.max(1, Math.ceil(choice.quote)),
    );
    const quantity = choice.score > 0 ? Math.floor(budget / limitPrice) : 0;
    const committed = quantity * limitPrice;
    remainingBudget -= committed;
    allocation[choice.product.id] = {
      quote: choice.quote,
      priceIndex: Number(choice.priceIndex.toFixed(4)),
      budget: committed,
      quantity,
    };
    const market = marketFor(world, choice.product.id);
    market.demand.lastPrice = limitPrice;
    market.demand.lastQuantity = quantity;
    market.demand.lastBudget = committed;
    market.demand.nextDemandAt = (cycleId + 1) * group.cycleMs;
    market.demand.satisfaction = 0;
    if (quantity < 1) continue;
    const order = {
      id: createId('population-order'),
      productId: choice.product.id,
      side: 'buy',
      ownerType: 'population',
      ownerName: group.ownerName,
      demandGroupId: group.id,
      demandCycleId: cycleId,
      price: limitPrice,
      quantity,
      remaining: quantity,
      status: 'open',
      createdAt: now,
    };
    world.orders.push(order);
    matchOrder(world, order, now);
    const filled = quantity - order.remaining;
    totalQuantity += quantity;
    filledQuantity += filled;
    market.demand.satisfaction = quantity === 0 ? 0 : filled / quantity;
  }

  state.lastCycleId = cycleId;
  state.nextDemandAt = (cycleId + 1) * group.cycleMs;
  state.lastBudget = group.baseBudget;
  state.lastCommitted = group.baseBudget - remainingBudget;
  state.satisfaction = totalQuantity === 0 ? 0 : filledQuantity / totalQuantity;
  state.lastAllocation = allocation;
}

function result(ok, message) {
  return { ok, message };
}

function getPlayer(world, userId) {
  const player = world.players[String(userId)];
  if (!player) throw new Error(`Missing player ${userId}`);
  return player;
}

function normalizePositiveInteger(value, max = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const normalized = Math.floor(number);
  return normalized < 1 || normalized > max ? null : normalized;
}

function work(world, userId, now) {
  const player = getPlayer(world, userId);
  if (now < player.work.cooldownUntil) return result(false, '工作冷却尚未结束');
  player.work.streak = 0;
  player.work.cooldownUntil = now + ECONOMY_CONSTANTS.workCooldownMs;
  player.work.lastWorkedAt = now;
  player.work.totalClicks += 1;
  player.credits += 1;
  player.stats.workIssued += 1;
  player.stats.workClicks = Number(player.stats.workClicks || 0) + 1;
  addLedger(player, 'work_income', 1, '完成工作，固定冷却 10 秒', now);
  return result(true, '工作完成，获得 1 货币');
}

function buildFacility(world, userId, payload, now) {
  const player = getPlayer(world, userId);
  const type = FACILITY_TYPES.get(String(payload.facilityTypeId || 'farm'));
  if (!type) return result(false, '工厂类型不存在');
  if (player.facilities.some((facility) => facility.status === 'constructing')) {
    return result(false, '同时只能施工一座工厂');
  }
  if (player.credits < type.buildCost) return result(false, '建造资金不足');
  player.credits -= type.buildCost;
  player.stats.systemSinks += type.buildCost;
  const sameTypeCount = player.facilities.filter((facility) => facility.facilityTypeId === type.id).length;
  const facility = createFacilityFromType(type.id, userId, now, {
    name: `${type.name} ${sameTypeCount + 1}`,
    status: 'constructing',
    constructionCompletesAt: now + type.buildTimeMs,
  });
  player.facilities.push(facility);
  addLedger(player, 'facility_construction', -type.buildCost, `支付${type.name}建造费用`, now);
  return result(true, `${type.name}开始施工，预计 ${Math.ceil(type.buildTimeMs / 60_000)} 分钟完成`);
}

function findOwnedFacility(player, facilityId) {
  return player.facilities.find((facility) => facility.id === facilityId);
}

function startFacility(world, userId, payload, now) {
  const player = getPlayer(world, userId);
  const facility = findOwnedFacility(player, payload.facilityId);
  if (!facility) return result(false, '生产设施不存在');
  if (facility.status === 'constructing' || facility.status === 'listed') return result(false, '当前状态不能启动生产');
  if (facility.internalGoods + facility.outputPerCycle > facility.internalCapacity) {
    facility.status = 'full';
    facility.stopReason = 'output_full';
    return result(false, '设施内部产成品已满');
  }
  if (player.credits < facility.operatingCost) {
    facility.status = 'insufficient_funds';
    facility.stopReason = 'insufficient_funds';
    return result(false, '运营资金不足');
  }
  if (facility.inputProductId && inventoryFor(player, facility.inputProductId).available < facility.inputPerCycle) {
    facility.status = 'insufficient_input';
    facility.stopReason = 'insufficient_input';
    return result(false, '生产原料不足');
  }
  facility.status = 'running';
  facility.stopReason = undefined;
  facility.cycleStartedAt = now;
  return result(true, `${facility.name}已手动启动`);
}

function pauseFacility(world, userId, payload) {
  const facility = findOwnedFacility(getPlayer(world, userId), payload.facilityId);
  if (!facility) return result(false, '生产设施不存在');
  if (facility.status !== 'running') return result(false, '生产设施当前未运行');
  stopFacility(facility, 'paused', 'manual');
  return result(true, `${facility.name}已手动停止`);
}

function collectFacility(world, userId, payload, now) {
  const player = getPlayer(world, userId);
  const facility = findOwnedFacility(player, payload.facilityId);
  if (!facility || facility.internalGoods <= 0) return result(false, '没有可领取的产成品');
  const availableCapacity = player.inventoryCapacity - inventoryUsed(player) - pendingBuyQuantity(world, userId);
  if (availableCapacity <= 0) return result(false, '玩家仓库已满或已被买单预占');
  const quantity = Math.min(facility.internalGoods, availableCapacity);
  facility.internalGoods -= quantity;
  inventoryFor(player, facility.outputProductId).available += quantity;
  if (facility.status === 'full' && facility.internalGoods + facility.outputPerCycle <= facility.internalCapacity) {
    facility.status = 'paused';
    facility.stopReason = 'manual';
  }
  addLedger(
    player,
    'inventory',
    0,
    `从 ${facility.name} 领取 ${quantity} 个${productDefinition(facility.outputProductId).name}`,
    now,
  );
  return result(true, `已领取 ${quantity} 个${productDefinition(facility.outputProductId).name}`);
}

function listFacility(world, userId, payload, now) {
  const player = getPlayer(world, userId);
  const facility = findOwnedFacility(player, payload.facilityId);
  const price = normalizePositiveInteger(payload.price);
  if (!facility) return result(false, '生产设施不存在');
  if (!price) return result(false, '挂牌价格无效');
  if (!['ready', 'paused', 'full', 'insufficient_funds', 'insufficient_input'].includes(facility.status)) {
    return result(false, '当前状态不能挂牌');
  }
  if (facility.internalGoods > 0) return result(false, '挂牌前必须领取全部内部产成品');
  if (price < facility.systemValue * 0.5 || price > facility.systemValue * 2) {
    return result(false, '挂牌价必须在系统估值的 50%～200% 之间');
  }
  const listingId = createId('facility-listing');
  facility.status = 'listed';
  facility.stopReason = 'listed';
  facility.listedOrderId = listingId;
  delete facility.cycleStartedAt;
  world.facilityListings.push({
    id: listingId,
    facilityId: facility.id,
    ownerType: 'player',
    ownerId: userId,
    ownerName: player.playerName,
    price,
    createdAt: now,
    facility: facilitySnapshot(facility),
  });
  return result(true, '生产设施已进入市场挂牌');
}

function cancelFacilityListing(world, userId, payload) {
  const listing = world.facilityListings.find((item) => item.id === payload.listingId && item.ownerId === userId);
  if (!listing) return result(false, '设施挂牌不存在');
  const facility = findOwnedFacility(getPlayer(world, userId), listing.facilityId);
  if (facility) {
    facility.status = 'paused';
    facility.stopReason = 'manual';
    delete facility.listedOrderId;
  }
  world.facilityListings = world.facilityListings.filter((item) => item.id !== listing.id);
  return result(true, '设施挂牌已撤销');
}

function buyFacility(world, userId, payload, now) {
  const buyer = getPlayer(world, userId);
  const listing = world.facilityListings.find((item) => item.id === payload.listingId);
  if (!listing || listing.ownerId === userId) return result(false, '无法购买该挂牌');
  if (buyer.credits < listing.price) return result(false, '购买资金不足');

  let facility;
  if (listing.ownerType === 'player') {
    const seller = getPlayer(world, listing.ownerId);
    facility = findOwnedFacility(seller, listing.facilityId);
    if (!facility) return result(false, '挂牌设施不存在');
    seller.facilities = seller.facilities.filter((item) => item.id !== facility.id);
    seller.credits += listing.price;
    seller.stats.facilityVolume += listing.price;
    addTrade(seller, {
      type: 'facility',
      side: 'sell',
      quantity: 1,
      price: listing.price,
      total: listing.price,
      counterparty: buyer.playerName,
      createdAt: now,
      description: `出售 ${facility.name}`,
    });
    addLedger(seller, 'facility_sale', listing.price, `出售 ${facility.name}`, now);
  } else {
    facility = createFacilityFromType(listing.facility.facilityTypeId, userId, now, {
      ...listing.facility,
      id: listing.facilityId,
      status: 'paused',
      builtAt: now,
    });
  }

  buyer.credits -= listing.price;
  buyer.stats.facilityVolume += listing.price;
  facility.ownerId = userId;
  facility.status = 'paused';
  facility.stopReason = 'manual';
  delete facility.listedOrderId;
  delete facility.cycleStartedAt;
  buyer.facilities.push(facility);
  addTrade(buyer, {
    type: 'facility',
    side: 'buy',
    quantity: 1,
    price: listing.price,
    total: listing.price,
    counterparty: listing.ownerName,
    createdAt: now,
    description: `收购 ${facility.name}`,
  });
  addLedger(buyer, 'facility_trade', -listing.price, `收购 ${facility.name}`, now);
  world.facilityListings = world.facilityListings.filter((item) => item.id !== listing.id);
  return result(true, '生产设施产权已完成交割');
}

function placeOrder(world, userId, payload, now) {
  const player = getPlayer(world, userId);
  const side = payload.side === 'buy' ? 'buy' : payload.side === 'sell' ? 'sell' : null;
  const productId = PRODUCTS.has(String(payload.productId || 'wheat')) ? String(payload.productId || 'wheat') : null;
  const quantity = normalizePositiveInteger(payload.quantity, ECONOMY_CONSTANTS.maxOrderQuantity);
  const price = normalizePositiveInteger(payload.price, 1_000_000);
  if (!side || !productId || !quantity || !price) return result(false, '订单参数无效');
  const openOrders = world.orders.filter((order) => order.ownerId === userId && isOpenOrder(order));
  if (openOrders.length >= ECONOMY_CONSTANTS.maxOpenOrders) return result(false, '未完成订单数量已达上限');

  if (side === 'buy') {
    const total = quantity * price;
    if (player.credits < total) return result(false, '可用资金不足');
    const capacity = player.inventoryCapacity - inventoryUsed(player) - pendingBuyQuantity(world, userId);
    if (capacity < quantity) return result(false, '仓库容量不足');
    player.credits -= total;
    player.frozenCredits += total;
  } else {
    const inventory = inventoryFor(player, productId);
    if (inventory.available < quantity) return result(false, '可用商品库存不足');
    inventory.available -= quantity;
    inventory.frozen += quantity;
  }

  const order = {
    id: createId('order'),
    productId,
    side,
    ownerType: 'player',
    ownerId: userId,
    ownerName: player.playerName,
    price,
    quantity,
    remaining: quantity,
    status: 'open',
    createdAt: now,
  };
  world.orders.push(order);
  matchOrder(world, order, now);
  return result(true, order.status === 'filled' ? '订单已全部成交' : order.status === 'partial' ? '订单已部分成交' : '订单已进入订单簿');
}

function cancelOrder(world, userId, payload) {
  const order = world.orders.find((item) => item.id === payload.orderId && item.ownerId === userId && isOpenOrder(item));
  if (!order) return result(false, '未找到可撤销订单');
  const player = getPlayer(world, userId);
  if (order.side === 'buy') {
    const release = order.remaining * order.price;
    player.frozenCredits -= release;
    player.credits += release;
  } else {
    const inventory = inventoryFor(player, order.productId);
    inventory.frozen -= order.remaining;
    inventory.available += order.remaining;
  }
  order.status = 'cancelled';
  return result(true, '订单已撤销，冻结资产已释放');
}

function renamePlayer(world, userId, payload) {
  const player = getPlayer(world, userId);
  const name = String(payload.playerName || '').trim().slice(0, 32);
  if (name.length < 2) return result(false, '玩家昵称至少需要 2 个字符');
  player.playerName = name;
  for (const order of world.orders) if (order.ownerId === userId) order.ownerName = name;
  for (const listing of world.facilityListings) if (listing.ownerId === userId) listing.ownerName = name;
  return result(true, '玩家昵称已更新');
}

function resetPlayer(world, user, now) {
  world.orders = world.orders.filter((order) => order.ownerId !== Number(user.id));
  world.facilityListings = world.facilityListings.filter((listing) => listing.ownerId !== Number(user.id));
  world.players[String(user.id)] = createPlayer(user, now);
  return result(true, '服务器经济状态已重置');
}

export function applyAction(world, user, action, payload = {}, now = Date.now()) {
  migrateWorld(world, now);
  ensurePlayer(world, user, now);
  processWorld(world, now);
  const userId = Number(user.id);
  switch (action) {
    case 'work': return work(world, userId, now);
    case 'buildFacility': return buildFacility(world, userId, payload, now);
    case 'startFacility': return startFacility(world, userId, payload, now);
    case 'pauseFacility': return pauseFacility(world, userId, payload, now);
    case 'collectFacility': return collectFacility(world, userId, payload, now);
    case 'listFacility': return listFacility(world, userId, payload, now);
    case 'cancelFacilityListing': return cancelFacilityListing(world, userId, payload, now);
    case 'buyFacility': return buyFacility(world, userId, payload, now);
    case 'placeOrder': return placeOrder(world, userId, payload, now);
    case 'cancelOrder': return cancelOrder(world, userId, payload, now);
    case 'renamePlayer': return renamePlayer(world, userId, payload, now);
    case 'resetPlayer': return resetPlayer(world, user, now);
    default: return result(false, '不支持的游戏操作');
  }
}

function createLeaderboard(world, currentUserId, now) {
  return Object.values(world.players)
    .map((player) => ({
      playerName: player.playerName,
      totalAssets: totalAssets(world, player),
      cashAssets: player.credits + player.frozenCredits,
      facilityCount: player.facilities.length,
      weeklyChange: player.stats.workIssued + player.stats.populationIssued - player.stats.systemSinks,
      updatedAt: now,
      isCurrentPlayer: player.userId === currentUserId,
    }))
    .sort((left, right) => right.totalAssets - left.totalAssets || left.playerName.localeCompare(right.playerName))
    .slice(0, 100)
    .map((entry, index) => ({ rank: index + 1, ...entry }));
}

export function createClientState(world, userId, now = Date.now()) {
  migrateWorld(world, now);
  const player = getPlayer(world, userId);
  const wheatInventory = inventoryFor(player, 'wheat');
  const wheatMarket = marketFor(world, 'wheat');
  return {
    version: 5,
    userId: player.userId,
    playerName: player.playerName,
    registeredAt: player.registeredAt,
    credits: player.credits,
    frozenCredits: player.frozenCredits,
    inventories: clone(player.inventories),
    inventoryCapacity: player.inventoryCapacity,
    facilities: clone(player.facilities),
    products: clone(PRODUCT_CATALOG),
    facilityTypes: clone(FACILITY_TYPE_CATALOG),
    markets: clone(world.markets),
    orders: clone(world.orders),
    facilityListings: clone(world.facilityListings),
    trades: clone(player.trades),
    ledger: clone(player.ledger),
    work: clone(player.work),
    stats: clone(player.stats),
    leaderboard: createLeaderboard(world, userId, now),
    lastProcessedAt: world.lastProcessedAt,

    // Temporary compatibility aliases for the existing UI while the multi-product UI migrates.
    inventory: wheatInventory.available,
    frozenInventory: wheatInventory.frozen,
    commodityName: productDefinition('wheat').name,
    marketPrice: wheatMarket.lastPrice,
    marketPriceHistory: clone(wheatMarket.priceHistory),
    demand: clone(wheatMarket.demand),
  };
}
