from pathlib import Path
import re

ROOT = Path('.')

def load(path):
    return (ROOT / path).read_text(encoding='utf-8')

def save(path, text):
    (ROOT / path).write_text(text, encoding='utf-8')

def replace_exact(path, old, new, count=None):
    text = load(path)
    found = text.count(old)
    if found == 0:
        raise SystemExit(f'{path}: missing expected text: {old[:120]!r}')
    if count is not None and found != count:
        raise SystemExit(f'{path}: expected {count} matches, found {found}: {old[:120]!r}')
    text = text.replace(old, new)
    save(path, text)

def replace_regex(path, pattern, replacement, flags=0, count=0, require=True):
    text = load(path)
    next_text, n = re.subn(pattern, replacement, text, count=count, flags=flags)
    if require and n == 0:
        raise SystemExit(f'{path}: regex did not match: {pattern[:120]!r}')
    save(path, next_text)
    return n

market_history = """import type { MarketDailyHistoryPoint, PricePoint } from '../types';

const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;
export const MARKET_BUCKET_MS = 24 * 60 * 60 * 1000;
export const MARKET_BUCKET_COUNT = 30;
export const MARKET_WINDOW_MS = MARKET_BUCKET_COUNT * MARKET_BUCKET_MS;

export type MarketFlowDirection = 'buy' | 'sell' | 'neutral';

export interface MarketHistoryBucket {
  startAt: number;
  price: number;
  volume: number;
  buyVolume: number;
  sellVolume: number;
  neutralVolume: number;
  netVolume: number;
  direction: MarketFlowDirection;
}

export interface MarketFlowSummary {
  volume: number;
  buyVolume: number;
  sellVolume: number;
  neutralVolume: number;
  netVolume: number;
  direction: MarketFlowDirection;
}

function validPrice(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function flowDirection(netVolume: number): MarketFlowDirection {
  if (netVolume > 0) return 'buy';
  if (netVolume < 0) return 'sell';
  return 'neutral';
}

function shanghaiDayIndex(timestamp: number) {
  return Math.floor((timestamp + SHANGHAI_OFFSET_MS) / MARKET_BUCKET_MS);
}

function shanghaiDayStart(dayIndex: number) {
  return dayIndex * MARKET_BUCKET_MS - SHANGHAI_OFFSET_MS;
}

function dateKeyForDayIndex(dayIndex: number) {
  return new Date(dayIndex * MARKET_BUCKET_MS).toISOString().slice(0, 10);
}

function dayIndexForDateKey(dateKey: string) {
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(dateKey)) return null;
  const timestamp = Date.parse(`${dateKey}T00:00:00+08:00`);
  return Number.isFinite(timestamp) ? shanghaiDayIndex(timestamp) : null;
}

export function getMarketWindowBounds(now = Date.now()) {
  const currentDayIndex = shanghaiDayIndex(now);
  const firstDayIndex = currentDayIndex - (MARKET_BUCKET_COUNT - 1);
  return {
    windowStart: shanghaiDayStart(firstDayIndex),
    windowEnd: shanghaiDayStart(currentDayIndex + 1),
  };
}

export function countMarketHistoryPointsInWindow(points: PricePoint[], now = Date.now()) {
  const { windowStart, windowEnd } = getMarketWindowBounds(now);
  return points.reduce((count, point) => (
    Number.isFinite(Number(point.createdAt))
    && Number(point.createdAt) >= windowStart
    && Number(point.createdAt) < windowEnd
      ? count + 1
      : count
  ), 0);
}

export function buildMarketHistoryBuckets(
  points: PricePoint[],
  fallbackPrice: number,
  now = Date.now(),
  dailyHistory: MarketDailyHistoryPoint[] = [],
): MarketHistoryBucket[] {
  const normalizedFallback = validPrice(Number(fallbackPrice), 1);
  const currentDayIndex = shanghaiDayIndex(now);
  const firstDayIndex = currentDayIndex - (MARKET_BUCKET_COUNT - 1);
  const lastDayIndex = currentDayIndex;
  const normalizedPoints = points
    .map((point) => ({
      price: validPrice(Number(point.price), normalizedFallback),
      quantity: Math.max(0, Number(point.quantity) || 0),
      createdAt: Number(point.createdAt),
      takerSide: point.takerSide === 'buy' || point.takerSide === 'sell' ? point.takerSide : undefined,
    }))
    .filter((point) => Number.isFinite(point.createdAt))
    .sort((left, right) => left.createdAt - right.createdAt);

  let previousPrice: number | undefined;
  for (const point of normalizedPoints) {
    if (shanghaiDayIndex(point.createdAt) < firstDayIndex) previousPrice = point.price;
    else break;
  }

  type Aggregate = {
    price: number;
    volume: number;
    buyVolume: number;
    sellVolume: number;
    neutralVolume: number;
    lastTradeAt: number;
  };
  const bucketsByDay = new Map<number, Aggregate>();

  for (const item of dailyHistory) {
    const dayIndex = dayIndexForDateKey(String(item?.dateKey || ''));
    if (dayIndex === null || dayIndex < firstDayIndex || dayIndex > lastDayIndex) continue;
    const buyVolume = Math.max(0, Number(item.buyVolume) || 0);
    const sellVolume = Math.max(0, Number(item.sellVolume) || 0);
    const neutralVolume = Math.max(0, Number(item.neutralVolume) || 0);
    const volume = Math.max(
      buyVolume + sellVolume + neutralVolume,
      Math.max(0, Number(item.volume) || 0),
    );
    bucketsByDay.set(dayIndex, {
      price: validPrice(Number(item.price), normalizedFallback),
      volume,
      buyVolume,
      sellVolume,
      neutralVolume,
      lastTradeAt: shanghaiDayStart(dayIndex) + MARKET_BUCKET_MS - 1,
    });
  }

  if (dailyHistory.length === 0) {
    for (const point of normalizedPoints) {
      const dayIndex = shanghaiDayIndex(point.createdAt);
      if (dayIndex < firstDayIndex || dayIndex > lastDayIndex) continue;
      const buyVolume = point.takerSide === 'buy' ? point.quantity : 0;
      const sellVolume = point.takerSide === 'sell' ? point.quantity : 0;
      const neutralVolume = point.takerSide ? 0 : point.quantity;
      const current = bucketsByDay.get(dayIndex);
      if (!current) {
        bucketsByDay.set(dayIndex, {
          price: point.price,
          volume: point.quantity,
          buyVolume,
          sellVolume,
          neutralVolume,
          lastTradeAt: point.createdAt,
        });
        continue;
      }
      current.volume += point.quantity;
      current.buyVolume += buyVolume;
      current.sellVolume += sellVolume;
      current.neutralVolume += neutralVolume;
      if (point.createdAt >= current.lastTradeAt) {
        current.price = point.price;
        current.lastTradeAt = point.createdAt;
      }
    }
  }

  const firstKnown = [...bucketsByDay.entries()]
    .sort((left, right) => left[0] - right[0])
    .find(([, bucket]) => bucket.price > 0)?.[1].price;
  let carriedPrice = previousPrice ?? firstKnown ?? normalizedFallback;

  return Array.from({ length: MARKET_BUCKET_COUNT }, (_, offset) => {
    const dayIndex = firstDayIndex + offset;
    const trade = bucketsByDay.get(dayIndex);
    if (trade) carriedPrice = trade.price;
    const buyVolume = trade?.buyVolume ?? 0;
    const sellVolume = trade?.sellVolume ?? 0;
    const neutralVolume = trade?.neutralVolume ?? 0;
    const netVolume = buyVolume - sellVolume;
    return {
      startAt: shanghaiDayStart(dayIndex),
      price: carriedPrice,
      volume: trade?.volume ?? 0,
      buyVolume,
      sellVolume,
      neutralVolume,
      netVolume,
      direction: flowDirection(netVolume),
    };
  });
}

export function summarizeMarketFlow(buckets: MarketHistoryBucket[]): MarketFlowSummary {
  const totals = buckets.reduce((summary, bucket) => ({
    volume: summary.volume + bucket.volume,
    buyVolume: summary.buyVolume + bucket.buyVolume,
    sellVolume: summary.sellVolume + bucket.sellVolume,
    neutralVolume: summary.neutralVolume + bucket.neutralVolume,
  }), { volume: 0, buyVolume: 0, sellVolume: 0, neutralVolume: 0 });
  const netVolume = totals.buyVolume - totals.sellVolume;
  return { ...totals, netVolume, direction: flowDirection(netVolume) };
}

export function formatMarketAxisTime(timestamp: number, locales?: Intl.LocalesArgument) {
  return new Intl.DateTimeFormat(locales, {
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Shanghai',
  }).format(timestamp);
}

export function marketBucketDateKey(bucket: MarketHistoryBucket) {
  return dateKeyForDayIndex(shanghaiDayIndex(bucket.startAt));
}
"""
save('src/utils/marketHistory.ts', market_history)

market_scale = """export type MarketChartVariant = 'compact' | 'full';

const DAY_MS = 24 * 60 * 60 * 1000;
const MARKET_TIME_INTERVAL_DAYS = [1, 2, 3, 5, 7, 10, 15] as const;

function clampInteger(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, Math.floor(value)));
}

export function chooseMarketTimeInterval(
  plotWidth: number,
  rootFontSize: number,
  variant: MarketChartVariant,
  windowMs: number,
) {
  const minimumLabelSpacing = variant === 'compact'
    ? Math.max(52, rootFontSize * 3.25)
    : Math.max(60, rootFontSize * 3.75);
  const maximumSegments = clampInteger(Math.max(1, plotWidth) / minimumLabelSpacing, 3, 15);
  const intervalDays = MARKET_TIME_INTERVAL_DAYS.find((days) => (
    Math.max(1, windowMs) / (days * DAY_MS) <= maximumSegments
  )) ?? MARKET_TIME_INTERVAL_DAYS[MARKET_TIME_INTERVAL_DAYS.length - 1];
  return intervalDays * DAY_MS;
}

export function chooseMarketPriceTickCount(priceHeight: number, rootFontSize: number) {
  const minimumTickSpacing = Math.max(38, rootFontSize * 2.4);
  return clampInteger(Math.max(1, priceHeight) / minimumTickSpacing + 1, 3, 7);
}

export function chooseMarketVolumeTickCount(
  volumeHeight: number,
  rootFontSize: number,
  variant: MarketChartVariant = 'full',
) {
  const minimumTickSpacing = Math.max(34, rootFontSize * 2.2);
  const minimumTicks = variant === 'compact' ? 2 : 3;
  return clampInteger(Math.max(1, volumeHeight) / minimumTickSpacing + 1, minimumTicks, 5);
}

export function resolveMarketBucketIndex(
  axisValue: number,
  windowStart: number,
  bucketCount: number,
  bucketMs: number,
) {
  if (!(bucketCount > 0) || !(bucketMs > 0) || !Number.isFinite(axisValue) || !Number.isFinite(windowStart)) return 0;
  const rawIndex = Math.floor((axisValue - windowStart) / bucketMs);
  return clampInteger(rawIndex, 0, bucketCount - 1);
}
"""
save('src/components/charts/marketChartScale.ts', market_scale)

# Types: expose the 30-day daily trend payload without changing old price-history compatibility.
types = load('src/types.ts')
price_point = """export interface PricePoint {
  price: number;
  quantity: number;
  createdAt: number;
  takerSide?: OrderSide;
}
"""
daily_point = price_point + """
export interface MarketDailyHistoryPoint {
  dateKey: string;
  price: number;
  volume: number;
  buyVolume: number;
  sellVolume: number;
  neutralVolume?: number;
}
"""
if price_point not in types:
    raise SystemExit('src/types.ts: PricePoint block not found')
types = types.replace(price_point, daily_point, 1)
if types.count('  priceHistory?: PricePoint[];') < 2:
    raise SystemExit('src/types.ts: expected Product/Facility priceHistory fields')
types = types.replace(
    '  priceHistory?: PricePoint[];',
    '  priceHistory?: PricePoint[];\n  /** Fixed Beijing-calendar-day trend history for the latest 30 days. */\n  dailyHistory?: MarketDailyHistoryPoint[];',
    2,
)
save('src/types.ts', types)

# MarketPage consumes the daily payload first while retaining raw trade points as a compatibility fallback.
market_page = load('src/pages/MarketPage.tsx')
market_page = market_page.replace(
    "  const marketHistory = detailedMarket?.priceHistory ?? selectedMarket?.priceHistory ?? [];\n",
    "  const marketHistory = detailedMarket?.priceHistory ?? selectedMarket?.priceHistory ?? [];\n  const marketDailyHistory = detailedMarket?.dailyHistory;\n",
    1,
)
market_page = market_page.replace(
    "() => buildMarketHistoryBuckets(marketHistory, marketFallbackPrice, now),\n    [marketFallbackPrice, marketHistory, now],",
    "() => buildMarketHistoryBuckets(marketHistory, marketFallbackPrice, now, marketDailyHistory ?? []),\n    [marketDailyHistory, marketFallbackPrice, marketHistory, now],",
    1,
)
save('src/pages/MarketPage.tsx', market_page)

# Price chart: 30 daily buckets, no visible buy/sell legend, smaller footer.
chart = load('src/components/charts/PriceSparkline.tsx')
chart = chart.replace('近二十四小时', '近三十天')
chart = chart.replace('近 24 小时', '近 30 天')
chart = chart.replace(
"""  const timeLabelHeight = compact ? Math.max(28, rootFontSize * 1.8) : Math.max(52, rootFontSize * 3.2);
  const legendGap = 8;
  const legendHeight = Math.max(20, rootFontSize * 1.25);
  const legendTitleGap = showXAxisTitle ? 10 : 0;
  const titleHeight = showXAxisTitle ? Math.max(16, rootFontSize) : 0;
  const bottomSafeInset = 6;
  const footerHeight = legendGap + legendHeight + legendTitleGap + titleHeight + bottomSafeInset;
""",
"""  const timeLabelHeight = compact ? Math.max(26, rootFontSize * 1.7) : Math.max(44, rootFontSize * 2.75);
  const titleGap = showXAxisTitle ? 8 : 0;
  const titleHeight = showXAxisTitle ? Math.max(16, rootFontSize) : 0;
  const bottomSafeInset = 6;
  const footerHeight = titleGap + titleHeight + bottomSafeInset;
""",
1,
)
chart = chart.replace(
"""        return `<strong>${escapeChartHtml(new Date(bucket.startAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }))}</strong>`
""",
"""        return `<strong>${escapeChartHtml(new Date(bucket.startAt).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', timeZone: 'Asia/Shanghai' }))}</strong>`
""",
1,
)
old_footer = """      <div className="market-chart-footer" style={{ paddingLeft: geometry.left, paddingRight: geometry.right }}>
        <div className="market-chart-legend" aria-label="主动买卖方向图例">
          <span className="market-chart-legend-item buy"><i />净主动买入</span>
          <span className="market-chart-legend-item sell"><i />净主动卖出</span>
        </div>
        {geometry.showXAxisTitle ? <div className="market-chart-x-axis-title">时间</div> : null}
      </div>
"""
new_footer = """      {geometry.showXAxisTitle ? (
        <div className="market-chart-footer" style={{ paddingLeft: geometry.left, paddingRight: geometry.right }}>
          <div className="market-chart-x-axis-title">日期</div>
        </div>
      ) : null}
"""
if old_footer not in chart:
    raise SystemExit('PriceSparkline footer block not found')
chart = chart.replace(old_footer, new_footer, 1)
save('src/components/charts/PriceSparkline.tsx', chart)

# Remove now-unused legend CSS.
charts_css = load('src/styles/charts.css')
charts_css = re.sub(
    r"\n\.market-chart-legend \{.*?\.market-chart-legend-item\.sell > i \{ background: var\(--color-danger\); \}\n",
    "\n",
    charts_css,
    flags=re.S,
)
save('src/styles/charts.css', charts_css)

# Server: retain 29 completed Beijing days; current day is appended dynamically by the detail projection.
system_market = load('server/src/system-market.js')
marker = "export const DAILY_SYSTEM_MARKET_VERSION = 2;\n"
helper = marker + """
const SYSTEM_MARKET_DAILY_HISTORY_LIMIT = 29;

function normalizeMarketDailyHistory(market) {
  const normalized = new Map();
  for (const entry of Array.isArray(market?.dailyHistory) ? market.dailyHistory : []) {
    const dateKey = String(entry?.dateKey || '');
    const price = Number(entry?.price || 0);
    if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(dateKey) || !(price > 0)) continue;
    const buyQuantity = positiveInteger(entry?.buyQuantity ?? entry?.buyVolume);
    const sellQuantity = positiveInteger(entry?.sellQuantity ?? entry?.sellVolume);
    normalized.set(dateKey, {
      dateKey,
      price,
      buyQuantity,
      sellQuantity,
      volume: buyQuantity + sellQuantity,
    });
  }
  market.dailyHistory = [...normalized.values()]
    .sort((left, right) => left.dateKey.localeCompare(right.dateKey))
    .slice(-SYSTEM_MARKET_DAILY_HISTORY_LIMIT);
  return market.dailyHistory;
}

function appendMarketDailyHistory(market, entry) {
  normalizeMarketDailyHistory(market);
  const dateKey = String(entry?.dateKey || '');
  const price = Number(entry?.price || 0);
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(dateKey) || !(price > 0)) return;
  const buyQuantity = positiveInteger(entry?.buyQuantity);
  const sellQuantity = positiveInteger(entry?.sellQuantity);
  market.dailyHistory = [
    ...market.dailyHistory.filter((candidate) => candidate.dateKey !== dateKey),
    {
      dateKey,
      price,
      buyQuantity,
      sellQuantity,
      volume: buyQuantity + sellQuantity,
    },
  ].sort((left, right) => left.dateKey.localeCompare(right.dateKey))
    .slice(-SYSTEM_MARKET_DAILY_HISTORY_LIMIT);
}
"""
if marker not in system_market:
    raise SystemExit('system-market version marker not found')
system_market = system_market.replace(marker, helper, 1)
system_market = system_market.replace(
    "    market.provinceId = normalizeProvinceId(market.provinceId || DEFAULT_PROVINCE_ID);\n",
    "    market.provinceId = normalizeProvinceId(market.provinceId || DEFAULT_PROVINCE_ID);\n    normalizeMarketDailyHistory(market);\n",
    1,
)
next_price_line = "    const nextPrice = clampSystemPrice(product, market.officialPrice * (1 + changeBps / 10_000));\n"
daily_append = next_price_line + """    appendMarketDailyHistory(market, {
      dateKey: String(market.priceDateKey || yesterdayKey),
      price: market.officialPrice,
      buyQuantity,
      sellQuantity,
    });
"""
if next_price_line not in system_market:
    raise SystemExit('system-market next price line not found')
system_market = system_market.replace(next_price_line, daily_append, 1)
save('server/src/system-market.js', system_market)

# Server market detail: expose fixed 30-day daily trend; keep existing 24h raw points for compatibility/summary.
delivery = load('server/src/market-state-delivery.js')
delivery = delivery.replace(
    "import { createEconomicCalendarClientState } from './economic-events.js';\n",
    "import { createEconomicCalendarClientState } from './economic-events.js';\nimport { checkInDateKey } from './daily-check-in.js';\n",
    1,
)
delivery = delivery.replace(
    "const DAY_MS = 24 * 60 * 60 * 1_000;\n",
    "const DAY_MS = 24 * 60 * 60 * 1_000;\nconst MARKET_DAILY_HISTORY_DAYS = 30;\n",
    1,
)
between_marker = """function realTradePointsBetween(market, startsAt, endsAt) {
  return (market?.priceHistory || [])
    .filter((point) => (
      Number(point?.createdAt || 0) >= startsAt
      && Number(point?.createdAt || 0) <= endsAt
      && (point?.takerSide === 'buy' || point?.takerSide === 'sell')
    ))
    .sort((left, right) => Number(left.createdAt || 0) - Number(right.createdAt || 0));
}
"""
daily_helper = between_marker + """
function dailyHistoryForMarket(market, assetKind, now) {
  const byDate = new Map();
  const remember = (entry) => {
    const dateKey = String(entry?.dateKey || '');
    const price = Number(entry?.price || 0);
    if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(dateKey) || !(price > 0)) return;
    const buyVolume = Math.max(0, Number(entry?.buyQuantity ?? entry?.buyVolume) || 0);
    const sellVolume = Math.max(0, Number(entry?.sellQuantity ?? entry?.sellVolume) || 0);
    const neutralVolume = Math.max(0, Number(entry?.neutralVolume) || 0);
    byDate.set(dateKey, {
      dateKey,
      price,
      buyVolume,
      sellVolume,
      neutralVolume,
      volume: Math.max(
        buyVolume + sellVolume + neutralVolume,
        Math.max(0, Number(entry?.volume) || 0),
      ),
    });
  };

  for (const entry of Array.isArray(market?.dailyHistory) ? market.dailyHistory : []) remember(entry);

  if (assetKind === 'commodity') {
    remember({
      dateKey: checkInDateKey(now),
      price: Number(market?.officialPrice || market?.lastPrice || 0),
      buyQuantity: Math.max(0, Number(market?.todayBuyQuantity || 0)),
      sellQuantity: Math.max(0, Number(market?.todaySellQuantity || 0)),
    });
  } else {
    for (const point of realTradePointsBetween(market, now - MARKET_DAILY_HISTORY_DAYS * DAY_MS, now)) {
      const dateKey = checkInDateKey(Number(point.createdAt || 0));
      const current = byDate.get(dateKey) || {
        dateKey,
        price: Number(point.price || 0),
        buyVolume: 0,
        sellVolume: 0,
        neutralVolume: 0,
        volume: 0,
      };
      const quantity = Math.max(0, Number(point.quantity || 0));
      current.price = Number(point.price || current.price || 0);
      current.volume += quantity;
      if (point.takerSide === 'buy') current.buyVolume += quantity;
      else if (point.takerSide === 'sell') current.sellVolume += quantity;
      byDate.set(dateKey, current);
    }
  }

  return [...byDate.values()]
    .sort((left, right) => left.dateKey.localeCompare(right.dateKey))
    .slice(-MARKET_DAILY_HISTORY_DAYS);
}
"""
if between_marker not in delivery:
    raise SystemExit('market-state-delivery realTradePointsBetween block not found')
delivery = delivery.replace(between_marker, daily_helper, 1)
delivery = delivery.replace(
    "  const priceHistory = realTradePoints(market, now).map(publicPricePoint);\n",
    "  const priceHistory = realTradePoints(market, now).map(publicPricePoint);\n  const dailyHistory = dailyHistoryForMarket(market, assetKind, now);\n",
    1,
)
delivery = delivery.replace(
    "    .update(JSON.stringify({ summary, priceHistory, bids, asks }))\n",
    "    .update(JSON.stringify({ summary, priceHistory, dailyHistory, bids, asks }))\n",
    1,
)
delivery = delivery.replace(
    "    market: { ...summary, priceHistory },\n",
    "    market: { ...summary, priceHistory, dailyHistory },\n",
    1,
)
save('server/src/market-state-delivery.js', delivery)

# Authoritative write latency: state projection happens after the write queue has released the committed transaction.
runtime_store = load('server/src/runtime-store.js')
projection_block = """    Object.defineProperty(response, 'stateSnapshot', {
      configurable: true,
      enumerable: false,
      value: this.getStateSnapshot(user, null, now),
    });
    return response;
"""
if projection_block not in runtime_store:
    raise SystemExit('runtime-store stateSnapshot block not found')
runtime_store = runtime_store.replace(projection_block, "    return response;\n", 1)
save('server/src/runtime-store.js', runtime_store)

app = load('server/src/app.js')
app_old = """    const knownPartitions = readKnownPartitionRevisionsFromHeader(
      request.headers['x-economy-state-revisions'],
    );
    sendJson(response, 200, createPartitionedActionDelivery(actionResponse, knownPartitions));
"""
app_new = """    const actionDeliveryNow = Date.now();
    Object.defineProperty(actionResponse, 'stateSnapshot', {
      configurable: true,
      enumerable: false,
      value: store.getStateSnapshot(user, null, actionDeliveryNow),
    });
    const knownPartitions = readKnownPartitionRevisionsFromHeader(
      request.headers['x-economy-state-revisions'],
    );
    sendJson(response, 200, createPartitionedActionDelivery(actionResponse, knownPartitions, actionDeliveryNow));
"""
if app_old not in app:
    raise SystemExit('app action delivery block not found')
app = app.replace(app_old, app_new, 1)
save('server/src/app.js', app)

# Unify the player-visible frozen count while keeping internal mortgage/collateral fields for loan settlement.
fg = load('server/src/facility-groups.js')
fg_old = """  const listedCount = listedQuantity(world, player.userId, group.facilityTypeId, group.provinceId);
  const auctionedCount = auctionedQuantity(world, player.userId, group.facilityTypeId, group.provinceId);
  const frozenCount = listedCount + auctionedCount;
  const mortgagedCount = mortgagedFacilityQuantity(player, group.facilityTypeId, group.provinceId);
  const contractCollateralCount = playerLoanCollateralQuantity(world, player.userId, group.facilityTypeId, group.provinceId);
"""
fg_new = """  const listedCount = listedQuantity(world, player.userId, group.facilityTypeId, group.provinceId);
  const auctionedCount = auctionedQuantity(world, player.userId, group.facilityTypeId, group.provinceId);
  const transactionFrozenCount = listedCount + auctionedCount;
  const mortgagedCount = mortgagedFacilityQuantity(player, group.facilityTypeId, group.provinceId);
  const contractCollateralCount = playerLoanCollateralQuantity(world, player.userId, group.facilityTypeId, group.provinceId);
  const frozenCount = transactionFrozenCount + mortgagedCount + contractCollateralCount;
"""
if fg_old not in fg:
    raise SystemExit('facility-groups clientGroup frozen block not found')
fg = fg.replace(fg_old, fg_new, 1)
save('server/src/facility-groups.js', fg)

# Facility detail displays one unified frozen count.
detail = load('src/pages/production/ProductionFacilityDetail.tsx')
detail_old = """              <span>
                冻结中 <strong>{<CompactNumber value={group.frozenCount ?? group.listedCount} />}</strong>
              </span>
              <span>
                抵押中 <strong>{<CompactNumber value={group.mortgagedCount} />}</strong>
              </span>
"""
detail_new = """              <span>
                冻结中 <strong>{<CompactNumber value={group.frozenCount ?? group.listedCount} />}</strong>
              </span>
"""
if detail_old not in detail:
    raise SystemExit('ProductionFacilityDetail status rows not found')
detail = detail.replace(detail_old, detail_new, 1)
save('src/pages/production/ProductionFacilityDetail.tsx', detail)

# Asset overview exposes only the unified frozen bucket; internal values remain separately available for compatibility.
assets = load('src/components/assets/AssetOverviewPanel.tsx')
assets = assets.replace(
    "  const frozenFacilities = game.facilityGroups.reduce((sum, group) => sum + Number(group.frozenCount || 0), 0);\n  const mortgagedFacilities = game.facilityGroups.reduce((sum, group) => sum + Number(group.mortgagedCount || 0), 0);\n",
    "  const frozenFacilities = game.facilityGroups.reduce((sum, group) => sum + Number(group.frozenCount || 0), 0);\n",
    1,
)
assets = assets.replace(
    "  const mortgagedFacilityValue = game.assetSummary.mortgagedFacilityValue ?? 0;\n  const frozenFacilityValue = game.assetSummary.frozenFacilityValue ?? 0;\n",
    "  const frozenFacilityValue = (game.assetSummary.frozenFacilityValue ?? 0) + (game.assetSummary.mortgagedFacilityValue ?? 0);\n",
    1,
)
assets = assets.replace(
    "              aria-label={`工厂，总计 ${formatCurrency(derived.facilityValue)}，可转让 ${formatCurrency(availableFacilityValue)}，抵押 ${formatCurrency(mortgagedFacilityValue)}，交易冻结 ${formatCurrency(frozenFacilityValue)}，冻结 ${formatNumber(frozenFacilities)} 座，抵押 ${formatNumber(mortgagedFacilities)} 座，共 ${formatNumber(totalFacilities)} 座`}\n",
    "              aria-label={`工厂，总计 ${formatCurrency(derived.facilityValue)}，可转让 ${formatCurrency(availableFacilityValue)}，冻结 ${formatCurrency(frozenFacilityValue)}，冻结 ${formatNumber(frozenFacilities)} 座，共 ${formatNumber(totalFacilities)} 座`}\n",
    1,
)
assets = assets.replace(
    "                <span>工厂<small>交易冻结 {<CompactNumber value={frozenFacilities} />} · 抵押 {<CompactNumber value={mortgagedFacilities} />} · 共 {<CompactNumber value={totalFacilities} />}</small></span>\n",
    "                <span>工厂<small>冻结 {<CompactNumber value={frozenFacilities} />} · 共 {<CompactNumber value={totalFacilities} />}</small></span>\n",
    1,
)
assets = assets.replace(
    "              <span role=\"cell\" data-label=\"冻结\"><CurrencyAmount>{formatCurrency(frozenFacilityValue + mortgagedFacilityValue)}</CurrencyAmount></span>\n",
    "              <span role=\"cell\" data-label=\"冻结\"><CurrencyAmount>{formatCurrency(frozenFacilityValue)}</CurrencyAmount></span>\n",
    1,
)
save('src/components/assets/AssetOverviewPanel.tsx', assets)

# Mobile handle: reduce only the hit/blank region, keeping the visual handle and drag behavior intact.
replace_exact(
    'src/styles/mobile-detail-sheet.css',
    """  .mobile-detail-sheet-drag-handle {
    min-height: 32px;
""",
    """  .mobile-detail-sheet-drag-handle {
    min-height: 24px;
""",
    count=1,
)

# Auto-operation title and switch are locked into one row at all supported widths.
save('src/styles/factory-auto-operation.css', """.facility-auto-operation {
  display: grid;
  gap: var(--space-4, 1rem);
}

.facility-auto-operation__header {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3, 0.75rem);
}

.facility-auto-operation__header > strong {
  min-width: 0;
}

.facility-auto-operation__message {
  line-height: 1.5;
}

.facility-auto-operation__coverage {
  width: fit-content;
  max-width: 100%;
  justify-self: start;
  justify-items: start;
}

.facility-auto-operation__coverage .ui-rich-select {
  width: fit-content;
}

.facility-auto-operation__coverage .ui-rich-select__trigger {
  width: fit-content;
  min-width: 8.5rem;
}
""")

# Remove the old Chinese mortgage term everywhere in maintained source/design/tests.
text_suffixes = {'.ts', '.tsx', '.js', '.mjs', '.md', '.css', '.json'}
for base in ['src', 'server/src', 'server/test', 'docs', 'scripts', 'tests/browser']:
  for path in (ROOT / base).rglob('*'):
    if not path.is_file() or path.suffix not in text_suffixes:
      continue
    text = path.read_text(encoding='utf-8')
    if '抵押' in text:
      path.write_text(text.replace('抵押', '冻结').replace('冻结物', '冻结资产'), encoding='utf-8')

# Repair duplicate/ambiguous wording created by the terminology migration.
product_design = load('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md')
product_design = product_design.replace(
    '冻结与冻结只改变可用性，不改变所有权。',
    '所有冻结只改变可用性，不改变所有权。',
)
product_design = product_design.replace(
    '冻结资产和冻结工厂继续计入资产毛值；',
    '冻结资产继续计入资产毛值；',
)
product_design = product_design.replace(
    '冻结工厂继续参与其所在地区的现有集群生产，但在贷款结清前不能出售、拍卖或重复冻结；市场卖单冻结和拍卖冻结仍会退出生产，冻结数量不得复用 `frozenCount`，同类型但不同地区的工厂不得被重复扣减。',
    '贷款冻结工厂继续参与其所在地区的现有集群生产，但在贷款结清前不能出售、拍卖或重复冻结；市场卖单冻结和拍卖冻结仍会退出生产。贷款冻结仍由内部 `mortgagedCount`／`collateral` 字段保存，交易冻结仍由内部交易冻结字段保存；普通玩家界面统一归类为“冻结”，同类型但不同地区的工厂不得被重复扣减。',
)
save('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', product_design)

industry = load('docs/INDUSTRY_AND_PRODUCTION_DESIGN.md')
industry = industry.replace('运行／冻结／冻结数量摘要', '运行／冻结数量摘要')
industry = industry.replace('运行中／冻结中／冻结中三项数量明细', '运行中／冻结中两项数量明细')
industry = industry.replace('运行中／冻结中／冻结中三列', '运行中／冻结中两列')
industry = industry.replace(
    '银行冻结数量继续参与生产，但不得出售、拍卖或重复冻结；冻结数量与拍卖冻结数量分别保存。',
    '银行贷款冻结数量继续参与生产，但不得出售、拍卖或重复冻结；贷款冻结与拍卖／交易冻结在内部仍分别保存，普通玩家界面统一归类为“冻结”。',
)
save('docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', industry)

page_design = load('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md')
page_design = page_design.replace('运行中／冻结中／冻结中', '运行中／冻结中')
page_design = page_design.replace('近 24h 真实成交趋势', '近 30 天按日成交趋势')
save('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', page_design)

ui_design = load('docs/UI_DESIGN_SYSTEM.md')
ui_design = ui_design.replace('运行中／冻结中／冻结中数量摘要', '运行中／冻结中数量摘要')
ui_design = ui_design.replace('“运行中／冻结中／冻结中”三列', '“运行中／冻结中”两列')
ui_design += "\n\n- 移动根 Sheet 与二级详情共用的拖拽把手命中区域固定为 `24px` 高；视觉把手本体尺寸不变，不得通过恢复大块空白增加 Sheet 顶部占用。\n- 工厂生产配置中的“自动经营”标题与 `SwitchControl` 固定在同一行，左侧标题允许收缩，右侧开关不得换行到下一行。\n"
save('docs/UI_DESIGN_SYSTEM.md', ui_design)

warehouse_design = load('docs/WAREHOUSE_EXPANSION_DESIGN.md')
if '“自动经营”标题与开关固定在同一行' not in warehouse_design:
    warehouse_design += "\n\n工厂详情的“自动经营”标题与开关固定在同一行；该规则只约束策略入口布局，不改变自动经营策略、原料保障周期或服务器执行语义。\n"
save('docs/WAREHOUSE_EXPANSION_DESIGN.md', warehouse_design)

chrome_design = load('docs/LIQUID_GLASS_CHROME_DESIGN.md')
if '把手命中区域固定为 `24px`' not in chrome_design:
    chrome_design += "\n\n移动根 Sheet 和二级详情复用同一个拖拽把手，命中区域固定为 `24px` 高；不得恢复 `32px` 或更高的顶部空白区。视觉把手尺寸、Sheet 拖拽关闭、视口冻结与焦点恢复规则保持不变。\n"
save('docs/LIQUID_GLASS_CHROME_DESIGN.md', chrome_design)

server_design = load('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md')
needle = 'HTTP 传输层在事务提交后必须从当前 committed world 为当前玩家生成一次权威状态交付'
if needle in server_design and '权威写执行器释放串行写队列之后生成' not in server_design:
    server_design = server_design.replace(
        needle,
        'HTTP 传输层在事务提交且权威写执行器释放串行写队列之后生成，从当前 committed world 为当前玩家生成一次权威状态交付',
        1,
    )
save('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', server_design)

# Market chart design: replace the retired 24h/6m model only where it owns the chart, while preserving separate 24h catalog metrics.
chart_design = load('docs/MARKET_CHART_LAYOUT_DESIGN.md')
chart_design = chart_design.replace(
    '本文件只负责市场页近 24h 行情图的绘图区、坐标、悬浮交互、图例与安全区几何。',
    '本文件只负责市场页近 30 天按日行情图的绘图区、坐标、悬浮交互与安全区几何。',
)
chart_design = chart_design.replace(
    '价格 `line` 与成交量 `bar` 共享同一 24h 时间尺度。',
    '价格 `line` 与成交量 `bar` 共享同一最近 30 个北京时间自然日的日期尺度。',
)
chart_design = chart_design.replace(
    '24h 聚合、整数坐标、颜色方向、动态刻度和几何结果仍由项目纯函数计算',
    '最近 30 天按日聚合、整数坐标、颜色方向、动态刻度和几何结果仍由项目纯函数计算',
)
chart_design = chart_design.replace(
    '- 行情仍统计当前资产最近 24h，使用 `6m × 240` 固定数据分段；动态变化只影响可见刻度密度，不改变聚合窗口或经济数据。',
    '- 行情固定统计当前资产最近 30 个北京时间自然日，每个自然日一个桶，共 30 个连续日桶；当天桶实时读取当日成交量和当前官方价，已完成日桶由服务器持久化，缺失自然日以零成交量并延续最近有效价格补齐。',
)
chart_design = chart_design.replace(
    '- 横轴时间间隔必须根据真实绘图区宽度、根字号和 compact／full 变体，从 `1／2／3／4／6／8／12` 小时中选择，宽屏显示更多刻度，窄屏或放大字号自动减少刻度。',
    '- 横轴日期间隔必须根据真实绘图区宽度、根字号和 compact／full 变体，从 `1／2／3／5／7／10／15` 天中选择，宽屏显示更多日期刻度，窄屏或放大字号自动减少刻度。',
)
chart_design = chart_design.replace(
    '- 图例只显示“净主动买入”和“净主动卖出”；中性成交量继续使用灰色柱，但不显示“均衡／方向未知”图例。',
    '- 行情图不显示主动买入／主动卖出方向图例；成交量柱仍按日净主动方向使用成功色／危险色／中性色，具体买入、卖出和净主动量只在 Tooltip 中读取。',
)
chart_design = chart_design.replace('当前分段的时间、价格', '当前日桶的日期、价格')
chart_design = chart_design.replace('6 分钟分段', '单日日桶')
chart_design = chart_design.replace(
    '页面顺序固定为“顶部交易摘要 → 近 24h 行情图 → 手动即时交易 → 浏览器本地成交记录”。',
    '页面顺序固定为“顶部交易摘要 → 近 30 天按日行情图 → 手动即时交易 → 浏览器本地成交记录”。',
)
chart_design = chart_design.replace(
    '- 成交趋势详情接口只下发当前时刻向前 24h 内带真实 `buy`／`sell` `takerSide` 的成交点；更早历史点和没有真实成交方向的合成点不得进入详情 payload 或 revision。客户端详情刷新跟随所选市场公开摘要的原始数值变化，不依赖 `game.orders` 或市场对象引用变化，避免主状态对象重建造成无意义重复详情请求和“游戏服务器响应超时”。已有有效详情时，单次后台刷新失败不得用错误文案覆盖当前行情。',
    '- 成交趋势详情接口提供最近 30 个北京时间自然日的 `dailyHistory`；已完成商品日桶由服务器持久化，当前日桶实时合并 `todayBuyQuantity`／`todaySellQuantity` 与当前官方价。原始 `priceHistory` 继续只承担兼容与 24h 摘要用途，不再决定 30 天图表的保留能力。客户端详情刷新跟随所选市场公开摘要的原始数值变化，不依赖 `game.orders` 或市场对象引用变化；已有有效详情时，单次后台刷新失败不得覆盖当前行情或已经确认的交易结果。',
)
# Retire every remaining legend-specific layout sentence in this owner document.
chart_design = '\n'.join(line for line in chart_design.splitlines() if '图例' not in line)
chart_design += "\n\n- 防回退：成交趋势必须保持最近 30 个北京时间自然日、按日 30 桶；不得恢复 24h／6 分钟 240 桶，也不得恢复“净主动买入／净主动卖出”可见图例。\n"
save('docs/MARKET_CHART_LAYOUT_DESIGN.md', chart_design + '\n')

# Verifier: update functional 30-day aggregation assertions and retired legend expectations.
verifier = load('scripts/verify-market-chart.mjs')
verifier = verifier.replace(
    '  countMarketHistoryPointsInWindow,\n',
    '  countMarketHistoryPointsInWindow,\n  getMarketWindowBounds,\n',
    1,
)
start = verifier.index("const now = Date.UTC(2026, 6, 17, 8, 3, 0);")
end = verifier.index("const chart = read('src/components/charts/PriceSparkline.tsx');")
new_assertions = """const now = Date.UTC(2026, 6, 17, 8, 3, 0);
const { windowStart, windowEnd } = getMarketWindowBounds(now);
const points = [
  { price: 8, quantity: 9, createdAt: windowStart - 1_000 },
  { price: 10, quantity: 2, takerSide: 'buy', createdAt: windowStart + 60 * 60 * 1000 },
  { price: 12, quantity: 3, takerSide: 'sell', createdAt: windowStart + 3 * 60 * 60 * 1000 },
  { price: 15, quantity: 4, takerSide: 'buy', createdAt: windowStart + MARKET_BUCKET_MS + 60 * 60 * 1000 },
];
const buckets = buildMarketHistoryBuckets(points, 6, now);

assert.equal(MARKET_BUCKET_COUNT, 30, '成交趋势必须固定保留最近 30 个自然日');
assert.equal(MARKET_BUCKET_MS, 24 * 60 * 60 * 1000, '成交趋势必须按日聚合');
assert.equal(buckets.length, 30, '行情聚合必须输出固定 30 个日桶');
assert.equal(countMarketHistoryPointsInWindow(points, now), 3, '成交笔数只统计最近 30 个自然日窗口');
assert.deepEqual(
  { price: buckets[0].price, volume: buckets[0].volume, buyVolume: buckets[0].buyVolume, sellVolume: buckets[0].sellVolume, netVolume: buckets[0].netVolume, direction: buckets[0].direction },
  { price: 12, volume: 5, buyVolume: 2, sellVolume: 3, netVolume: -1, direction: 'sell' },
  '同一自然日必须使用最后成交价并按吃单方向汇总',
);
assert.deepEqual(
  { price: buckets[2].price, volume: buckets[2].volume, netVolume: buckets[2].netVolume, direction: buckets[2].direction },
  { price: 15, volume: 0, netVolume: 0, direction: 'neutral' },
  '无成交自然日必须延续最近有效价格且成交量为零',
);
const summary = summarizeMarketFlow(buckets);
assert.deepEqual(
  { volume: summary.volume, buyVolume: summary.buyVolume, sellVolume: summary.sellVolume, netVolume: summary.netVolume },
  { volume: 9, buyVolume: 6, sellVolume: 3, netVolume: 3 },
  '30 天汇总必须保留完整主动方向数据',
);
assert.equal(buckets[0].startAt, windowStart, '首个日桶必须从 30 天窗口起点开始');
assert.equal(buckets.at(-1).startAt + MARKET_BUCKET_MS, windowEnd, '最后日桶必须覆盖当前北京时间自然日');

assert.equal(chooseMarketTimeInterval(900, 16, 'full', MARKET_WINDOW_MS), 2 * MARKET_BUCKET_MS, '宽屏应显示两天间隔');
assert.equal(chooseMarketTimeInterval(260, 16, 'full', MARKET_WINDOW_MS), 10 * MARKET_BUCKET_MS, '窄屏应降低日期刻度密度');
assert.equal(chooseMarketTimeInterval(260, 20, 'full', MARKET_WINDOW_MS), 10 * MARKET_BUCKET_MS, '放大字号应保持稀疏日期刻度');
assert.ok(chooseMarketPriceTickCount(240, 16) > chooseMarketPriceTickCount(112, 16), '价格刻度数必须随真实高度增加');
assert.equal(chooseMarketVolumeTickCount(48, 16, 'full'), 3, '完整行情图必须至少生成三个成交量刻度');
assert.equal(chooseMarketVolumeTickCount(48, 16, 'compact'), 2, '紧凑行情图允许保留两个成交量刻度');
assert.ok(chooseMarketVolumeTickCount(140, 16, 'full') > chooseMarketVolumeTickCount(48, 16, 'full'), '成交量刻度数必须随真实高度增加');
assert.equal(resolveMarketBucketIndex(windowStart - 1, windowStart, 30, MARKET_BUCKET_MS), 0, '悬浮索引必须限制在首个日桶');
assert.equal(resolveMarketBucketIndex(windowStart + MARKET_BUCKET_MS * 12 + 1, windowStart, 30, MARKET_BUCKET_MS), 12, '悬浮索引必须由统一轴值映射');
assert.equal(resolveMarketBucketIndex(windowEnd + 1, windowStart, 30, MARKET_BUCKET_MS), 29, '悬浮索引必须限制在最后日桶');

"""
verifier = verifier[:start] + new_assertions + verifier[end:]
verifier = verifier.replace(
    '  \'geometry.showXAxisTitle ? <div className="market-chart-x-axis-title">时间</div> : null\',\n  \'净主动买入\', \'净主动卖出\',\n',
    '  \'<div className="market-chart-x-axis-title">日期</div>\',\n',
)
verifier = verifier.replace("'MARKET_TIME_INTERVAL_HOURS',", "'MARKET_TIME_INTERVAL_DAYS',")
verifier = verifier.replace(
    "'buildMarketHistoryBuckets(marketHistory, marketFallbackPrice, now)'",
    "'buildMarketHistoryBuckets(marketHistory, marketFallbackPrice, now, marketDailyHistory ?? [])'",
)
verifier = verifier.replace("'近 24h 真实成交趋势',", "'近 30 天按日成交趋势',")
# Add explicit legend absence and 30-day payload guards.
insert_after = "for (const text of ['<svg', '<polyline', '<polygon', '<rect', 'context.measureText', 'useChartAxisMetrics']) {\n"
if insert_after in verifier:
    guard = """for (const text of ['market-chart-legend', '净主动买入', '净主动卖出']) {
  assert.ok(!chart.includes(text), `行情图不得恢复主动方向图例: ${text}`);
}
assert.ok(types.includes('dailyHistory?: MarketDailyHistoryPoint[];'), '市场详情类型必须暴露 30 天日行情');
assert.ok(chartDesign.includes('最近 30 个北京时间自然日'), '行情设计必须锁定最近 30 天');
assert.ok(!chartDesign.includes('`6m × 240`'), '行情设计不得保留 6 分钟 240 桶旧规则');

"""
    verifier = verifier.replace(insert_after, guard + insert_after, 1)
save('scripts/verify-market-chart.mjs', verifier)

# Rewrite the browser safe-zone geometry helper to validate date ticks and absence of the legend.
safe = load('tests/browser/market-chart-safe-zone.spec.ts')
safe = safe.replace(
"""    const legendRects = Array.from(wrapper.querySelectorAll<HTMLElement>('.market-chart-legend-item'))
      .map((item) => item.getBoundingClientRect());
    const title = wrapper.querySelector<HTMLElement>('.market-chart-x-axis-title');
    if (!canvas || !svg || !divider || legendRects.length !== 2) throw new Error('ECharts market chart fixture is incomplete');
""",
"""    const legendCount = wrapper.querySelectorAll<HTMLElement>('.market-chart-legend-item').length;
    const title = wrapper.querySelector<HTMLElement>('.market-chart-x-axis-title');
    if (!canvas || !svg || !divider) throw new Error('ECharts market chart fixture is incomplete');
""",
1,
)
safe = safe.replace(
"""    const timeTicks = Array.from(svg.querySelectorAll<SVGTextElement>('text'))
      .filter((text) => /^\\d{2}:\\d{2}$/.test(text.textContent?.trim() ?? ''))
      .map((text) => text.getBoundingClientRect());
    const legendLeft = Math.min(...legendRects.map((rect) => rect.left));
    const legendRight = Math.max(...legendRects.map((rect) => rect.right));
    const legendBottom = Math.max(...legendRects.map((rect) => rect.bottom));
""",
"""    const timeTicks = Array.from(svg.querySelectorAll<SVGTextElement>('text'))
      .filter((text) => /^\\d{2}[/\\-]\\d{2}$/.test(text.textContent?.trim() ?? ''))
      .map((text) => text.getBoundingClientRect());
""",
1,
)
safe = safe.replace("    const plotCenterX = readNumber('plotCenterX');\n", "", 1)
safe = safe.replace(
"""      timeLegendGap: Math.min(...legendRects.map((rect) => rect.top)) - canvasRect.bottom,
      legendTitleGap: titleRect ? titleRect.top - legendBottom : null,
      bottomGap: wrapperRect.bottom - (titleRect?.bottom ?? legendBottom),
      legendCenterDelta: Math.abs((legendLeft + legendRight) / 2 - (wrapperRect.left + plotCenterX)),
""",
"""      titleGap: titleRect ? titleRect.top - canvasRect.bottom : null,
      bottomGap: wrapperRect.bottom - (titleRect?.bottom ?? canvasRect.bottom),
      legendCount,
""",
1,
)
safe = safe.replace(
"""  expect(bounds.timeLegendGap, `${context}时间刻度区与图例之间必须保留安全区`).toBeGreaterThanOrEqual(7);
  if (bounds.xAxisTitleVisible === 'true') {
    expect(bounds.titlePresent, `${context}宽图时间轴标题必须存在`).toBe(true);
    expect(bounds.legendTitleGap, `${context}图例与时间轴标题之间必须保留安全区`).toBeGreaterThanOrEqual(9);
  } else {
    expect(bounds.titlePresent, `${context}窄图不得保留冗余时间轴标题`).toBe(false);
    expect(bounds.legendTitleGap).toBeNull();
  }
  expect(bounds.bottomGap, `${context}底部可见内容不得贴住图表边缘`).toBeGreaterThanOrEqual(5);
  expect(bounds.legendCenterDelta, `${context}两项图例必须围绕绘图区中心整体居中`).toBeLessThanOrEqual(Math.max(2, bounds.chartWidth * 0.01));
""",
"""  expect(bounds.legendCount, `${context}不得显示净主动买入／卖出图例`).toBe(0);
  if (bounds.xAxisTitleVisible === 'true') {
    expect(bounds.titlePresent, `${context}宽图日期轴标题必须存在`).toBe(true);
    expect(bounds.titleGap, `${context}日期刻度与日期轴标题之间必须保留安全区`).toBeGreaterThanOrEqual(7);
  } else {
    expect(bounds.titlePresent, `${context}窄图不得保留冗余日期轴标题`).toBe(false);
    expect(bounds.titleGap).toBeNull();
  }
  expect(bounds.bottomGap, `${context}底部可见内容不得贴住图表边缘`).toBeGreaterThanOrEqual(5);
""",
1,
)
safe = safe.replace('可见时间标题必须由图表自身宽度决定', '可见日期标题必须由图表自身宽度决定')
save('tests/browser/market-chart-safe-zone.spec.ts', safe)

# Other source-verifiers that explicitly required the retired legend.
overview_verify = load('scripts/verify-overview-content.mjs')
overview_verify = overview_verify.replace(
    '  \'className="market-chart-legend-item buy"\',\n  \'className="market-chart-legend-item sell"\',\n',
    '',
)
save('scripts/verify-overview-content.mjs', overview_verify)

# Market action latency verifier: guard the new queue boundary rather than increasing timeout.
latency = load('scripts/verify-market-action-latency.mjs')
if "const runtimeStore = 'server/src/runtime-store.js';" not in latency:
    latency = latency.replace(
        "const serverDesign = 'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md';\n",
        "const serverDesign = 'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md';\nconst runtimeStore = 'server/src/runtime-store.js';\nconst serverApp = 'server/src/app.js';\n",
        1,
    )
guard_anchor = "for (const text of [\n  '普通玩家权威动作的持久化幂等确认仍固定为 `{ result: { ok, message }, revision }`',"
if guard_anchor in latency:
    extra = """for (const text of [
  "Object.defineProperty(actionResponse, 'stateSnapshot'",
  'value: store.getStateSnapshot(user, null, actionDeliveryNow)',
  'createPartitionedActionDelivery(actionResponse, knownPartitions, actionDeliveryNow)',
]) requireText(serverApp, text);
for (const text of ["Object.defineProperty(response, 'stateSnapshot'", 'value: this.getStateSnapshot(user, null, now)']) {
  forbidText(runtimeStore, text);
}

"""
    latency = latency.replace(guard_anchor, extra + guard_anchor, 1)
save('scripts/verify-market-action-latency.mjs', latency)

# Mobile verifier and warehouse verifier lock the two small layout rules.
mobile_verify = load('scripts/verify-mobile-page-sheet.mjs')
if "min-height: 24px;" not in mobile_verify:
    mobile_verify += "\nrequireAll('src/styles/mobile-detail-sheet.css', ['min-height: 24px;']);\n"
save('scripts/verify-mobile-page-sheet.mjs', mobile_verify)

warehouse_verify = load('scripts/verify-warehouse-expansion.mjs')
if "grid-template-columns: minmax(0, 1fr) auto;" not in warehouse_verify:
    warehouse_verify += "\nrequireText('src/styles/factory-auto-operation.css', 'grid-template-columns: minmax(0, 1fr) auto;');\n"
save('scripts/verify-warehouse-expansion.mjs', warehouse_verify)

# Assets verifier should require unified frozen wording and no visible legacy term.
assets_verify = load('scripts/verify-assets-page.mjs')
assets_verify = assets_verify.replace(
    '冻结资产和冻结工厂仍归当前玩家所有并计入资产毛值；商业建筑第一版没有冻结、冻结或产权交易状态；贷款负债从资产毛值中扣除形成净资产。',
    '冻结资产仍归当前玩家所有并计入资产毛值；商业建筑第一版没有冻结或产权交易状态；贷款负债从资产毛值中扣除形成净资产。',
)
save('scripts/verify-assets-page.mjs', assets_verify)

# Clean duplicated helper wording in the component after global term migration.
assets = load('src/components/assets/AssetOverviewPanel.tsx')
assets = assets.replace(
    '冻结资产和冻结工厂仍归当前玩家所有并计入资产毛值；商业建筑第一版没有冻结、冻结或产权交易状态；贷款负债从资产毛值中扣除形成净资产。',
    '冻结资产仍归当前玩家所有并计入资产毛值；商业建筑第一版没有冻结或产权交易状态；贷款负债从资产毛值中扣除形成净资产。',
)
save('src/components/assets/AssetOverviewPanel.tsx', assets)

# Final policy guards.
for path in [ROOT / 'src', ROOT / 'server/src', ROOT / 'docs']:
    for file in path.rglob('*'):
        if file.is_file() and file.suffix in text_suffixes:
            text = file.read_text(encoding='utf-8')
            if '抵押' in text:
                raise SystemExit(f'legacy visible term remains: {file}')

chart = load('src/components/charts/PriceSparkline.tsx')
if 'market-chart-legend' in chart or '净主动买入' in chart or '净主动卖出' in chart:
    raise SystemExit('retired chart legend remains')
if 'MARKET_BUCKET_COUNT = 30' not in load('src/utils/marketHistory.ts'):
    raise SystemExit('30 day market bucket rule missing')
if 'min-height: 24px;' not in load('src/styles/mobile-detail-sheet.css'):
    raise SystemExit('mobile handle height rule missing')
if 'grid-template-columns: minmax(0, 1fr) auto;' not in load('src/styles/factory-auto-operation.css'):
    raise SystemExit('auto-operation one-row rule missing')
if "Object.defineProperty(response, 'stateSnapshot'" in load('server/src/runtime-store.js'):
    raise SystemExit('state projection still blocks authoritative write queue')

print('Task patch applied successfully.')
