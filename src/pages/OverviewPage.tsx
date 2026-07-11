import type { LoadedGameViewModel } from '../app/gameViewModel';
import { PriceSparkline } from '../components/charts/PriceSparkline';
import {
  Button,
  DataList,
  DataRow,
  EmptyState,
  MetricCard,
  PageLayout,
  Panel,
  StatusTag,
  WidgetHeading,
} from '../components/ui/layout';
import { economyConstants } from '../config/economy';
import { formatCurrency, formatDuration, formatTime } from '../utils/formatters';

export function OverviewPage({ model }: { model: LoadedGameViewModel }) {
  const { game, derived, workRemaining, work, showResult, setTab } = model;
  const plannedFacilities = game.facilities.filter((facility) => facility.productionMode === 'target').length;
  const pendingPlans = game.facilities.reduce((sum, facility) => (
    facility.productionMode === 'target'
      ? sum + Math.max(0, (facility.targetQuantity || 0) - facility.completedQuantity)
      : sum
  ), 0);

  return (
    <PageLayout
      title={<>早上好，{game.playerName}</>}
      description="管理多商品产业链、手动控制工厂，并通过独立市场提高总资产排名。"
      actions={
        <>
          <StatusTag>{`未完成订单 ${derived.ownOpenOrders.length}/${economyConstants.maxOpenOrders}`}</StatusTag>
          <Button onClick={() => setTab('market')}>进入市场</Button>
        </>
      }
    >
      <div className="home-grid">
        <Panel className="widget work-widget">
          <WidgetHeading title="基础工作" action={<StatusTag tone="success">兜底收入</StatusTag>} />
          <p>每次有效工作获得 ¤1。连续工作会提高冷却，停止 5 分钟后恢复基础档位。</p>
          <Button
            block
            className="work-compact-button"
            disabled={workRemaining > 0}
            onClick={() => void showResult(work())}
          >
            <strong>{workRemaining > 0 ? formatDuration(workRemaining) : '开始工作'}</strong>
            <span>{workRemaining > 0 ? '等待冷却结束' : '获得 ¤ 1'}</span>
          </Button>
          <div className="mini-stat-row">
            <span>连续档位 <strong>{game.work.streak || 0}/4</strong></span>
            <span>累计工作 <strong>{game.work.totalClicks}</strong></span>
          </div>
        </Panel>

        <Panel className="widget market-summary span-2">
          <WidgetHeading
            title={`${derived.selectedProduct.name}市场`}
            action={<Button variant="text" onClick={() => setTab('market')}>查看全部商品 →</Button>}
          />
          <div className="market-quote-grid">
            <MetricCard label="最近成交" value={`¤ ${derived.selectedMarket.lastPrice}`} />
            <MetricCard tone="success" label="最高买价" value={`¤ ${derived.bestBid || '--'}`} />
            <MetricCard tone="danger" label="最低卖价" value={`¤ ${derived.bestAsk || '--'}`} />
            <MetricCard label="持仓" value={derived.selectedInventory.available} detail={`冻结 ${derived.selectedInventory.frozen}`} />
          </div>
          <PriceSparkline values={derived.history.slice(-24)} />
          <div className="overview-product-strip">
            {game.products.map((product) => (
              <button
                type="button"
                key={product.id}
                onClick={() => {
                  model.setSelectedProductId(product.id);
                  setTab('market');
                }}
              >
                <span>{product.name}</span>
                <strong>¤ {game.markets[product.id]?.lastPrice ?? product.basePrice}</strong>
              </button>
            ))}
          </div>
        </Panel>

        <Panel className="widget production-summary">
          <WidgetHeading
            title="生产摘要"
            action={<Button variant="text" onClick={() => setTab('production')}>管理工厂</Button>}
          />
          <DataList>
            <DataRow label="运行中的工厂" value={derived.runningFacilities} tone="success" />
            <DataRow label="已停止的工厂" value={derived.stoppedFacilities} />
            <DataRow label="阻塞的工厂" value={derived.blockedFacilities} tone={derived.blockedFacilities ? 'danger' : 'neutral'} />
            <DataRow label="施工中的工厂" value={derived.constructingFacilities} tone="warning" />
            <DataRow label="定量计划" value={`${plannedFacilities} 个 / 剩余 ${pendingPlans}`} tone="info" />
            <DataRow label="待领取产成品" value={derived.pendingGoods} />
          </DataList>
        </Panel>

        <Panel className="widget wealth-summary">
          <WidgetHeading
            title="财富构成"
            action={<StatusTag tone="warning">第 {derived.currentRank?.rank ?? '--'} 名</StatusTag>}
          />
          <MetricCard
            tone="success"
            className="wealth-total"
            label="当前总资产"
            value={`¤ ${formatCurrency(derived.totalAssets)}`}
          />
          <DataList className="compact">
            <DataRow label="现金资产" value={`¤ ${formatCurrency(derived.cashValue)}`} />
            <DataRow label="商品估值" value={`¤ ${formatCurrency(derived.commodityValue)}`} />
            <DataRow label="工厂估值" value={`¤ ${formatCurrency(derived.facilityValue)}`} />
          </DataList>
        </Panel>

        <Panel className="widget recent-activity span-2">
          <WidgetHeading
            title="最近成交与提醒"
            action={<Button variant="text" onClick={() => setTab('records')}>全部记录</Button>}
          />
          <div className="activity-list">
            {game.trades.slice(0, 6).map((trade) => (
              <div key={trade.id}>
                <span><strong>{trade.description}</strong><small>{trade.counterparty} · {formatTime(trade.createdAt)}</small></span>
                <strong className={trade.side === 'sell' ? 'positive' : 'negative'}>
                  {trade.side === 'sell' ? '+' : '-'}¤ {formatCurrency(trade.total)}
                </strong>
              </div>
            ))}
            {game.trades.length === 0 ? <EmptyState>暂无成交。进入市场提交你的第一笔商品订单。</EmptyState> : null}
          </div>
        </Panel>
      </div>
    </PageLayout>
  );
}
