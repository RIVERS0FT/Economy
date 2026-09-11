import { createHash } from 'node:crypto';
import policy from '../../shared/commodity-investment-policy.json' with { type: 'json' };
import { PRODUCT_CATALOG } from './product-catalog.js';
import { PROVINCE_CATALOG } from './provinces.js';
import { cashEconomyError, cashMicros, cashMoney, cashTimestamp } from './cash-economy-money.js';

export const COMMODITY_INDEX_VERSION = policy.version;
export const COMMODITY_INVESTMENT_FEE_BPS = policy.feeBps;
export const COMMODITY_INVESTMENT_HISTORY_LIMIT = 100;
const OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const PRODUCTS = new Set(PRODUCT_CATALOG.map((product) => product.id));
const PROVINCES = new Set(PROVINCE_CATALOG.map((province) => province.id));
const WEIGHTS = Object.freeze(policy.weights.map(({ provinceId, weight }) => {
  if (!PROVINCES.has(provinceId) || !Number.isSafeInteger(weight) || weight < 1) {
    throw new Error('商品指数地区权重无效');
  }
  return Object.freeze({ provinceId, weight });
}).sort((left, right) => left.provinceId.localeCompare(right.provinceId)));
if (WEIGHTS.length !== PROVINCES.size || new Set(WEIGHTS.map((entry) => entry.provinceId)).size !== PROVINCES.size) {
  throw new Error('商品指数权重必须且只能覆盖全部正式地区');
}
const TOTAL_WEIGHT = WEIGHTS.reduce((sum, entry) => sum + BigInt(entry.weight), 0n);
export const COMMODITY_INDEX_POLICY_ID = `pce-${COMMODITY_INDEX_VERSION}-${createHash('sha256')
  .update(JSON.stringify(WEIGHTS)).digest('hex').slice(0, 16)}`;

export function cashDateKey(at) {
  return new Date(cashTimestamp(at) + OFFSET_MS).toISOString().slice(0, 10);
}

export function commodityInvestmentPeriod(at) {
  cashTimestamp(at);
  const local = new Date(at + OFFSET_MS);
  const daysSinceMonday = (local.getUTCDay() + 6) % 7;
  const startsAt = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - daysSinceMonday) - OFFSET_MS;
  const endsAt = startsAt + WEEK_MS;
  cashTimestamp(startsAt); cashTimestamp(endsAt);
  return { key: cashDateKey(startsAt), startsAt, endsAt };
}

export function requireCashProduct(productId) {
  if (typeof productId !== 'string' || !PRODUCTS.has(productId)) {
    throw cashEconomyError('CASH_PRODUCT_INVALID', '商品不存在');
  }
  return productId;
}

export function requireCashProvince(provinceId) {
  if (typeof provinceId !== 'string' || !PROVINCES.has(provinceId)) {
    throw cashEconomyError('CASH_PROVINCE_INVALID', '经营地区不存在');
  }
  return provinceId;
}

function priceMicros(value) {
  const micros = cashMicros(value, '正式商品价格');
  if (micros < 10_000n || micros % 10_000n !== 0n) {
    throw cashEconomyError('CASH_PRICE_INVALID', '正式商品价格必须为正分币金额');
  }
  return micros;
}

/** Read only: a missing date is not permission to use a base price or today's quote. */
export function officialCashPrice(world, provinceId, productId, at) {
  requireCashProvince(provinceId); requireCashProduct(productId);
  const dateKey = cashDateKey(at);
  const marketKey = `${provinceId}:${productId}`;
  const archived = world.cashPriceArchive?.days?.[dateKey]?.prices?.[marketKey];
  const market = world.markets?.[marketKey];
  const current = market?.priceDateKey === dateKey ? market.officialPrice : undefined;
  const history = market?.dailyHistory?.find((entry) => entry.dateKey === dateKey)?.price;
  const value = archived ?? current ?? history;
  if (value === undefined) {
    throw cashEconomyError('CASH_PRICE_UNAVAILABLE', `${dateKey} 的正式商品价格尚未就绪`);
  }
  const price = cashMoney(priceMicros(value));
  for (const candidate of [archived, current, history]) {
    if (candidate !== undefined && priceMicros(candidate) !== priceMicros(price)) {
      throw cashEconomyError('CASH_PRICE_CONFLICT', '同一自然日的正式价格来源不一致');
    }
  }
  return { provinceId, productId, dateKey, price };
}

export function commodityInvestmentQuote(world, productId, at) {
  requireCashProduct(productId);
  const period = commodityInvestmentPeriod(at);
  const dateKey = cashDateKey(at);
  let weightedCents = 0n;
  for (const { provinceId, weight } of WEIGHTS) {
    weightedCents += priceMicros(officialCashPrice(world, provinceId, productId, at).price) / 10_000n * BigInt(weight);
  }
  const indexCents = (weightedCents + TOTAL_WEIGHT / 2n) / TOTAL_WEIGHT;
  const price = cashMoney(indexCents * 10_000n, '商品指数价格');
  return {
    productId, contractId: `${productId}:${period.key}:${COMMODITY_INDEX_POLICY_ID}`,
    periodKey: period.key, startsAt: period.startsAt, expiresAt: period.endsAt,
    priceDateKey: dateKey, price, indexPolicyId: COMMODITY_INDEX_POLICY_ID,
    feeBps: COMMODITY_INVESTMENT_FEE_BPS,
  };
}

/** Capture actual published quotes before their bounded UI history is pruned. */
export function archiveCashPriceDay(world, at) {
  const dateKey = cashDateKey(at);
  const prices = {};
  for (const [marketKey, market] of Object.entries(world.markets || {})) {
    if (market?.priceDateKey !== dateKey) continue;
    const [provinceId, productId, extra] = marketKey.split(':');
    if (extra !== undefined || !PROVINCES.has(provinceId) || !PRODUCTS.has(productId)) continue;
    prices[marketKey] = cashMoney(priceMicros(market.officialPrice));
  }
  if (Object.keys(prices).length === 0) return false;
  const archive = world.cashPriceArchive ?? { version: 1, days: {} };
  if (archive.version !== 1) throw cashEconomyError('CASH_PRICE_ARCHIVE_VERSION', '价格归档版本不兼容');
  const previous = archive.days?.[dateKey]?.prices ?? {};
  let changed = false;
  for (const [key, price] of Object.entries(prices)) {
    if (Object.hasOwn(previous, key) && previous[key] !== price) {
      throw cashEconomyError('CASH_PRICE_CONFLICT', '同一自然日不能覆盖已发布价格');
    }
    if (!Object.hasOwn(previous, key)) changed = true;
  }
  if (!changed) return false;
  world.cashPriceArchive = { ...archive, days: { ...archive.days,
    [dateKey]: { prices: { ...previous, ...prices } },
  } };
  return true;
}

/** Bounded retention plus exact dates still needed by genuinely prepaid or unclosed obligations. */
export function pruneCashPriceArchive(world, now) {
  cashTimestamp(now);
  const archive = world.cashPriceArchive;
  if (!archive) return false;
  if (archive.version !== 1 || !archive.days || Array.isArray(archive.days)) {
    throw cashEconomyError('CASH_PRICE_ARCHIVE_VERSION', '价格归档版本或结构不兼容');
  }
  const oldest = cashDateKey(Math.max(0, now - 29 * DAY_MS));
  const retained = new Set();
  for (const player of Object.values(world.players ?? {})) {
    for (const group of player.facilityGroups ?? []) {
      if (group.cashCycle) retained.add(cashDateKey(group.cashCycle.completesAt));
    }
    for (const position of player.weeklyCashSettlement?.pendingInvestmentAssessment?.positions ?? []) {
      retained.add(cashDateKey(Math.min(position.expiresAt, player.weeklyCashSettlement.pendingInvestmentAssessment.assessedAt)));
    }
    for (const position of Object.values(player.commodityInvestmentAccount?.positions ?? {})) {
      retained.add(cashDateKey(position.expiresAt));
    }
  }
  const days = Object.fromEntries(Object.entries(archive.days).filter(([date]) => date >= oldest || retained.has(date)));
  if (Object.keys(days).length === Object.keys(archive.days).length) return false;
  world.cashPriceArchive = { ...archive, days };
  return true;
}
