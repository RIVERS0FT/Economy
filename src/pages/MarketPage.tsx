import { type ChangeEvent, useState } from 'react';
import { orderStatusNames, type LoadedGameViewModel } from '../app/gameViewModel';
import { PriceSparkline } from '../components/charts/PriceSparkline';
import {
  Button,
  MetricCard,
  PageLayout,
  Panel,
  ScrollableTable,
  StatusTag,
  type StatusTone,
  WidgetHeading,
} from '../components/ui/layout';
import { economyConstants } from '../config/economy';
import type { CommodityOrder } from '../types';
import { formatCurrency, formatTime } from '../utils/formatters';

function orderTone(status: CommodityOrder['status']): StatusTone {
  if (status === 'filled') return 'success';
  if (status === 'partial') return 'warning';
  if (status === 'cancelled') return 'danger';
  return 'neutral';
}

export function MarketPage({ model }: { model: LoadedGameViewModel }) {
  const {
    game,
    derived,
    localTrades,
    selectedProductId,
    setSelectedProductId,
    orderSide,
    setOrderSide,
    orderQuantity,
    setOrderQuantity,
    orderPrice,
    setOrderPrice,
    placeCommodityOrder,
    cancelOrder,
    cancelFacilityListing,
    buyFacility,
    showResult,
  } = model;
  const [purchaseQuantities, setPurchaseQuantities] = useState<Record<string, number>>({});
  const selectedProduct = derived.selectedProduct;
  const selectedInventory = derived.selectedInventory;
  const selectedMarket = derived.selectedMarket;
  const frozenInventory = Object.values(game.inventories).reduce((sum, inventory) => sum + inventory.frozen, 0);
  const bestAsks = derived.asks.slice(0, 5).reverse();
  const bestBids = derived.bids.slice(0, 5);
  const maxBuyQuantity = orderPrice > 0
    ? Math.max(0, Math.min(game.warehouseAvailableCapacity, Math.floor(game.credits / orderPrice)))
    : 0;
  const maxSellQuantity = selectedInventory.available;
  const maxTradeQuantity = orderSide === 'buy' ? maxBuyQuantity : maxSellQuantity;
  const ownListingQuantity = derived.ownListings.reduce((sum, listing) => sum + listing.quantity, 0);

  function productName(productId?: string) {
    if (!productId) return '商品';
    return game.products.find((product) => product.id === productId)?.name ?? productId;
  }

  function facilityType(typeId: string) {
    return game.facilityTypes.find((type) => type.id === typeId);
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
    <PageLayout
      title="市场"
      description="完成商品限价交易、撤单和工厂数量交易；成交记录仅保存在当前浏览器。"
    >
      <div className="product-tabs" role="tablist" aria-label="选择商品市场">
        {game.products.map((product) => {
          const inventory = game.inventories[product.id] ?? { available: 0, frozen: 0 };
          const market = game.markets[product.id];
          return (
            <button
              type="button"
              role="tab"
              aria-selected={product.id === selectedProductId}
              className={product.id === selectedProductId ? 'product-tab active' : 'product-tab'}
              key={product.id}
              onClick={() => setSelectedProductId(product.id)}
            >
              <strong>{product.name}</strong>
              <span>¤ {market?.lastPrice ?? product.basePrice}</span>
              <small>持仓 {inventory.available}</small>
            </button>
          );
        })}
      </div>

      <div className="market-stat-strip panel">
        <MetricCard tone="success" label="买一价" value={`¤ ${derived.bestBid || '--'}`} />
        <MetricCard tone="danger" label="卖一价" value={`¤ ${derived.bestAsk || '--'}`} />
        <MetricCard label="价差" value={`¤ ${derived.spread}`} />
        <MetricCard label="可用持仓" value={selectedInventory.available} detail={`冻结 ${selectedInventory.frozen}`} />
        <MetricCard label="仓库剩余" value={game.warehouseAvailableCapacity} detail={`买单预占 ${game.warehouseReservedQuantity}`} />
      </div>

      <div className="market-grid">
        <Panel className="widget order-entry">
          <WidgetHeading
            title={`${selectedProduct.name}限价订单`}
            action={<StatusTag>{derived.ownSelectedOpenOrders.length} 笔未完成</StatusTag>}
          />
          <div className="ui-segmented" role="group" aria-label="订单方向">
            <Button
              variant="text"
              className={orderSide === 'buy' ? 'ui-segmented__button active' : 'ui-segmented__button'}
              aria-pressed={orderSide === 'buy'}
              onClick={() => setOrderSide('buy')}
            >
              买入
            </Button>
            <Button
              variant="text"
              className={orderSide === 'sell' ? 'ui-segmented__button active danger' : 'ui-segmented__button'}
              aria-pressed={orderSide === 'sell'}
              onClick={() => setOrderSide('sell')}
            >
              卖出
            </Button>
          </div>
          <label>
            限价
            <input
              type="number"
              min="1"
              value={orderPrice}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setOrderPrice(Number(event.target.value))}
            />
          </label>
          <label>
            数量
            <input
              type="number"
              min="1"
              max={Math.max(1, maxTradeQuantity)}
              value={orderQuantity}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setOrderQuantity(Number(event.target.value))}
            />
          </label>
          <div className="order-quick-fill" role="group" aria-label="快捷填写交易数量">
            <Button variant="compact" disabled={maxTradeQuantity < 1} onClick={() => fillQuickQuantity(0.25)}>1/4 仓</Button>
            <Button variant="compact" disabled={maxTradeQuantity < 1} onClick={() => fillQuickQuantity(0.5)}>1/2 仓</Button>
            <Button variant="compact" disabled={maxTradeQuantity < 1} onClick={() => fillQuickQuantity(1)}>全仓</Button>
          </div>
          <small className="ui-helper-text">
            {orderSide === 'buy'
              ? `买入快捷数量按资金与仓库剩余空间共同计算，当前最多 ${maxBuyQuantity}。`
              : `卖出快捷数量按当前${selectedProduct.name}可用库存计算，当前最多 ${maxSellQuantity}。`}
          </small>
          <div className="order-summary"><span>订单总额</span><strong>¤ {formatCurrency(orderQuantity * orderPrice)}</strong></div>
          <div className="order-capacity">
            <span>可用资金 ¤ {formatCurrency(game.credits)}</span>
            <span>仓库剩余 {game.warehouseAvailableCapacity}</span>
            <span>可用{selectedProduct.name} {selectedInventory.available}</span>
          </div>
          <Button
            block
            disabled={orderQuantity < 1 || orderQuantity > maxTradeQuantity}
            onClick={() => void showResult(placeCommodityOrder(orderSide, orderQuantity, orderPrice))}
          >
            提交{selectedProduct.name}{orderSide === 'buy' ? '买单' : '卖单'}
          </Button>

          <div className="inline-order-list" aria-label={`我的${selectedProduct.name}未完成订单`}>
            {derived.ownSelectedOpenOrders.map((order) => (
              <div key={order.id}>
                <span>
                  <StatusTag tone={order.side === 'buy' ? 'success' : 'danger'}>
                    {order.side === 'buy' ? '买入' : '卖出'}
                  </StatusTag>
                  <strong>¤ {order.price}</strong>
                  <small>{order.remaining}/{order.quantity}</small>
                </span>
                <Button variant="compact" onClick={() => void showResult(cancelOrder(order.id))}>撤单</Button>
              </div>
            ))}
            {derived.ownSelectedOpenOrders.length === 0 ? <p className="muted">当前商品没有未完成订单。</p> : null}
          </div>
        </Panel>

        <Panel className="widget order-book single-order-book">
          <WidgetHeading title={`${selectedProduct.name}订单簿`} />
          <div className="order-book-stack" aria-label={`${selectedProduct.name}买卖盘`}>
            <div className="order-book-side-label ask-label"><span>卖盘</span><small>最低价前 5 笔</small></div>
            {bestAsks.map((order) => (
              <div className="book-order-row ask" key={order.id}>
                <StatusTag tone="danger">卖</StatusTag>
                <strong>¤ {order.price}</strong>
                <span>{order.remaining}</span>
              </div>
            ))}
            {bestAsks.length === 0 ? <p className="muted">暂无卖单</p> : null}

            <div className="order-book-midpoint">
              <span>最近成交 <strong>¤ {selectedMarket.lastPrice}</strong></span>
              <span>价差 <strong>¤ {derived.spread}</strong></span>
            </div>

            {bestBids.map((order) => (
              <div className="book-order-row bid" key={order.id}>
                <StatusTag tone="success">买</StatusTag>
                <strong>¤ {order.price}</strong>
                <span>{order.remaining}</span>
              </div>
            ))}
            {bestBids.length === 0 ? <p className="muted">暂无买单</p> : null}
            <div className="order-book-side-label bid-label"><span>买盘</span><small>最高价前 5 笔</small></div>
          </div>
        </Panel>

        <Panel className="widget market-chart-card">
          <WidgetHeading
            title={`${selectedProduct.name}近期成交曲线`}
            action={
              <StatusTag tone={derived.marketTrend >= 0 ? 'success' : 'danger'}>
                {derived.marketTrend >= 0 ? '+' : ''}{derived.marketTrend}
              </StatusTag>
            }
          />
          <PriceSparkline values={derived.history} />
          <div className="chart-footer">
            <span>成交样本 {selectedMarket.priceHistory.length}</span>
            <span>当前订单 {derived.ownSelectedOpenOrders.length} 笔</span>
            <span>需求满足率 {Math.round(selectedMarket.demand.satisfaction * 100)}%</span>
          </div>
        </Panel>

        <Panel className="widget span-3 market-account-panel">
          <WidgetHeading
            title="我的订单与成交"
            action={<StatusTag>{derived.ownOpenOrders.length}/{economyConstants.maxOpenOrders} 笔未完成</StatusTag>}
          />
          <div className="market-account-summary">
            <MetricCard label="冻结资金" value={`¤ ${formatCurrency(game.frozenCredits)}`} tone="warning" />
            <MetricCard label="冻结商品" value={frozenInventory} detail={`${game.products.filter((product) => (game.inventories[product.id]?.frozen ?? 0) > 0).length} 种商品`} tone="warning" />
            <MetricCard label="未完成订单" value={`${derived.ownOpenOrders.length}/${economyConstants.maxOpenOrders}`} />
            <MetricCard label="我的工厂挂牌" value={`${ownListingQuantity} 座`} tone="info" />
          </div>

          <div className="market-account-grid">
            <section>
              <h3>未完成订单</h3>
              <ScrollableTable>
                <table>
                  <thead><tr><th>商品</th><th>方向</th><th className="numeric-cell">限价</th><th className="numeric-cell">剩余/原始</th><th className="numeric-cell">冻结资产</th><th>状态</th><th>时间</th><th /></tr></thead>
                  <tbody>
                    {derived.ownOpenOrders.map((order) => (
                      <tr key={order.id}>
                        <td><strong>{productName(order.productId)}</strong></td>
                        <td><StatusTag tone={order.side === 'buy' ? 'success' : 'danger'}>{order.side === 'buy' ? '买入' : '卖出'}</StatusTag></td>
                        <td className="numeric-cell">¤ {order.price}</td>
                        <td className="numeric-cell">{order.remaining}/{order.quantity}</td>
                        <td className="numeric-cell">{order.side === 'buy' ? `¤ ${formatCurrency(order.remaining * order.price)}` : `${order.remaining} ${productName(order.productId)}`}</td>
                        <td><StatusTag tone={orderTone(order.status)}>{orderStatusNames[order.status]}</StatusTag></td>
                        <td>{formatTime(order.createdAt)}</td>
                        <td><Button variant="compact" onClick={() => void showResult(cancelOrder(order.id))}>撤单</Button></td>
                      </tr>
                    ))}
                    {derived.ownOpenOrders.length === 0 ? <tr><td colSpan={8} className="empty-cell">暂无未完成订单。</td></tr> : null}
                  </tbody>
                </table>
              </ScrollableTable>
            </section>

            <section>
              <h3>本地成交记录</h3>
              <p className="ui-helper-text">仅保存在当前浏览器；更换设备或清除网站数据后不会恢复。</p>
              <ScrollableTable>
                <table>
                  <thead><tr><th>资产</th><th>方向</th><th className="numeric-cell">数量</th><th className="numeric-cell">价格</th><th className="numeric-cell">总额</th><th>来源</th><th>时间</th></tr></thead>
                  <tbody>
                    {localTrades.map((trade) => (
                      <tr key={trade.id}>
                        <td>{trade.type === 'facility' ? trade.description : productName(trade.productId)}</td>
                        <td><StatusTag tone={trade.side === 'buy' ? 'success' : 'danger'}>{trade.side === 'buy' ? '买入' : '卖出'}</StatusTag></td>
                        <td className="numeric-cell">{trade.quantity}</td>
                        <td className="numeric-cell">¤ {formatCurrency(trade.price)}</td>
                        <td className="numeric-cell">¤ {formatCurrency(trade.total)}</td>
                        <td>{trade.counterparty}</td>
                        <td>{formatTime(trade.createdAt)}</td>
                      </tr>
                    ))}
                    {localTrades.length === 0 ? <tr><td colSpan={7} className="empty-cell">当前浏览器暂无成交记录。</td></tr> : null}
                  </tbody>
                </table>
              </ScrollableTable>
            </section>
          </div>
        </Panel>

        <Panel className="widget span-3">
          <WidgetHeading title="工厂数量市场" action={<span className="muted">按类型、数量和单座价格完成产权交易</span>} />
          <div className="listing-grid">
            {game.facilityListings.map((listing) => {
              const type = facilityType(listing.facilityTypeId);
              const purchaseQuantity = Math.min(
                Math.max(1, purchaseQuantities[listing.id] ?? 1),
                listing.quantity,
              );
              return (
                <article className="listing-card" key={listing.id}>
                  <div>
                    <StatusTag tone={listing.ownerId === game.userId ? 'info' : 'neutral'}>
                      {listing.ownerId === game.userId ? '我的挂牌' : '可收购'}
                    </StatusTag>
                    <h3>{type?.name ?? listing.facilityTypeId} × {listing.quantity}</h3>
                    <p>{listing.ownerName} · 单座 ¤ {formatCurrency(listing.unitPrice)}</p>
                  </div>
                  <div className="listing-specs ui-spec-grid">
                    <span>周期 <strong>{(type?.cycleMs ?? 0) / 1000} 秒</strong></span>
                    <span>周期产量 <strong>{type?.output.quantity ?? 0} {productName(type?.output.productId)}</strong></span>
                    <span>周期成本 <strong>¤ {type?.operatingCost ?? 0}</strong></span>
                    <span>原料 <strong>{type?.input ? `${type.input.quantity} ${productName(type.input.productId)}` : '无需原料'}</strong></span>
                  </div>
                  {listing.ownerId === game.userId ? (
                    <div className="listing-price">
                      <strong>挂牌总额 ¤ {formatCurrency(listing.quantity * listing.unitPrice)}</strong>
                      <Button variant="danger" onClick={() => void showResult(cancelFacilityListing(listing.id))}>撤销全部</Button>
                    </div>
                  ) : (
                    <div className="listing-purchase-control">
                      <label>
                        购买数量
                        <input
                          type="number"
                          min="1"
                          max={listing.quantity}
                          value={purchaseQuantity}
                          onChange={(event) => setPurchaseQuantities((current) => ({
                            ...current,
                            [listing.id]: Number(event.target.value),
                          }))}
                        />
                      </label>
                      <div><span>总价</span><strong>¤ {formatCurrency(purchaseQuantity * listing.unitPrice)}</strong></div>
                      <Button onClick={() => void showResult(buyFacility(listing.id, purchaseQuantity))}>购买 {purchaseQuantity} 座</Button>
                    </div>
                  )}
                </article>
              );
            })}
            {game.facilityListings.length === 0 ? <p className="empty-state">暂无工厂挂牌。</p> : null}
          </div>
        </Panel>
      </div>
    </PageLayout>
  );
}
