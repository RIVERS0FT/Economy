import { randomUUID } from 'node:crypto';
import { applyMarketSellFee } from './market-sell-fee.js';
import { isOpenOrder, orderKind } from './order-identity.js';
import { getOrderBookSide, recordOrderBookReduction } from './order-book-runtime.js';
import {
  PRICE_MAX_MULTIPLIER,
  PRICE_MIN_MULTIPLIER,
  SYSTEM_PRICE_K_BPS,
  SYSTEM_PRICE_LIQUIDITY_BASELINE,
  SYSTEM_PRICE_MAX_CHANGE_BPS,
} from './market-demand/catalog.js';
import { clamp, round4 } from './market-demand/math.js';
import { ceilPlayerMoney, floorPlayerMoney, multiplyMoneyByInteger, ORDER_PRICE_TICK, roundInternalMoney } from './money.js';
import { creditPopulationEmployment } from './population-economy.js';
import {
  DEFAULT_PROVINCE_ID,
  inventoryForProvince,
  normalizeProvinceId,
  provinceScopedKey,
} from './provinces.js';

export function createSystemMarketRuntime({
  products,
  constants,
  marketFor,
  isOpenOrder,
  recordPrice,
  addTrade,
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
    if (!Number.isFinite(Number(market.nextPriceAt))) market.nextPriceAt = now + constants.demandCycleMs;
    market.cycleBuyQuantity = Math.max(0, Math.floor(Number(market.cycleBuyQuantity || 0)));
    market.cycleSellQuantity = Math.max(0, Math.floor(Number(market.cycleSellQuantity || 0)));
    market.lastImbalance = Number.isFinite(Number(market.lastImbalance)) ? Number(market.lastImbalance) : 0;
    market.lastPriceChangeBps = Number.isFinite(Number(market.lastPriceChangeBps))
      ? Math.trunc(Number(market.lastPriceChangeBps))
      : 0;
    if (!Number.isFinite(Number(market.lastPriceAt))) market.lastPriceAt = now;
    return market;
  }

  function recordSystemAudit(world, market, product, { side, quantity, total, netTotal = total }) {
    world.systemMarketAudit ||= { version: 1, products: {} };
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

  function settlePlayerOrderWithSystem(world, order, createdAt) {
    if (order?.ownerType !== 'player' || orderKind(order) !== 'commodity' || !isOpenOrder(order)) return 0;
    const product = productFor(order.productId);
    const market = marketFor(world, product.id, createdAt, order.provinceId);
    ensureSystemPrice(market, product, createdAt);
    const price = market.officialPrice;
    if (Number(order.price) !== price) return 0;
    const quantity = Math.max(0, Math.floor(Number(order.remaining || 0)));
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
      counterparty: '系统市场',
      liquidity: 'taker',
      makerOrderId: order.id,
      takerOrderId: order.id,
      createdAt,
    };
    if (order.side === 'buy') {
      const reserved = multiplyMoneyByInteger(order.price, quantity) || 0;
      player.frozenCredits = roundInternalMoney(player.frozenCredits - reserved) || 0;
      inventoryFor(player, product.id, order.provinceId).available += quantity;
      player.stats ||= {};
      player.stats.commodityVolume = Number(player.stats.commodityVolume || 0) + quantity;
      player.stats.boughtGoods = Number(player.stats.boughtGoods || 0) + quantity;
      addTrade(player, {
        type: 'commodity', productId: product.id, provinceId: normalizeProvinceId(order.provinceId),
        side: 'buy', quantity, price, total, counterparty: '系统市场',
        createdAt, description: `买入 ${product.name}`,
      });
      addLedger(player, 'market_trade', -total, `向系统买入 ${quantity} 个${product.name}，系统价 ${price}`, createdAt);
      market.cycleBuyQuantity = Math.max(0, Math.floor(Number(market.cycleBuyQuantity || 0))) + quantity;
      recordSystemAudit(world, market, product, { side: 'buy', quantity, total });
    } else {
      const inventory = inventoryFor(player, product.id, order.provinceId);
      inventory.frozen = Math.max(0, Number(inventory.frozen || 0) - quantity);
      player.credits = roundInternalMoney(player.credits + sellerSettlement.netTotal) || 0;
      player.stats ||= {};
      player.stats.commodityVolume = Number(player.stats.commodityVolume || 0) + quantity;
      player.stats.soldGoods = Number(player.stats.soldGoods || 0) + quantity;
      if (sellerSettlement.fee > 0) {
        creditPopulationEmployment(world, sellerSettlement.fee, 'marketService');
        player.stats.marketServiceFees = Number(player.stats.marketServiceFees || 0) + sellerSettlement.fee;
        player.stats.employmentPayments = Number(player.stats.employmentPayments || 0) + sellerSettlement.fee;
      }
      addTrade(player, {
        type: 'commodity', productId: product.id, provinceId: normalizeProvinceId(order.provinceId),
        side: 'sell', quantity, price, total,
        fee: sellerSettlement.fee, netTotal: sellerSettlement.netTotal, counterparty: '系统市场',
        createdAt, description: `卖出 ${product.name}`,
      });
      addLedger(
        player,
        'market_trade',
        sellerSettlement.netTotal,
        `向系统卖出 ${quantity} 个${product.name}，系统价 ${price}，市场服务费 ${sellerSettlement.fee}`,
        createdAt,
      );
      market.cycleSellQuantity = Math.max(0, Math.floor(Number(market.cycleSellQuantity || 0))) + quantity;
      recordSystemAudit(world, market, product, {
        side: 'sell',
        quantity,
        total,
        netTotal: sellerSettlement.netTotal,
      });
    }
    order.remaining = 0;
    order.status = 'filled';
    order.lastFilledAt = createdAt;
    order.fills = Array.isArray(order.fills) ? order.fills : [];
    order.fills.push(fill);
    order.fills = order.fills.slice(-120);
    recordOrderBookReduction(world, order, quantity);
    recordPrice(
      world,
      product.id,
      price,
      quantity,
      order.side,
      createdAt,
      1,
      'player',
      order.provinceId,
    );
    return quantity;
  }

  function clearPlayerOrdersAtSystemPrice(world, market, product, now) {
    const price = market.officialPrice;
    for (const side of ['sell', 'buy']) {
      const candidates = getOrderBookSide(world, {
        provinceId: market.provinceId,
        assetKind: 'commodity',
        assetId: product.id,
        side,
      });
      for (const order of candidates) {
        if (order.ownerType !== 'player' || Number(order.price) !== price || !isOpenOrder(order)) continue;
        settlePlayerOrderWithSystem(world, order, now);
      }
    }
  }

  function advancePriceCycle(world, market, product, now) {
    ensureSystemPrice(market, product, now);
    const buyQuantity = Math.max(0, Math.floor(Number(market.cycleBuyQuantity || 0)));
    const sellQuantity = Math.max(0, Math.floor(Number(market.cycleSellQuantity || 0)));
    const baseline = SYSTEM_PRICE_LIQUIDITY_BASELINE;
    const imbalance = (buyQuantity - sellQuantity) / (buyQuantity + sellQuantity + 2 * baseline);
    const rawBps = Math.round(imbalance * SYSTEM_PRICE_K_BPS);
    const changeBps = clamp(-SYSTEM_PRICE_MAX_CHANGE_BPS, SYSTEM_PRICE_MAX_CHANGE_BPS, rawBps);
    const nextPrice = clampSystemPrice(product, market.officialPrice * (1 + changeBps / 10_000));
    market.lastImbalance = round4(imbalance);
    market.lastPriceChangeBps = changeBps;
    market.officialPrice = nextPrice;
    market.lastPriceAt = now;
    market.nextPriceAt = now + constants.demandCycleMs;
    market.cycleBuyQuantity = 0;
    market.cycleSellQuantity = 0;
    market.priceHistory ||= [];
    market.priceHistory.push({
      price: nextPrice,
      quantity: buyQuantity + sellQuantity,
      createdAt: now,
    });
    market.priceHistory = market.priceHistory.slice(-constants.maxPricePoints);
    clearPlayerOrdersAtSystemPrice(world, market, product, now);
  }

  function normalizeSystemPrices(world, now = Date.now()) {
    for (const market of Object.values(world.markets || {})) {
      if (!market?.productId) continue;
      ensureSystemPrice(market, productFor(market.productId), now);
    }
    return world;
  }

  function processPriceCycles(world, now = Date.now()) {
    for (const market of Object.values(world.markets || {})) {
      if (!market?.productId) continue;
      const product = productFor(market.productId);
      ensureSystemPrice(market, product, now);
      if (Number(market.nextPriceAt || 0) > now) continue;
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
    settlePlayerOrderWithSystem,
    systemPriceFor,
  };
}
