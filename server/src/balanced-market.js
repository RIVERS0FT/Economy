import { randomUUID } from 'node:crypto';
import { applyMarketSellFee } from './market-sell-fee.js';

export function createBalancedMarketRuntime({ products, constants }) {
  const productMap = new Map(products.map((product) => [product.id, product]));
  const createId = (prefix) => `${prefix}-${randomUUID()}`;
  const productFor = (productId) => productMap.get(String(productId || '')) || productMap.get('wheat');
  const isOpenOrder = (order) => Number(order?.remaining || 0) > 0
    && (order?.status === 'open' || order?.status === 'partial');
  const isCommodityOwner = (order) => order?.ownerType === 'player' || order?.ownerType === 'population';

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

  function appendFill(order, fill) {
    if (order.ownerType !== 'player') return;
    order.fills = Array.isArray(order.fills) ? order.fills : [];
    order.fills.push(fill);
    order.fills = order.fills.slice(-120);
  }

  function counterparty(order) {
    return order.ownerName || (order.ownerType === 'population' ? '人口需求' : '玩家');
  }

  function recordPrice(world, productId, price, quantity, takerSide, createdAt) {
    const market = marketFor(world, productId, createdAt);
    market.lastPrice = price;
    market.lastTradePrice = price;
    market.priceHistory ||= [];
    market.priceHistory.push({ price, quantity, createdAt, takerSide });
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
    player.stats.systemSinks = Number(player.stats.systemSinks || 0) + settlement.fee;
    player.stats.commodityVolume = Number(player.stats.commodityVolume || 0) + quantity;
    player.stats.soldGoods = Number(player.stats.soldGoods || 0) + quantity;
    if (buyer.ownerType === 'population') {
      player.stats.populationIssued = Number(player.stats.populationIssued || 0) + total;
    }
    const product = productFor(order.productId);
    addTrade(player, {
      type: 'commodity', productId: product.id, side: 'sell', quantity, price: tradePrice,
      total, fee: settlement.fee, netTotal: settlement.netTotal,
      counterparty: counterparty(buyer), createdAt, description: `卖出 ${product.name}`,
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
    const price = Number(resting.price);
    const fill = {
      id: createId('order-fill'), quantity, price, total: quantity * price, createdAt,
      makerOrderId: resting.id, takerOrderId: incoming.id,
    };
    incoming.remaining -= quantity;
    resting.remaining -= quantity;
    incoming.status = incoming.remaining === 0 ? 'filled' : 'partial';
    resting.status = resting.remaining === 0 ? 'filled' : 'partial';
    const settlement = sell.ownerType === 'player'
      ? applyMarketSellFee(sell, fill.total)
      : { fee: 0, netTotal: fill.total };
    appendFill(buy, {
      ...fill, fee: 0, netTotal: fill.total,
      counterparty: counterparty(sell), liquidity: buy.id === resting.id ? 'maker' : 'taker',
    });
    appendFill(sell, {
      ...fill, ...settlement,
      counterparty: counterparty(buy), liquidity: sell.id === resting.id ? 'maker' : 'taker',
    });
    if (buy.ownerType === 'player') settlePlayerBuy(world, buy, quantity, price, counterparty(sell), createdAt);
    if (sell.ownerType === 'player') settlePlayerSell(world, sell, quantity, price, buy, settlement, createdAt);
    recordPrice(world, incoming.productId, price, quantity, incoming.side, createdAt);
  }

  function matchOrder(world, incoming, createdAt) {
    if (!isCommodityOwner(incoming)) throw new Error(`Unsupported commodity order owner: ${incoming?.ownerType}`);
    const opposite = incoming.side === 'buy' ? 'sell' : 'buy';
    const candidates = (world.orders || [])
      .filter((order) => (
        order.id !== incoming.id
        && isCommodityOwner(order)
        && order.productId === incoming.productId
        && order.side === opposite
        && isOpenOrder(order)
        && !(order.ownerType === 'player' && incoming.ownerType === 'player'
          && Number(order.ownerId) === Number(incoming.ownerId))
        && (incoming.side === 'buy'
          ? Number(order.price) <= Number(incoming.price)
          : Number(order.price) >= Number(incoming.price))
      ))
      .sort((left, right) => incoming.side === 'buy'
        ? Number(left.price) - Number(right.price) || Number(left.createdAt) - Number(right.createdAt)
        : Number(right.price) - Number(left.price) || Number(left.createdAt) - Number(right.createdAt));
    for (const candidate of candidates) {
      if (!isOpenOrder(incoming)) break;
      executeTrade(world, incoming, candidate, Math.min(incoming.remaining, candidate.remaining), createdAt);
    }
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
