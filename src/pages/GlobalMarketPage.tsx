import { CompactNumber } from '../components/ui/CompactNumber';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import type { OnlineAutoTradeAwareGameViewModel } from '../auto-trade/useOnlineAutoTrade';
import { ChevronIcon } from '../components/icons/GameIcons';
import {
  compareMarketOptionalValue,
  MarketCommodityHeader,
  MarketCommodityRow,
  type MarketCommoditySortKey,
  type MarketSortDirection,
} from '../components/market/MarketCommodityRow';
import { ProductArtwork } from '../components/products/ProductArtwork';
import { CurrencyAmount } from '../components/ui/CurrencyAmount';
import {
  EntityListHeader,
  type EntityListSortState,
} from '../components/ui/EntityListHeader';
import { usePlayerPageNavigation } from '../components/ui/PageNavigationContext';
import { RegionalEntityPageTitle } from '../components/ui/RegionalEntityPageTitle';
import {
  PageLayout,
  Panel,
} from '../components/ui/layout';
import type { ProductCategory } from '../types';
import '../styles/global-operation-pages.css';
import '../styles/entity-list-header.css';

const EmbeddedMarketPage = lazy(() => import('./MarketPage').then((module) => ({
  default: module.MarketPage,
})));

type GlobalMarketStatus = 'all' | 'traded' | 'unmet-demand' | 'no-trade';
type GlobalMarketSortKey = 'name' | 'volume24h' | 'market-price' | 'price-change24h';
type RegionalProductStatus = 'all' | 'traded' | 'no-trade';

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

function average(values: number[]) {
  if (values.length === 0) return undefined;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
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

export function GlobalMarketPage({ model }: { model: OnlineAutoTradeAwareGameViewModel }) {
  const [selectedGlobalProductId, setSelectedGlobalProductId] = useState<string | null>(null);
  const [activeProvinceId, setActiveProvinceId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<'all' | ProductCategory>('all');
  const [statusFilter, setStatusFilter] = useState<GlobalMarketStatus>('all');
  const [catalogSort, setCatalogSort] = useState<EntityListSortState<GlobalMarketSortKey>>({
    key: 'catalog',
    direction: 'asc',
  });
  const [regionalStatusFilter, setRegionalStatusFilter] = useState<RegionalProductStatus>('all');
  const [regionalSort, setRegionalSort] = useState<MarketCommoditySortKey>('catalog');
  const [regionalSortDirection, setRegionalSortDirection] = useState<MarketSortDirection>('asc');
  const pageNavigation = usePlayerPageNavigation();
  const stackedLocation = pageNavigation?.currentLocation;
  const game = model.game;
  const provinces = operationalProvinces(model);

  useEffect(() => {
    if (!stackedLocation) return;
    if (stackedLocation.type === 'global-market-product') {
      setSelectedGlobalProductId(stackedLocation.productId);
      setActiveProvinceId(null);
      return;
    }
    if (stackedLocation.type === 'regional-product' && stackedLocation.host === 'market') {
      setSelectedGlobalProductId(stackedLocation.productId);
      setActiveProvinceId(stackedLocation.provinceId);
      return;
    }
    if (stackedLocation.type === 'tab' && stackedLocation.tab === 'market') {
      setSelectedGlobalProductId(null);
      setActiveProvinceId(null);
    }
  }, [stackedLocation]);

  const productRows = useMemo(() => game.products.map((product, catalogIndex) => {
    const officialPrices: number[] = [];
    const priceChanges24h: number[] = [];
    let tradedProvinceCount = 0;
    let tradeVolume24h = 0;
    let directDemandProvinces = 0;
    let unmetDemandProvinces = 0;
    for (const province of provinces) {
      const market = game.provinceMarkets?.[province.id]?.[product.id];
      if (typeof market?.lastTradePrice === 'number') tradedProvinceCount += 1;
      if (typeof market?.officialPrice === 'number') officialPrices.push(market.officialPrice);
      if (typeof market?.priceChange24h === 'number') priceChanges24h.push(market.priceChange24h);
      tradeVolume24h += Math.max(0, Number(market?.tradeVolume24h || 0));
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
      catalogIndex,
      tradedProvinceCount,
      directDemandProvinces,
      unmetDemandProvinces,
      tradeVolume24h,
      marketPrice: average(officialPrices),
      priceChange24h: average(priceChanges24h),
    };
  }), [game.products, game.provinceMarkets, provinces]);

  const filteredProductRows = useMemo(() => {
    const filtered = productRows.filter((row) => {
      if (categoryFilter !== 'all' && row.category !== categoryFilter) return false;
      if (statusFilter === 'traded' && row.tradedProvinceCount <= 0) return false;
      if (statusFilter === 'unmet-demand' && row.unmetDemandProvinces <= 0) return false;
      if (statusFilter === 'no-trade' && row.tradedProvinceCount > 0) return false;
      return true;
    });
    return filtered.sort((left, right) => {
      let comparison = 0;
      if (catalogSort.key === 'name') {
        comparison = catalogSort.direction === 'asc'
          ? left.name.localeCompare(right.name, 'zh-CN')
          : right.name.localeCompare(left.name, 'zh-CN');
      } else if (catalogSort.key === 'volume24h') {
        comparison = catalogSort.direction === 'asc'
          ? left.tradeVolume24h - right.tradeVolume24h
          : right.tradeVolume24h - left.tradeVolume24h;
      } else if (catalogSort.key === 'market-price') {
        comparison = compareMarketOptionalValue(left.marketPrice, right.marketPrice, catalogSort.direction);
      } else if (catalogSort.key === 'price-change24h') {
        comparison = compareMarketOptionalValue(left.priceChange24h, right.priceChange24h, catalogSort.direction);
      }
      return comparison || left.catalogIndex - right.catalogIndex;
    });
  }, [catalogSort, categoryFilter, productRows, statusFilter]);

  const selectedGlobalProduct = selectedGlobalProductId
    ? game.products.find((product) => product.id === selectedGlobalProductId)
    : undefined;

  const regionalRows = useMemo(() => {
    if (!selectedGlobalProduct) return [];
    const rows = provinces.map((province, catalogIndex) => {
      const market = game.provinceMarkets?.[province.id]?.[selectedGlobalProduct.id];
      const marketPrice = typeof market?.officialPrice === 'number' ? market.officialPrice : undefined;
      const trend = typeof market?.priceChange24h === 'number'
        ? market.priceChange24h
        : trendForHistory(market?.priceHistory ?? [], game.lastProcessedAt);
      return {
        province,
        catalogIndex,
        tradeVolume24h: Math.max(0, Number(market?.tradeVolume24h || 0)),
        marketPrice,
        trend,
        traded: typeof market?.lastTradePrice === 'number',
      };
    });
    const filtered = rows.filter((row) => {
      if (regionalStatusFilter === 'traded' && !row.traded) return false;
      if (regionalStatusFilter === 'no-trade' && row.traded) return false;
      return true;
    });
    return filtered.sort((left, right) => {
      if (regionalSort === 'name') return regionalSortDirection === 'asc'
        ? left.province.name.localeCompare(right.province.name, 'zh-CN')
        : right.province.name.localeCompare(left.province.name, 'zh-CN');
      if (regionalSort === 'price') return compareMarketOptionalValue(left.marketPrice, right.marketPrice, regionalSortDirection);
      if (regionalSort === 'trend') return compareMarketOptionalValue(left.trend, right.trend, regionalSortDirection);
      if (regionalSort === 'volume24h') return compareMarketOptionalValue(left.tradeVolume24h, right.tradeVolume24h, regionalSortDirection);
      return left.catalogIndex - right.catalogIndex;
    });
  }, [
    game.lastProcessedAt,
    game.provinceMarkets,
    provinces,
    regionalSortDirection,
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
    setRegionalSortDirection('asc');
    pageNavigation?.pushPage({ type: 'global-market-product', productId });
  };

  const openRegionalProduct = (provinceId: string) => {
    if (!selectedGlobalProduct) return;
    setActiveProvinceId(provinceId);
    model.setSelectedProvinceId(provinceId);
    pageNavigation?.pushPage({
      type: 'regional-product',
      host: 'market',
      provinceId,
      productId: selectedGlobalProduct.id,
    });
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
          backAction={pageNavigation ? undefined : {
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
    const activeRegionalFilterCount = Number(regionalStatusFilter !== 'all');
    return (
      <PageLayout
        title={selectedGlobalProduct.name}
        backAction={pageNavigation ? undefined : { label: '返回商品列表', onClick: () => setSelectedGlobalProductId(null) }}
      >
        <div
          className="global-operation-page global-market-page global-market-product-detail"
          data-global-scope="market"
          data-global-product-id={selectedGlobalProduct.id}
        >
          <details className="global-market-filter-disclosure">
            <summary>
              <span>筛选</span>
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
            </div>
          </details>
          <section className="entity-list-surface global-market-product-region-surface">
            <MarketCommodityHeader
              entityLabel="地区"
              entitySortKey="name"
              sortKey={regionalSort}
              sortDirection={regionalSortDirection}
              onSortChange={({ key, direction }) => {
                setRegionalSort(key);
                setRegionalSortDirection(direction);
              }}
            />
            <ul className="entity-list-rows global-market-product-region-list" aria-label={`${selectedGlobalProduct.name}各地区行情`}>
              {regionalRows.map((row) => (
                <li key={row.province.id}>
                  <MarketCommodityRow
                    productId={selectedGlobalProduct.id}
                    productName={selectedGlobalProduct.name}
                    categoryLabel={PRODUCT_CATEGORY_LABELS[selectedGlobalProduct.category]}
                    regionName={row.province.name}
                    regionPrimary
                    currentRegion={row.province.id === model.selectedProvinceId}
                    provinceId={row.province.id}
                    tradeVolume24h={row.tradeVolume24h}
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
          </section>
        </div>
      </PageLayout>
    );
  }

  const activeCatalogFilterCount = Number(categoryFilter !== 'all') + Number(statusFilter !== 'all');
  return (
    <PageLayout title="市场">
      <div className="global-operation-page global-market-page" data-global-scope="market">
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
        <section className="entity-list-surface global-market-goods-surface">
          <EntityListHeader
            className="global-market-goods-header"
            columns={[
              { label: '商品', sortKey: 'name', defaultDirection: 'asc' },
              { label: '24h成交量', sortKey: 'volume24h', defaultDirection: 'desc' },
              { label: '今日价格', sortKey: 'market-price', defaultDirection: 'desc' },
              { label: '24h价格变化', sortKey: 'price-change24h', defaultDirection: 'desc' },
              { key: 'chevron', label: '' },
            ]}
            sortState={catalogSort}
            onSortChange={setCatalogSort}
          />
          <ul className="entity-list-rows global-market-goods-list" aria-label="全局商品目录">
            {filteredProductRows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className="entity-list-row global-market-goods-row"
                  data-ui-interactive="surface"
                  aria-label={`打开${row.name}全局详情`}
                  onClick={() => openGlobalProduct(row.id)}
                >
                  <span className="global-market-goods-row__identity">
                    <span className="global-market-goods-row__artwork" aria-hidden="true"><ProductArtwork productId={row.id} /></span>
                    <span className="global-market-goods-row__name"><strong>{row.name}</strong><small>{row.categoryLabel}</small></span>
                  </span>
                  <span className="global-market-goods-row__metric"><strong><CompactNumber value={row.tradeVolume24h} /></strong></span>
                  <span className="global-market-goods-row__metric"><strong>{typeof row.marketPrice === 'number'
                    ? <CurrencyAmount>{row.marketPrice}</CurrencyAmount>
                    : '—'}</strong></span>
                  <span className={`global-market-goods-row__metric entity-list-value ${typeof row.priceChange24h !== 'number' ? 'is-unavailable' : row.priceChange24h > 0 ? 'is-positive' : row.priceChange24h < 0 ? 'is-negative' : 'is-neutral'}`}><strong>{typeof row.priceChange24h === 'number'
                    ? <CurrencyAmount sign={row.priceChange24h > 0 ? '+' : undefined}>{row.priceChange24h}</CurrencyAmount>
                    : '—'}</strong></span>
                  <span className="global-market-goods-row__chevron" aria-hidden="true">
                    <ChevronIcon direction="right" />
                  </span>
                </button>
              </li>
            ))}
            {filteredProductRows.length === 0 ? <li className="global-market-empty">没有符合当前筛选条件的商品。</li> : null}
          </ul>
        </section>
      </div>
    </PageLayout>
  );
}
