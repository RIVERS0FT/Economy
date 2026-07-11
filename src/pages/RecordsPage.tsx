import { orderStatusNames, type LoadedGameViewModel } from '../app/gameViewModel';
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
import { ledgerCategoryNames } from '../config/labels';
import { formatCurrency, formatTime } from '../utils/formatters';

function orderTone(status: string): StatusTone {
  if (status === 'filled') return 'success';
  if (status === 'partial') return 'warning';
  if (status === 'cancelled') return 'danger';
  return 'neutral';
}

export function RecordsPage({ model }: { model: LoadedGameViewModel }) {
  const { game, derived, cancelOrder, showResult } = model;
  const frozenInventory = Object.values(game.inventories).reduce((sum, inventory) => sum + inventory.frozen, 0);

  function productName(productId?: string) {
    if (!productId) return '工厂资产';
    return game.products.find((product) => product.id === productId)?.name ?? productId;
  }

  return (
    <PageLayout
      title="订单与记录"
      description="统一查看各商品订单、成交记录、冻结资产和服务器流水。"
    >
      <div className="records-grid">
        <Panel className="widget span-2">
          <WidgetHeading
            title="当前商品订单"
            action={<StatusTag>{derived.ownOpenOrders.length}/{economyConstants.maxOpenOrders}</StatusTag>}
          />
          <ScrollableTable>
            <table>
              <thead><tr><th>商品</th><th>方向</th><th className="numeric-cell">限价</th><th className="numeric-cell">剩余/原始</th><th>状态</th><th>提交时间</th><th /></tr></thead>
              <tbody>
                {derived.ownOpenOrders.map((order) => (
                  <tr key={order.id}>
                    <td><strong>{productName(order.productId)}</strong></td>
                    <td><StatusTag tone={order.side === 'buy' ? 'success' : 'danger'}>{order.side === 'buy' ? '买入' : '卖出'}</StatusTag></td>
                    <td className="numeric-cell">¤ {order.price}</td>
                    <td className="numeric-cell">{order.remaining}/{order.quantity}</td>
                    <td><StatusTag tone={orderTone(order.status)}>{orderStatusNames[order.status]}</StatusTag></td>
                    <td>{formatTime(order.createdAt)}</td>
                    <td><Button variant="compact" onClick={() => void showResult(cancelOrder(order.id))}>撤单</Button></td>
                  </tr>
                ))}
                {derived.ownOpenOrders.length === 0 ? <tr><td colSpan={7} className="empty-cell">暂无未完成商品订单。</td></tr> : null}
              </tbody>
            </table>
          </ScrollableTable>
        </Panel>

        <Panel className="widget">
          <WidgetHeading title="冻结资产" />
          <div className="frozen-cards">
            <MetricCard label="买单冻结资金" value={`¤ ${formatCurrency(game.frozenCredits)}`} tone="warning" />
            <MetricCard label="卖单冻结商品" value={frozenInventory} detail={`${game.products.filter((product) => (game.inventories[product.id]?.frozen ?? 0) > 0).length} 种商品`} tone="warning" />
            <MetricCard label="工厂挂牌" value={derived.ownListings.length} tone="info" />
          </div>
        </Panel>

        <Panel className="widget span-3">
          <WidgetHeading title="成交记录" action={<StatusTag>{game.trades.length} 笔</StatusTag>} />
          <ScrollableTable>
            <table>
              <thead><tr><th>资产</th><th>方向</th><th className="numeric-cell">数量</th><th className="numeric-cell">价格</th><th className="numeric-cell">总额</th><th>对手方</th><th>时间</th></tr></thead>
              <tbody>
                {game.trades.map((trade) => (
                  <tr key={trade.id}>
                    <td>{trade.type === 'facility' ? trade.description : productName(trade.productId)}</td>
                    <td><StatusTag tone={trade.side === 'buy' ? 'success' : 'danger'}>{trade.side === 'buy' ? '买入' : '卖出'}</StatusTag></td>
                    <td className="numeric-cell">{trade.quantity}</td>
                    <td className="numeric-cell">¤ {trade.price}</td>
                    <td className="numeric-cell">¤ {formatCurrency(trade.total)}</td>
                    <td>{trade.counterparty}</td>
                    <td>{formatTime(trade.createdAt)}</td>
                  </tr>
                ))}
                {game.trades.length === 0 ? <tr><td colSpan={7} className="empty-cell">暂无成交记录。</td></tr> : null}
              </tbody>
            </table>
          </ScrollableTable>
        </Panel>

        <Panel className="widget span-3">
          <WidgetHeading title="资产流水" action={<span className="muted">资金、商品、工厂和生产计划变化均由服务器记录</span>} />
          <div className="ledger-list">
            {game.ledger.map((entry) => (
              <div key={entry.id}>
                <span className="ledger-time">{formatTime(entry.createdAt)}</span>
                <div><strong>{entry.description}</strong><small>{ledgerCategoryNames[entry.category]}</small></div>
                <span className={entry.amount > 0 ? 'positive' : entry.amount < 0 ? 'negative' : ''}>
                  {entry.amount > 0 ? '+' : ''}{entry.amount ? `¤ ${entry.amount}` : '状态'}
                </span>
                <small>余额 ¤ {entry.balanceAfter}</small>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </PageLayout>
  );
}
