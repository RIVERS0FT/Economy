import { randomUUID } from 'node:crypto';
import {
  ACTIVITY_WINDOW_MS,
  LIQUIDITY_BASE_SPREAD,
  LIQUIDITY_INVENTORY_SKEW,
  LIQUIDITY_MAX_SPREAD,
  LIQUIDITY_MIN_SPREAD,
  LIQUIDITY_MIN_TARGET,
  LIQUIDITY_TARGET_MAX_FALL,
  LIQUIDITY_TARGET_MAX_RISE,
  PRICE_MAX_MULTIPLIER,
  PRICE_MIN_MULTIPLIER,
  PRICE_WINDOW_MS,
} from './market-demand/catalog.js';
import { allocateMoneyBudget, clamp, round4, roundMoney } from './market-demand/math.js';
import { ceilPlayerMoney, floorPlayerMoney, multiplyMoneyByInteger, ORDER_PRICE_TICK, roundInternalMoney } from './money.js';
import { bestSystemPrice, systemBookIsCrossed } from './order-book-integrity.js';
import { bestSystemOrder as indexedBestSystemOrder, ordersForDemandGroup } from './order-book-runtime.js';

const LIQUIDITY_BUY = 'liquidity-buy';
const LIQUIDITY_SELL = 'liquidity-sell';

export function createMarketLiquidityRuntime({
  products,
  groups,
  marketFor,
  matchOrder,
  isOpenOrder,
  realTradeStats,
}) {
  const productsByGroup = new Map(groups.map((group) => [
    group.id,
    products.filter((product) => product.marketDemandGroupId === group.id),
  ]));

  function seedTarget(group, product) {
    const seed = Number(group.seedDemandQuantities?.[product.id] || 0);
    return Math.max(LIQUIDITY_MIN_TARGET, Math.ceil(Math.max(1, seed) * 0.5));
  }

  function defaultReserve(group, product, seeded) {
    const targetInventory = seedTarget(group, product);
    return {
      inventory: seeded ? targetInventory : 0,
      frozenInventory: 0,
      targetInventory,
      lastBidPrice: 0,
      lastAskPrice: 0,
      lastBidQuantity: 0,
      lastAskQuantity: 0,
      totalBought: 0,
      totalSold: 0,
      totalBuyValue: 0,
      totalSellValue: 0,
    };
  }

  function normalizeReserve(group, product, previous, seeded) {
    const fallback = defaultReserve(group, product, seeded);
    return {
      ...fallback,
      ...(previous || {}),
      inventory: Math.max(0, Math.floor(Number(previous?.inventory ?? fallback.inventory))),
      frozenInventory: Math.max(0, Math.floor(Number(previous?.frozenInventory || 0))),
      targetInventory: Math.max(
        LIQUIDITY_MIN_TARGET,
        Math.ceil(Number(previous?.targetInventory || fallback.targetInventory)),
      ),
      totalBought: Math.max(0, Math.floor(Number(previous?.totalBought || 0))),
      totalSold: Math.max(0, Math.floor(Number(previous?.totalSold || 0))),
      totalBuyValue: roundMoney(Number(previous?.totalBuyValue || 0)),
      totalSellValue: roundMoney(Number(previous?.totalSellValue || 0)),
    };
  }

  function normalizeWorld(world, { seed = false } = {}) {
    world.marketDemand ||= {};
    const previous = world.marketDemand.liquidity && typeof world.marketDemand.liquidity === 'object'
      ? world.marketDemand.liquidity
      : {};
    const next = { groups: {} };
    for (const group of groups) {
      const previousGroup = previous.groups?.[group.id] || {};
      const wasSeeded = previousGroup.seeded === true;
      const seedNow = seed && !wasSeeded;
      const rebuildSeededState = seed && wasSeeded;
      const previousFrozenCredits = roundMoney(Number(previousGroup.frozenCredits || 0));
      const groupState = {
        seeded: wasSeeded || seedNow,
        initialCredits: roundMoney(Number(
          previousGroup.initialCredits ?? (seedNow ? group.baseBudget : 0),
        )),
        credits: roundMoney(Number(
          previousGroup.credits ?? (seedNow ? group.baseBudget : 0),
        ) + (rebuildSeededState ? previousFrozenCredits : 0)),
        frozenCredits: rebuildSeededState ? 0 : previousFrozenCredits,
        lastCycleId: Number.isFinite(Number(previousGroup.lastCycleId)) ? Number(previousGroup.lastCycleId) : -1,
        reserves: {},
      };
      for (const product of productsByGroup.get(group.id) || []) {
        const reserve = normalizeReserve(
          group,
          product,
          previousGroup.reserves?.[product.id],
          seedNow,
        );
        if (rebuildSeededState) {
          reserve.inventory += reserve.frozenInventory;
          reserve.frozenInventory = 0;
        }
        groupState.reserves[product.id] = reserve;
      }
      next.groups[group.id] = groupState;
    }
    world.marketDemand.liquidity = next;
    return next;
  }

  function groupStateFor(world, groupId) {
    return world.marketDemand?.liquidity?.groups?.[groupId];
  }

  function reserveFor(world, groupId, productId) {
    return groupStateFor(world, groupId)?.reserves?.[productId];
  }

  function releaseOpenOrder(world, order) {
    if (!isOpenOrder(order)) return;
    const groupState = groupStateFor(world, order.demandGroupId);
    const reserve = reserveFor(world, order.demandGroupId, order.productId);
    if (!groupState || !reserve) {
      order.status = 'cancelled';
      order.remaining = 0;
      return;
    }
    const remaining = Math.max(0, Math.floor(Number(order.remaining || 0)));
    if (order.demandTier === LIQUIDITY_BUY) {
      const release = multiplyMoneyByInteger(order.price, remaining) || 0;
      groupState.frozenCredits = roundMoney(groupState.frozenCredits - release);
      groupState.credits = roundMoney(groupState.credits + release);
    } else if (order.demandTier === LIQUIDITY_SELL) {
      reserve.frozenInventory = Math.max(0, reserve.frozenInventory - remaining);
      reserve.inventory += remaining;
    }
    order.remaining = 0;
    order.status = 'cancelled';
  }

  function cancelGroupOrders(world, groupId) {
  for (const order of ordersForDemandGroup(world, groupId)) {
    if (
      order.ownerType === 'population'
      && (order.demandTier === LIQUIDITY_BUY || order.demandTier === LIQUIDITY_SELL)
    ) releaseOpenOrder(world, order);
  }
}

  function bestSystemOrder(world, productId, side) {
  return indexedBestSystemOrder(world, 'commodity', productId, side);
}

  function repairCrossedSystemBook(world, groupId, productId) {
    let repaired = 0;
    while (systemBookIsCrossed(world, productId) && repaired < 4) {
      const bid = bestSystemOrder(world, productId, 'buy');
      const ask = bestSystemOrder(world, productId, 'sell');
      const removable = ask?.demandGroupId === groupId && ask?.demandTier === LIQUIDITY_SELL
        ? ask
        : bid?.demandGroupId === groupId && bid?.demandTier === LIQUIDITY_BUY
          ? bid
          : null;
      if (!removable) break;
      releaseOpenOrder(world, removable);
      repaired += 1;
    }
    return repaired;
  }

  function recentVolatility(world, product, now) {
    const points = (marketFor(world, product.id, now).priceHistory || [])
      .filter((point) => (
        Number(point.createdAt || 0) >= now - PRICE_WINDOW_MS
        && (point.takerSide === 'buy' || point.takerSide === 'sell')
        && Number(point.price || 0) > 0
        && point.synthetic !== true
        && point.marketRole !== 'liquidity'
      ))
      .sort((left, right) => Number(left.createdAt || 0) - Number(right.createdAt || 0));
    if (points.length < 2) return 0;
    let variance = 0;
    let weight = 0;
    for (let index = 1; index < points.length; index += 1) {
      const previous = Math.max(1, Number(points[index - 1].price));
      const current = Math.max(1, Number(points[index].price));
      const returnValue = Math.log(current / previous);
      variance = variance * 0.75 + returnValue * returnValue * 0.25;
      weight = weight * 0.75 + 0.25;
    }
    return weight <= 0 ? 0 : Math.sqrt(variance / weight);
  }

  function targetInventoryFor(world, state, product, reserve, now) {
    const demandQuantity = Math.max(0, Number(state.previousDemandQuantities?.[product.id] || 0));
    const stats = realTradeStats(world, product.id, now, ACTIVITY_WINDOW_MS);
    const tradeQuantity = Math.max(0, Number(stats.playerQuantity || 0) + Number(stats.consumptionQuantity || 0));
    const rawTarget = Math.max(LIQUIDITY_MIN_TARGET, Math.ceil(demandQuantity * 0.5 + tradeQuantity * 0.05));
    const previous = Math.max(LIQUIDITY_MIN_TARGET, Math.ceil(Number(reserve.targetInventory || LIQUIDITY_MIN_TARGET)));
    const minimum = Math.max(LIQUIDITY_MIN_TARGET, Math.floor(previous * (1 - LIQUIDITY_TARGET_MAX_FALL)));
    const maximum = Math.max(minimum, Math.ceil(previous * (1 + LIQUIDITY_TARGET_MAX_RISE)));
    return clamp(minimum, maximum, rawTarget);
  }

  function quoteFor(world, state, product, reserve, now) {
    reserve.targetInventory = targetInventoryFor(world, state, product, reserve, now);
    const referencePrice = Math.max(ORDER_PRICE_TICK, Number(
      world.marketDemand.priceTransmission.products[product.id]?.referencePrice || product.basePrice,
    ));
    const totalInventory = reserve.inventory + reserve.frozenInventory;
    const inventoryRatio = totalInventory / Math.max(1, reserve.targetInventory);
    const skewExponent = clamp(-0.10, 0.10, -LIQUIDITY_INVENTORY_SKEW * (inventoryRatio - 1));
    const midpoint = referencePrice * Math.exp(skewExponent);
    const volatility = recentVolatility(world, product, now);
    const spread = clamp(
      LIQUIDITY_MIN_SPREAD,
      LIQUIDITY_MAX_SPREAD,
      LIQUIDITY_BASE_SPREAD + volatility * 1.5,
    );
    const minimum = Math.max(ORDER_PRICE_TICK, ceilPlayerMoney(product.basePrice * PRICE_MIN_MULTIPLIER) || ORDER_PRICE_TICK);
    const maximum = Math.max(minimum + ORDER_PRICE_TICK, floorPlayerMoney(product.basePrice * PRICE_MAX_MULTIPLIER) || minimum + ORDER_PRICE_TICK);
    const rawBid = clamp(minimum, maximum - ORDER_PRICE_TICK, floorPlayerMoney(midpoint * (1 - spread / 2)) || minimum);
    const rawAsk = clamp(rawBid + ORDER_PRICE_TICK, maximum, ceilPlayerMoney(midpoint * (1 + spread / 2)) || rawBid + ORDER_PRICE_TICK);
    const lowestSystemAsk = bestSystemPrice(world, product.id, 'sell');
    const highestSystemBid = bestSystemPrice(world, product.id, 'buy');
    const bidCeiling = lowestSystemAsk === null
      ? maximum - ORDER_PRICE_TICK
      : Math.min(maximum - ORDER_PRICE_TICK, floorPlayerMoney(lowestSystemAsk - ORDER_PRICE_TICK) || 0);
    const bid = bidCeiling >= minimum ? Math.min(rawBid, bidCeiling) : null;
    const askFloor = highestSystemBid === null
      ? minimum + ORDER_PRICE_TICK
      : ceilPlayerMoney(highestSystemBid + ORDER_PRICE_TICK);
    const askCandidate = Math.max(rawAsk, askFloor || rawAsk, (bid ?? rawBid) + ORDER_PRICE_TICK);
    const ask = askCandidate <= maximum ? ceilPlayerMoney(askCandidate) : null;
    return { bid, ask, midpoint: round4(midpoint), spread: round4(spread) };
  }

  function createOrder(world, group, product, side, price, quantity, cycleId, now) {
    if (quantity < 1 || !Number.isFinite(price) || price < ORDER_PRICE_TICK || floorPlayerMoney(price) !== price) return null;
    const order = {
      id: `market-liquidity-order-${randomUUID()}`,
      assetKind: 'commodity',
      assetId: product.id,
      productId: product.id,
      side,
      ownerType: 'population',
      ownerName: group.ownerName,
      demandGroupId: group.id,
      demandTier: side === 'buy' ? LIQUIDITY_BUY : LIQUIDITY_SELL,
      demandCycleId: cycleId,
      price,
      quantity,
      remaining: quantity,
      status: 'open',
      createdAt: now,
    };
    world.orders.push(order);
    matchOrder(world, order, now);
    return order;
  }

  function processGroup(world, group, state, cycleId, now) {
    normalizeWorld(world);
    const groupState = groupStateFor(world, group.id);
    if (!groupState || Number(groupState.lastCycleId) === cycleId) return false;
    cancelGroupOrders(world, group.id);
    const groupProducts = productsByGroup.get(group.id) || [];
    const quotes = new Map();
    const entries = [];
    const signals = new Map();
    for (const product of groupProducts) {
      const reserve = reserveFor(world, group.id, product.id);
      const quote = quoteFor(world, state, product, reserve, now);
      quotes.set(product.id, quote);
      const totalInventory = reserve.inventory + reserve.frozenInventory;
      const deficitQuantity = Math.max(0, reserve.targetInventory - totalInventory);
      const stats = realTradeStats(world, product.id, now, ACTIVITY_WINDOW_MS);
      const sellerQuantity = Math.max(0, -Number(stats.playerNetActive || 0));
      const unmetValue = Math.max(0, Number(state.lastCycleSettlement?.products?.[product.id]?.openValue || 0));
      const weight = quote.bid === null ? 0 : deficitQuantity * quote.bid + sellerQuantity * quote.bid * 0.25 + unmetValue;
      signals.set(product.id, { deficitQuantity, sellerQuantity });
      if (weight > 0) entries.push({ id: product.id, weight, maxBudget: groupState.credits });
    }

    const quoteBudget = roundMoney(groupState.credits);
    const budgets = allocateMoneyBudget(entries, quoteBudget);

    for (const product of [...groupProducts].sort((left, right) => left.basePrice - right.basePrice || left.id.localeCompare(right.id))) {
      const reserve = reserveFor(world, group.id, product.id);
      const quote = quotes.get(product.id);
      const signal = signals.get(product.id) || { deficitQuantity: 0, sellerQuantity: 0 };
      let buyQuantity = 0;
      if (quote.bid !== null) {
        const plannedQuantity = signal.deficitQuantity + Math.ceil(signal.sellerQuantity * 0.25);
        const budget = Math.min(groupState.credits, budgets.get(product.id) || 0);
        buyQuantity = Math.min(
          plannedQuantity,
          Math.floor(groupState.credits / quote.bid),
          Math.floor(budget / quote.bid),
        );
        if (buyQuantity > 0) {
          const reservedCredits = multiplyMoneyByInteger(quote.bid, buyQuantity) || 0;
          groupState.credits = roundMoney(groupState.credits - reservedCredits);
          groupState.frozenCredits = roundMoney(groupState.frozenCredits + reservedCredits);
          createOrder(world, group, product, 'buy', quote.bid, buyQuantity, cycleId, now);
        }
      }

      let sellQuantity = 0;
      if (quote.ask !== null) {
        const safetyStock = Math.max(LIQUIDITY_MIN_TARGET, Math.floor(reserve.targetInventory * 0.20));
        sellQuantity = Math.max(0, reserve.inventory - safetyStock);
        if (sellQuantity > 0) {
          reserve.inventory -= sellQuantity;
          reserve.frozenInventory += sellQuantity;
          createOrder(world, group, product, 'sell', quote.ask, sellQuantity, cycleId, now);
        }
      }

      repairCrossedSystemBook(world, group.id, product.id);
      reserve.lastBidPrice = quote.bid ?? 0;
      reserve.lastAskPrice = quote.ask ?? 0;
      reserve.lastBidQuantity = buyQuantity;
      reserve.lastAskQuantity = sellQuantity;
      reserve.lastMidpoint = quote.midpoint;
      reserve.lastSpread = quote.spread;
    }
    groupState.lastCycleId = cycleId;
    return true;
  }

  return {
    normalizeWorld,
    processGroup,
    groupStateFor,
    reserveFor,
    LIQUIDITY_BUY,
    LIQUIDITY_SELL,
  };
}
