import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import type { OnlineAutoTradeAwareGameViewModel } from '../auto-trade/useOnlineAutoTrade';
import { MarketCommodityRow } from '../components/market/MarketCommodityRow';
import { ProductArtwork } from '../components/products/ProductArtwork';
import { RegionalEntityPageTitle } from '../components/ui/RegionalEntityPageTitle';
import {
  PageLayout,
  PagePanel,
  Panel,
  StatusTag,
  WidgetHeading,
} from '../components/ui/layout';
import type { AssetOrder, EconomyState, ProductCategory } from '../types';
import { formatCurrency, formatNumber } from '../utils/formatters';
import '../styles/global-operation-pages.css';

const EmbeddedMarketPage = lazy(() => import('./MarketPage').then((module) => ({
  default: module.MarketPage,
})));

type GlobalMarketStatus = 'all' | 'traded' | 'unmet-demand' | 'no-trade';
type RegionalProductStatus = 'all' | 'traded' | 'buy' | 'sell' | 'own-order';
type RegionalProductSort = 'catalog' | 'price' | 'trend' | 'buy-volume' | 'sell-volume';

const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
  raw: '原材料',
  intermediate: '中间品',
  consumer: '消费品',
  industrial: '工业品',
};

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

const REGIONAL_STATUS_FILTERS: Array<{ value: RegionalProductStatus; label: string }> = [
  { value: 'all', label: '全部地区' },
  { value: 'traded', label: '有真实成交' },
  { value: 'buy', label: '有买盘' },
  { value: 'sell', label: '有卖盘' },
  { value: 'own-order', label: '有我的订单' },
];

const REGIONAL_SORT_OPTIONS: Array<{ value: RegionalProductSort; label: string }> = [
  { value: 'catalog', label: '地区顺序' },
  { value: 'price', label: '市场价' },
  { value: 'trend', label: '24h 变化' },
  { value: 'buy-volume', label: '买单量' },
  { value: 'sell-volume', label: '卖单量' },
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

function trendForHistory(
  history: Array<{ createdAt: number; price: number }>,
  now: number,
) {
  const windowStart = now - (24 * 60 * 60 * 1_000);
  const trades = history
    .filter((point) => point.createdAt >= windowStart && point.createdAt <= now)
    .sort((left, right) => left.createdAt - right.createdAt);
  return trades.length > 1
    ? trades[trades.length - 1].price - trades[0].price
    : undefined;
}

function openOrder(order: AssetOrder) {
  return (order.status === 'open' || order.status === 'partial')
    && Number(order.remaining || 0) > 0;
}

function commodityOrderProductId(order: AssetOrder) {
  return order.assetKind === 'commodity' ? order.assetId : order.productId;
}

export function GlobalMarketPage({ model }: { model: OnlineAutoTradeAwareGameViewModel }) {
  const [selectedGlobalProductId, setSelectedGlobalProductId] = useState<string | null>(null);
  const [activeProvinceId, setActiveProvinceId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<'all' | ProductCategory>('all');
  const [statusFilter, setStatusFilter] = useState<GlobalMarketStatus>('all');
  const [regionalStatusFilter, setRegionalStatusFilter] = useState<RegionalProductStatus>('all');
  const [regionalSort, setRegionalSort] = useState<RegionalProductSort>('catalog');
  const game = model.game;
  const provinces = operationalProvinces(model);
  const allProvinceOrders = ((game as EconomyState & { allProvinceOrders?: AssetOrder[] }).allProvinceOrders ?? game.orders);

  const productRows = useMemo(() => game.products.map((product) => {
    const prices: number[] = [];
    let directDemandProvinces = 0;
    let unmetDemandProvinces = 0;
    for (const province of provinces) {
      const market = game.provinceMarkets?.[province.id]?.[product.id];
      if (typeof market?.lastTradePrice === 'number') prices.push(market.lastTradePrice);
      if ((market?.demand?.lastQuantity ?? 0) > 0) {
        directDemandProvinces += 1;
        if ((market?.demand?.satisfaction ?? 1) < 1) unmetDemandProvinces += 1;
      }
    }
    return {
      id: product.id,
      name: product.name,
      category: product.category,
      categoryLabel: PRODUCT_CATEGORY_LABELS[product.category],
      tradedProvinceCount: prices.length,
      directDemandProvinces,
      unmetDemandProvinces,
      range: priceRange(prices),
    };
  }), [game.products, game.provinceMarkets, provinces]);

  const filteredProductRows = useMemo(() => productRows.filter((row) => {
    if (categoryFilter !== 'all' && row.category !== categoryFilter) return false;
    if (statusFilter === 'traded' && row.tradedProvinceCount <= 0) return false;
    if (statusFilter === 'unmet-demand' && row.unmetDemandProvinces <= 0) return false;
    if (statusFilter === 'no-trade' && row.tradedProvinceCount > 0) return false;
    return true;
  }), [categoryFilter, productRows, statusFilter]);

  const orderVolumes = useMemo(() => {
    const byProvinceAndProduct = new Map<string, { buy: number; sell: number; own: number }>();
    for (const order of allProvinceOrders) {
      if (!openOrder(order)) continue;
      const productId = commodityOrderProductId(order);
      if (!productId || !order.provinceId) continue;
      const key = `${order.provinceId}:${productId}`;
      const current = byProvinceAndProduct.get(key) ?? { buy: 0, sell: 0, own: 0 };
      const remaining = Math.max(0, Number(order.remaining || 0));
      if (order.side === 'buy') current.buy += remaining;
      else current.sell += remaining;
      if (order.isOwn) current.own += 1;
      byProvinceAndProduct.set(key, current);
    }
    return byProvinceAndProduct;
  }, [allProvinceOrders]);

  const selectedGlobalProduct = selectedGlobalProductId
    ? game.products.find((product) => product.id === selectedGlobalProductId)
    : undefined;

  const regionalRows = useMemo(() => {
    if (!selectedGlobalProduct) return [];
    const rows = provinces.map((province, catalogIndex) => {
      const market = game.provinceMarkets?.[province.id]?.[selectedGlobalProduct.id];
      const volume = orderVolumes.get(`${province.id}:${selectedGlobalProduct.id}`) ?? { buy: 0, sell: 0, own: 0 };
      const marketPrice = typeof market?.officialPrice === 'number' ? market.officialPrice : undefined;
      const trend = trendForHistory(market?.priceHistory ?? [], game.lastProcessedAt);
      return {
        province,
        catalogIndex,
        buyVolume: volume.buy,
        sellVolume: volume.sell,
        ownOrderCount: volume.own,
        marketPrice,
        trend,
        traded: typeof market?.lastTradePrice === 'number',
      };
    });
    const filtered = rows.filter((row) => {
      if (regionalStatusFilter === 'traded' && !row.traded) return false;
      if (regionalStatusFilter === 'buy' && row.buyVolume <= 0) return false;
      if (regionalStatusFilter === 'sell' && row.sellVolume <= 0) return false;
      if (regionalStatusFilter === 'own-order' && row.ownOrderCount <= 0) return false;
      return true;
    });
    return filtered.sort((left, right) => {
      if (regionalSort === 'price') return (right.marketPrice ?? -Infinity) - (left.marketPrice ?? -Infinity);
      if (regionalSort === 'trend') return (right.trend ?? -Infinity) - (left.trend ?? -Infinity);
      if (regionalSort === 'buy-volume') return right.buyVolume - left.buyVolume;
      if (regionalSort === 'sell-volume') return right.sellVolume - left.sellVolume;
      return left.catalogIndex - right.catalogIndex;
    });
  }, [
    game.lastProcessedAt,
    game.provinceMarkets,
    orderVolumes,
    provinces,
    regionalSort,
    regionalStatusFilter,
    selectedGlobalProduct,
  ]);

  useEffect(() => {
    if (!activeProvinceId || !selectedGlobalProduct) return;
    if (model.selectedProvinceId !== activeProvinceId) return;
    if (
      model.marketViewMode === 'detail'
      && model.marketAssetKind === 'commodity'
      && model.marketAssetId === selectedGlobalProduct.id
    ) return;
    model.selectMarketAsset('commodity', selectedGlobalProduct.id, false);
  }, [
    activeProvinceId,
    model,
    model.marketAssetId,
    model.marketAssetKind,
    model.marketViewMode,
    model.selectedProvinceId,
    selectedGlobalProduct,
  ]);

  const openGlobalProduct = (productId: string) => {
    setSelectedGlobalProductId(productId);
    setActiveProvinceId(null);
    setRegionalStatusFilter('all');
    setRegionalSort('catalog');
  };

  const openRegionalProduct = (provinceId: string) => {
    if (!selectedGlobalProduct) return;
    setActiveProvinceId(provinceId);
    model.setSelectedProvinceId(provinceId);
  };

  if (selectedGlobalProduct && activeProvinceId) {
    const activeProvince = provinces.find((province) => province.id === activeProvinceId);
    if (activeProvince) {
      const provinceReady = model.selectedProvinceId === activeProvince.id;
      const detailReady = provinceReady
        && model.marketViewMode === 'detail'
        && model.marketAssetKind === 'commodity'
        && model.marketAssetId === selectedGlobalProduct.id;
      return (
        <PageLayout
          title={<RegionalEntityPageTitle entityName={selectedGlobalProduct.name} regionName={activeProvince.name} />}
          backAction={{
            label: '返回商品全局详情',
            onClick: () => {
              model.showMarketCatalog();
              setActiveProvinceId(null);
            },
          }}
        >
          <div
            className="global-operation-page global-market-page"
            data-global-scope="market"
            data-global-product-id={selectedGlobalProduct.id}
            data-drilldown-province-id={activeProvince.id}
          >
            {detailReady ? (
              <Suspense fallback={<Panel className="empty-state"><span role="status">正在加载地区商品详情…</span></Panel>}>
                <EmbeddedMarketPage model={model} embedded />
              </Suspense>
            ) : <Panel className="empty-state"><span role="status">正在切换经营地区…</span></Panel>}
          </div>
        </PageLayout>
      );
    }
  }

  if (selectedGlobalProduct) {
    const activeRegionalFilterCount = Number(regionalStatusFilter !== 'all') + Number(regionalSort !== 'catalog');
    return (
      <PageLayout
        title={selectedGlobalProduct.name}
        backAction={{ label: '返回商品列表', onClick: () => setSelectedGlobalProductId(null) }}
      >
        <div
          className="global-operation-page global-market-page global-market-product-detail"
          data-global-scope="market"
          data-global-product-id={selectedGlobalProduct.id}
        >
          <PagePanel className="global-market-product-detail-panel">
            <WidgetHeading
              title="地区行情"
              action={<StatusTag>{formatNumber(regionalRows.length)} / {formatNumber(provinces.length)} 个地区</StatusTag>}
            />
            <details className="global-market-filter-disclosure">
              <summary>
                <span>筛选与排序</span>
                <small>{activeRegionalFilterCount > 0 ? `${activeRegionalFilterCount} 项已启用` : '默认折叠'}</small>
              </summary>
              <div className="global-market-filter-row" aria-label={`${selectedGlobalProduct.name}地区行情筛选`}>
                <div className="global-market-filter-group" role="group" aria-label="地区市场状态">
                  {REGIONAL_STATUS_FILTERS.map((option) => (
                    <button
                      type="button"
                      className={'global-market-filter-button' + (regionalStatusFilter === option.value ? ' active' : '')}
                      aria-pressed={regionalStatusFilter === option.value}
                      key={option.value}
                      onClick={() => setRegionalStatusFilter(option.value)}
                    >{option.label}</button>
                  ))}
                </div>
                <div className="global-market-filter-group" role="group" aria-label="地区行情排序">
                  {REGIONAL_SORT_OPTIONS.map((option) => (
                    <button
                      type="button"
                      className={'global-market-filter-button' + (regionalSort === option.value ? ' active' : '')}
                      aria-pressed={regionalSort === option.value}
                      key={option.value}
                      onClick={() => setRegionalSort(option.value)}
                    >{option.label}</button>
                  ))}
                </div>
              </div>
            </details>
            <ul className="global-market-product-region-list" aria-label={`${selectedGlobalProduct.name}各地区行情`}>
              {regionalRows.map((row) => (
                <li key={row.province.id}>
                  <MarketCommodityRow
                    productId={selectedGlobalProduct.id}
                    productName={selectedGlobalProduct.name}
                    categoryLabel={PRODUCT_CATEGORY_LABELS[selectedGlobalProduct.category]}
                    regionName={row.province.name}
                    currentRegion={row.province.id === model.selectedProvinceId}
                    provinceId={row.province.id}
                    sellVolume={row.sellVolume}
                    buyVolume={row.buyVolume}
                    marketPrice={row.marketPrice}
                    trend={row.trend}
                    ariaLabel={`打开${row.province.name}${selectedGlobalProduct.name}详情`}
                    onClick={() => openRegionalProduct(row.province.id)}
                  />
                </li>
              ))}
              {regionalRows.length === 0
                ? <li className="global-market-empty">没有符合当前筛选条件的地区。</li>
                : null}
            </ul>
          </PagePanel>
        </div>
      </PageLayout>
    );
  }

  const activeCatalogFilterCount = Number(categoryFilter !== 'all') + Number(statusFilter !== 'all');
  return (
    <PageLayout title="市场">
      <div className="global-operation-page global-market-page" data-global-scope="market">
        <WidgetHeading title="商品" />
        <details className="global-market-filter-disclosure">
          <summary>
            <span>筛选</span>
            <small>{activeCatalogFilterCount > 0 ? `${activeCatalogFilterCount} 项已启用` : '默认折叠'}</small>
          </summary>
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
        </details>
        <ul className="global-market-goods-list" aria-label="全局商品目录">
          {filteredProductRows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className="global-market-goods-row"
                data-ui-interactive="surface"
                aria-label={`打开${row.name}全局详情`}
                onClick={() => openGlobalProduct(row.id)}
              >
                <span className="global-market-goods-row__identity">
                  <span className="global-market-goods-row__artwork" aria-hidden="true"><ProductArtwork productId={row.id} /></span>
                  <span className="global-market-goods-row__name"><strong>{row.name}</strong><small>{row.categoryLabel}</small></span>
                </span>
                <span className="global-market-goods-row__metric"><small>成交地区</small><strong>{formatNumber(row.tradedProvinceCount)} / {formatNumber(provinces.length)}</strong></span>
                <span className="global-market-goods-row__metric"><small>真实成交价范围</small><strong>{row.range}</strong></span>
                <span className="global-market-goods-row__metric"><small>需求未满足</small><strong>{formatNumber(row.unmetDemandProvinces)} / {formatNumber(row.directDemandProvinces)}</strong></span>
                <span className="global-market-goods-row__chevron" aria-hidden="true">›</span>
              </button>
            </li>
          ))}
          {filteredProductRows.length === 0 ? <li className="global-market-empty">没有符合当前筛选条件的商品。</li> : null}
        </ul>
      </div>
    </PageLayout>
  );
}
