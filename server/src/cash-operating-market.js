import { cashAdd, cashEconomyError, cashMoney, cashMicros, cashProduct, cashQuantity, cashTimestamp } from './cash-economy-money.js';
import { cashDateKey, officialCashPrice, requireCashProduct, requireCashProvince } from './commodity-investment-prices.js';

const MAX_POINTS = 288;
const MAX_DAILY_HISTORY = 29;

export function quoteCashOperatingInputs(world, provinceId, inputs, multiplier, at) {
  requireCashProvince(provinceId);
  cashQuantity(multiplier, '等效经营量', { allowZero: true });
  if (!Array.isArray(inputs)) throw cashEconomyError('CASH_RECIPE_INVALID', '投入配方无效');
  const totals = new Map();
  for (const input of inputs) {
    requireCashProduct(input.productId);
    cashQuantity(input.quantity, '配方数量');
    const quantity = cashQuantity(input.quantity * multiplier, '投入数量', { allowZero: true });
    totals.set(input.productId, cashQuantity((totals.get(input.productId) ?? 0) + quantity, '投入数量', { allowZero: true }));
  }
  return [...totals].filter(([, quantity]) => quantity > 0).map(([productId, quantity]) => {
    const quote = officialCashPrice(world, provinceId, productId, at);
    return { productId, quantity, unitPrice: quote.price, total: cashProduct(quote.price, quantity) };
  });
}

export function cashInputTotal(inputs) {
  return cashMoney(inputs.reduce((sum, input) => sum + cashMicros(input.total, '投入金额'), 0n), '材料总费用');
}

/** All changes are prepared before the caller commits its cash/cycle mutation. */
export function prepareCashMarketBookings(world, bookings) {
  const markets = new Map();
  const audit = structuredClone(world.systemMarketAudit ?? { version: 2, products: {} });
  audit.version = 2;
  audit.products ??= {};
  for (const booking of bookings) {
    const { provinceId, productId, side, quantity, price, at, processedAt, execution } = booking;
    requireCashProvince(provinceId); requireCashProduct(productId);
    cashQuantity(quantity, '经营成交数量', { allowZero: true });
    cashTimestamp(at); cashTimestamp(processedAt);
    if (!['buy', 'sell'].includes(side) || at > processedAt) throw cashEconomyError('CASH_BOOKING_INVALID', '经营成交方向或时间无效');
    if (quantity === 0) continue;
    const quote = officialCashPrice(world, provinceId, productId, at);
    if (price !== quote.price) throw cashEconomyError('CASH_BOOKING_PRICE_INVALID', '经营成交必须使用正式价格');
    const key = `${provinceId}:${productId}`;
    const market = markets.get(key) ?? structuredClone(world.markets?.[key]);
    if (!market) throw cashEconomyError('CASH_PRICE_UNAVAILABLE', '经营地区行情未建立');
    const dateKey = cashDateKey(at);
    const counter = side === 'buy' ? 'todayBuyQuantity' : 'todaySellQuantity';
    if (market.priceDateKey === dateKey) {
      market[counter] = cashQuantity((market[counter] ?? 0) + quantity, '每日成交数量');
      market.cycleBuyQuantity = market.todayBuyQuantity ?? 0;
      market.cycleSellQuantity = market.todaySellQuantity ?? 0;
    } else {
      // Late settlement belongs to its original history, not today's pricing input.
      const history = market.dailyHistory ?? [];
      const row = history.find((entry) => entry.dateKey === dateKey)
        ?? { dateKey, price, buyQuantity: 0, sellQuantity: 0, volume: 0 };
      const field = side === 'buy' ? 'buyQuantity' : 'sellQuantity';
      row[field] = cashQuantity((row[field] ?? 0) + quantity, '历史成交数量');
      row.volume = cashQuantity(row.buyQuantity + row.sellQuantity, '历史成交总量');
      market.dailyHistory = [...history.filter((entry) => entry.dateKey !== dateKey), row]
        .sort((left, right) => left.dateKey.localeCompare(right.dateKey)).slice(-MAX_DAILY_HISTORY);
    }
    market.priceHistory ??= [];
    const lastTradeAt = market.priceHistory.reduce((latest, point) => Math.max(latest, Number(point.createdAt ?? 0)), 0);
    if (at >= lastTradeAt) {
      market.lastPrice = price;
      market.lastTradePrice = price;
    }
    market.priceHistory = [...market.priceHistory, {
      price, quantity, createdAt: at, processedAt, takerSide: side, signalWeight: 1,
      marketRole: 'player', execution,
    }].sort((left, right) => left.createdAt - right.createdAt).slice(-MAX_POINTS);
    markets.set(key, market);
    const total = cashProduct(price, quantity);
    const netTotal = booking.netTotal ?? total;
    cashMicros(netTotal, '经营净结算金额');
    if (netTotal > total) throw cashEconomyError('CASH_BOOKING_INVALID', '净结算金额不能大于成交总额');
    const row = audit.products[key] ?? {
      provinceId, productId, soldQuantity: 0, boughtQuantity: 0,
      creditsIssued: 0, creditsCollected: 0, fillCount: 0,
    };
    if (side === 'buy') {
      row.soldQuantity = cashQuantity(row.soldQuantity + quantity, '系统售出数量');
      row.creditsCollected = cashAdd(row.creditsCollected, total, '系统回收资金');
    } else {
      row.boughtQuantity = cashQuantity(row.boughtQuantity + quantity, '系统购入数量');
      row.creditsIssued = cashAdd(row.creditsIssued, netTotal, '系统发行资金');
    }
    row.fillCount = cashQuantity(row.fillCount + 1, '经营成交笔数');
    audit.products[key] = row;
  }
  return { markets, audit, changed: markets.size > 0 };
}

export function commitCashMarketBookings(world, prepared) {
  if (!prepared.changed) return;
  for (const [key, market] of prepared.markets) world.markets[key] = market;
  world.systemMarketAudit = prepared.audit;
}
