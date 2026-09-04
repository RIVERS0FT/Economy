import { CompactNumber } from '../components/ui/CompactNumber';
import { useEffect, useMemo, useState } from 'react';
import { getMarketDetail } from '../api/game';
import type { LoadedGameViewModel } from '../app/gameViewModel';
import { PriceSparkline } from '../components/charts/PriceSparkline';
import {
  compareMarketOptionalValue,
  MarketCommodityHeader,
  MarketCommodityRow,
  type MarketSortDirection,
} from '../components/market/MarketCommodityRow';
import { FacilityIcon } from '../components/icons/FacilityIcons';
import { FactoryIcon } from '../components/icons/GameIcons';
import { ProductIconLabel } from '../components/icons/ProductIcons';
import { ProductArtwork } from '../components/products/ProductArtwork';
import { CurrencyAmount } from '../components/ui/CurrencyAmount';
import { RegionalEntityPageTitle } from '../components/ui/RegionalEntityPageTitle';
import { IntegerInput, SelectInput } from '../components/ui/FormControls';
import {
  Button,
  PageLayout,
  Panel,
  StatusTag,
  type StatusTone,
  WidgetHeading,
} from '../components/ui/layout';
import { VirtualRecordTable } from '../components/ui/VirtualRecordTable';
import type { AssetKind, MarketDetail, OrderSide, ProductCategory, ProductMarketState } from '../types';
import { formatCurrency, formatTime } from '../utils/formatters';
import { parseIntegerDraft } from '../utils/integerDraft';
import { buildMarketHistoryBuckets } from '../utils/marketHistory';

function localTradeKey(trade: { id: string }) { return trade.id; }

type MarketCatalogStatus = 'all' | 'traded' | 'unmet-demand';
type MarketCatalogSort = 'catalog' | 'name' | 'price' | 'trend' | 'volume24h';

const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
  raw: '原材料',
  intermediate: '中间品',
  consumer: '消费品',
  industrial: '工业品',
};

interface MarketCatalogEntry {
  kind: 'commodity';
  id: string;
  name: string;
  category: ProductCategory;
  categoryLabel: string;
  lastTradePrice?: number;
  marketPrice?: number;
  trend?: number;
  tradeVolume24h: number;
  demandSatisfaction: number | null;
}

function trendForMarket(
  history: Parameters<typeof buildMarketHistoryBuckets>[0],
  now: number,
) {
  const windowStart = now - (24 * 60 * 60 * 1_000);
  const realTrades = history
    .filter((point) => point.createdAt >= windowStart && point.createdAt <= now)
    .sort((left, right) => left.createdAt - right.createdAt);
  return realTrades.length > 1
    ? realTrades[realTrades.length - 1].price - realTrades[0].price
    : undefined;
}

function MarketImmediateTradeEntry({
  assetId,
  assetName,
  officialPrice,
  nextPriceAt,
  orderSide,
  selectOrderSide,
  orderQuantity,
  credits,
  availableQuantity,
  placeAssetOrder,
  showResult,
}: {
  assetId: string;
  assetName: string;
  officialPrice: number;
  nextPriceAt?: number;
  orderSide: OrderSide;
  selectOrderSide: (side: OrderSide) => void;
  orderQuantity: number;
  credits: number;
  availableQuantity: number;
  placeAssetOrder: LoadedGameViewModel['placeAssetOrder'];
  showResult: LoadedGameViewModel['showResult'];
}) {
  const [quantityDraft, setQuantityDraft] = useState(String(orderQuantity));
  const maxBuyByFunds = officialPrice > 0 ? Math.max(0, Math.floor(credits / officialPrice)) : 0;
  const maxTradeQuantity = orderSide === 'buy' ? maxBuyByFunds : Math.max(0, availableQuantity);
  const parsedQuantity = parseIntegerDraft(quantityDraft, { min: 1 });
  const effectiveQuantity = parsedQuantity ?? 0;
  const total = officialPrice * effectiveQuantity;
  const estimatedFee = orderSide === 'sell' && total > 0
    ? Math.round(total * 0.01 * 1_000_000) / 1_000_000
    : 0;
  const estimatedNet = Math.max(0, total - estimatedFee);
  const quantityReason = maxTradeQuantity < 1
    ? orderSide === 'buy' ? '可用资金不足。' : '暂无可售库存。'
    : parsedQuantity === null
      ? '数量必须是不低于 1 的整数。'
      : parsedQuantity > maxTradeQuantity
        ? orderSide === 'buy' ? `当前最多可买 ${maxTradeQuantity}。` : '数量超过可售范围。'
        : undefined;

  function adjustQuantity(delta: number) {
    if (maxTradeQuantity < 1) return;
    const base = parsedQuantity ?? Math.min(Math.max(1, orderQuantity), maxTradeQuantity);
    setQuantityDraft(String(Math.min(maxTradeQuantity, Math.max(1, base + delta))));
  }

  function fillQuickQuantity(fraction: number) {
    if (maxTradeQuantity < 1) return;
    const next = fraction >= 1
      ? maxTradeQuantity
      : Math.max(1, Math.floor(maxTradeQuantity * fraction));
    setQuantityDraft(String(Math.min(maxTradeQuantity, next)));
  }

  function submitTrade() {
    if (quantityReason || parsedQuantity === null) return;
    void showResult(placeAssetOrder('commodity', assetId, orderSide, parsedQuantity, officialPrice));
  }

  return (
    <section className="order-entry market-trade-entry market-immediate-trade" aria-labelledby="market-immediate-trade-title">
      <h3 id="market-immediate-trade-title" className="market-trade-section-title">即时交易</h3>
      <div className="ui-segmented market-side-switch" role="group" aria-label="交易方向">
        <Button
          variant="text"
          className={orderSide === 'buy' ? 'ui-segmented__button active' : 'ui-segmented__button'}
          aria-pressed={orderSide === 'buy'}
          onClick={() => selectOrderSide('buy')}
        >买入</Button>
        <Button
          variant="text"
          className={orderSide === 'sell' ? 'ui-segmented__button active danger' : 'ui-segmented__button'}
          aria-pressed={orderSide === 'sell'}
          onClick={() => selectOrderSide('sell')}
        >卖出</Button>
      </div>
      <div className="market-order-summary-grid market-daily-price-summary">
        <span>
          <small>今日成交价</small>
          <strong><CurrencyAmount>{formatCurrency(officialPrice)}</CurrencyAmount></strong>
        </span>
        <span>
          <small>下次调价</small>
          <strong>{typeof nextPriceAt === 'number' ? formatTime(nextPriceAt) : '次日 00:00'}</strong>
        </span>
      </div>
      <div className="market-stepper-block">
        <div className="market-stepper market-quantity-stepper" role="group" aria-label="调整交易数量">
          <Button
            variant="compact"
            className="market-stepper__button"
            aria-label="数量减少 1"
            disabled={maxTradeQuantity < 1 || (parsedQuantity ?? 1) <= 1}
            onClick={() => adjustQuantity(-1)}
          >−</Button>
          <IntegerInput
            id="market-trade-quantity"
            label="数量"
            fieldClassName="market-stepper__field"
            className="market-stepper__input"
            value={quantityDraft}
            fallbackValue={Math.min(Math.max(1, orderQuantity), Math.max(1, maxTradeQuantity))}
            min={1}
            max={maxTradeQuantity > 0 ? maxTradeQuantity : undefined}
            disabled={maxTradeQuantity < 1}
            aria-invalid={Boolean(quantityReason)}
            aria-describedby={quantityReason ? 'market-trade-quantity-error' : undefined}
            onValueChange={setQuantityDraft}
            onKeyDown={(event) => { if (event.key === 'Enter') submitTrade(); }}
          />
          <Button
            variant="compact"
            className="market-stepper__button"
            aria-label="数量增加 1"
            disabled={maxTradeQuantity < 1 || (parsedQuantity ?? 1) >= maxTradeQuantity}
            onClick={() => adjustQuantity(1)}
          >＋</Button>
        </div>
        {quantityReason ? <small id="market-trade-quantity-error" className="ui-form-field__error" role="alert">{quantityReason}</small> : null}
      </div>
      <div className="order-quick-fill" role="group" aria-label="快捷填写交易数量">
        <Button variant="compact" disabled={maxTradeQuantity < 1} onClick={() => fillQuickQuantity(0.25)}>25%</Button>
        <Button variant="compact" disabled={maxTradeQuantity < 1} onClick={() => fillQuickQuantity(0.5)}>50%</Button>
        <Button variant="compact" disabled={maxTradeQuantity < 1} onClick={() => fillQuickQuantity(1)}>最大</Button>
      </div>
      <div className="market-order-summary-grid">
        <span><small>交易总额</small><strong><CurrencyAmount>{formatCurrency(total)}</CurrencyAmount></strong></span>
        {orderSide === 'sell'
          ? <span><small>预计到账</small><strong><CurrencyAmount>{formatCurrency(estimatedNet)}</CurrencyAmount></strong></span>
          : <span><small>可用资金</small><strong><CurrencyAmount>{formatCurrency(credits)}</CurrencyAmount></strong></span>}
      </div>
      <Button
        block
        className="market-submit-order"
        disabled={Boolean(quantityReason)}
        onClick={submitTrade}
      >
        {orderSide === 'buy' ? `立即买入${assetName}` : `立即卖出${assetName}`}
      </Button>
    </section>
  );
}

export function MarketPage({
  model,
  embedded = false,
  facilityAssetId,
  onBackFromFacilityAsset,
}: {
  model: LoadedGameViewModel;
  embedded?: boolean;
  readOnly?: boolean;
  facilityAssetId?: string;
  onBackFromFacilityAsset?: () => void;
}) {
  const {
    game,
    localTrades,
    marketAssetKind,
    marketAssetId,
    marketViewMode,
    showMarketCatalog,
    selectMarketAsset,
    orderSide,
    selectOrderSide,
    orderQuantity,
    placeAssetOrder,
    clearLocalTrades,
    showResult,
  } = model;
  const now = game.lastProcessedAt;
  const [catalogCategory, setCatalogCategory] = useState('all');
  const [catalogStatus, setCatalogStatus] = useState<MarketCatalogStatus>('all');
  const [catalogSort, setCatalogSort] = useState<MarketCatalogSort>('catalog');
  const [catalogSortDirection, setCatalogSortDirection] = useState<MarketSortDirection>('desc');
  const [marketDetail, setMarketDetail] = useState<MarketDetail | null>(null);
  const [marketDetailLoading, setMarketDetailLoading] = useState(false);
  const [marketDetailError, setMarketDetailError] = useState('');

  const productById = useMemo(
    () => new Map(game.products.map((product) => [product.id, product])),
    [game.products],
  );
  const facilityTypeById = useMemo(
    () => new Map(game.facilityTypes.map((facility) => [facility.id, facility])),
    [game.facilityTypes],
  );
  const activeAssetKind: AssetKind = facilityAssetId ? 'facility' : marketAssetKind;
  const activeAssetId = facilityAssetId ?? marketAssetId;
  const selectedProduct = activeAssetKind === 'commodity'
    ? productById.get(activeAssetId) ?? game.products[0]
    : undefined;
  const selectedFacility = activeAssetKind === 'facility'
    ? facilityTypeById.get(activeAssetId) ?? game.facilityTypes[0]
    : undefined;
  const selectedInventory = selectedProduct
    ? game.inventories[selectedProduct.id] ?? { available: 0, frozen: 0, inTransit: 0 }
    : { available: 0, frozen: 0, inTransit: 0 };
  const selectedMarket = selectedProduct
    ? game.markets[selectedProduct.id]
    : selectedFacility ? game.facilityMarkets[selectedFacility.id] : undefined;
  const assetName = selectedProduct?.name ?? selectedFacility?.name ?? '资产';
  const assetId = selectedProduct?.id ?? selectedFacility?.id ?? activeAssetId;
  const selectedMarketDetail = marketDetail
    && marketDetail.provinceId === model.selectedProvinceId
    && marketDetail.assetKind === activeAssetKind
    && marketDetail.assetId === assetId
    ? marketDetail
    : null;
  const marketDetailRefreshToken = [
    selectedMarket?.lastTradeAt ?? '',
    selectedMarket?.lastTradePrice ?? '',
    selectedMarket?.tradeVolume24h ?? '',
    selectedProduct ? selectedMarket?.officialPrice ?? '' : '',
    selectedProduct ? selectedMarket?.nextPriceAt ?? '' : '',
  ].join('|');

  useEffect(() => {
    const shouldLoad = Boolean(facilityAssetId) || marketViewMode === 'detail';
    if (!shouldLoad || !assetId) return undefined;
    const controller = new AbortController();
    setMarketDetailLoading(true);
    setMarketDetailError('');
    void getMarketDetail(
      model.selectedProvinceId,
      activeAssetKind,
      assetId,
      controller.signal,
    ).then((detail) => {
      if (!controller.signal.aborted) setMarketDetail(detail);
    }).catch((reason) => {
      if (!controller.signal.aborted) setMarketDetailError(reason instanceof Error ? reason.message : '市场详情加载失败');
    }).finally(() => {
      if (!controller.signal.aborted) setMarketDetailLoading(false);
    });
    return () => controller.abort();
  }, [
    activeAssetKind,
    assetId,
    facilityAssetId,
    marketDetailRefreshToken,
    marketViewMode,
    model.selectedProvinceId,
  ]);

  const selectedLocalTrades = useMemo(
    () => localTrades.filter((trade) => (
      trade.type === activeAssetKind
      && (activeAssetKind === 'commodity' ? trade.productId : trade.facilityTypeId) === assetId
    )),
    [activeAssetKind, assetId, localTrades],
  );
  const detailedMarket = selectedMarketDetail?.market;
  const marketHistory = detailedMarket?.priceHistory ?? selectedMarket?.priceHistory ?? [];
  const marketFallbackPrice = detailedMarket?.lastPrice ?? selectedMarket?.lastPrice
    ?? selectedProduct?.basePrice
    ?? selectedFacility?.systemValue
    ?? 1;
  const marketBuckets = useMemo(
    () => buildMarketHistoryBuckets(marketHistory, marketFallbackPrice, now),
    [marketFallbackPrice, marketHistory, now],
  );
  const bucketMarketTrend = marketBuckets[marketBuckets.length - 1].price - marketBuckets[0].price;
  const summaryMarketTrend = detailedMarket?.priceChange24h ?? selectedMarket?.priceChange24h;
  const marketTrend = typeof summaryMarketTrend === 'number' ? summaryMarketTrend : bucketMarketTrend;
  const marketVolume24h = useMemo(() => {
    const summaryVolume = detailedMarket?.tradeVolume24h ?? selectedMarket?.tradeVolume24h;
    if (typeof summaryVolume === 'number') return Math.max(0, summaryVolume);
    const windowStart = now - (24 * 60 * 60 * 1_000);
    return marketHistory
      .filter((point) => point.createdAt >= windowStart && point.createdAt <= now)
      .reduce((sum, point) => sum + Math.max(0, Number(point.quantity || 0)), 0);
  }, [detailedMarket?.tradeVolume24h, marketHistory, now, selectedMarket?.tradeVolume24h]);
  const trendTone: StatusTone = marketTrend > 0 ? 'success' : marketTrend < 0 ? 'danger' : 'neutral';
  const detailedProductMarket = selectedProduct ? detailedMarket as ProductMarketState | undefined : undefined;
  const officialPrice = selectedProduct
    ? detailedProductMarket?.officialPrice ?? selectedMarket?.officialPrice ?? selectedProduct.basePrice
    : undefined;
  const nextPriceAt = selectedProduct
    ? detailedProductMarket?.nextPriceAt ?? selectedMarket?.nextPriceAt
    : undefined;
  const todayVolume = selectedProduct
    ? Math.max(0, Number(selectedMarket?.cycleBuyQuantity || 0)) + Math.max(0, Number(selectedMarket?.cycleSellQuantity || 0))
    : 0;

  const catalogEntries = useMemo(() => {
    const entries: MarketCatalogEntry[] = game.products.map((product) => {
      const market = game.markets[product.id];
      return {
        kind: 'commodity',
        id: product.id,
        name: product.name,
        category: product.category,
        categoryLabel: PRODUCT_CATEGORY_LABELS[product.category],
        lastTradePrice: typeof market?.lastTradePrice === 'number' ? market.lastTradePrice : undefined,
        marketPrice: typeof market?.officialPrice === 'number' ? market.officialPrice : undefined,
        trend: typeof market?.priceChange24h === 'number'
          ? market.priceChange24h
          : trendForMarket(market?.priceHistory ?? [], now),
        tradeVolume24h: Math.max(0, Number(market?.tradeVolume24h || 0)),
        demandSatisfaction: (market?.demand?.lastQuantity ?? 0) > 0
          ? Math.max(0, Math.min(1, market?.demand?.satisfaction ?? 0))
          : null,
      };
    });
    const filtered = entries.filter((entry) => {
      if (catalogCategory !== 'all' && entry.category !== catalogCategory) return false;
      if (catalogStatus === 'traded' && typeof entry.lastTradePrice !== 'number') return false;
      if (catalogStatus === 'unmet-demand' && !(entry.demandSatisfaction !== null && entry.demandSatisfaction < 1)) return false;
      return true;
    });
    return filtered.sort((left, right) => {
      if (catalogSort === 'name') return catalogSortDirection === 'asc'
        ? left.name.localeCompare(right.name, 'zh-CN')
        : right.name.localeCompare(left.name, 'zh-CN');
      if (catalogSort === 'price') return compareMarketOptionalValue(left.marketPrice, right.marketPrice, catalogSortDirection);
      if (catalogSort === 'trend') return compareMarketOptionalValue(left.trend, right.trend, catalogSortDirection);
      if (catalogSort === 'volume24h') return compareMarketOptionalValue(left.tradeVolume24h, right.tradeVolume24h, catalogSortDirection);
      return 0;
    });
  }, [catalogCategory, catalogSort, catalogSortDirection, catalogStatus, game.markets, game.products, now]);

  function resetCatalogFilters() {
    setCatalogCategory('all');
    setCatalogStatus('all');
  }

  function returnToCatalog() {
    if (facilityAssetId && onBackFromFacilityAsset) {
      onBackFromFacilityAsset();
      return;
    }
    showMarketCatalog();
  }

  const provinceName = model.selectedProvince?.name || '加利福尼亚州';
  if (!facilityAssetId && marketViewMode === 'catalog') {
    const activeCatalogFilterCount = Number(catalogCategory !== 'all') + Number(catalogStatus !== 'all');
    const catalogContent = (
      <div className="market-page-surface market-catalog-surface">
        <details className="market-catalog-filter-disclosure">
          <summary>
            <span>筛选</span>
            <small>{activeCatalogFilterCount > 0 ? `${activeCatalogFilterCount} 项已启用` : '默认折叠'}</small>
          </summary>
          <div className="market-catalog-filters" aria-label="市场列表筛选">
            <SelectInput label="分类" value={catalogCategory} onChange={(event) => setCatalogCategory(event.currentTarget.value)}>
              <option value="all">全部分类</option>
              {Object.entries(PRODUCT_CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </SelectInput>
            <SelectInput label="市场状态" value={catalogStatus} onChange={(event) => setCatalogStatus(event.currentTarget.value as MarketCatalogStatus)}>
              <option value="all">全部状态</option>
              <option value="traded">有真实成交</option>
              <option value="unmet-demand">消费需求未满足</option>
            </SelectInput>
          </div>
        </details>
        <MarketCommodityHeader
          entitySortKey="name"
          sortKey={catalogSort}
          sortDirection={catalogSortDirection}
          onSortChange={({ key, direction }) => {
            setCatalogSort(key as MarketCatalogSort);
            setCatalogSortDirection(direction);
          }}
        />
        <ul className="market-catalog-list" aria-label="商品市场列表">
          {catalogEntries.map((entry) => (
            <li className="market-catalog-item" key={entry.id}>
              <MarketCommodityRow
                productId={entry.id}
                productName={entry.name}
                categoryLabel={entry.categoryLabel}
                tradeVolume24h={entry.tradeVolume24h}
                marketPrice={entry.marketPrice}
                trend={entry.trend}
                ariaLabel={`查看${entry.name}详情`}
                onClick={() => selectMarketAsset(entry.kind, entry.id, !embedded)}
              />
            </li>
          ))}
          {catalogEntries.length === 0 ? (
            <li className="market-catalog-empty">
              <p>没有符合当前筛选条件的商品。</p>
              <Button variant="secondary" onClick={resetCatalogFilters}>清除筛选</Button>
            </li>
          ) : null}
        </ul>
      </div>
    );
    return embedded ? catalogContent : <PageLayout title={`${provinceName}市场`}>{catalogContent}</PageLayout>;
  }

  const detailContent = (
    <div className="market-page-surface market-detail-surface">
      <Panel className={`widget market-detail-hero${selectedProduct ? ' market-detail-hero--commodity' : ''}`}>
        <span className="market-detail-hero__artwork" aria-hidden="true">
          {selectedProduct
            ? <ProductArtwork productId={selectedProduct.id} />
            : selectedFacility ? <FacilityIcon facilityTypeId={selectedFacility.id} /> : <FactoryIcon />}
        </span>
        <div className="market-detail-hero__metrics">
          {selectedProduct ? (
            <>
              <span><small>今日价格</small><strong><CurrencyAmount>{formatCurrency(officialPrice ?? selectedProduct.basePrice)}</CurrencyAmount></strong></span>
              <span><small>24h 变化</small><StatusTag tone={trendTone}><CurrencyAmount sign={marketTrend > 0 ? '+' : undefined}>{formatCurrency(marketTrend)}</CurrencyAmount></StatusTag></span>
              <span><small>可用库存</small><strong><CompactNumber value={selectedInventory.available} /></strong></span>
            </>
          ) : (
            <>
              <span><small>最近成交</small><strong>{typeof selectedMarket?.lastTradePrice === 'number' ? formatCurrency(selectedMarket.lastTradePrice) : '—'}</strong></span>
              <span><small>24h 变化</small><StatusTag tone={trendTone}><CurrencyAmount sign={marketTrend > 0 ? '+' : undefined}>{formatCurrency(marketTrend)}</CurrencyAmount></StatusTag></span>
              <span><small>交易方式</small><strong>拍卖</strong></span>
            </>
          )}
        </div>
      </Panel>

      <div className="market-grid unified-market-grid">
        <Panel className="widget market-chart-card">
          <WidgetHeading
            title={selectedProduct
              ? <ProductIconLabel productId={selectedProduct.id}>{`${assetName}近 24h 成交趋势`}</ProductIconLabel>
              : <span className="product-icon-label facility-icon-label"><FactoryIcon />{`${assetName}近 24h 成交趋势`}</span>}
            action={<StatusTag tone={trendTone}><CurrencyAmount sign={marketTrend > 0 ? '+' : undefined}>{formatCurrency(marketTrend)}</CurrencyAmount></StatusTag>}
          />
          {marketDetailLoading && !selectedMarketDetail ? <small className="muted" role="status">正在加载当前市场行情…</small> : null}
          {marketDetailError && !selectedMarketDetail ? <small className="ui-form-field__error" role="alert">{marketDetailError}</small> : null}
          <PriceSparkline buckets={marketBuckets} variant="full" />
        </Panel>

        {selectedProduct ? (
          <section className="market-trade-card market-immediate-trade-card">
            <WidgetHeading title={<ProductIconLabel productId={selectedProduct.id}>{`${assetName}即时交易`}</ProductIconLabel>} />
            <div className="market-trade-summary" aria-label={`${assetName}即时交易摘要`}>
              <span><small>今日价格</small><strong><CurrencyAmount>{formatCurrency(officialPrice ?? selectedProduct.basePrice)}</CurrencyAmount></strong></span>
              <span><small>今日成交量</small><strong><CompactNumber value={todayVolume} /></strong></span>
              <span><small>24h 成交量</small><strong><CompactNumber value={marketVolume24h} /></strong></span>
              <span><small>下次调价</small><strong>{typeof nextPriceAt === 'number' ? formatTime(nextPriceAt) : '次日 00:00'}</strong></span>
            </div>
            <MarketImmediateTradeEntry
              key={`${assetId}:${orderSide}`}
              assetId={assetId}
              assetName={assetName}
              officialPrice={officialPrice ?? selectedProduct.basePrice}
              nextPriceAt={nextPriceAt}
              orderSide={orderSide}
              selectOrderSide={selectOrderSide}
              orderQuantity={orderQuantity}
              credits={game.credits}
              availableQuantity={selectedInventory.available}
              placeAssetOrder={placeAssetOrder}
              showResult={showResult}
            />
          </section>
        ) : (
          <Panel className="widget market-trade-card">
            <WidgetHeading title={`${assetName}产权交易`} />
            <p className="muted">工厂产权只通过拍卖转移，市场页仅保留历史行情。</p>
          </Panel>
        )}

        <Panel className="widget span-3 market-account-panel">
          <div className="local-trades-heading">
            <WidgetHeading title={`${assetName}最近成交`} />
            <Button variant="compact" onClick={clearLocalTrades} disabled={localTrades.length === 0}>清除全部本地成交</Button>
          </div>
          {selectedLocalTrades.length === 0 ? <p className="muted">当前浏览器暂无该资产成交记录。</p> : (
            <VirtualRecordTable
              items={selectedLocalTrades}
              getKey={localTradeKey}
              estimateSize={58}
              viewportHeight={520}
              minViewportHeight={96}
              overscan={6}
              gap={5}
              className="local-trades-scroll-area"
              tableClassName="local-trades-virtual-table"
              ariaLabel={`${assetName}最近成交`}
              header={(
                <>
                  <span role="columnheader" className="trade-side-cell">方向</span>
                  <span role="columnheader" className="numeric-cell">数量</span>
                  <span role="columnheader" className="numeric-cell">价格</span>
                  <span role="columnheader" className="numeric-cell">总额</span>
                  <span role="columnheader" className="numeric-cell">手续费 / 实收</span>
                  <span role="columnheader">时间</span>
                </>
              )}
              renderRow={(trade) => (
                <div className="virtual-record-row" role="row">
                  <span role="cell" className="trade-side-cell"><StatusTag tone={trade.side === 'buy' ? 'success' : 'danger'}>{trade.side === 'buy' ? '买入' : '卖出'}</StatusTag></span>
                  <span role="cell" className="numeric-cell"><CompactNumber value={trade.quantity} /></span>
                  <span role="cell" className="numeric-cell"><CurrencyAmount>{formatCurrency(trade.price)}</CurrencyAmount></span>
                  <span role="cell" className="numeric-cell"><CurrencyAmount>{formatCurrency(trade.total)}</CurrencyAmount></span>
                  <span role="cell" className="numeric-cell">{trade.side === 'sell' ? <><CurrencyAmount>{formatCurrency(trade.fee ?? 0)}</CurrencyAmount> / <CurrencyAmount>{formatCurrency(trade.netTotal ?? trade.total)}</CurrencyAmount></> : '—'}</span>
                  <span role="cell">{formatTime(trade.createdAt)}</span>
                </div>
              )}
            />
          )}
        </Panel>
      </div>
    </div>
  );

  return embedded ? detailContent : (
    <PageLayout
      title={<RegionalEntityPageTitle entityName={assetName} regionName={provinceName} />}
      backAction={{
        label: facilityAssetId ? '返回建筑详情' : '返回商品列表',
        onClick: returnToCatalog,
      }}
    >
      {detailContent}
    </PageLayout>
  );
}
