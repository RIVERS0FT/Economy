import { randomUUID } from 'node:crypto';
import { isOpenOrder } from './order-identity.js';
import { matchIncomingOrder } from './order-matching.js';
import { LIQUIDITY_SIGNAL_WEIGHT } from './market-demand/catalog.js';
import {
  creditPopulationEmployment,
  recordPopulationSellerIncome,
  settlePopulationPurchase,
} from './population-economy.js';

const LIQUIDITY_BUY = 'liquidity-buy';
const LIQUIDITY_SELL = 'liquidity-sell';

export function createBalancedMarketRuntime({ products, constants }) {
  const productMap = new Map(products.map((product) => [product.id, product]));
  const createId = (prefix) => `${prefix}-${randomUUID()}`;
  const productFor = (productId) => productMap.get(String(productId || '')) || productMap.get('wheat');
  const isCommodityOwner = (order) => order?.ownerType === 'player' || order?.ownerType === 'population';
  const isLiquidityOrder = (order) => order?.ownerType === 'population'
    && (order?.demandTier === LIQUIDITY_BUY || order?.demandTier === LIQUIDITY_SELL);
  const isConsumptionOrder = (order) => order?.ownerType === 'population' && !isLiquidityOrder(order);
  const hasValidOwner = (world, order) => order?.ownerType !== 'player'
    || Boolean(world.players?.[String(order.ownerId)]);

  function createMarket(product, now) {
    const offsets = [-1, 0, 1, 0, 1, 1, 0, -1, 0, 1, 0, 0, 1, -1, 0, 1, 0, 1, 0, -1, 0, 1, 0, 0];
    return {
      productId: product.id,
      lastPrice: product.basePrice,
      lastTradePrice: null,
      priceHistory: offsets.map((offset, index) => ({
        price: Math.max(1, product.basePrice + offset),
        quantity: 3 + (index % 5),
        createdAt: now - 60_000 * (offsets.length - index),
        synthetic: true,
      })),
      demand: {
        cycleMs: constants.demandCycleMs,
        nextDemandAt: now + constants.demandCycleMs,
        lastBudget: 0,
        lastQuantity: 0,
        lastPrice: product.basePrice,
        satisfaction: 0,
        referencePrice: product.basePrice,
        observedPrice: product.basePrice,
        costAnchor: null,
        downstreamValueAnchor: null,
        targetPrice: product.basePrice,
      },
    };
  }

  function marketFor(world, productId, now = Date.now()) {
    const product = productFor(productId);
    world.markets ||= {};
    world.markets[product.id] ||= createMarket(product, now);
    return world.markets[product.id];
  }

  function inventoryFor(player, productId) {
    player.inventories ||= {};
    player.inventories[productId] ||= { available: 0, frozen: 0 };
    return player.inventories[productId];
  }

  function liquidityGroupFor(world, order) {
    return world.marketDemand?.liquidity?.groups?.[String(order?.demandGroupId || '')];
  }

  function liquidityReserveFor(world, order) {
    return liquidityGroupFor(world, order)?.reserves?.[String(order?.productId || '')];
  }

  function addTrade(player, trade) {
    player.trades ||= [];
    player.trades.unshift({ id: createId('trade'), ...trade });
    player.trades = player.trades.slice(0, constants.maxTradesPerPlayer);
  }

  function addLedger(player, category, amount, description, createdAt) {
    player.ledger ||= [];
    player.ledger.unshift({
      id: createId('ledger'),
      category,
      amount,
      balanceAfter: player.credits,
      createdAt,
      description,
    });
    player.ledger = player.ledger.slice(0, constants.maxLedgerPerPlayer);
  }

  function counterparty(order) {
    return order.ownerName || (order.ownerType === 'population' ? '市场系统' : '玩家');
  }

  function recordPrice(world, productId, price, quantity, takerSide, createdAt, signalWeight = 1, marketRole = 'player') {
    const market = marketFor(world, productId, createdAt);
    market.lastPrice = price;
    market.lastTradePrice = price;
    market.priceHistory ||= [];
    market.priceHistory.push({ price, quantity, createdAt, takerSide, signalWeight, marketRole });
    market.priceHistory = market.priceHistory.slice(-constants.maxPricePoints);
  }

  function settlePlayerBuy(world, order, quantity, tradePrice, sellerName, createdAt) {
    const player = world.players?.[String(order.ownerId)];
    if (!player) throw new Error(`Missing buyer ${order.ownerId}`);
    const reserved = quantity * Number(order.price);
    const actual = quantity * tradePrice;
    player.frozenCredits -= reserved;
    player.credits += reserved - actual;
    inventoryFor(player, order.productId).available += quantity;
    player.stats ||= {};
    player.stats.commodityVolume = Number(player.stats.commodityVolume || 0) + quantity;
    player.stats.boughtGoods = Number(player.stats.boughtGoods || 0) + quantity;
    const product = productFor(order.productId);
    addTrade(player, {
      type: 'commodity', productId: product.id, side: 'buy', quantity, price: tradePrice,
      total: actual, counterparty: sellerName, createdAt, description: `买入 ${product.name}`,
    });
    addLedger(player, 'market_trade', -actual, `买入 ${quantity} 个${product.name}，成交价 ${tradePrice}`, createdAt);
  }

  function settlePlayerSell(world, order, quantity, tradePrice, buyer, settlement, createdAt) {
    const player = world.players?.[String(order.ownerId)];
    if (!player) throw new Error(`Missing seller ${order.ownerId}`);
    const inventory = inventoryFor(player, order.productId);
    const total = quantity * tradePrice;
    inventory.frozen -= quantity;
    player.credits += settlement.netTotal;
    player.stats ||= {};
    player.stats.commodityVolume = Number(player.stats.commodityVolume || 0) + quantity;
    player.stats.soldGoods = Number(player.stats.soldGoods || 0) + quantity;
    if (settlement.fee > 0) {
      creditPopulationEmployment(world, settlement.fee, 'marketService');
      player.stats.marketServiceFees = Number(player.stats.marketServiceFees || 0) + settlement.fee;
      player.stats.employmentPayments = Number(player.stats.employmentPayments || 0) + settlement.fee;
    }
    const consumptionIncome = isConsumptionOrder(buyer);
    if (consumptionIncome) recordPopulationSellerIncome(player, settlement.netTotal);
    const product = productFor(order.productId);
    addTrade(player, {
      type: 'commodity', productId: product.id, side: 'sell', quantity, price: tradePrice,
      total, fee: settlement.fee, netTotal: settlement.netTotal,
      counterparty: counterparty(buyer), createdAt, description: `卖出 ${product.name}`,
    });
    addLedger(
      player,
      consumptionIncome ? 'population_income' : 'market_trade',
      settlement.netTotal,
      `${consumptionIncome ? '人口消费购买' : '卖给市场储备'} ${quantity} 个${product.name}，成交价 ${tradePrice}，市场服务费 ${settlement.fee}`,
      createdAt,
    );
  }

  function settlePopulationBuy(world, order, quantity, tradePrice) {
    settlePopulationPurchase(world, order, quantity, tradePrice);
  }

  function settleLiquidityBuy(world, order, quantity, tradePrice) {
    const group = liquidityGroupFor(world, order);
    const reserve = liquidityReserveFor(world, order);
    if (!group || !reserve) throw new Error(`Missing liquidity reserve for ${order.productId}`);
    const reserved = quantity * Number(order.price);
    const actual = quantity * tradePrice;
    group.frozenCredits -= reserved;
    group.credits += reserved - actual;
    reserve.inventory += quantity;
    reserve.totalBought = Number(reserve.totalBought || 0) + quantity;
    reserve.totalBuyValue = Number(reserve.totalBuyValue || 0) + actual;
  }

  function settleLiquiditySell(world, order, quantity, tradePrice) {
    const group = liquidityGroupFor(world, order);
    const reserve = liquidityReserveFor(world, order);
    if (!group || !reserve) throw new Error(`Missing liquidity reserve for ${order.productId}`);
    reserve.frozenInventory -= quantity;
    group.credits += quantity * tradePrice;
    reserve.totalSold = Number(reserve.totalSold || 0) + quantity;
    reserve.totalSellValue = Number(reserve.totalSellValue || 0) + quantity * tradePrice;
  }

  function matchOrder(world, incoming, createdAt) {
    if (!isCommodityOwner(incoming)) throw new Error(`Unsupported commodity order owner: ${incoming?.ownerType}`);
    if (!hasValidOwner(world, incoming)) return { fillCount: 0, filledQuantity: 0 };
    return matchIncomingOrder({
      world,
      incoming,
      createdAt,
      canMatch: ({ resting }) => (
        isCommodityOwner(resting)
        && hasValidOwner(world, resting)
        && !(resting.ownerType === 'population' && incoming.ownerType === 'population')
      ),
      describeCounterparty: counterparty,
      settleTrade: ({ buy, sell, quantity, price, sellerSettlement }) => {
        if (buy.ownerType === 'player') settlePlayerBuy(world, buy, quantity, price, counterparty(sell), createdAt);
        if (isConsumptionOrder(buy)) settlePopulationBuy(world, buy, quantity, price);
        if (buy.demandTier === LIQUIDITY_BUY) settleLiquidityBuy(world, buy, quantity, price);
        if (sell.ownerType === 'player') settlePlayerSell(world, sell, quantity, price, buy, sellerSettlement, createdAt);
        if (sell.demandTier === LIQUIDITY_SELL) settleLiquiditySell(world, sell, quantity, price);
      },
      recordTrade: ({ buy, sell, quantity, price, takerSide }) => {
        const liquidityTrade = isLiquidityOrder(buy) || isLiquidityOrder(sell);
        const consumptionTrade = !liquidityTrade && (isConsumptionOrder(buy) || isConsumptionOrder(sell));
        const signalWeight = liquidityTrade ? LIQUIDITY_SIGNAL_WEIGHT : 1;
        const marketRole = liquidityTrade ? 'liquidity' : consumptionTrade ? 'consumption' : 'player';
        recordPrice(world, incoming.productId, price, quantity, takerSide, createdAt, signalWeight, marketRole);
      },
    });
  }

  function rebalanceNewWorld(world, now) {
    world.markets = Object.fromEntries(products.map((product) => [product.id, createMarket(product, now)]));
    world.orders = (world.orders || []).filter((order) => isCommodityOwner(order));
    return world;
  }

  function repairMissingMarkets(world, existingMarketIds, now, legacy = {}) {
    world.markets ||= {};
    for (const product of products) {
      if (existingMarketIds.has(product.id)) continue;
      const market = createMarket(product, now);
      if (product.id === 'wheat' && legacy.grainMarket) {
        Object.assign(market, legacy.grainMarket, { productId: 'wheat' });
      }
      if (product.id === 'wheat' && legacy.price !== undefined) market.lastPrice = legacy.price;
      if (product.id === 'wheat' && legacy.history?.length) {
        market.priceHistory = legacy.history.map((point) => ({
          price: Number(point.price || market.lastPrice), quantity: Number(point.quantity || 1),
          createdAt: Number(point.createdAt || now), takerSide: point.takerSide,
        }));
      }
      const latestTrade = [...market.priceHistory].reverse().find((point) => point.takerSide === 'buy' || point.takerSide === 'sell');
      market.lastTradePrice = latestTrade ? Number(latestTrade.price) : null;
      if (product.id === 'wheat' && legacy.demand) market.demand = { ...market.demand, ...legacy.demand };
      world.markets[product.id] = market;
    }
    return world;
  }

  return {
    createMarket,
    isOpenOrder,
    marketFor,
    matchOrder,
    rebalanceNewWorld,
    repairMissingMarkets,
  };
}
