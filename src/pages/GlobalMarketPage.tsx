import { lazy, Suspense, useMemo, useState } from 'react';
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
