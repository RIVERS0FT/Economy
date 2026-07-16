import { type ChangeEvent } from 'react';
import { orderAssetId, orderKind, orderStatusNames, type LoadedGameViewModel } from '../app/gameViewModel';
import { PriceSparkline } from '../components/charts/PriceSparkline';
import { FactoryIcon } from '../components/icons/GameIcons';
import { ProductIcon, ProductIconLabel } from '../components/icons/ProductIcons';
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
import { buildMarketHistoryBuckets } from '../utils/marketHistory';

function orderTone(status: AssetOrder['status']): StatusTone {
  if (status === 'filled') return 'success';
  if (status === 'partial') return 'warning';
  if (status === 'cancelled') return 'danger';
  return 'neutral';
}

export function MarketPage({ model }: { model: LoadedGameViewModel }) {
  const {
    game,
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
  const ownSelectedOrders = selectedOrders.filter((order) => order.ownerId === game.userId);
  const ownOpenOrders = game.orders.filter((order) => (
    order.ownerId === game.userId && ['open', 'partial'].includes(order.status)
  ));
  const bestAsks = selectedOrders
    .filter((order) => order.side === 'sell')
    .sort((a, b) => a.price - b.price || a.createdAt - b.createdAt)
    .slice(0, 5)
    .reverse();
  const bestBids = selectedOrders
    .filter((order) => order.side === 'buy')
    .sort((a, b) => b.price - a.price || a.createdAt - b.createdAt)
    .slice(0, 5);
  const marketHistory = selectedMarket?.priceHistory ?? [];
  const marketFallbackPrice = selectedMarket?.lastPrice
    ?? selectedProduct?.basePrice
    ?? selectedFacility?.systemValue
    ?? 1;
  const marketBuckets = buildMarketHistoryBuckets(marketHistory, marketFallbackPrice);
  const marketTrend = marketBuckets[marketBuckets.length - 1].price - marketBuckets[0].price;
  const maxBuyQuantity = orderPrice > 0
    ? marketAssetKind === 'commodity'
      ? Math.max(0, Math.min(game.warehouseAvailableCapacity, Math.floor(game.credits / orderPrice)))
      : Math.max(0, Math.floor(game.credits / orderPrice))
    : 0;
  const maxSellQuantity = marketAssetKind === 'commodity'
    ? selectedInventory.available
    : selectedGroup?.availableCount ?? 0;
  const maxTradeQuantity = orderSide === 'buy' ? maxBuyQuantity : maxSellQuantity;

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
    if (quantity > 0) setOrderQuantity(quantity);
  }

  return (
    <PageLayout title="市场" description="商品与工厂使用相同的订单簿、价格优先和时间优先规则。">
      <div className="unified-asset-tabs" role="tablist" aria-label="选择交易资产">
        {game.products.map((product) => {
          const inventory = game.inventories[product.id] ?? { available: 0, frozen: 0 };
          const active = marketAssetKind === 'commodity' && product.id === assetId;
          return (
            <button
              type="button"
              role="tab"
              aria-selected={active}
              className={active ? 'unified-asset-tab active' : 'unified-asset-tab'}
              key={`commodity-${product.id}`}
              onClick={() => selectMarketAsset('commodity', product.id)}
            >
              <span className="asset-kind-icon" aria-hidden="true"><ProductIcon productId={product.id} /></span>
              <strong>{product.name}</strong>
              <span>¤ {formatCurrency(game.markets[product.id]?.lastPrice ?? product.basePrice)}</span>
              <small>持仓 {formatNumber(inventory.available)}</small>
            </button>
          );
        })}
        {game.facilityTypes.map((facility) => {
          const group = game.facilityGroups.find((item) => item.facilityTypeId === facility.id);
          const active = marketAssetKind === 'facility' && facility.id === assetId;
          return (
            <button
              type="button"
              role="tab"
              aria-selected={active}
              className={active ? 'unified-asset-tab facility active' : 'unified-asset-tab facility'}
              key={`facility-${facility.id}`}
              onClick={() => selectMarketAsset('facility', facility.id)}
            >
              <span className="asset-kind-icon" aria-hidden="true"><FactoryIcon /></span>
              <strong>{facility.name}</strong>
              <span>¤ {formatCurrency(game.facilityMarkets[facility.id]?.lastPrice ?? facility.systemValue)}</span>
              <small>持有 {formatNumber(group?.count ?? 0)}</small>
            </button>
          );
        })}
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
          <label>
            价格
            <input type="number" min="1" value={orderPrice} onChange={(event: ChangeEvent<HTMLInputElement>) => setOrderPrice(Number(event.target.value))} />
          </label>
          <label>
            数量
            <input type="number" min="1" max={Math.max(1, maxTradeQuantity)} value={orderQuantity} onChange={(event: ChangeEvent<HTMLInputElement>) => setOrderQuantity(Number(event.target.value))} />
          </label>
          <div className="order-quick-fill" role="group" aria-label="快捷填写交易数量">
            <Button variant="compact" disabled={maxTradeQuantity < 1} onClick={() => fillQuickQuantity(0.25)}>1/4 仓</Button>
            <Button variant="compact" disabled={maxTradeQuantity < 1} onClick={() => fillQuickQuantity(0.5)}>1/2 仓</Button>
            <Button variant="compact" disabled={maxTradeQuantity < 1} onClick={() => fillQuickQuantity(1)}>全仓</Button>
          </div>
          <div className="order-summary"><span>订单总额</span><strong>¤ {formatCurrency(orderQuantity * orderPrice)}</strong></div>
          <div className="order-capacity">
            <span>可用资金 ¤ {formatCurrency(game.credits)}</span>
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
          <Button
            block
            disabled={orderQuantity < 1 || orderQuantity > maxTradeQuantity}
            onClick={() => void showResult(placeAssetOrder(marketAssetKind, assetId, orderSide, orderQuantity, orderPrice))}
          >提交{assetName}{orderSide === 'buy' ? '买单' : '卖单'}</Button>
          <div className="inline-order-list" aria-label={`我的${assetName}未完成订单`}>
            {ownSelectedOrders.map((order) => (
              <div key={order.id}>
                <span>
                  <StatusTag tone={order.side === 'buy' ? 'success' : 'danger'}>{order.side === 'buy' ? '买入' : '卖出'}</StatusTag>
                  <strong>¤ {formatCurrency(order.price)}</strong>
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
            <div className="order-book-side-label ask-label"><span>卖盘</span><small>最低价前 5 笔</small></div>
            {bestAsks.map((order) => (
              <div className="book-order-row ask" key={order.id}><StatusTag tone="danger">卖</StatusTag><strong>¤ {formatCurrency(order.price)}</strong><span>{formatNumber(order.remaining)}</span></div>
            ))}
            {bestAsks.length === 0 ? <p className="muted">暂无卖单</p> : null}
            <div className="order-book-divider" aria-hidden="true" />
            {bestBids.map((order) => (
              <div className="book-order-row bid" key={order.id}><StatusTag tone="success">买</StatusTag><strong>¤ {formatCurrency(order.price)}</strong><span>{formatNumber(order.remaining)}</span></div>
            ))}
            {bestBids.length === 0 ? <p className="muted">暂无买单</p> : null}
            <div className="order-book-side-label bid-label"><span>买盘</span><small>最高价前 5 笔</small></div>
          </div>
        </Panel>

        <Panel className="widget market-chart-card">
          <WidgetHeading
            title={selectedAssetTitle(`${assetName}近 24h 成交趋势`)}
            action={<StatusTag tone={marketTrend >= 0 ? 'success' : 'danger'}>{marketTrend >= 0 ? '+' : ''}{formatCurrency(marketTrend)}</StatusTag>}
          />
          <PriceSparkline buckets={marketBuckets} />
          <div className="chart-footer">
            <span>24h · 6m × 240（{formatNumber(marketHistory.length)} 笔）</span>
            <span>我的当前订单 {formatNumber(ownSelectedOrders.length)} 笔</span>
            <span>估值买价 ¤ {game.valuationPrices[`${marketAssetKind}:${assetId}`] ? formatCurrency(game.valuationPrices[`${marketAssetKind}:${assetId}`]) : '--'}</span>
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
                        <td className="numeric-cell">¤ {formatCurrency(order.price)}</td>
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
                    <span role="columnheader">类型</span><span role="columnheader">资产</span><span role="columnheader">方向</span><span role="columnheader" className="numeric-cell">数量</span><span role="columnheader" className="numeric-cell">价格</span><span role="columnheader" className="numeric-cell">总额</span><span role="columnheader">来源</span><span role="columnheader">时间</span>
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
                        <span role="cell" className="numeric-cell">¤ {formatCurrency(trade.price)}</span>
                        <span role="cell" className="numeric-cell">¤ {formatCurrency(trade.total)}</span>
                        <span role="cell">{trade.counterparty}</span>
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
    </PageLayout>
  );
}
