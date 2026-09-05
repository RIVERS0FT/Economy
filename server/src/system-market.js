import { adoptLegacyCommodityFreeze, consumeCommodityFreeze, freezeCommodity, releaseLegacyOrderFreeze } from './commodity-freezes.js';
import { randomUUID } from 'node:crypto';
import { applyMarketSellFee } from './market-sell-fee.js';
import { isOpenOrder, orderKind } from './order-identity.js';
import { recordOrderBookReduction } from './order-book-runtime.js';
import {
  PRICE_MAX_MULTIPLIER,
  PRICE_MIN_MULTIPLIER,
  SYSTEM_PRICE_K_BPS,
  SYSTEM_PRICE_LIQUIDITY_BASELINE,
  SYSTEM_PRICE_MAX_CHANGE_BPS,
} from './market-demand/catalog.js';
import { clamp, round4 } from './market-demand/math.js';
import { dailyCheckInPeriodFor, checkInDateKey } from './daily-check-in.js';
import { ceilPlayerMoney, floorPlayerMoney, multiplyMoneyByInteger, ORDER_PRICE_TICK, roundInternalMoney } from './money.js';
import { creditPopulationEmployment } from './population-economy.js';
import {
  DEFAULT_PROVINCE_ID,
  inventoryForProvince,
  normalizeProvinceId,
  provinceScopedKey,
} from './provinces.js';

export const DAILY_SYSTEM_MARKET_VERSION = 2;

const SYSTEM_MARKET_DAILY_HISTORY_LIMIT = 29;

function normalizeMarketDailyHistory(market) {
  const normalized = new Map();
  for (const entry of Array.isArray(market?.dailyHistory) ? market.dailyHistory : []) {
    const dateKey = String(entry?.dateKey || '');
    const price = Number(entry?.price || 0);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !(price > 0)) continue;
    const buyQuantity = positiveInteger(entry?.buyQuantity ?? entry?.buyVolume);
    const sellQuantity = positiveInteger(entry?.sellQuantity ?? entry?.sellVolume);
    normalized.set(dateKey, { dateKey, price, buyQuantity, sellQuantity, volume: buyQuantity + sellQuantity });
  }
  market.dailyHistory = [...normalized.values()].sort((left, right) => left.dateKey.localeCompare(right.dateKey)).slice(-SYSTEM_MARKET_DAILY_HISTORY_LIMIT);
  return market.dailyHistory;
}

function appendMarketDailyHistory(market, entry) {
  normalizeMarketDailyHistory(market);
  const dateKey = String(entry?.dateKey || '');
  const price = Number(entry?.price || 0);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !(price > 0)) return;
  const buyQuantity = positiveInteger(entry?.buyQuantity);
  const sellQuantity = positiveInteger(entry?.sellQuantity);
  market.dailyHistory = [...market.dailyHistory.filter((candidate) => candidate.dateKey !== dateKey), { dateKey, price, buyQuantity, sellQuantity, volume: buyQuantity + sellQuantity }].sort((left, right) => left.dateKey.localeCompare(right.dateKey)).slice(-SYSTEM_MARKET_DAILY_HISTORY_LIMIT);
}

function positiveInteger(value) {
  const normalized = Math.floor(Number(value || 0));
  return Number.isSafeInteger(normalized) && normalized > 0 ? normalized : 0;
}

export function createSystemMarketRuntime({
  products,
  constants,
  marketFor,
  isOpenOrder,
  recordPrice,
  addLedger,
  inventoryFor = inventoryForProvince,
  productFor,
}) {
  function clampSystemPrice(product, value) {
    const minimum = Math.max(
      ORDER_PRICE_TICK,
      ceilPlayerMoney(product.basePrice * PRICE_MIN_MULTIPLIER) || ORDER_PRICE_TICK,
    );
    const maximum = Math.max(
      minimum,
      floorPlayerMoney(product.basePrice * PRICE_MAX_MULTIPLIER) || minimum,
    );
    const ticked = floorPlayerMoney(Number(value));
    const normalized = Number.isFinite(ticked) && ticked > 0 ? ticked : minimum;
    return Math.min(maximum, Math.max(minimum, normalized));
  }

  function ensureSystemPrice(market, product, now) {
    market.provinceId = normalizeProvinceId(market.provinceId || DEFAULT_PROVINCE_ID);
    normalizeMarketDailyHistory(market);
    if (!Number.isFinite(Number(market.officialPrice)) || Number(market.officialPrice) <= 0) {
      const seed = Number.isFinite(Number(market.lastTradePrice)) && Number(market.lastTradePrice) > 0
        ? Number(market.lastTradePrice)
        : (Number.isFinite(Number(market.lastPrice)) && Number(market.lastPrice) > 0
          ? Number(market.lastPrice)
          : product.basePrice);
      market.officialPrice = clampSystemPrice(product, seed);
    } else {
      market.officialPrice = clampSystemPrice(product, market.officialPrice);
    }

    const period = dailyCheckInPeriodFor(now);
    if (Number(market.systemPriceVersion || 0) < DAILY_SYSTEM_MARKET_VERSION) {
      // The retired five-minute counters can represent only a partial day. Do not reinterpret them as yesterday.
      market.systemPriceVersion = DAILY_SYSTEM_MARKET_VERSION;
      market.priceDateKey = period.todayKey;
      market.nextPriceAt = period.nextResetAt;
      market.todayBuyQuantity = 0;
      market.todaySellQuantity = 0;
      market.previousDayBuyQuantity = 0;
      market.previousDaySellQuantity = 0;
      market.cycleBuyQuantity = 0;
      market.cycleSellQuantity = 0;
      market.lastImbalance = 0;
      market.lastPriceChangeBps = 0;
      market.lastPriceAt = now;
      return market;
    }

    if (typeof market.priceDateKey !== 'string' || !market.priceDateKey) {
      market.priceDateKey = period.todayKey;
    }
    market.todayBuyQuantity = positiveInteger(market.todayBuyQuantity ?? market.cycleBuyQuantity);
    market.todaySellQuantity = positiveInteger(market.todaySellQuantity ?? market.cycleSellQuantity);
    market.previousDayBuyQuantity = positiveInteger(market.previousDayBuyQuantity);
    market.previousDaySellQuantity = positiveInteger(market.previousDaySellQuantity);
    // Keep old fields as read-only migration aliases while all new pricing logic uses daily counters.
    market.cycleBuyQuantity = market.todayBuyQuantity;
    market.cycleSellQuantity = market.todaySellQuantity;
    market.lastImbalance = Number.isFinite(Number(market.lastImbalance)) ? Number(market.lastImbalance) : 0;
    market.lastPriceChangeBps = Number.isFinite(Number(market.lastPriceChangeBps))
      ? Math.trunc(Number(market.lastPriceChangeBps))
      : 0;
    if (!Number.isFinite(Number(market.lastPriceAt))) market.lastPriceAt = now;
    if (!Number.isFinite(Number(market.nextPriceAt)) || market.priceDateKey === period.todayKey) {
      market.nextPriceAt = period.nextResetAt;
    }
    return market;
  }

  function recordSystemAudit(world, market, product, { side, quantity, total, netTotal = total }) {
    world.systemMarketAudit ||= { version: 2, products: {} };
    world.systemMarketAudit.version = 2;
    const key = provinceScopedKey(market.provinceId, product.id);
    const audit = world.systemMarketAudit.products[key] ||= {
      provinceId: market.provinceId,
      productId: product.id,
      soldQuantity: 0,
      boughtQuantity: 0,
      creditsIssued: 0,
      creditsCollected: 0,
      fillCount: 0,
    };
    if (side === 'buy') {
      audit.soldQuantity = Math.max(0, Number(audit.soldQuantity || 0)) + quantity;
      audit.creditsCollected = roundInternalMoney(Number(audit.creditsCollected || 0) + total) || 0;
    } else {
      audit.boughtQuantity = Math.max(0, Number(audit.boughtQuantity || 0)) + quantity;
      audit.creditsIssued = roundInternalMoney(Number(audit.creditsIssued || 0) + netTotal) || 0;
    }
    audit.fillCount = Math.max(0, Number(audit.fillCount || 0)) + 1;
  }

  function recordDailyVolume(market, side, quantity) {
    if (side === 'buy') market.todayBuyQuantity = positiveInteger(market.todayBuyQuantity) + quantity;
    else market.todaySellQuantity = positiveInteger(market.todaySellQuantity) + quantity;
    market.cycleBuyQuantity = market.todayBuyQuantity;
    market.cycleSellQuantity = market.todaySellQuantity;
  }

  function settleImmediatePlayerTrade(world, {
    userId,
    productId,
    provinceId = DEFAULT_PROVINCE_ID,
    side,
    quantity,
    createdAt = Date.now(),
  }) {
    const normalizedQuantity = positiveInteger(quantity);
    if ((side !== 'buy' && side !== 'sell') || normalizedQuantity < 1) {
      return { ok: false, message: '即时交易参数无效' };
    }
    const product = productFor(productId);
    const market = marketFor(world, product.id, createdAt, provinceId);
    ensureSystemPrice(market, product, createdAt);
    const player = world.players?.[String(userId)];
    if (!player) return { ok: false, message: '玩家不存在' };
    const price = market.officialPrice;
    const total = multiplyMoneyByInteger(price, normalizedQuantity);
    if (total === null) return { ok: false, message: '交易总额超出系统可表示范围' };

    let fee = 0;
    let netTotal = total;
    if (side === 'buy') {
      if (Number(player.credits || 0) < total) return { ok: false, message: '可用资金不足' };
      player.credits = roundInternalMoney(Number(player.credits || 0) - total) || 0;
      inventoryFor(player, product.id, market.provinceId).available += normalizedQuantity;
      player.stats ||= {};
      player.stats.commodityVolume = Number(player.stats.commodityVolume || 0) + normalizedQuantity;
      player.stats.boughtGoods = Number(player.stats.boughtGoods || 0) + normalizedQuantity;
      addLedger(player, 'market_trade', -total, `按今日系统价买入 ${normalizedQuantity} 个${product.name}，成交价 ${price}`, createdAt);
    } else {
      const inventory = inventoryFor(player, product.id, market.provinceId);
      if (Number(inventory.available || 0) < normalizedQuantity) return { ok: false, message: '可用商品库存不足' };
      const settlement = applyMarketSellFee({ ownerType: 'player', side: 'sell', fills: [] }, total);
      fee = settlement.fee;
      netTotal = settlement.netTotal;
      inventory.available = Math.max(0, Number(inventory.available || 0) - normalizedQuantity);
      player.credits = roundInternalMoney(Number(player.credits || 0) + netTotal) || 0;
      player.stats ||= {};
      player.stats.commodityVolume = Number(player.stats.commodityVolume || 0) + normalizedQuantity;
      player.stats.soldGoods = Number(player.stats.soldGoods || 0) + normalizedQuantity;
      if (fee > 0) {
        creditPopulationEmployment(world, fee, 'marketService');
        player.stats.marketServiceFees = Number(player.stats.marketServiceFees || 0) + fee;
        player.stats.employmentPayments = Number(player.stats.employmentPayments || 0) + fee;
      }
      addLedger(
        player,
        'market_trade',
        netTotal,
        `按今日系统价卖出 ${normalizedQuantity} 个${product.name}，成交价 ${price}，市场服务费 ${fee}`,
        createdAt,
      );
    }

    recordDailyVolume(market, side, normalizedQuantity);
    recordSystemAudit(world, market, product, { side, quantity: normalizedQuantity, total, netTotal });
    const fill = {
      id: `system-fill-${randomUUID()}`,
      quantity: normalizedQuantity,
      price,
      total,
      fee,
      netTotal,
      createdAt,
    };
    recordPrice(
      world,
      product.id,
      price,
      normalizedQuantity,
      side,
      createdAt,
      1,
      'player',
      market.provinceId,
    );
    return { ok: true, price, quantity: normalizedQuantity, total, fee, netTotal, fill };
  }

  // Compatibility settlement for legacy player commodity orders encountered before migration.
  function settlePlayerOrderWithSystem(world, order, createdAt) {
    if (order?.ownerType !== 'player' || orderKind(order) !== 'commodity' || !isOpenOrder(order)) return 0;
    const product = productFor(order.productId);
    const market = marketFor(world, product.id, createdAt, order.provinceId);
    ensureSystemPrice(market, product, createdAt);
    const price = market.officialPrice;
    if (Number(order.price) !== price) return 0;
    const quantity = positiveInteger(order.remaining);
    if (quantity <= 0) return 0;
    const player = world.players?.[String(order.ownerId)];
    if (!player) return 0;
    const total = multiplyMoneyByInteger(price, quantity);
    if (total === null) throw new RangeError('系统成交总额超出系统可表示范围');
    const sellerSettlement = order.side === 'sell'
      ? applyMarketSellFee(order, total)
      : { fee: 0, netTotal: total };
    const fill = {
      id: `system-fill-${randomUUID()}`,
      quantity,
      price,
      total,
      fee: sellerSettlement.fee,
      netTotal: sellerSettlement.netTotal,
      createdAt,
    };
    if (order.side === 'buy') {
      const reserved = multiplyMoneyByInteger(order.price, quantity) || 0;
      player.frozenCredits = roundInternalMoney(Number(player.frozenCredits || 0) - reserved) || 0;
      inventoryFor(player, product.id, order.provinceId).available += quantity;
      player.stats ||= {};
      player.stats.commodityVolume = Number(player.stats.commodityVolume || 0) + quantity;
      player.stats.boughtGoods = Number(player.stats.boughtGoods || 0) + quantity;
      addLedger(player, 'market_trade', -total, `按今日系统价买入 ${quantity} 个${product.name}，成交价 ${price}`, createdAt);
    } else {
      const inventory = inventoryFor(player, product.id, order.provinceId);
      adoptLegacyCommodityFreeze(inventory, 'legacy', `order:${order.id}`, quantity);
      consumeCommodityFreeze(inventory, 'legacy', `order:${order.id}`, quantity);
      player.credits = roundInternalMoney(Number(player.credits || 0) + sellerSettlement.netTotal) || 0;
      player.stats ||= {};
      player.stats.commodityVolume = Number(player.stats.commodityVolume || 0) + quantity;
      player.stats.soldGoods = Number(player.stats.soldGoods || 0) + quantity;
      if (sellerSettlement.fee > 0) {
        creditPopulationEmployment(world, sellerSettlement.fee, 'marketService');
        player.stats.marketServiceFees = Number(player.stats.marketServiceFees || 0) + sellerSettlement.fee;
        player.stats.employmentPayments = Number(player.stats.employmentPayments || 0) + sellerSettlement.fee;
      }
      addLedger(
        player,
        'market_trade',
        sellerSettlement.netTotal,
        `按今日系统价卖出 ${quantity} 个${product.name}，成交价 ${price}，市场服务费 ${sellerSettlement.fee}`,
        createdAt,
      );
    }
    recordDailyVolume(market, order.side, quantity);
    recordSystemAudit(world, market, product, {
      side: order.side,
      quantity,
      total,
      netTotal: sellerSettlement.netTotal,
    });
    order.remaining = 0;
    order.status = 'filled';
    order.lastFilledAt = createdAt;
    order.fills = Array.isArray(order.fills) ? order.fills : [];
    order.fills.push(fill);
    order.fills = order.fills.slice(-120);
    recordOrderBookReduction(world, order, quantity);
    recordPrice(world, product.id, price, quantity, order.side, createdAt, 1, 'player', order.provinceId);
    return quantity;
  }

  function advancePriceCycle(world, market, product, now) {
    ensureSystemPrice(market, product, now);
    const period = dailyCheckInPeriodFor(now);
    if (market.priceDateKey === period.todayKey) return false;
    const yesterdayKey = checkInDateKey(period.todayStartsAt - 1);
    const isYesterday = market.priceDateKey === yesterdayKey;
    // Archive the original day independently from the eligible pricing input.
    const archivedBuyQuantity = positiveInteger(market.todayBuyQuantity);
    const archivedSellQuantity = positiveInteger(market.todaySellQuantity);
    const buyQuantity = isYesterday ? archivedBuyQuantity : 0;
    const sellQuantity = isYesterday ? archivedSellQuantity : 0;
    const baseline = SYSTEM_PRICE_LIQUIDITY_BASELINE;
    const imbalance = (buyQuantity - sellQuantity) / (buyQuantity + sellQuantity + 2 * baseline);
    const rawBps = Math.round(imbalance * SYSTEM_PRICE_K_BPS);
    const changeBps = clamp(-SYSTEM_PRICE_MAX_CHANGE_BPS, SYSTEM_PRICE_MAX_CHANGE_BPS, rawBps);
    const nextPrice = clampSystemPrice(product, market.officialPrice * (1 + changeBps / 10_000));
    appendMarketDailyHistory(market, {
      dateKey: String(market.priceDateKey || yesterdayKey),
      price: market.officialPrice,
      buyQuantity: archivedBuyQuantity,
      sellQuantity: archivedSellQuantity,
    });
    market.previousDayBuyQuantity = buyQuantity;
    market.previousDaySellQuantity = sellQuantity;
    market.lastImbalance = round4(imbalance);
    market.lastPriceChangeBps = changeBps;
    market.officialPrice = nextPrice;
    market.lastPriceAt = now;
    market.priceDateKey = period.todayKey;
    market.nextPriceAt = period.nextResetAt;
    market.todayBuyQuantity = 0;
    market.todaySellQuantity = 0;
    market.cycleBuyQuantity = 0;
    market.cycleSellQuantity = 0;
    market.priceHistory ||= [];
    market.priceHistory.push({
      price: nextPrice,
      quantity: buyQuantity + sellQuantity,
      createdAt: now,
    });
    market.priceHistory = market.priceHistory.slice(-constants.maxPricePoints);
    return true;
  }

  function normalizeSystemPrices(world, now = Date.now()) {
    for (const market of Object.values(world.markets || {})) {
      if (!market?.productId) continue;
      ensureSystemPrice(market, productFor(market.productId), now);
    }
    return world;
  }

  function processPriceCycles(world, now = Date.now()) {
    const period = dailyCheckInPeriodFor(now);
    for (const market of Object.values(world.markets || {})) {
      if (!market?.productId) continue;
      const product = productFor(market.productId);
      ensureSystemPrice(market, product, now);
      if (market.priceDateKey === period.todayKey) continue;
      advancePriceCycle(world, market, product, now);
    }
    return world;
  }

  function systemPriceFor(world, productId, now = Date.now(), provinceId = DEFAULT_PROVINCE_ID) {
    const product = productFor(productId);
    const market = marketFor(world, product.id, now, provinceId);
    ensureSystemPrice(market, product, now);
    return market.officialPrice;
  }

  return {
    advancePriceCycle,
    ensureSystemPrice,
    normalizeSystemPrices,
    processPriceCycles,
    settleImmediatePlayerTrade,
    settlePlayerOrderWithSystem,
    systemPriceFor,
  };
}
