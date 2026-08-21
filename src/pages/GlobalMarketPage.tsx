import { lazy, Suspense, useMemo, useState } from 'react';
import type { OnlineAutoTradeAwareGameViewModel } from '../auto-trade/useOnlineAutoTrade';
import { ProductArtwork } from '../components/products/ProductArtwork';
import {
  Button,
  MetricCard,
  PageLayout,
  PagePanel,
  Panel,
  StatusTag,
  WidgetHeading,
} from '../components/ui/layout';
import { formatCurrency, formatNumber } from '../utils/formatters';
import '../styles/global-operation-pages.css';

const EmbeddedMarketPage = lazy(() => import('./MarketPage').then((module) => ({
  default: module.MarketPage,
})));

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
    : `${formatCurrency(minimum)} – ${formatCurrency(maximum)}`;
}

export function GlobalMarketPage({ model }: { model: OnlineAutoTradeAwareGameViewModel }) {
  const [activeProvinceId, setActiveProvinceId] = useState<string | null>(null);
  const game = model.game;
  const provinces = operationalProvinces(model);
  const summaries = game.provinceAssetSummaries ?? {};

  const productRows = useMemo(() => game.products.map((product) => {
    const prices: number[] = [];
    let unmetDemandProvinces = 0;
    for (const province of provinces) {
      const market = game.provinceMarkets?.[province.id]?.[product.id];
      if (typeof market?.lastTradePrice === 'number') prices.push(market.lastTradePrice);
      if ((market?.demand?.lastQuantity ?? 0) > 0 && (market?.demand?.satisfaction ?? 1) < 1) {
        unmetDemandProvinces += 1;
      }
    }
    return {
      id: product.id,
      name: product.name,
      tradedProvinceCount: prices.length,
      unmetDemandProvinces,
      range: priceRange(prices),
    };
  }), [game.products, game.provinceMarkets, provinces]);

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
  const activeProvince = activeProvinceId
    ? provinces.find((province) => province.id === activeProvinceId)
    : undefined;

  const openProvinceMarket = (provinceId: string) => {
    model.setSelectedProvinceId(provinceId);
    model.showMarketCatalog();
    setActiveProvinceId(provinceId);
  };

  if (activeProvince) {
    const provinceReady = model.selectedProvinceId === activeProvince.id;
    return (
      <PageLayout
        title="市场"
        actions={(
          <div className="global-operation-page-actions">
            <StatusTag>{activeProvince.name}地区市场</StatusTag>
            <Button variant="secondary" onClick={() => setActiveProvinceId(null)}>返回全局市场</Button>
          </div>
        )}
      >
        <div className="global-operation-page global-market-page" data-global-scope="market" data-drilldown-province-id={activeProvince.id}>
          <section className="global-operation-drilldown-context" aria-label="当前地区市场">
            <small>全局市场 · 地区交易视图</small>
            <h2>{activeProvince.name}市场</h2>
          </section>
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
        <section className="global-operation-metrics" aria-label="全局市场汇总">
          <MetricCard label="已解锁地区" value={formatNumber(provinces.length)} detail={`共 ${formatNumber(game.provinces.length)} 个州级地区`} />
          <MetricCard label="未完成挂单" value={formatNumber(totalOpenOrders)} tone={totalOpenOrders > 0 ? 'info' : 'neutral'} detail="所有已解锁州合计" />
          <MetricCard label="有真实成交商品" value={formatNumber(tradedProductCount)} tone={tradedProductCount > 0 ? 'success' : 'neutral'} detail={`共 ${formatNumber(game.products.length)} 种商品`} />
          <MetricCard label="需求未满足地区项" value={formatNumber(unmetDemandCount)} tone={unmetDemandCount > 0 ? 'warning' : 'neutral'} detail="按商品 × 州统计" />
        </section>

        <PagePanel className="global-current-scope-summary">
          <WidgetHeading title="当前经营州" action={<StatusTag>地图选择</StatusTag>} />
          <h2>{currentProvinceName}市场</h2>
          <p className="muted">当前经营州只决定后续地区写操作；本页默认展示全部已解锁州的市场信息。点击下方州卡进入对应地区交易。</p>
        </PagePanel>

        <PagePanel>
          <WidgetHeading title="全局商品行情" action={<StatusTag>{formatNumber(productRows.length)} 种商品</StatusTag>} />
          <ul className="global-operation-summary-list" aria-label="跨州商品行情">
            {productRows.map((row) => (
              <li className="global-operation-summary-row global-market-product-row" key={row.id}>
                <span className="global-operation-summary-identity">
                  <span className="global-operation-summary-artwork" aria-hidden="true"><ProductArtwork productId={row.id} /></span>
                  <strong>{row.name}</strong>
                </span>
                <span><small>有成交地区</small><strong>{formatNumber(row.tradedProvinceCount)}</strong></span>
                <span><small>真实成交价范围</small><strong>{row.range}</strong></span>
                <span><small>需求未满足地区</small><strong>{formatNumber(row.unmetDemandProvinces)}</strong></span>
              </li>
            ))}
          </ul>
        </PagePanel>

        <PagePanel>
          <WidgetHeading title="地区市场" action={<StatusTag>{formatNumber(provinceRows.length)} 个已解锁州</StatusTag>} />
          <div className="global-province-grid" aria-label="全局地区市场入口">
            {provinceRows.map((row) => (
              <button
                type="button"
                className="global-province-card"
                data-ui-interactive="surface"
                data-province-id={row.province.id}
                key={row.province.id}
                aria-label={`打开${row.province.name}地区市场`}
                onClick={() => openProvinceMarket(row.province.id)}
              >
                <span className="global-province-card__title"><strong>{row.province.name}</strong><small>{row.province.shortName}</small></span>
                <span><small>未完成挂单</small><strong>{formatNumber(row.openOrderCount)}</strong></span>
                <span><small>有成交商品</small><strong>{formatNumber(row.tradedProducts)}</strong></span>
                <span><small>需求未满足</small><strong>{formatNumber(row.unmetDemandProducts)}</strong></span>
                <span><small>本地库存</small><strong>{formatNumber(row.storedQuantity)}</strong></span>
              </button>
            ))}
          </div>
        </PagePanel>
      </div>
    </PageLayout>
  );
}
