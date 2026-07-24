import type {
  AdminPlayerStatistics as AdminPlayerStatisticsData,
  AdminPlayerStatisticsRange,
  ExtendedAdminSummary,
} from '../api/admin';
import { AdminPlayerStatistics } from './AdminPlayerStatistics';
import { AdminPopulationControl } from './AdminPopulationControl';
import { Button, EmptyState, MetricCard, Panel, WidgetHeading } from './ui/layout';

const RANGES: AdminPlayerStatisticsRange[] = ['7d', '30d', '90d'];

export function AdminOverview({
  summary,
  playerStatistics,
  playerStatisticsRange,
  playerStatisticsLoading,
  onPlayerStatisticsRangeChange,
  onPopulationChanged,
  onNotice,
}: {
  summary: ExtendedAdminSummary | null;
  playerStatistics: AdminPlayerStatisticsData | null;
  playerStatisticsRange: AdminPlayerStatisticsRange;
  playerStatisticsLoading: boolean;
  onPlayerStatisticsRangeChange: (range: AdminPlayerStatisticsRange) => void;
  onPopulationChanged: () => Promise<void>;
  onNotice: (message: string) => void;
}) {
  return (
    <div className="admin-section-stack admin-overview-console">
      <section className="admin-summary-grid" aria-label="世界概况">
        <MetricCard label="玩家数量" value={summary?.playerCount ?? '--'} />
        <MetricCard label="未完成订单" value={summary?.openOrderCount ?? '--'} />
        <MetricCard label="商品订单" value={summary?.commodityOrderCount ?? '--'} />
        <MetricCard label="工厂订单" value={summary?.facilityOrderCount ?? '--'} />
        <MetricCard label="进行中拍卖" value={summary?.openAuctionCount ?? '--'} />
        <MetricCard label="开放／履约合同" value={summary?.openContractCount ?? '--'} />
      </section>

      <Panel className="admin-panel admin-player-statistics-panel">
        <WidgetHeading
          title="玩家运营分析"
          action={(
            <div className="admin-player-statistics__range" role="group" aria-label="玩家统计时间范围">
              {RANGES.map((range) => (
                <Button
                  className={range === playerStatisticsRange ? 'is-active' : ''}
                  disabled={playerStatisticsLoading && range === playerStatisticsRange}
                  key={range}
                  variant="compact"
                  aria-pressed={range === playerStatisticsRange}
                  onClick={() => onPlayerStatisticsRangeChange(range)}
                >
                  {range.replace('d', ' 日')}
                </Button>
              ))}
            </div>
          )}
        />
        <AdminPlayerStatistics statistics={playerStatistics} loading={playerStatisticsLoading} />
      </Panel>

      <Panel className="admin-panel admin-population-economy">
        <WidgetHeading title="人口经济" />
        {summary?.populationEconomy ? (
          <AdminPopulationControl
            economy={summary.populationEconomy}
            onChanged={onPopulationChanged}
            onNotice={onNotice}
          />
        ) : <EmptyState>人口经济数据尚未初始化。</EmptyState>}
      </Panel>
    </div>
  );
}
