import { orderStatusNames, type LoadedGameViewModel } from '../app/gameViewModel';
import { PageLayout, Panel, ScrollableTable, WidgetHeading } from '../components/ui/layout';
import { ledgerCategoryNames } from '../config/labels';
import { economyConstants } from '../store/gameStore';
import { formatTime } from '../utils/formatters';

export function RecordsPage({ model }: { model: LoadedGameViewModel }) {
  const { game, derived, cancelOrder } = model;

  return (
    <PageLayout
      eyebrow="订单与记录"
      title="订单与记录"
      description="统一查看当前订单、历史成交和资金资产流水。"
    >
      <div className="records-grid">
        <Panel className="widget span-2">
          <WidgetHeading eyebrow="当前订单" title="当前商品订单" action={<span>{derived.ownOpenOrders.length}/{economyConstants.maxOpenOrders}</span>} />
          <ScrollableTable>
            <table>
              <thead><tr><th>方向</th><th>限价</th><th>剩余/原始</th><th>状态</th><th>提交时间</th><th /></tr></thead>
              <tbody>
                {derived.ownOpenOrders.map((order) => (
                  <tr key={order.id}>
                    <td><span className={order.side === 'buy' ? 'side-buy' : 'side-sell'}>{order.side === 'buy' ? '买入' : '卖出'}</span></td>
                    <td>¤ {order.price}</td><td>{order.remaining}/{order.quantity}</td><td>{orderStatusNames[order.status]}</td><td>{formatTime(order.createdAt)}</td>
                    <td><button className="table-button" onClick={() => cancelOrder(order.id)}>撤单</button></td>
                  </tr>
                ))}
                {derived.ownOpenOrders.length === 0 ? <tr><td colSpan={6} className="empty-cell">暂无未完成商品订单。</td></tr> : null}
              </tbody>
            </table>
          </ScrollableTable>
        </Panel>

        <Panel className="widget">
          <h2>冻结资产</h2>
          <div className="frozen-cards"><div><span>买单冻结资金</span><strong>¤ {game.frozenCredits}</strong></div><div><span>卖单冻结库存</span><strong>{game.frozenInventory}</strong></div><div><span>设施挂牌</span><strong>{derived.ownListings.length}</strong></div></div>
        </Panel>

        <Panel className="widget span-3">
          <WidgetHeading eyebrow="成交记录" title="成交记录" action={<span>{game.trades.length} 笔</span>} />
          <ScrollableTable>
            <table>
              <thead><tr><th>资产</th><th>方向</th><th>数量</th><th>价格</th><th>总额</th><th>对手方</th><th>时间</th></tr></thead>
              <tbody>
                {game.trades.map((trade) => (
                  <tr key={trade.id}>
                    <td>{trade.type === 'facility' ? trade.description : game.commodityName}</td>
                    <td><span className={trade.side === 'buy' ? 'side-buy' : 'side-sell'}>{trade.side === 'buy' ? '买入' : '卖出'}</span></td>
                    <td>{trade.quantity}</td><td>¤ {trade.price}</td><td>¤ {trade.total}</td><td>{trade.counterparty}</td><td>{formatTime(trade.createdAt)}</td>
                  </tr>
                ))}
                {game.trades.length === 0 ? <tr><td colSpan={7} className="empty-cell">暂无成交记录。</td></tr> : null}
              </tbody>
            </table>
          </ScrollableTable>
        </Panel>

        <Panel className="widget span-3">
          <WidgetHeading eyebrow="资产流水" title="资产流水" action={<span className="muted">资金、库存与产权变化均可追溯</span>} />
          <div className="ledger-list">
            {game.ledger.map((entry) => (
              <div key={entry.id}>
                <span className="ledger-time">{formatTime(entry.createdAt)}</span>
                <div><strong>{entry.description}</strong><small>{ledgerCategoryNames[entry.category]}</small></div>
                <span className={entry.amount > 0 ? 'positive' : entry.amount < 0 ? 'negative' : ''}>{entry.amount > 0 ? '+' : ''}{entry.amount ? `¤ ${entry.amount}` : '状态'}</span>
                <small>余额 ¤ {entry.balanceAfter}</small>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </PageLayout>
  );
}
