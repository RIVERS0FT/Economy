import { useEffect, useRef, useState } from 'react';
import { orderStatusNames, type LoadedGameViewModel } from '../app/gameViewModel';
import { PriceSparkline } from '../components/charts/PriceSparkline';
import { FactoryIcon } from '../components/icons/GameIcons';
import { ProductIcon, ProductIconLabel } from '../components/icons/ProductIcons';
import { CurrencyAmount } from '../components/ui/CurrencyAmount';
import { IntegerInput } from '../components/ui/FormControls';
import {
  Button,
  PageLayout,
  Panel,
  ScrollableTable,
  StatusTag,
  type StatusTone,
  WidgetHeading,
} from '../components/ui/layout';
import { VirtualList } from '../components/ui/VirtualList';
import { economyConstants } from '../config/economy';
import type { AssetOrder } from '../types';
import { formatCurrency, formatNumber, formatTime } from '../utils/formatters';
import { parseIntegerDraft } from '../utils/integerDraft';
import {
  buildMarketHistoryBuckets,
  countMarketHistoryPointsInWindow,
  summarizeMarketFlow,
} from '../utils/marketHistory';
import { buildOrderBookLevels } from '../utils/orderBookLevels';
import { orderAssetId, orderKind } from '../utils/orderIdentity';

function orderTone(status: AssetOrder['status']): StatusTone {
  if (status === 'filled') return 'success';
  if (status === 'partial') return 'warning';
  if (status === 'cancelled') return 'danger';
  return 'neutral';
}

export function MarketPage({ model }: { model: LoadedGameViewModel }) {
  const {
    game,
    now,
    localTrades,
    marketAssetKind,
    marketAssetId,
    selectMarketAsset,
    orderSide,
    selectOrderSide,
    orderQuantity,
    setOrderQuantity,
    orderPrice,
    setOrderPrice,
    placeAssetOrder,
    cancelOrder,
    showResult,
  } = model;
  const assetDirectoryRef = useRef<HTMLDivElement>(null);
  const [priceDraft, setPriceDraft] = useState(String(orderPrice));
  const [quantityDraft, setQuantityDraft] = useState(String(orderQuantity));

  const selectedProduct = marketAssetKind === 'commodity'
    ? game.products.find((product) => product.id === marketAssetId) ?? game.products[0]
    : undefined;
  const selectedFacility = marketAssetKind === 'facility'
    ? game.facilityTypes.find((facility) => facility.id === marketAssetId) ?? game.facilityTypes[0]
    : undefined;
  const selectedGroup = selectedFacility
    ? game.facilityGroups.find((group) => group.facilityTypeId === selectedFacility.id)
    : undefined;
  const selectedInventory = selectedProduct
    ? game.inventories[selectedProduct.id] ?? { available: 0, frozen: 0 }
    : { available: 0, frozen: 0 };
  const selectedMarket = selectedProduct
    ? game.markets[selectedProduct.id]
    : selectedFacility ? game.facilityMarkets[selectedFacility.id] : undefined;
  const assetName = selectedProduct?.name ?? selectedFacility?.name ?? '资产';
  const assetId = selectedProduct?.id ?? selectedFacility?.id ?? marketAssetId;
  const selectedOrders = game.orders.filter((order) => (
    orderKind(order) === marketAssetKind
    && orderAssetId(order) === assetId
    && ['open', 'partial'].includes(order.status)
  ));
  const ownSelectedOrders = selectedOrders.filter((order) => order.isOwn);
  const ownOpenOrders = game.orders.filter((order) => (
    order.isOwn && ['open', 'partial'].includes(order.status)
  ));
  const bestAsks = buildOrderBookLevels(selectedOrders, 'sell').reverse();
  const bestBids = buildOrderBookLevels(selectedOrders, 'buy');
  const marketHistory = selectedMarket?.priceHistory ?? [];
  const marketFallbackPrice = selectedMarket?.lastPrice
    ?? selectedProduct?.basePrice
    ?? selectedFacility?.systemValue
    ?? 1;
  const marketBuckets = buildMarketHistoryBuckets(marketHistory, marketFallbackPrice, now);
  const marketHistoryCount = countMarketHistoryPointsInWindow(marketHistory, now);
  const marketFlow = summarizeMarketFlow(marketBuckets);
  const marketTrend = marketBuckets[marketBuckets.length - 1].price - marketBuckets[0].price;
  const trendTone: StatusTone = marketTrend > 0 ? 'success' : marketTrend < 0 ? 'danger' : 'neutral';
  const parsedOrderPrice = parseIntegerDraft(priceDraft, { min: 1 });
  const effectiveOrderPrice = parsedOrderPrice ?? 0;
  const maxBuyQuantity = effectiveOrderPrice > 0
    ? marketAssetKind === 'commodity'
      ? Math.max(0, Math.min(game.warehouseAvailableCapacity, Math.floor(game.credits / effectiveOrderPrice)))
      : Math.max(0, Math.floor(game.credits / effectiveOrderPrice))
    : 0;
  const maxSellQuantity = marketAssetKind === 'commodity'
    ? selectedInventory.available
    : selectedGroup?.availableCount ?? 0;
  const maxTradeQuantity = orderSide === 'buy' ? maxBuyQuantity : maxSellQuantity;
  const parsedOrderQuantity = parseIntegerDraft(quantityDraft, { min: 1 });
  const orderTotal = Math.max(0, (parsedOrderQuantity ?? 0) * effectiveOrderPrice);
  const estimatedSellFee = orderSide === 'sell' && orderTotal > 0
    ? Math.max(1, Math.ceil(orderTotal / 100))
    : 0;
  const estimatedNetTotal = Math.max(0, orderTotal - estimatedSellFee);

  const availabilityReason = parsedOrderPrice === null
    ? '请输入不低于 1 的整数价格。'
    : orderSide === 'buy'
      ? game.credits < parsedOrderPrice
        ? `可用资金不足，当前价格至少需要 ${formatCurrency(parsedOrderPrice)}。`
        : marketAssetKind === 'commodity' && game.warehouseAvailableCapacity < 1
          ? '仓库剩余空间不足，无法提交商品买单。'
          : undefined
      : marketAssetKind === 'commodity'
        ? selectedInventory.available < 1
          ? `当前没有可出售的${assetName}。`
          : undefined
        : (selectedGroup?.availableCount ?? 0) < 1
          ? `当前没有可出售的${assetName}。`
          : undefined;
  const quantityReason = availabilityReason === undefined
    ? parsedOrderQuantity === null
      ? '数量必须是不低于 1 的整数。'
      : parsedOrderQuantity > maxTradeQuantity
        ? `数量超过当前可交易上限 ${formatNumber(maxTradeQuantity)}。`
        : undefined
    : undefined;
  const orderDisabledReason = availabilityReason ?? quantityReason;

  useEffect(() => {
    const active = assetDirectoryRef.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    active?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [assetId, marketAssetKind]);

  useEffect(() => {
    setPriceDraft(String(orderPrice));
  }, [orderPrice]);

  useEffect(() => {
    setQuantityDraft(String(orderQuantity));
  }, [orderQuantity]);

  function updatePriceDraft(value: string) {
    setPriceDraft(value);
    const parsed = parseIntegerDraft(value, { min: 1 });
    if (parsed !== null) setOrderPrice(parsed);
  }

  function updateQuantityDraft(value: string) {
    setQuantityDraft(value);
    const parsed = parseIntegerDraft(value, { min: 1, max: maxTradeQuantity > 0 ? maxTradeQuantity : undefined });
    if (parsed !== null) setOrderQuantity(parsed);
  }

  function assetLabel(order: AssetOrder) {
    const id = orderAssetId(order);
    if (orderKind(order) === 'facility') return game.facilityTypes.find((type) => type.id === id)?.name ?? id;
    const productName = game.products.find((product) => product.id === id)?.name ?? id;
    return <ProductIconLabel productId={id}>{productName}</ProductIconLabel>;
  }

  function selectedAssetTitle(label: string) {
    return selectedProduct
      ? <ProductIconLabel productId={selectedProduct.id}>{label}</ProductIconLabel>
      : label;
  }

  function quickQuantity(fraction: number) {
    if (maxTradeQuantity <= 0) return 0;
    if (fraction >= 1) return maxTradeQuantity;
    return Math.max(1, Math.floor(maxTradeQuantity * fraction));
  }

  function fillQuickQuantity(fraction: number) {
    const quantity = quickQuantity(fraction);
    if (quantity > 0) {
      setOrderQuantity(quantity);
      setQuantityDraft(String(quantity));
    }
  }

  function scrollAssetDirectory(direction: -1 | 1) {
    const directory = assetDirectoryRef.current;
    if (!directory) return;
    directory.scrollBy({ left: direction * directory.clientWidth * 0.82, behavior: 'smooth' });
  }

  function submitOrder() {
    if (orderDisabledReason || parsedOrderPrice === null || parsedOrderQuantity === null) return;
    void showResult(placeAssetOrder(marketAssetKind, assetId, orderSide, parsedOrderQuantity, parsedOrderPrice));
  }

  return (
    <PageLayout title="市场" description="商品与工厂使用相同的订单簿、价格优先和时间优先规则。">
      <div className="market-page-surface">
        <div className="asset-directory-shell">
          <Button
            variant="compact"
            className="asset-directory-control asset-directory-control--previous"
            aria-label="向前浏览资产"
            onClick={() => scrollAssetDirectory(-1)}
          >‹</Button>
          <div ref={assetDirectoryRef} className="unified-asset-tabs" role="tablist" aria-label="选择交易资产">
            <span className="asset-directory-divider" role="presentation" aria-hidden="true">商品</span>
            {game.products.map((product) => {
              const inventory = game.inventories[product.id] ?? { available: 0, frozen: 0 };
              const active = marketAssetKind === 'commodity' && product.id === assetId;
              return (
                <button
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-label={`${product.name}${active ? '，当前选择' : ''}`}
                  data-current={active ? '当前' : undefined}
                  className={active ? 'unified-asset-tab active' : 'unified-asset-tab'}
                  key={`commodity-${product.id}`}
                  onClick={() => selectMarketAsset('commodity', product.id)}
                >
                  <span className="asset-kind-icon" aria-hidden="true"><ProductIcon productId={product.id} /></span>
                  <strong>{product.name}</strong>
                  <span><CurrencyAmount>{formatCurrency(game.markets[product.id]?.lastPrice ?? product.basePrice)}</CurrencyAmount></span>
                  <small>持仓 {formatNumber(inventory.available)}</small>
                </button>
              );
            })}
            <span className="asset-directory-divider asset-directory-divider--facility" role="presentation" aria-hidden="true">工厂</span>
            {game.facilityTypes.map((facility) => {
              const group = game.facilityGroups.find((item) => item.facilityTypeId === facility.id);
              const active = marketAssetKind === 'facility' && facility.id === assetId;
              return (
                <button
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-label={`${facility.name}${active ? '，当前选择' : ''}`}
                  data-current={active ? '当前' : undefined}
                  className={active ? 'unified-asset-tab facility active' : 'unified-asset-tab facility'}
                  key={`facility-${facility.id}`}
                  onClick={() => selectMarketAsset('facility', facility.id)}
                >
                  <span className="asset-kind-icon" aria-hidden="true"><FactoryIcon /></span>
                  <strong>{facility.name}</strong>
                  <span><CurrencyAmount>{formatCurrency(game.facilityMarkets[facility.id]?.lastPrice ?? facility.systemValue)}</CurrencyAmount></span>
                  <small>持有 {formatNumber(group?.count ?? 0)}</small>
                </button>
              );
            })}
          </div>
          <Button
            variant="compact"
            className="asset-directory-control asset-directory-control--next"
            aria-label="向后浏览资产"
            onClick={() => scrollAssetDirectory(1)}
          >›</Button>
        </div>

        <div className="market-grid unified-market-grid">
          <Panel className="widget order-entry">
            <WidgetHeading
              title={selectedAssetTitle(`${assetName}订单`)}
              action={<StatusTag>{formatNumber(ownSelectedOrders.length)} 笔未完成</StatusTag>}
            />
            <div className="ui-segmented" role="group" aria-label="订单方向">
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
            <IntegerInput
              label="价格"
              value={priceDraft}
              fallbackValue={orderPrice}
              min={1}
              error={parsedOrderPrice === null ? '请输入不低于 1 的整数价格。' : undefined}
              onValueChange={updatePriceDraft}
              onKeyDown={(event) => { if (event.key === 'Enter') submitOrder(); }}
            />
            <IntegerInput
              label="数量"
              value={quantityDraft}
              fallbackValue={Math.min(Math.max(1, orderQuantity), Math.max(1, maxTradeQuantity))}
              min={1}
              max={maxTradeQuantity > 0 ? maxTradeQuantity : undefined}
              disabled={maxTradeQuantity < 1}
              error={quantityReason}
              aria-describedby={orderDisabledReason ? 'order-disabled-reason' : undefined}
              onValueChange={updateQuantityDraft}
              onKeyDown={(event) => { if (event.key === 'Enter') submitOrder(); }}
            />
            <div className="order-quick-fill" role="group" aria-label="快捷填写交易数量">
              <Button variant="compact" disabled={maxTradeQuantity < 1} onClick={() => fillQuickQuantity(0.25)}>1/4 仓</Button>
              <Button variant="compact" disabled={maxTradeQuantity < 1} onClick={() => fillQuickQuantity(0.5)}>1/2 仓</Button>
              <Button variant="compact" disabled={maxTradeQuantity < 1} onClick={() => fillQuickQuantity(1)}>全仓</Button>
            </div>
            <div className="order-summary"><span>订单总额</span><strong><CurrencyAmount>{formatCurrency(orderTotal)}</CurrencyAmount></strong></div>
            {orderSide === 'sell' ? (
              <>
                <div className="order-summary"><span>预计手续费（1%，最低 1）</span><strong><CurrencyAmount>{formatCurrency(estimatedSellFee)}</CurrencyAmount></strong></div>
                <div className="order-summary"><span>预计到账</span><strong><CurrencyAmount>{formatCurrency(estimatedNetTotal)}</CurrencyAmount></strong></div>
                {orderTotal > 0 && estimatedNetTotal === 0 ? <p className="order-disabled-reason">成交额将全部用于支付最低手续费。</p> : null}
              </>
            ) : null}
            <div className="order-capacity">
              <span>可用资金 <CurrencyAmount>{formatCurrency(game.credits)}</CurrencyAmount></span>
              {marketAssetKind === 'commodity' ? (
                <>
                  <span>仓库剩余 {formatNumber(game.warehouseAvailableCapacity)}</span>
                  <span>可用{assetName} {formatNumber(selectedInventory.available)}</span>
                  <span>冻结{assetName} {formatNumber(selectedInventory.frozen)}</span>
                </>
              ) : (
                <>
                  <span>持有 {formatNumber(selectedGroup?.count ?? 0)} 座</span>
                  <span>卖单冻结 {formatNumber(selectedGroup?.listedCount ?? 0)} 座</span>
                  <span>当前参与 {formatNumber(selectedGroup?.participatingCount ?? 0)} 座</span>
                </>
              )}
            </div>
            {orderDisabledReason ? <p id="order-disabled-reason" className="order-disabled-reason" role="status">{orderDisabledReason}</p> : null}
            <Button block disabled={Boolean(orderDisabledReason)} onClick={submitOrder}>
              提交{assetName}{orderSide === 'buy' ? '买单' : '卖单'}
            </Button>
            <div className="inline-order-list" aria-label={`我的${assetName}未完成订单`}>
              {ownSelectedOrders.map((order) => (
                <div key={order.id}>
                  <span>
                    <StatusTag tone={order.side === 'buy' ? 'success' : 'danger'}>{order.side === 'buy' ? '买入' : '卖出'}</StatusTag>
                    <strong><CurrencyAmount>{formatCurrency(order.price)}</CurrencyAmount></strong>
                    <small>{formatNumber(order.remaining)}/{formatNumber(order.quantity)}</small>
                  </span>
                  <Button variant="compact" onClick={() => void showResult(cancelOrder(order.id))}>撤单</Button>
                </div>
              ))}
              {ownSelectedOrders.length === 0 ? <p className="muted">当前资产没有未完成订单。</p> : null}
            </div>
          </Panel>

          <Panel className="widget order-book single-order-book">
            <WidgetHeading title={selectedAssetTitle(`${assetName}订单簿`)} />
            <div className="order-book-stack" aria-label={`${assetName}买卖盘`}>
              <div className="order-book-side-label ask-label"><span>卖盘</span><small>最低价前 5 档</small></div>
              {bestAsks.map((level) => (
                <div
                  className="book-order-row ask"
                  key={`sell-${level.price}`}
                  aria-label={`卖盘，价格 ${formatCurrency(level.price)}，合计剩余 ${formatNumber(level.remaining)}，包含 ${formatNumber(level.orderCount)} 笔订单`}
                  data-order-count={level.orderCount}
                >
                  <StatusTag tone="danger">卖</StatusTag>
                  <strong><CurrencyAmount>{formatCurrency(level.price)}</CurrencyAmount></strong>
                  <span>{formatNumber(level.remaining)}</span>
                </div>
              ))}
              {bestAsks.length === 0 ? <p className="muted order-book-empty">暂无卖单</p> : null}
              <div className="order-book-divider" aria-hidden="true" />
              <div className="order-book-side-label bid-label"><span>买盘</span><small>最高价前 5 档</small></div>
              {bestBids.map((level) => (
                <div
                  className="book-order-row bid"
                  key={`buy-${level.price}`}
                  aria-label={`买盘，价格 ${formatCurrency(level.price)}，合计剩余 ${formatNumber(level.remaining)}，包含 ${formatNumber(level.orderCount)} 笔订单`}
                  data-order-count={level.orderCount}
                >
                  <StatusTag tone="success">买</StatusTag>
                  <strong><CurrencyAmount>{formatCurrency(level.price)}</CurrencyAmount></strong>
                  <span>{formatNumber(level.remaining)}</span>
                </div>
              ))}
              {bestBids.length === 0 ? <p className="muted order-book-empty">暂无买单</p> : null}
            </div>
          </Panel>

          <Panel className="widget market-chart-card">
            <WidgetHeading
              title={selectedAssetTitle(`${assetName}近 24h 成交趋势`)}
              action={(
                <StatusTag tone={trendTone} className="market-trend-tag">
                  <CurrencyAmount sign={marketTrend > 0 ? '+' : undefined}>{formatCurrency(marketTrend)}</CurrencyAmount>
                </StatusTag>
              )}
            />
            <PriceSparkline buckets={marketBuckets} variant="full" />
            <div className="chart-footer">
              <span>最近 24h {formatNumber(marketHistoryCount)} 笔 · 6m × 240</span>
              <span>估值买价 <CurrencyAmount>{game.valuationPrices[`${marketAssetKind}:${assetId}`] ? formatCurrency(game.valuationPrices[`${marketAssetKind}:${assetId}`]) : '--'}</CurrencyAmount></span>
              <span>{marketFlow.netVolume > 0
                ? `净主动买入 ${formatNumber(marketFlow.netVolume)}`
                : marketFlow.netVolume < 0
                  ? `净主动卖出 ${formatNumber(Math.abs(marketFlow.netVolume))}`
                  : '主动买卖均衡／方向未知'}</span>
              <span>我的当前订单 {formatNumber(ownSelectedOrders.length)} 笔</span>
            </div>
          </Panel>

          <Panel className="widget span-3 market-account-panel">
            <WidgetHeading title="我的订单与成交" action={<StatusTag>{formatNumber(ownOpenOrders.length)}/{formatNumber(economyConstants.maxOpenOrders)} 笔未完成</StatusTag>} />
            <div className="market-account-grid">
              <section>
                <h3>未完成订单</h3>
                <ScrollableTable>
                  <table>
                    <thead><tr><th>类型</th><th>资产</th><th>方向</th><th className="numeric-cell">价格</th><th className="numeric-cell">剩余/原始</th><th>状态</th><th>时间</th><th /></tr></thead>
                    <tbody>
                      {ownOpenOrders.map((order) => (
                        <tr key={order.id}>
                          <td>{orderKind(order) === 'facility' ? '工厂' : '商品'}</td>
                          <td><strong>{assetLabel(order)}</strong></td>
                          <td><StatusTag tone={order.side === 'buy' ? 'success' : 'danger'}>{order.side === 'buy' ? '买入' : '卖出'}</StatusTag></td>
                          <td className="numeric-cell"><CurrencyAmount>{formatCurrency(order.price)}</CurrencyAmount></td>
                          <td className="numeric-cell">{formatNumber(order.remaining)}/{formatNumber(order.quantity)}</td>
                          <td><StatusTag tone={orderTone(order.status)}>{orderStatusNames[order.status]}</StatusTag></td>
                          <td>{formatTime(order.createdAt)}</td>
                          <td><Button variant="compact" onClick={() => void showResult(cancelOrder(order.id))}>撤单</Button></td>
                        </tr>
                      ))}
                      {ownOpenOrders.length === 0 ? <tr><td colSpan={8} className="empty-cell">暂无未完成订单。</td></tr> : null}
                    </tbody>
                  </table>
                </ScrollableTable>
              </section>

              <section className="local-trades-section">
                <h3>本地成交记录</h3>
                {localTrades.length === 0 ? <p className="muted">当前浏览器暂无成交记录。</p> : (
                  <div className="virtual-record-table local-trades-virtual-table" role="table" aria-label="本地成交记录">
                    <div className="virtual-record-header" role="row">
                      <span role="columnheader">类型</span><span role="columnheader">资产</span><span role="columnheader">方向</span><span role="columnheader" className="numeric-cell">数量</span><span role="columnheader" className="numeric-cell">价格</span><span role="columnheader" className="numeric-cell">总额</span><span role="columnheader" className="numeric-cell">手续费 / 实收</span><span role="columnheader">时间</span>
                    </div>
                    <VirtualList
                      items={localTrades}
                      getKey={(trade) => trade.id}
                      estimateSize={54}
                      viewportHeight={520}
                      minViewportHeight={96}
                      overscan={6}
                      gap={0}
                      className="virtual-record-viewport"
                      role="rowgroup"
                      itemRole="presentation"
                      ariaLabel="本地成交记录行"
                      renderItem={(trade) => (
                        <div className="virtual-record-row" role="row">
                          <span role="cell">{trade.type === 'facility' ? '工厂' : '商品'}</span>
                          <span role="cell">{trade.type === 'commodity' && trade.productId
                            ? <ProductIconLabel productId={trade.productId}>{trade.description}</ProductIconLabel>
                            : trade.description}</span>
                          <span role="cell"><StatusTag tone={trade.side === 'buy' ? 'success' : 'danger'}>{trade.side === 'buy' ? '买入' : '卖出'}</StatusTag></span>
                          <span role="cell" className="numeric-cell">{formatNumber(trade.quantity)}</span>
                          <span role="cell" className="numeric-cell"><CurrencyAmount>{formatCurrency(trade.price)}</CurrencyAmount></span>
                          <span role="cell" className="numeric-cell"><CurrencyAmount>{formatCurrency(trade.total)}</CurrencyAmount></span>
                          <span role="cell" className="numeric-cell">{trade.side === 'sell' ? <><CurrencyAmount>{formatCurrency(trade.fee ?? 0)}</CurrencyAmount> / <CurrencyAmount>{formatCurrency(trade.netTotal ?? trade.total)}</CurrencyAmount></> : '—'}</span>
                          <span role="cell">{formatTime(trade.createdAt)}</span>
                        </div>
                      )}
                    />
                  </div>
                )}
              </section>
            </div>
          </Panel>
        </div>
      </div>
    </PageLayout>
  );
}
