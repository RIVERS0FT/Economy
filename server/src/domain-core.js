import { randomUUID } from 'node:crypto';
import { applyMarketSellFee } from './market-sell-fee.js';
import { FACILITY_TYPE_CATALOG, PRODUCT_CATALOG } from './industry-catalog.js';

export { FACILITY_TYPE_CATALOG, PRODUCT_CATALOG } from './industry-catalog.js';

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

export const DEMAND_GROUP_CATALOG = Object.freeze([
  {
    id: 'food', name: '饮食需求', ownerName: '饮食需求',
    cycleMs: ECONOMY_CONSTANTS.demandCycleMs, baseBudget: 1_000,
    products: [
      { productId: 'wheat', preferenceWeight: 1 },
      { productId: 'rice', preferenceWeight: 1 },
      { productId: 'flour', preferenceWeight: 4 },
      { productId: 'food', preferenceWeight: 8 },
      { productId: 'meat', preferenceWeight: 4 },
      { productId: 'eggs', preferenceWeight: 3 },
      { productId: 'milk', preferenceWeight: 3 },
    ],
  },
  {
    id: 'household', name: '家庭用品需求', ownerName: '家庭用品需求',
    cycleMs: ECONOMY_CONSTANTS.demandCycleMs, baseBudget: 900,
    products: [
      { productId: 'timber', preferenceWeight: 1 },
      { productId: 'cotton', preferenceWeight: 1 },
      { productId: 'wool', preferenceWeight: 1 },
      { productId: 'copper-ore', preferenceWeight: 1 },
      { productId: 'crude-oil', preferenceWeight: 1 },
      { productId: 'lumber', preferenceWeight: 2 },
      { productId: 'textile', preferenceWeight: 2 },
      { productId: 'copper', preferenceWeight: 2 },
      { productId: 'plastic', preferenceWeight: 2 },
      { productId: 'furniture', preferenceWeight: 4 },
      { productId: 'clothing', preferenceWeight: 5 },
      { productId: 'electronics', preferenceWeight: 5 },
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
    lastTradePrice: null,
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
    nextDemandAt: now,
    lastCycleId: Math.floor(now / group.cycleMs) - 1,
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

function seedOrders() {
  return [];
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
    version: 13,
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
  for (const product of PRODUCT_CATALOG) {
    world.markets[product.id] ||= createMarket(product, now);
    const market = world.markets[product.id];
    if (market.lastTradePrice === undefined) {
      const latestTrade = [...(market.priceHistory || [])].reverse().find((point) => point.takerSide === 'buy' || point.takerSide === 'sell');
      market.lastTradePrice = latestTrade ? Number(latestTrade.price) : null;
    }
  }

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
  world.version = 13;
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

function recordPrice(world, productId, price, quantity, takerSide, createdAt) {
  const market = marketFor(world, productId);
  market.lastPrice = price;
  market.lastTradePrice = price;
  market.priceHistory.push({ price, quantity, createdAt, takerSide });
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
  const orderQuantity = world.orders
    .filter((order) => order.ownerId === userId && order.side === 'buy' && order.assetKind !== 'facility' && isOpenOrder(order))
    .reduce((sum, order) => sum + order.remaining, 0);
  const auctionQuantity = (world.collectibleAuctions || []).reduce((sum, auction) => {
    if (
      auction?.assetKind !== 'commodity'
      || Number(auction?.highestBidderId) !== Number(userId)
      || auction?.status !== 'open'
      || auction?.escrowStatus === 'released'
      || auction?.escrowStatus === 'transferred'
    ) return sum;
    return sum + Math.max(0, Number(auction.quantity || 0));
  }, 0);
  return orderQuantity + auctionQuantity;
}

function sortCandidates(orders, side) {
  return [...orders].sort((left, right) => {
    if (left.price !== right.price) return side === 'buy' ? left.price - right.price : right.price - left.price;
    return left.createdAt - right.createdAt;
  });
}

function describeCounterparty(order) {
  return order.ownerName || (order.ownerType === 'population' ? '人口需求' : '玩家');
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

function settlePlayerSell(world, order, quantity, tradePrice, buyer, settlement, createdAt) {
  const player = world.players[String(order.ownerId)];
  if (!player) throw new Error(`Missing seller ${order.ownerId}`);
  const inventory = inventoryFor(player, order.productId);
  const total = quantity * tradePrice;
  inventory.frozen -= quantity;
  player.credits += settlement.netTotal;
  player.stats.systemSinks = Number(player.stats.systemSinks || 0) + settlement.fee;
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
    fee: settlement.fee,
    netTotal: settlement.netTotal,
    counterparty: describeCounterparty(buyer),
    createdAt,
    description: `卖出 ${product.name}`,
  });
  addLedger(
    player,
    buyer.ownerType === 'population' ? 'population_income' : 'market_trade',
    settlement.netTotal,
    `${buyer.ownerType === 'population' ? '人口需求消费' : '卖出'} ${quantity} 个${product.name}，成交价 ${tradePrice}，手续费 ${settlement.fee}`,
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
  const settlement = sell.ownerType === 'player'
    ? applyMarketSellFee(sell, fillBase.total)
    : { fee: 0, netTotal: fillBase.total };
  appendPlayerOrderFill(buy, {
    ...fillBase,
    fee: 0,
    netTotal: fillBase.total,
    counterparty: describeCounterparty(sell),
    liquidity: buy.id === resting.id ? 'maker' : 'taker',
  });
  appendPlayerOrderFill(sell, {
    ...fillBase,
    ...settlement,
    counterparty: describeCounterparty(buy),
    liquidity: sell.id === resting.id ? 'maker' : 'taker',
  });
  if (buy.ownerType === 'player') settlePlayerBuy(world, buy, quantity, price, describeCounterparty(sell), createdAt);
  if (sell.ownerType === 'player') settlePlayerSell(world, sell, quantity, price, buy, settlement, createdAt);
  recordPrice(world, incoming.productId, price, quantity, incoming.side, createdAt);
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

function createPopulationDemand() {
  return undefined;
}

function refreshExternalLiquidity() {
  return undefined;
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
