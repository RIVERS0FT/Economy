import { randomUUID } from 'node:crypto';
import {
  ACTIVITY_WINDOW_MS,
  LIQUIDITY_BASE_SPREAD,
  LIQUIDITY_INVENTORY_SKEW,
  LIQUIDITY_MAX_SPREAD,
  LIQUIDITY_MAX_TARGET,
  LIQUIDITY_MIN_SPREAD,
  LIQUIDITY_MIN_QUOTE_BUDGET_SHARE,
  LIQUIDITY_MIN_TARGET,
  LIQUIDITY_QUOTE_BUDGET_SHARE,
  LIQUIDITY_TRADE_SHARE,
  PRICE_MAX_MULTIPLIER,
  PRICE_MIN_MULTIPLIER,
  PRICE_WINDOW_MS,
} from './market-demand/catalog.js';
import { allocateIntegerBudget, clamp, round4 } from './market-demand/math.js';
import { bestSystemPrice, systemBookIsCrossed } from './order-book-integrity.js';

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
    return clamp(LIQUIDITY_MIN_TARGET, LIQUIDITY_MAX_TARGET, Math.ceil(Math.max(1, seed) * 0.5));
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
      targetInventory: clamp(
        LIQUIDITY_MIN_TARGET,
        LIQUIDITY_MAX_TARGET,
        Math.max(1, Math.ceil(Number(previous?.targetInventory || fallback.targetInventory))),
      ),
      totalBought: Math.max(0, Math.floor(Number(previous?.totalBought || 0))),
      totalSold: Math.max(0, Math.floor(Number(previous?.totalSold || 0))),
      totalBuyValue: Math.max(0, Math.floor(Number(previous?.totalBuyValue || 0))),
      totalSellValue: Math.max(0, Math.floor(Number(previous?.totalSellValue || 0))),
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
      const previousFrozenCredits = Math.max(0, Math.floor(Number(previousGroup.frozenCredits || 0)));
      const groupState = {
        seeded: wasSeeded || seedNow,
        initialCredits: Math.max(0, Math.floor(Number(
          previousGroup.initialCredits ?? (seedNow ? group.baseBudget : 0),
        ))),
        credits: Math.max(0, Math.floor(Number(
          previousGroup.credits ?? (seedNow ? group.baseBudget : 0),
        ))) + (rebuildSeededState ? previousFrozenCredits : 0),
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
      const release = remaining * Math.max(1, Math.floor(Number(order.price || 1)));
      groupState.frozenCredits = Math.max(0, groupState.frozenCredits - release);
      groupState.credits += release;
    } else if (order.demandTier === LIQUIDITY_SELL) {
      reserve.frozenInventory = Math.max(0, reserve.frozenInventory - remaining);
      reserve.inventory += remaining;
    }
    order.remaining = 0;
    order.status = 'cancelled';
  }

  function cancelGroupOrders(world, groupId) {
    for (const order of world.orders || []) {
      if (
        order.ownerType === 'population'
        && order.demandGroupId === groupId
        && (order.demandTier === LIQUIDITY_BUY || order.demandTier === LIQUIDITY_SELL)
      ) releaseOpenOrder(world, order);
    }
  }

  function bestSystemOrder(world, productId, side) {
    const orders = (world.orders || []).filter((order) => (
      order.ownerType === 'population'
      && order.productId === productId
      && order.side === side
      && isOpenOrder(order)
    ));
    orders.sort(side === 'buy'
      ? (left, right) => Number(right.price) - Number(left.price) || Number(left.createdAt) - Number(right.createdAt)
      : (left, right) => Number(left.price) - Number(right.price) || Number(left.createdAt) - Number(right.createdAt));
    return orders[0] || null;
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

  function targetInventoryFor(world, state, product, now) {
    const demandQuantity = Math.max(0, Number(state.previousDemandQuantities?.[product.id] || 0));
    const stats = realTradeStats(world, product.id, now, ACTIVITY_WINDOW_MS);
    const tradeQuantity = Math.max(0, Number(stats.playerQuantity || 0) + Number(stats.consumptionQuantity || 0));
    return clamp(
      LIQUIDITY_MIN_TARGET,
      LIQUIDITY_MAX_TARGET,
      Math.ceil(demandQuantity * 0.5 + tradeQuantity * 0.05),
    );
  }

  function quoteFor(world, state, product, reserve, now) {
    reserve.targetInventory = targetInventoryFor(world, state, product, now);
    const referencePrice = Math.max(1, Number(
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
    const minimum = Math.max(1, Math.ceil(product.basePrice * PRICE_MIN_MULTIPLIER));
    const maximum = Math.max(minimum + 1, Math.floor(product.basePrice * PRICE_MAX_MULTIPLIER));
    const rawBid = clamp(minimum, maximum - 1, Math.floor(midpoint * (1 - spread / 2)));
    const rawAsk = clamp(rawBid + 1, maximum, Math.ceil(midpoint * (1 + spread / 2)));
    const lowestSystemAsk = bestSystemPrice(world, product.id, 'sell');
    const highestSystemBid = bestSystemPrice(world, product.id, 'buy');
    const bidCeiling = lowestSystemAsk === null ? maximum - 1 : Math.min(maximum - 1, lowestSystemAsk - 1);
    const bid = bidCeiling >= minimum ? Math.min(rawBid, bidCeiling) : null;
    const askFloor = highestSystemBid === null ? minimum + 1 : highestSystemBid + 1;
    const askCandidate = Math.max(rawAsk, askFloor, (bid ?? rawBid) + 1);
    const ask = askCandidate <= maximum ? askCandidate : null;
    return { bid, ask, midpoint: round4(midpoint), spread: round4(spread) };
  }

  function createOrder(world, group, product, side, price, quantity, cycleId, now) {
    if (quantity < 1 || !Number.isInteger(price) || price < 1) return null;
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
    for (const product of groupProducts) {
      const reserve = reserveFor(world, group.id, product.id);
      const quote = quoteFor(world, state, product, reserve, now);
      quotes.set(product.id, quote);
      const totalInventory = reserve.inventory + reserve.frozenInventory;
      const deficit = clamp(0, 1, (reserve.targetInventory - totalInventory) / Math.max(1, reserve.targetInventory));
      const stats = realTradeStats(world, product.id, now, ACTIVITY_WINDOW_MS);
      const sellerFlow = stats.playerQuantity <= 0 ? 0 : clamp(0, 1, -stats.playerNetActive / stats.playerQuantity);
      const weight = deficit + sellerFlow * 0.25;
      if (weight > 0) entries.push({ id: product.id, weight, maxBudget: Math.max(0, Number(state.lastBudget || 0)) });
    }

    const quoteBudget = Math.min(
      groupState.credits,
      Math.max(
        Math.max(0, Math.floor(Number(state.lastBudget ?? group.baseBudget) * LIQUIDITY_QUOTE_BUDGET_SHARE)),
        Math.max(0, Math.floor(Number(group.baseBudget || 0) * LIQUIDITY_MIN_QUOTE_BUDGET_SHARE)),
      ),
    );
    const budgets = allocateIntegerBudget(entries, quoteBudget);
    let remainingQuoteBudget = quoteBudget;

    for (const product of [...groupProducts].sort((left, right) => left.basePrice - right.basePrice || left.id.localeCompare(right.id))) {
      const reserve = reserveFor(world, group.id, product.id);
      const quote = quotes.get(product.id);
      const tradeCap = Math.max(1, Math.floor(reserve.targetInventory * LIQUIDITY_TRADE_SHARE));
      const totalInventory = reserve.inventory + reserve.frozenInventory;
      const inventoryRoom = Math.max(0, Math.ceil(reserve.targetInventory * 1.25) - totalInventory);
      let buyQuantity = 0;
      if (quote.bid !== null) {
        let budget = Math.min(remainingQuoteBudget, budgets.get(product.id) || 0);
        if (budget < quote.bid && remainingQuoteBudget >= quote.bid && (budgets.get(product.id) || 0) > 0) budget = quote.bid;
        buyQuantity = Math.min(
          tradeCap,
          inventoryRoom,
          Math.floor(groupState.credits / quote.bid),
          Math.floor(budget / quote.bid),
        );
        if (buyQuantity > 0) {
          const reservedCredits = buyQuantity * quote.bid;
          groupState.credits -= reservedCredits;
          groupState.frozenCredits += reservedCredits;
          remainingQuoteBudget -= reservedCredits;
          createOrder(world, group, product, 'buy', quote.bid, buyQuantity, cycleId, now);
        }
      }

      let sellQuantity = 0;
      if (quote.ask !== null) {
        const safetyStock = Math.floor(reserve.targetInventory * 0.20);
        sellQuantity = Math.min(
          tradeCap,
          Math.max(0, reserve.inventory - safetyStock),
        );
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
