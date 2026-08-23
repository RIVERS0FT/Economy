import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
}

function write(path, content) {
  fs.mkdirSync(path.split('/').slice(0, -1).join('/'), { recursive: true });
  fs.writeFileSync(path, content.replace(/\r\n/g, '\n'));
}

function replaceRequired(source, before, after, label) {
  if (!source.includes(before)) {
    throw new Error('Missing patch anchor: ' + label);
  }
  return source.replace(before, after);
}

function appendOnce(path, marker, addition) {
  const source = read(path);
  if (source.includes(marker)) return;
  write(path, source.trimEnd() + '\n\n' + addition.trim() + '\n');
}

const GLOBAL_MARKET_PAGE = String.raw`import { lazy, Suspense, useMemo, useState } from 'react';
import type { OnlineAutoTradeAwareGameViewModel } from '../auto-trade/useOnlineAutoTrade';
import { MarketCoverageBar } from '../components/market/MarketBalanceBar';
import { ProductArtwork } from '../components/products/ProductArtwork';
import { RegionalEntityPageTitle } from '../components/ui/RegionalEntityPageTitle';
import {
  PageLayout,
  PagePanel,
  Panel,
  StatusTag,
  type StatusTone,
  WidgetHeading,
} from '../components/ui/layout';
import type { ProductCategory } from '../types';
import { formatCurrency, formatNumber } from '../utils/formatters';
import '../styles/global-operation-pages.css';

const EmbeddedMarketPage = lazy(() => import('./MarketPage').then((module) => ({
  default: module.MarketPage,
})));

type GlobalMarketStatus = 'all' | 'traded' | 'unmet-demand' | 'no-trade';

const PRODUCT_CATEGORY_FILTERS: Array<{ value: 'all' | ProductCategory; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'raw', label: '原材料' },
  { value: 'intermediate', label: '中间品' },
  { value: 'consumer', label: '消费品' },
  { value: 'industrial', label: '工业品' },
];

const MARKET_STATUS_FILTERS: Array<{ value: GlobalMarketStatus; label: string }> = [
  { value: 'all', label: '全部状态' },
  { value: 'traded', label: '有真实成交' },
  { value: 'unmet-demand', label: '需求未满足' },
  { value: 'no-trade', label: '暂无成交' },
];

function operationalProvinces(model: OnlineAutoTradeAwareGameViewModel) {
  const game = model.game;
  const hasUnlockState = Array.isArray(game.unlockedProvinces)
    || typeof game.startingProvinceId === 'string';
  if (!hasUnlockState) return game.provinces;
  const unlocked = new Set(game.unlockedProvinces ?? []);
  if (game.startingProvinceId) unlocked.add(game.startingProvinceId);
  return game.provinces.filter((province) => unlocked.has(province.id));
}

function priceRange(prices: number[]) {
  if (prices.length === 0) return '—';
  const minimum = Math.min(...prices);
  const maximum = Math.max(...prices);
  return minimum === maximum
    ? formatCurrency(minimum)
    : formatCurrency(minimum) + ' – ' + formatCurrency(maximum);
}

function globalProductStatus(row: {
  tradedProvinceCount: number;
  directDemandProvinces: number;
  unmetDemandProvinces: number;
}): { label: string; tone: StatusTone } {
  if (row.unmetDemandProvinces > 0) return { label: '存在需求缺口', tone: 'warning' };
  if (row.tradedProvinceCount > 0 && row.directDemandProvinces > 0) return { label: '成交活跃', tone: 'success' };
  if (row.tradedProvinceCount > 0) return { label: '已有成交', tone: 'info' };
  return { label: '暂无成交', tone: 'neutral' };
}

function provinceMarketStatus(row: {
  openOrderCount: number;
  tradedProducts: number;
  unmetDemandProducts: number;
}): { label: string; tone: StatusTone } {
  if (row.unmetDemandProducts > 0) return { label: '需求不足', tone: 'warning' };
  if (row.openOrderCount > 0 || row.tradedProducts > 0) return { label: '活跃', tone: 'success' };
  return { label: '清淡', tone: 'neutral' };
}

export function GlobalMarketPage({ model }: { model: OnlineAutoTradeAwareGameViewModel }) {
  const [activeProvinceId, setActiveProvinceId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<'all' | ProductCategory>('all');
  const [statusFilter, setStatusFilter] = useState<GlobalMarketStatus>('all');
  const game = model.game;
  const provinces = operationalProvinces(model);
  const summaries = game.provinceAssetSummaries ?? {};

  const productRows = useMemo(() => game.products.map((product) => {
    const prices: Array<{ price: number; provinceName: string }> = [];
    let directDemandProvinces = 0;
    let unmetDemandProvinces = 0;
    for (const province of provinces) {
      const market = game.provinceMarkets?.[province.id]?.[product.id];
      if (typeof market?.lastTradePrice === 'number') {
        prices.push({ price: market.lastTradePrice, provinceName: province.name });
      }
      if ((market?.demand?.lastQuantity ?? 0) > 0) {
        directDemandProvinces += 1;
        if ((market?.demand?.satisfaction ?? 1) < 1) unmetDemandProvinces += 1;
      }
    }
    const orderedPrices = [...prices].sort((left, right) => left.price - right.price);
    return {
      id: product.id,
      name: product.name,
      category: product.category,
      tradedProvinceCount: prices.length,
      directDemandProvinces,
      unmetDemandProvinces,
      range: priceRange(prices.map((entry) => entry.price)),
      lowProvinceName: orderedPrices[0]?.provinceName ?? '—',
      highProvinceName: orderedPrices[orderedPrices.length - 1]?.provinceName ?? '—',
    };
  }), [game.products, game.provinceMarkets, provinces]);

  const filteredProductRows = useMemo(() => productRows.filter((row) => {
    if (categoryFilter !== 'all' && row.category !== categoryFilter) return false;
    if (statusFilter === 'traded' && row.tradedProvinceCount <= 0) return false;
    if (statusFilter === 'unmet-demand' && row.unmetDemandProvinces <= 0) return false;
    if (statusFilter === 'no-trade' && row.tradedProvinceCount > 0) return false;
    return true;
  }), [categoryFilter, productRows, statusFilter]);

  const provinceRows = useMemo(() => provinces.map((province) => {
    const markets = game.provinceMarkets?.[province.id] ?? {};
    const summary = summaries[province.id];
    let tradedProducts = 0;
    let unmetDemandProducts = 0;
    for (const product of game.products) {
      const market = markets[product.id];
      if (typeof market?.lastTradePrice === 'number') tradedProducts += 1;
      if ((market?.demand?.lastQuantity ?? 0) > 0 && (market?.demand?.satisfaction ?? 1) < 1) {
        unmetDemandProducts += 1;
      }
    }
    return {
      province,
      openOrderCount: Number(summary?.openOrderCount || 0),
      tradedProducts,
      unmetDemandProducts,
      storedQuantity: Number(summary?.storedQuantity || 0),
    };
  }), [game.products, game.provinceMarkets, provinces, summaries]);

  const totalOpenOrders = provinceRows.reduce((sum, row) => sum + row.openOrderCount, 0);
  const tradedProductCount = productRows.filter((row) => row.tradedProvinceCount > 0).length;
  const unmetDemandCount = productRows.reduce((sum, row) => sum + row.unmetDemandProvinces, 0);
  const currentProvinceName = model.selectedProvince?.name || '加利福尼亚州';
  const detailProduct = model.marketViewMode === 'detail' && model.marketAssetKind === 'commodity'
    ? game.products.find((product) => product.id === model.marketAssetId)
    : undefined;
  const detailProvince = detailProduct
    ? provinces.find((province) => province.id === model.selectedProvinceId)
    : undefined;
  const activeProvince = activeProvinceId
    ? provinces.find((province) => province.id === activeProvinceId)
    : detailProvince;

  const openProvinceMarket = (provinceId: string) => {
    model.setSelectedProvinceId(provinceId);
    model.showMarketCatalog();
    setActiveProvinceId(provinceId);
  };

  if (activeProvince) {
    const provinceReady = model.selectedProvinceId === activeProvince.id;
    const isProductDetail = provinceReady && Boolean(detailProduct);
    const returnToProvinceMarket = () => {
      setActiveProvinceId(activeProvince.id);
      model.showMarketCatalog();
    };
    return (
      <PageLayout
        title={isProductDetail && detailProduct ? (
          <RegionalEntityPageTitle entityName={detailProduct.name} regionName={activeProvince.name} />
        ) : activeProvince.name + '市场'}
        backAction={isProductDetail
          ? { label: '返回商品列表', onClick: returnToProvinceMarket }
          : { label: '返回全局市场', onClick: () => setActiveProvinceId(null) }}
      >
        <div className="global-operation-page global-market-page" data-global-scope="market" data-drilldown-province-id={activeProvince.id}>
          {provinceReady ? (
            <Suspense fallback={<Panel className="empty-state"><span role="status">正在加载地区市场…</span></Panel>}>
              <EmbeddedMarketPage model={model} embedded />
            </Suspense>
          ) : <Panel className="empty-state"><span role="status">正在切换经营地区…</span></Panel>}
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="市场">
      <div className="global-operation-page global-market-page" data-global-scope="market">
        <section className="global-market-summary-strip" aria-label="全局市场摘要">
          <span><small>已解锁地区</small><strong>{formatNumber(provinces.length)}</strong></span>
          <span><small>未完成挂单</small><strong>{formatNumber(totalOpenOrders)}</strong></span>
          <span><small>有真实成交商品</small><strong>{formatNumber(tradedProductCount)} / {formatNumber(game.products.length)}</strong></span>
          <span><small>需求未满足地区项</small><strong>{formatNumber(unmetDemandCount)}</strong></span>
          <span className="global-market-summary-strip__current"><small>当前经营州</small><strong>{currentProvinceName}</strong></span>
        </section>

        <PagePanel className="global-market-goods-panel">
          <WidgetHeading title="全局商品行情" action={<StatusTag>{formatNumber(filteredProductRows.length)} / {formatNumber(productRows.length)} 种商品</StatusTag>} />
          <div className="global-market-filter-row" aria-label="全局商品筛选">
            <div className="global-market-filter-group" role="group" aria-label="商品分类">
              {PRODUCT_CATEGORY_FILTERS.map((option) => (
                <button
                  type="button"
                  className={'global-market-filter-button' + (categoryFilter === option.value ? ' active' : '')}
                  aria-pressed={categoryFilter === option.value}
                  key={option.value}
                  onClick={() => setCategoryFilter(option.value)}
                >{option.label}</button>
              ))}
            </div>
            <div className="global-market-filter-group" role="group" aria-label="市场状态">
              {MARKET_STATUS_FILTERS.map((option) => (
                <button
                  type="button"
                  className={'global-market-filter-button' + (statusFilter === option.value ? ' active' : '')}
                  aria-pressed={statusFilter === option.value}
                  key={option.value}
                  onClick={() => setStatusFilter(option.value)}
                >{option.label}</button>
              ))}
            </div>
          </div>
          <ul className="global-market-goods-list" aria-label="跨州商品行情">
            {filteredProductRows.map((row) => {
              const status = globalProductStatus(row);
              return (
                <li className="global-market-goods-row" key={row.id}>
                  <span className="global-market-goods-row__identity">
                    <span className="global-market-goods-row__artwork" aria-hidden="true"><ProductArtwork productId={row.id} /></span>
                    <strong>{row.name}</strong>
                  </span>
                  <span className="global-market-goods-row__metric"><small>成交地区</small><strong>{formatNumber(row.tradedProvinceCount)} / {formatNumber(provinces.length)}</strong></span>
                  <span className="global-market-goods-row__metric"><small>真实成交价范围</small><strong>{row.range}</strong></span>
                  <span className="global-market-goods-row__metric"><small>最低价地区</small><strong>{row.lowProvinceName}</strong></span>
                  <span className="global-market-goods-row__metric"><small>最高价地区</small><strong>{row.highProvinceName}</strong></span>
                  <span className="global-market-goods-row__metric"><small>需求未满足</small><strong>{formatNumber(row.unmetDemandProvinces)} / {formatNumber(row.directDemandProvinces)}</strong></span>
                  <span className="global-market-goods-row__status">
                    <small>地区覆盖</small>
                    <StatusTag tone={status.tone}>{status.label}</StatusTag>
                    <MarketCoverageBar
                      tradedCount={row.tradedProvinceCount}
                      unmetDemandCount={row.unmetDemandProvinces}
                      totalCount={provinces.length}
                    />
                  </span>
                </li>
              );
            })}
            {filteredProductRows.length === 0 ? <li className="global-market-empty">没有符合当前筛选条件的商品。</li> : null}
          </ul>
        </PagePanel>

        <PagePanel className="global-market-provinces-panel">
          <WidgetHeading title="地区市场" action={<StatusTag>{formatNumber(provinceRows.length)} 个已解锁州</StatusTag>} />
          <ul className="global-market-province-list" aria-label="全局地区市场入口">
            {provinceRows.map((row) => {
              const status = provinceMarketStatus(row);
              const isCurrent = row.province.id === model.selectedProvinceId;
              return (
                <li key={row.province.id}>
                  <button
                    type="button"
                    className="global-market-province-row"
                    data-ui-interactive="surface"
                    data-province-id={row.province.id}
                    aria-label={'打开' + row.province.name + '地区市场'}
                    onClick={() => openProvinceMarket(row.province.id)}
                  >
                    <span className="global-market-province-row__identity"><strong>{row.province.name}</strong><small>{row.province.shortName}{isCurrent ? ' · 当前经营州' : ''}</small></span>
                    <span><small>未完成挂单</small><strong>{formatNumber(row.openOrderCount)}</strong></span>
                    <span><small>有成交商品</small><strong>{formatNumber(row.tradedProducts)}</strong></span>
                    <span><small>需求未满足</small><strong>{formatNumber(row.unmetDemandProducts)}</strong></span>
                    <span><small>本地库存</small><strong>{formatNumber(row.storedQuantity)}</strong></span>
                    <span className="global-market-province-row__status"><small>市场状态</small><StatusTag tone={status.tone}>{status.label}</StatusTag></span>
                    <span className="global-market-province-row__chevron" aria-hidden="true">›</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </PagePanel>
      </div>
    </PageLayout>
  );
}
`;

write('src/pages/GlobalMarketPage.tsx', GLOBAL_MARKET_PAGE);

const MARKET_BALANCE_COMPONENT = String.raw`import type { CSSProperties } from 'react';

export function MarketBalanceBar({
  buyVolume,
  sellVolume,
  className = '',
}: {
  buyVolume: number;
  sellVolume: number;
  className?: string;
}) {
  const safeBuy = Math.max(0, Number(buyVolume) || 0);
  const safeSell = Math.max(0, Number(sellVolume) || 0);
  const total = safeBuy + safeSell;
  const balance = safeSell - safeBuy;
  const direction = total <= 0 ? 'inactive' : balance > 0 ? 'sell' : balance < 0 ? 'buy' : 'balanced';
  const fill = total > 0 ? Math.round(Math.min(1, Math.abs(balance) / total) * 50) : 0;
  const label = total <= 0
    ? '当前没有买卖挂单'
    : balance > 0
      ? '卖单比买单多 ' + Math.abs(balance)
      : balance < 0
        ? '买单比卖单多 ' + Math.abs(balance)
        : '买卖挂单数量相同';
  return (
    <span
      className={'market-balance-bar' + (className ? ' ' + className : '')}
      data-direction={direction}
      role="img"
      aria-label={label}
      style={{ '--market-balance-fill': fill + '%' } as CSSProperties}
    >
      <span className="market-balance-bar__fill" aria-hidden="true" />
    </span>
  );
}

export function MarketCoverageBar({
  tradedCount,
  unmetDemandCount,
  totalCount,
}: {
  tradedCount: number;
  unmetDemandCount: number;
  totalCount: number;
}) {
  const safeTotal = Math.max(0, Number(totalCount) || 0);
  const tradedCoverage = safeTotal > 0 ? Math.min(100, Math.round((Math.max(0, tradedCount) / safeTotal) * 100)) : 0;
  const unmetCoverage = safeTotal > 0 ? Math.min(100, Math.round((Math.max(0, unmetDemandCount) / safeTotal) * 100)) : 0;
  return (
    <span
      className="market-coverage-bar"
      role="img"
      aria-label={'真实成交覆盖 ' + tradedCount + ' 个地区；需求未满足 ' + unmetDemandCount + ' 个地区'}
      style={{
        '--market-traded-coverage': tradedCoverage + '%',
        '--market-unmet-coverage': unmetCoverage + '%',
      } as CSSProperties}
    >
      <span className="market-coverage-bar__track market-coverage-bar__track--traded" aria-hidden="true"><span /></span>
      <span className="market-coverage-bar__track market-coverage-bar__track--unmet" aria-hidden="true"><span /></span>
    </span>
  );
}
`;
write('src/components/market/MarketBalanceBar.tsx', MARKET_BALANCE_COMPONENT);

let marketPage = read('src/pages/MarketPage.tsx');
marketPage = replaceRequired(
  marketPage,
  "import { MarketAutoTradePanel } from '../components/market/MarketAutoTradePanel';",
  "import { MarketAutoTradePanel } from '../components/market/MarketAutoTradePanel';\nimport { MarketBalanceBar } from '../components/market/MarketBalanceBar';",
  'MarketBalanceBar import',
);

const BEST_BIDS_ANCHOR = String.raw`  const bestBids = useMemo(
    () => buildOrderBookLevels(selectedOrders, 'buy'),
    [selectedOrders],
  );`;
marketPage = replaceRequired(
  marketPage,
  BEST_BIDS_ANCHOR,
  BEST_BIDS_ANCHOR + String.raw`
  const selectedBuyVolume = bestBids.reduce((sum, level) => sum + Math.max(0, level.remaining), 0);
  const selectedSellVolume = bestAsks.reduce((sum, level) => sum + Math.max(0, level.remaining), 0);
  const selectedBalance = selectedSellVolume - selectedBuyVolume;`,
  'selected order volume summary',
);

const FALLBACK_PRICE_ANCHOR = String.raw`  const marketFallbackPrice = selectedMarket?.lastPrice
    ?? selectedProduct?.basePrice
    ?? selectedFacility?.systemValue
    ?? 1;`;
marketPage = replaceRequired(
  marketPage,
  FALLBACK_PRICE_ANCHOR,
  FALLBACK_PRICE_ANCHOR + String.raw`
  const selectedMarketPrice = selectedProductMarket?.officialPrice ?? marketFallbackPrice;
  const selectedBaseDeviationPercent = selectedProduct && selectedProduct.basePrice > 0
    ? ((selectedMarketPrice / selectedProduct.basePrice) - 1) * 100
    : undefined;`,
  'selected market price summary',
);

const CATALOG_BALANCE_OLD = String.raw`                  <span className="market-catalog-row__metric market-catalog-row__balance">
                    <small>挂单差额</small>
                    <strong>{entry.balance > 0 ? '+' : ''}{formatNumber(entry.balance)}</strong>
                  </span>`;
const CATALOG_BALANCE_NEW = String.raw`                  <span className="market-catalog-row__metric market-catalog-row__balance">
                    <small>挂单差额</small>
                    <strong>{entry.balance > 0 ? '+' : ''}{formatNumber(entry.balance)}</strong>
                    <MarketBalanceBar buyVolume={entry.buyVolume} sellVolume={entry.sellVolume} />
                  </span>`;
marketPage = replaceRequired(marketPage, CATALOG_BALANCE_OLD, CATALOG_BALANCE_NEW, 'catalog balance bar');

const heroStart = marketPage.indexOf('        <Panel className="widget market-detail-hero">');
const heroEnd = marketPage.indexOf('        {selectedProduct && selectedProductMarket ? (', heroStart);
if (heroStart < 0 || heroEnd < 0) throw new Error('Missing market detail hero boundaries');
const MARKET_HERO = String.raw`        <Panel className="widget market-detail-hero">
          <span className="market-detail-hero__artwork" aria-hidden="true">
            {selectedProduct
              ? <ProductArtwork productId={selectedProduct.id} />
              : selectedFacility ? <FacilityIcon facilityTypeId={selectedFacility.id} /> : <FactoryIcon />}
          </span>
          <span className="market-detail-hero__identity">
            <strong>{assetName}</strong>
            <small>{selectedProduct
              ? PRODUCT_CATEGORY_LABELS[selectedProduct.category]
              : selectedFacility ? FACILITY_CATEGORY_LABELS[selectedFacility.category] : '市场资产'}</small>
          </span>
          {selectedProduct ? (
            <>
              <span className="market-detail-hero__metric market-detail-hero__market-price">
                <small>市场价</small>
                <strong><CurrencyAmount>{formatCurrency(selectedMarketPrice)}</CurrencyAmount></strong>
              </span>
              <span className="market-detail-hero__metric">
                <small>基准偏离</small>
                <strong className={(selectedBaseDeviationPercent ?? 0) > 0 ? 'market-value-warning' : (selectedBaseDeviationPercent ?? 0) < 0 ? 'market-value-info' : ''}>
                  {typeof selectedBaseDeviationPercent === 'number' ? (selectedBaseDeviationPercent > 0 ? '+' : '') + selectedBaseDeviationPercent.toFixed(1) + '%' : '—'}
                </strong>
              </span>
              <span className="market-detail-hero__metric">
                <small>24h 变化</small>
                <strong className={marketTrend > 0 ? 'market-value-positive' : marketTrend < 0 ? 'market-value-negative' : ''}>
                  <CurrencyAmount sign={marketTrend > 0 ? '+' : undefined}>{formatCurrency(marketTrend)}</CurrencyAmount>
                </strong>
              </span>
            </>
          ) : (
            <>
              <span><small>可用</small><strong>{formatNumber(availableAssetQuantity)}</strong></span>
              <span><small>冻结</small><strong>{formatNumber(selectedGroup?.frozenCount ?? 0)}</strong></span>
              <span><small>已有订单</small><strong>{formatNumber(ownSelectedOrders.length)}</strong></span>
            </>
          )}
        </Panel>
`;
marketPage = marketPage.slice(0, heroStart) + MARKET_HERO + marketPage.slice(heroEnd);

const fundamentalsStart = marketPage.indexOf('              <div className="market-fundamentals-metrics">');
const fundamentalsEnd = marketPage.indexOf('              <p className="market-authority-note">', fundamentalsStart);
if (fundamentalsStart < 0 || fundamentalsEnd < 0) throw new Error('Missing market fundamentals boundaries');
const MARKET_FUNDAMENTALS = String.raw`              <div className="market-fundamentals-metrics">
                <MetricCard
                  label="市场价"
                  value={<CurrencyAmount>{formatCurrency(selectedMarketPrice)}</CurrencyAmount>}
                  detail={typeof selectedBaseDeviationPercent === 'number' ? '相对基础价 ' + (selectedBaseDeviationPercent > 0 ? '+' : '') + selectedBaseDeviationPercent.toFixed(1) + '%' : undefined}
                  tone={(selectedBaseDeviationPercent ?? 0) > 0 ? 'warning' : (selectedBaseDeviationPercent ?? 0) < 0 ? 'info' : 'neutral'}
                />
                <MetricCard label="卖单量" value={formatNumber(selectedSellVolume)} />
                <MetricCard label="买单量" value={formatNumber(selectedBuyVolume)} />
                <MetricCard
                  label="挂单差额"
                  value={(selectedBalance > 0 ? '+' : '') + formatNumber(selectedBalance)}
                  detail="卖单量 − 买单量"
                  tone={selectedBalance > 0 ? 'info' : selectedBalance < 0 ? 'warning' : 'neutral'}
                />
                <MetricCard
                  label="需求满足率"
                  value={selectedProductMarket.demand.lastQuantity > 0 ? (selectedProductMarket.demand.satisfaction * 100).toFixed(1) + '%' : '无直接需求'}
                  tone={selectedProductMarket.demand.lastQuantity > 0 && selectedProductMarket.demand.satisfaction < 1 ? 'warning' : 'neutral'}
                />
                <MetricCard label="参考价" value={<CurrencyAmount>{formatCurrency(selectedProductMarket.demand.referencePrice)}</CurrencyAmount>} />
                <MetricCard label="上轮需求" value={formatNumber(selectedProductMarket.demand.lastQuantity)} detail={'预算 ' + formatCurrency(selectedProductMarket.demand.lastBudget)} />
                <MetricCard
                  label="周期实际成交"
                  value={formatNumber(selectedProductMarket.cycleSellQuantity ?? 0) + ' 卖 / ' + formatNumber(selectedProductMarket.cycleBuyQuantity ?? 0) + ' 买'}
                />
              </div>
              <div className="market-fundamentals-balance" aria-label="当前订单簿失衡程度">
                <span><small>订单簿失衡</small><strong>{selectedBalance > 0 ? '卖单较多' : selectedBalance < 0 ? '买单较多' : selectedBuyVolume + selectedSellVolume > 0 ? '数量均衡' : '无挂单'}</strong></span>
                <MarketBalanceBar buyVolume={selectedBuyVolume} sellVolume={selectedSellVolume} />
              </div>
`;
marketPage = marketPage.slice(0, fundamentalsStart) + MARKET_FUNDAMENTALS + marketPage.slice(fundamentalsEnd);

const gridStart = marketPage.indexOf('        <div className="market-grid unified-market-grid">');
const tradeStart = marketPage.indexOf('          <Panel className="widget market-trade-card">', gridStart);
const chartStart = marketPage.indexOf('          <Panel className="widget market-chart-card">', tradeStart);
const autoStart = marketPage.indexOf('          {selectedProduct ? (\n            <MarketAutoTradePanel', chartStart);
if (gridStart < 0 || tradeStart < 0 || chartStart < 0 || autoStart < 0) throw new Error('Missing market trade/chart ordering boundaries');
const tradeBlock = marketPage.slice(tradeStart, chartStart);
const chartBlock = marketPage.slice(chartStart, autoStart);
marketPage = marketPage.slice(0, tradeStart) + chartBlock + tradeBlock + marketPage.slice(autoStart);
write('src/pages/MarketPage.tsx', marketPage);

const GLOBAL_MARKET_CSS = String.raw`
/* Commodity-first global market hierarchy. Cross-state bars visualize coverage only. */
.global-market-summary-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr)) minmax(9.5rem, 1.35fr);
  gap: 1px;
  overflow: hidden;
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-control);
  background: var(--color-border-subtle);
}

.global-market-summary-strip > span {
  min-width: 0;
  display: grid;
  gap: .15rem;
  padding: .55rem .7rem;
  background: color-mix(in srgb, var(--color-surface-panel) 76%, transparent);
}

.global-market-summary-strip small,
.global-market-goods-row small,
.global-market-province-row small {
  color: var(--color-text-muted);
}

.global-market-summary-strip strong,
.global-market-goods-row strong,
.global-market-province-row strong {
  min-width: 0;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.global-market-summary-strip__current {
  text-align: end;
}

.global-market-filter-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .55rem;
  flex-wrap: wrap;
  margin-bottom: .65rem;
}

.global-market-filter-group {
  display: flex;
  align-items: center;
  gap: .25rem;
  flex-wrap: wrap;
}

.global-market-filter-button {
  min-height: 30px;
  border: 1px solid transparent;
  border-radius: var(--radius-control);
  padding: .28rem .55rem;
  color: var(--color-text-secondary);
  background: transparent;
  font: inherit;
  font-size: var(--font-size-xs);
  font-weight: 700;
}

.global-market-filter-button.active {
  border-color: var(--color-border-strong);
  color: var(--color-text-primary);
  background: var(--color-surface-inset);
}

.global-market-goods-list,
.global-market-province-list {
  display: grid;
  gap: .32rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.global-market-goods-row {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(9.5rem, 1.35fr) minmax(4.8rem, .62fr) minmax(7rem, .82fr) repeat(2, minmax(6rem, .72fr)) minmax(5.5rem, .68fr) minmax(8rem, .9fr);
  align-items: center;
  gap: .55rem;
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-control);
  padding: .5rem .6rem;
  background: color-mix(in srgb, var(--color-surface-panel) 70%, transparent);
}

.global-market-goods-row__identity {
  min-width: 0;
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  align-items: center;
  gap: .55rem;
}

.global-market-goods-row__artwork {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  overflow: hidden;
}

.global-market-goods-row__artwork > * {
  max-width: 100%;
  max-height: 100%;
}

.global-market-goods-row__metric,
.global-market-goods-row__status,
.global-market-province-row > span:not(.global-market-province-row__chevron) {
  min-width: 0;
  display: grid;
  gap: .15rem;
}

.global-market-goods-row__status {
  align-content: center;
  justify-items: start;
}

.global-market-empty {
  min-height: 7rem;
  display: grid;
  place-items: center;
  color: var(--color-text-muted);
}

.global-market-province-row {
  position: relative;
  width: 100%;
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(10rem, 1.35fr) repeat(4, minmax(5rem, .68fr)) minmax(6rem, .72fr) 1rem;
  align-items: center;
  gap: .55rem;
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-control);
  padding: .55rem .65rem;
  color: var(--color-text-primary);
  text-align: left;
  background: color-mix(in srgb, var(--color-surface-panel) 70%, transparent);
}

.global-market-province-row__identity strong {
  font-size: var(--font-size-sm);
}

.global-market-province-row__status {
  justify-items: start;
}

.global-market-province-row__chevron {
  color: var(--color-text-secondary);
  font-size: 1.2rem;
  text-align: end;
}

@media (max-width: 960px) {
  .global-market-summary-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .global-market-summary-strip__current {
    grid-column: 1 / -1;
    text-align: start;
  }

  .global-market-goods-row,
  .global-market-province-row {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .global-market-goods-row__identity,
  .global-market-province-row__identity {
    grid-column: 1 / -1;
  }

  .global-market-goods-row__status {
    grid-column: span 2;
  }

  .global-market-province-row__chevron {
    position: absolute;
    top: .6rem;
    right: .65rem;
  }
}

@media (max-width: 620px) {
  .global-market-summary-strip,
  .global-market-goods-row,
  .global-market-province-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .global-market-summary-strip__current,
  .global-market-goods-row__identity,
  .global-market-goods-row__status,
  .global-market-province-row__identity,
  .global-market-province-row__status {
    grid-column: 1 / -1;
  }

  .global-market-filter-row {
    align-items: stretch;
  }

  .global-market-filter-group {
    width: 100%;
  }
}
`;
appendOnce('src/styles/global-operation-pages.css', 'Commodity-first global market hierarchy', GLOBAL_MARKET_CSS);

const MARKET_BALANCE_CSS = String.raw`
/* Market imbalance and detail hierarchy. */
.market-balance-bar {
  --market-balance-fill: 0%;
  position: relative;
  width: 100%;
  min-width: 4.5rem;
  height: 7px;
  display: block;
  overflow: hidden;
  border-radius: 999px;
  background: var(--color-surface-inset);
}

.market-balance-bar::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 1px;
  background: var(--color-border-strong);
}

.market-balance-bar__fill {
  position: absolute;
  top: 0;
  bottom: 0;
  width: var(--market-balance-fill);
}

.market-balance-bar[data-direction='buy'] .market-balance-bar__fill {
  right: 50%;
  background: var(--color-success);
}

.market-balance-bar[data-direction='sell'] .market-balance-bar__fill {
  left: 50%;
  background: var(--color-danger);
}

.market-balance-bar[data-direction='balanced'] .market-balance-bar__fill,
.market-balance-bar[data-direction='inactive'] .market-balance-bar__fill {
  left: 50%;
  width: 0;
}

.market-coverage-bar {
  --market-traded-coverage: 0%;
  --market-unmet-coverage: 0%;
  width: min(8rem, 100%);
  display: grid;
  gap: 3px;
  margin-top: 2px;
}

.market-coverage-bar__track {
  height: 4px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--color-surface-inset);
}

.market-coverage-bar__track > span {
  display: block;
  height: 100%;
}

.market-coverage-bar__track--traded > span {
  width: var(--market-traded-coverage);
  background: var(--color-info);
}

.market-coverage-bar__track--unmet > span {
  width: var(--market-unmet-coverage);
  background: var(--color-warning);
}

.market-catalog-row__balance .market-balance-bar {
  margin-top: 1px;
}

.market-detail-hero__metric strong {
  font-variant-numeric: tabular-nums;
}

.market-detail-hero__market-price strong {
  color: var(--color-warning);
  font-size: var(--font-size-lg);
}

.market-value-positive {
  color: var(--color-success) !important;
}

.market-value-negative {
  color: var(--color-danger) !important;
}

.market-value-warning {
  color: var(--color-warning) !important;
}

.market-value-info {
  color: var(--color-info) !important;
}

.market-fundamentals-balance {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(7rem, auto) minmax(8rem, 1fr);
  align-items: center;
  gap: var(--space-3);
  border-top: 1px solid var(--color-divider);
  padding-top: var(--space-2);
}

.market-fundamentals-balance > span {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.market-fundamentals-balance small {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

@container market-page (max-width: 620px) {
  .market-catalog-row__balance {
    grid-column: 1 / -1;
  }

  .market-fundamentals-balance {
    grid-template-columns: minmax(0, 1fr);
  }
}
`;
appendOnce('src/styles/market-page-polish.css', 'Market imbalance and detail hierarchy', MARKET_BALANCE_CSS);

const MARKET_SECTION = String.raw`## 4. 市场

一级路由 market 使用 GlobalMarketPage，页面主标题固定为“市场”。全局市场的主体固定为跨州商品行情主表，而不是统计卡片仪表盘：顶部只保留紧凑摘要条，显示已解锁地区、未完成挂单、有真实成交商品、需求未满足地区项和当前经营州；当前经营州不得恢复为独立说明卡。商品主表支持四类正式商品分类，以及全部状态、有真实成交、需求未满足、暂无成交四种状态过滤；每行固定显示商品、真实成交覆盖地区、真实成交价范围、最低价地区、最高价地区、需求未满足地区与地区覆盖状态。地区覆盖条只表示“有真实成交的州数量”和“需求未满足的州数量”，用于比较覆盖程度，不表示全国订单簿或全国供需差额。

多个州的订单簿、库存、需求和成交价始终保持州级隔离。全局页不得把各州买卖单合并成一个全国订单簿，不得用平均价、基础价、最低／最高价中点或任意聚合值伪造“全局市场价”，也不得在服务器没有逐州公开盘口摘要时从当前经营州的 game.orders 推断其他州买盘或卖盘。之所以使用真实成交覆盖、最低／最高成交地区和需求缺口覆盖，是因为这些字段已经由完整权威状态按州提供，能够增加维多利亚式市场信息密度而不突破州级撮合边界。未来若要显示跨州买盘／卖盘覆盖或贡献量，必须先由服务器增加对应权威摘要字段。

全局页第二部分固定为紧凑“地区市场”列表，不再使用大尺寸州卡。每行显示州名、未完成挂单、有成交商品、需求未满足商品、本地库存和市场状态；当前经营州只作为弱提示。玩家点击整行进入该州地区市场工作区，该动作可以显式更新当前经营州，但实际盘口、在线自动交易、下单、撤单和本地成交仍全部复用 MarketPage 并携带该 provinceId。ProvincePage 的市场分区继续直接嵌入当前地图州的同一个 MarketPage。全局市场钻取到地区目录时不重复渲染第二张“当前地区市场”说明卡。

地区 MarketPage 的目录态语义标题为“{州级地区全称}市场”；商品详情使用共享地区实体标题，第一行显示商品名称，第二行显示州级地区全称。嵌入 GlobalMarketPage 或 ProvincePage 时不得再套第二层 PageLayout，父级标题必须跟随同一目录／详情状态；地区商品详情返回当前地区商品目录，不得直接跳过地区层级。地区市场不显示州级下拉框；商品目录只展示商品，不提供商品／工厂资产类型切换；工厂资产的五档盘口、下单、本人订单与成交仍作为建筑详情中的从属交易视图打开，返回时必须回到原建筑详情。

地区商品目录固定采用连续市场数据行，而不是多张等权卡片。筛选栏和商品列表直接排列在正文；列表支持商品名称、四类正式商品分类、市场状态和排序筛选。每行固定显示商品、卖单量、买单量、挂单差额、市场价、相对基础价偏离、24h 变化和挂单状态。挂单差额固定为“卖单量 − 买单量”，并在同一列附带以当前地区真实公开订单簿计算的 Balance Bar：中线表示数量相等，左侧长度表示买单相对更多，右侧长度表示卖单相对更多，长度只表达失衡程度；颜色只表达方向，不把短缺或过剩自动解释为好坏。中窄与移动布局必须改为多行摘要，不得依赖横向滚动或隐藏上述关键字段。

点击商品进入当前地区商品详情。详情信息顺序固定为：商品摘要与市场价／基准偏离／24h 变化 → 商品基本面与当前订单簿卖单量、买单量、挂单差额、需求满足率、参考价和上轮需求 → 生产者与消费者关系 → 近 24h 真实成交趋势 → 手动下单与统一五档订单簿 → 锁定当前 provinceId + productId 的在线自动采购／自动出售 → 本人订单与本地成交。交易功能不得抢在价格、供需和生产消费关系之前成为详情首屏的唯一主体。自动交易不得在商品目录恢复全商品工作区或第二套盘口。

卖单量与买单量只来自当前地区公开订单簿，库存、理论产量、建筑数量和价格走势不得伪装成供给或需求。商品详情中的上轮消费需求量、预算、满足率和参考价只读取服务器 ProductMarketState.demand；没有直接需求时必须明确显示，不得由客户端阈值伪造短缺或过剩。商品生产者／消费者关系只能从正式建筑配方的输出／投入关系派生，不表示实际生产量、就业量或贸易流。商品行情、在线自动交易策略、五档盘口、未完成订单和本地成交记录都只展示当前地区；切换地区必须在同一完整权威状态上重新投影，不得沿用上一地区的盘口、库存、价格、策略或成交记录；下单请求必须携带当前 provinceId。
`;

let pageDesign = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');
const marketSectionPattern = /## 4\. 市场\n[\s\S]*?(?=\n## 5\.)/;
if (!marketSectionPattern.test(pageDesign)) throw new Error('Missing market section in page design');
pageDesign = pageDesign.replace(marketSectionPattern, MARKET_SECTION.trimEnd() + '\n');
write('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', pageDesign);

const VERIFY_MARKET_HIERARCHY = String.raw`import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function requireText(source, text, label) {
  if (!source.includes(text)) throw new Error(label + ': missing ' + text);
}

function forbidText(source, text, label) {
  if (source.includes(text)) throw new Error(label + ': forbidden ' + text);
}

const globalMarket = read('src/pages/GlobalMarketPage.tsx');
const regionalMarket = read('src/pages/MarketPage.tsx');
const globalCss = read('src/styles/global-operation-pages.css');
const marketCss = read('src/styles/market-page-polish.css');
const design = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');

for (const token of [
  'global-market-summary-strip',
  'global-market-filter-row',
  'global-market-goods-row',
  '真实成交价范围',
  '最低价地区',
  '最高价地区',
  'MarketCoverageBar',
  'global-market-province-row',
]) requireText(globalMarket, token, 'global market hierarchy');

forbidText(globalMarket, 'MetricCard', 'global market hierarchy');
forbidText(globalMarket, 'global-current-scope-summary', 'global market hierarchy');
forbidText(globalMarket, 'global-province-grid', 'global market hierarchy');

for (const token of [
  'MarketBalanceBar',
  'market-detail-hero__market-price',
  'market-fundamentals-balance',
  '卖单量',
  '买单量',
  '挂单差额',
]) requireText(regionalMarket, token, 'regional market hierarchy');

const chartIndex = regionalMarket.indexOf('<Panel className="widget market-chart-card">');
const tradeIndex = regionalMarket.indexOf('<Panel className="widget market-trade-card">');
if (chartIndex < 0 || tradeIndex < 0 || chartIndex >= tradeIndex) {
  throw new Error('regional market hierarchy: price chart must precede manual trading');
}

for (const token of [
  '.global-market-summary-strip',
  '.global-market-goods-row',
  '.global-market-province-row',
]) requireText(globalCss, token, 'global market css');

for (const token of [
  '.market-balance-bar',
  '.market-coverage-bar',
  '.market-fundamentals-balance',
]) requireText(marketCss, token, 'regional market css');

for (const token of [
  '全局市场的主体固定为跨州商品行情主表',
  '不得把各州买卖单合并成一个全国订单簿',
  'Balance Bar',
  '近 24h 真实成交趋势',
]) requireText(design, token, 'market design authority');

console.log('Market information hierarchy verification passed.');
`;
write('scripts/verify-market-information-hierarchy.mjs', VERIFY_MARKET_HIERARCHY);

const MARKET_BROWSER_TEST = String.raw`import { expect, test } from '@playwright/test';

test('market uses commodity-first global and regional information hierarchy', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('?preview=game');
  await page.locator('.desktop-sidebar').getByRole('button', { name: /^市场/ }).click();

  await expect(page.locator('.global-market-summary-strip')).toBeVisible();
  await expect(page.locator('.global-market-goods-row').first()).toBeVisible();
  await expect(page.locator('.global-market-province-row').first()).toBeVisible();
  await expect(page.locator('.global-current-scope-summary')).toHaveCount(0);
  await expect(page.locator('.global-province-grid')).toHaveCount(0);

  await page.locator('.global-market-province-row').first().click();
  const firstCommodity = page.locator('.market-catalog-row').first();
  await expect(firstCommodity).toBeVisible();
  await expect(firstCommodity.locator('.market-balance-bar')).toHaveCount(1);
  await firstCommodity.click();

  await expect(page.locator('.market-detail-hero__market-price')).toBeVisible();
  await expect(page.locator('.market-fundamentals-balance .market-balance-bar')).toHaveCount(1);
  const chartBox = await page.locator('.market-chart-card').boundingBox();
  const tradeBox = await page.locator('.market-trade-card').boundingBox();
  expect(chartBox).not.toBeNull();
  expect(tradeBox).not.toBeNull();
  expect(chartBox!.y).toBeLessThan(tradeBox!.y);
});
`;
write('tests/browser/market-information-hierarchy.spec.ts', MARKET_BROWSER_TEST);

let packageJson = read('package.json');
packageJson = replaceRequired(
  packageJson,
  '    "verify:market-desktop-cleanup": "node scripts/verify-market-desktop-cleanup.mjs",',
  '    "verify:market-desktop-cleanup": "node scripts/verify-market-desktop-cleanup.mjs",\n    "verify:market-information-hierarchy": "node scripts/verify-market-information-hierarchy.mjs",',
  'market hierarchy npm script',
);
packageJson = replaceRequired(
  packageJson,
  'node scripts/verify-market-page-layout.mjs && npm run verify:market-desktop-cleanup',
  'node scripts/verify-market-page-layout.mjs && npm run verify:market-information-hierarchy && npm run verify:market-desktop-cleanup',
  'architecture market hierarchy verification',
);
write('package.json', packageJson);

console.log('Final market patch applied.');
