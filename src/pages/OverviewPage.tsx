import type { LoadedGameViewModel } from '../app/gameViewModel';
import { PriceSparkline } from '../components/charts/PriceSparkline';
import { EmptyState, PageLayout, Panel, WidgetHeading } from '../components/ui/layout';
import { economyConstants } from '../store/gameStore';
import { formatCurrency, formatDuration, formatTime } from '../utils/formatters';

export function OverviewPage({ model }: { model: LoadedGameViewModel }) {
  const { game, derived, workRemaining, work, showResult, setTab } = model;

  return (
    <PageLayout
      eyebrow="玩家指挥中心"
      title={<>早上好，{game.playerName}</>}
      description="观察市场、管理生产，并持续提高你的总资产排名。"
      actions={
        <>
          <span>未完成订单 {derived.ownOpenOrders.length}/{economyConstants.maxOpenOrders}</span>
          <button type="button" onClick={() => setTab('market')}>进入市场</button>
        </>
      }
    >
      <div className="home-grid">
        <Panel className="widget work-widget">
          <WidgetHeading eyebrow="基础工作" title="基础工作" action={<span className="widget-badge">兜底收入</span>} />
          <p>每次有效工作获得 ¤1。连续工作会提高冷却，停止 5 分钟后恢复基础档位。</p>
          <button className="work-compact-button" disabled={workRemaining > 0} onClick={() => showResult(work())}>
            <strong>{workRemaining > 0 ? formatDuration(workRemaining) : '开始工作'}</strong>
            <span>{workRemaining > 0 ? '等待冷却结束' : '获得 ¤ 1'}</span>
          </button>
          <div className="mini-stat-row"><span>连续档位 <strong>{game.work.streak || 0}/4</strong></span><span>累计工作 <strong>{game.work.totalClicks}</strong></span></div>
        </Panel>

        <Panel className="widget market-summary span-2">
          <WidgetHeading eyebrow="市场动态" title={`${game.commodityName}市场`} action={<button className="text-button" onClick={() => setTab('market')}>查看完整盘口 →</button>} />
          <div className="market-quote-grid">
            <div><span>最近成交</span><strong>¤ {game.marketPrice}</strong></div>
            <div><span>最高买价</span><strong className="positive">¤ {derived.bestBid || '--'}</strong></div>
            <div><span>最低卖价</span><strong className="negative">¤ {derived.bestAsk || '--'}</strong></div>
            <div><span>买卖价差</span><strong>¤ {derived.spread}</strong></div>
          </div>
          <PriceSparkline values={derived.history.slice(-24)} />
        </Panel>

        <Panel className="widget production-summary">
          <WidgetHeading eyebrow="生产概况" title="生产摘要" action={<button className="text-button" onClick={() => setTab('production')}>管理</button>} />
          <div className="summary-stack">
            <div><span>运行中的设施</span><strong>{derived.runningFacilities}</strong></div>
            <div><span>施工中的设施</span><strong>{derived.constructingFacilities}</strong></div>
            <div><span>待领取商品</span><strong>{derived.pendingGoods}</strong></div>
            <div><span>本小时预计产量</span><strong>{game.facilities.reduce((sum, facility) => sum + Math.floor(3_600_000 / facility.cycleMs) * facility.outputPerCycle, 0)}</strong></div>
          </div>
        </Panel>

        <Panel className="widget wealth-summary">
          <WidgetHeading eyebrow="财富变化" title="财富变化" action={<span className="rank-chip">第 {derived.currentRank?.rank ?? '--'} 名</span>} />
          <div className="wealth-total"><span>当前总资产</span><strong>¤ {formatCurrency(derived.totalAssets)}</strong></div>
          <div className="summary-stack compact">
            <div><span>现金资产</span><strong>¤ {formatCurrency(derived.cashValue)}</strong></div>
            <div><span>商品估值</span><strong>¤ {formatCurrency(derived.commodityValue)}</strong></div>
            <div><span>设施估值</span><strong>¤ {formatCurrency(derived.facilityValue)}</strong></div>
          </div>
        </Panel>

        <Panel className="widget recent-activity span-2">
          <WidgetHeading eyebrow="最近动态" title="最近成交与提醒" action={<button className="text-button" onClick={() => setTab('records')}>全部记录</button>} />
          <div className="activity-list">
            {game.trades.slice(0, 6).map((trade) => (
              <div key={trade.id}>
                <span><strong>{trade.description}</strong><small>{trade.counterparty} · {formatTime(trade.createdAt)}</small></span>
                <strong className={trade.side === 'sell' ? 'positive' : 'negative'}>{trade.side === 'sell' ? '+' : '-'}¤ {formatCurrency(trade.total)}</strong>
              </div>
            ))}
            {game.trades.length === 0 ? <EmptyState>暂无成交。进入市场提交你的第一笔订单。</EmptyState> : null}
          </div>
        </Panel>
      </div>
    </PageLayout>
  );
}
