import { randomUUID } from 'node:crypto';

export function createBalancedMarketRuntime({ products, constants }) {
  const productMap = new Map(products.map((product) => [product.id, product]));

  const createId = (prefix) => `${prefix}-${randomUUID()}`;
  const productFor = (productId) => productMap.get(String(productId || '')) || productMap.get('wheat');
  const isOpenOrder = (order) => Number(order?.remaining || 0) > 0
    && (order?.status === 'open' || order?.status === 'partial');

  function createMarket(product, now) {
    const offsets = [-1, 0, 1, 0, 1, 1, 0, -1, 0, 1, 0, 0, 1, -1, 0, 1, 0, 1, 0, -1, 0, 1, 0, 0];
    return {
      productId: product.id,
      lastPrice: product.basePrice,
      priceHistory: offsets.map((offset, index) => ({
        price: Math.max(1, product.basePrice + offset),
        quantity: 3 + (index % 5),
        createdAt: now - 60_000 * (offsets.length - index),
      })),
      demand: {
        cycleMs: constants.demandCycleMs,
        nextDemandAt: now + constants.demandCycleMs,
        lastBudget: product.basePrice * 8,
        lastQuantity: 8,
        lastPrice: product.basePrice,
        satisfaction: 0.7,
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
    return order.ownerName || (order.ownerType === 'population' ? '人口需求' : '市场');
  }

  function recordPrice(world, productId, price, quantity, takerSide, createdAt) {
    const market = marketFor(world, productId, createdAt);
    market.lastPrice = price;
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

  function settlePlayerSell(world, order, quantity, tradePrice, buyer, createdAt) {
    const player = world.players?.[String(order.ownerId)];
    if (!player) throw new Error(`Missing seller ${order.ownerId}`);
    const inventory = inventoryFor(player, order.productId);
    const total = quantity * tradePrice;
    inventory.frozen -= quantity;
    player.credits += total;
    player.stats ||= {};
    player.stats.commodityVolume = Number(player.stats.commodityVolume || 0) + quantity;
    player.stats.soldGoods = Number(player.stats.soldGoods || 0) + quantity;
    if (buyer.ownerType === 'population') {
      player.stats.populationIssued = Number(player.stats.populationIssued || 0) + total;
    }
    const product = productFor(order.productId);
    addTrade(player, {
      type: 'commodity', productId: product.id, side: 'sell', quantity, price: tradePrice,
      total, counterparty: counterparty(buyer), createdAt, description: `卖出 ${product.name}`,
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
    const price = Number(resting.price);
    const fill = {
      id: createId('order-fill'), quantity, price, total: quantity * price, createdAt,
      makerOrderId: resting.id, takerOrderId: incoming.id,
    };
    incoming.remaining -= quantity;
    resting.remaining -= quantity;
    incoming.status = incoming.remaining === 0 ? 'filled' : 'partial';
    resting.status = resting.remaining === 0 ? 'filled' : 'partial';
    appendFill(buy, { ...fill, counterparty: counterparty(sell), liquidity: buy.id === resting.id ? 'maker' : 'taker' });
    appendFill(sell, { ...fill, counterparty: counterparty(buy), liquidity: sell.id === resting.id ? 'maker' : 'taker' });
    if (buy.ownerType === 'player') settlePlayerBuy(world, buy, quantity, price, counterparty(sell), createdAt);
    if (sell.ownerType === 'player') settlePlayerSell(world, sell, quantity, price, buy, createdAt);
    recordPrice(world, incoming.productId, price, quantity, incoming.side, createdAt);
  }

  function matchOrder(world, incoming, createdAt) {
    const opposite = incoming.side === 'buy' ? 'sell' : 'buy';
    const candidates = (world.orders || [])
      .filter((order) => (
        order.id !== incoming.id
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

  function seedOrders(now) {
    return products.flatMap((product, index) => [
      {
        id: createId('market-order'), productId: product.id, side: 'buy', ownerType: 'market',
        ownerName: '市场流动采购', price: Math.max(1, product.basePrice - 1), quantity: 18,
        remaining: 18, status: 'open', createdAt: now - 8_000 + index,
      },
      {
        id: createId('market-order'), productId: product.id, side: 'sell', ownerType: 'market',
        ownerName: '市场流动供给', price: product.basePrice + 1, quantity: 14,
        remaining: 14, status: 'open', createdAt: now - 5_000 + index,
      },
    ]);
  }

  function rebalanceNewWorld(world, now) {
    world.markets = Object.fromEntries(products.map((product) => [product.id, createMarket(product, now)]));
    world.orders = [
      ...(world.orders || []).filter((order) => order.ownerType !== 'market'
        || order.assetKind === 'facility' || order.facilityTypeId),
      ...seedOrders(now),
    ];
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
          createdAt: Number(point.createdAt || now),
        }));
      }
      if (product.id === 'wheat' && legacy.demand) market.demand = { ...market.demand, ...legacy.demand };
      world.markets[product.id] = market;
    }
    return world;
  }

  function createPopulationDemand(world, productId, now) {
    const product = productFor(productId);
    if (product.systemDemandMode && product.systemDemandMode !== 'single') return;
    const market = marketFor(world, product.id, now);
    for (const order of world.orders || []) {
      if (order.productId === product.id && order.ownerType === 'population' && isOpenOrder(order)) {
        order.status = 'cancelled';
      }
    }
    const tick = Math.floor(now / market.demand.cycleMs);
    const price = Math.max(1, product.basePrice + ((tick + product.id.length) % 3) - 1);
    const baseQuantity = product.category === 'consumer' ? 14 : product.category === 'industrial' ? 4 : 8;
    const quantity = baseQuantity + (tick % 4);
    const order = {
      id: createId('population-order'), productId: product.id, side: 'buy', ownerType: 'population',
      ownerName: product.category === 'industrial' ? '企业采购' : '人口需求',
      price, quantity, remaining: quantity, status: 'open', createdAt: now,
    };
    world.orders.push(order);
    market.demand.lastPrice = price;
    market.demand.lastQuantity = quantity;
    market.demand.lastBudget = price * quantity;
    market.demand.nextDemandAt = now + market.demand.cycleMs;
    matchOrder(world, order, now);
    market.demand.satisfaction = quantity === 0
      ? 1
      : Math.max(0.2, Math.min(1, (quantity - order.remaining) / quantity));
  }

  function refreshExternalLiquidity(world, now) {
    for (const product of products) {
      const openBuy = (world.orders || []).filter((order) => order.productId === product.id
        && order.ownerType === 'market' && order.side === 'buy' && isOpenOrder(order));
      const openSell = (world.orders || []).filter((order) => order.productId === product.id
        && order.ownerType === 'market' && order.side === 'sell' && isOpenOrder(order));
      if (openBuy.length > 0 && openSell.length > 0) continue;

      let bestBid;
      let bestAsk;
      for (const order of world.orders || []) {
        const price = Number(order.price);
        if (order.productId !== product.id || !isOpenOrder(order) || !Number.isInteger(price) || price < 1) continue;
        if (order.side === 'buy') bestBid = bestBid === undefined ? price : Math.max(bestBid, price);
        if (order.side === 'sell') bestAsk = bestAsk === undefined ? price : Math.min(bestAsk, price);
      }
      let buyPrice = bestBid ?? (bestAsk === undefined ? Math.max(1, product.basePrice - 1) : bestAsk - 1);
      let sellPrice = bestAsk ?? (bestBid === undefined ? product.basePrice + 1 : bestBid + 1);
      if (bestAsk !== undefined) buyPrice = Math.min(buyPrice, bestAsk - 1);
      if (bestBid !== undefined) sellPrice = Math.max(sellPrice, bestBid + 1);

      if (openBuy.length < 1 && Number.isInteger(buyPrice) && buyPrice >= 1) {
        const order = {
          id: createId('market-order'), productId: product.id, side: 'buy', ownerType: 'market',
          ownerName: '市场流动采购', price: buyPrice, quantity: 18, remaining: 18,
          status: 'open', createdAt: now,
        };
        world.orders.push(order);
        matchOrder(world, order, now);
      }
      if (openSell.length < 1) {
        const order = {
          id: createId('market-order'), productId: product.id, side: 'sell', ownerType: 'market',
          ownerName: '市场流动供给', price: Math.max(1, Math.floor(sellPrice)), quantity: 14,
          remaining: 14, status: 'open', createdAt: now,
        };
        world.orders.push(order);
        matchOrder(world, order, now);
      }
    }
  }

  return {
    createMarket,
    createPopulationDemand,
    isOpenOrder,
    marketFor,
    matchOrder,
    rebalanceNewWorld,
    refreshExternalLiquidity,
    repairMissingMarkets,
  };
}
