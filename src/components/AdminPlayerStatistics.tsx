import type { ReactNode } from 'react';
import type {
  AdminPlayerStatistics as AdminPlayerStatisticsData,
  AdminPlayerStatisticsAttention,
} from '../api/admin';
import { formatCurrency, formatDate } from '../utils/formatters';
import { CurrencyAmount } from './ui/CurrencyAmount';
import { EmptyState, StatusTag, type StatusTone } from './ui/layout';

function formatPercentBps(value: number) {
  const percent = Math.max(0, Number(value) || 0) / 100;
  if (percent === 0) return '0%';
  if (percent < 0.1) return '<0.1%';
  if (percent < 10) return `${percent.toFixed(1)}%`;
  return `${Math.round(percent)}%`;
}


function attentionTone(item: AdminPlayerStatisticsAttention): StatusTone {
  if (item.tone === 'danger') return 'danger';
  if (item.tone === 'warning') return 'warning';
  return 'neutral';
}

function Metric({ label, value, detail }: { label: string; value: ReactNode; detail?: ReactNode }) {
  return (
    <article className="admin-player-statistics__metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </article>
  );
}

function RatioBar({ value, label }: { value: number; label: string }) {
  const normalized = Math.max(0, Math.min(10_000, Number(value) || 0));
  const hasValue = normalized > 0;
  return (
    <span className="admin-player-statistics__bar" role="img" aria-label={`${label} ${formatPercentBps(normalized)}`}>
      <span style={{ width: hasValue ? `max(4px, ${normalized / 100}%)` : '0%' }} />
    </span>
  );
}

function Amount({ value }: { value: number }) {
  return <CurrencyAmount>{formatCurrency(value)}</CurrencyAmount>;
}

export function AdminPlayerStatistics({
  statistics,
  loading,
}: {
  statistics: AdminPlayerStatisticsData | null;
  loading: boolean;
}) {
  if (!statistics) {
    return <EmptyState>{loading ? '正在读取玩家运营统计…' : '玩家运营统计尚未初始化。'}</EmptyState>;
  }

  const { snapshot, activity, retention, funnel, participation, wealth, acquisition } = statistics;
  const maxTrend = Math.max(
    1,
    ...statistics.series.flatMap((point) => [point.activePlayers || 0, point.newPlayers || 0]),
  );
  const compositionTotal = Math.max(1, wealth.composition.total);
  const composition = [
    ['现金', wealth.composition.cash],
    ['商品', wealth.composition.commodities],
    ['工厂', wealth.composition.facilities],
  ] as const;

  return (
    <div className="admin-player-statistics" data-loading={loading ? 'true' : undefined}>
      <section className="admin-player-statistics__coverage" aria-label="统计覆盖范围">
        <div>
          <strong>{statistics.range.days} 日玩家运营视图</strong>
          <small>
            北京时间 · 生成于 {formatDate(statistics.generatedAt)} · 精确日活动自 {formatDate(statistics.coverageStartsAt)} 起记录
          </small>
        </div>
        <StatusTag tone={statistics.range.completeHistory ? 'success' : 'warning'}>
          {statistics.range.completeHistory ? '历史完整' : '部分历史'}
        </StatusTag>
      </section>

      <section className="admin-player-statistics__metrics" aria-label="玩家运营快照">
        <Metric label="总玩家" value={snapshot.totalPlayers} detail={`今日新增 ${snapshot.newToday}`} />
        <Metric label="24 小时经济活跃" value={snapshot.active24h} detail="只统计成功经济写操作" />
        <Metric label="7 日经济活跃" value={snapshot.active7d} detail={`活跃率 ${formatPercentBps(snapshot.activeRate7dBps)}`} />
        <Metric label="30 日经济活跃" value={snapshot.active30d} detail={`沉睡 ${snapshot.dormant30d}`} />
        <Metric label="区间新增" value={snapshot.registeredInRange} detail={`已激活 ${snapshot.activatedInRange}`} />
        <Metric label="新玩家激活率" value={formatPercentBps(snapshot.activationRateBps)} detail="首次成功经济操作" />
        <Metric label="区间活跃玩家" value={activity.activePlayersInRange} detail={`日均 ${activity.averageDailyActive}`} />
        <Metric label="活跃峰值" value={activity.peakDailyActive} detail={activity.peakDay || '暂无完整日数据'} />
      </section>

      <section className="admin-player-statistics__two-column">
        <article className="admin-player-statistics__card admin-player-statistics__trend-card">
          <header>
            <div><h3>新增与经济活跃趋势</h3><small>空心柱为新增，实心柱为成功经济操作玩家</small></div>
            <span>{activity.productionParticipantsInRange} 人生产 · {activity.tradeParticipantsInRange} 人成交</span>
          </header>
          <div className="admin-player-statistics__trend" role="img" aria-label={`${statistics.range.days} 日新增与经济活跃趋势`}>
            {statistics.series.map((point) => {
              const activeHeight = point.activePlayers === null ? 0 : point.activePlayers / maxTrend * 100;
              const newHeight = point.newPlayers / maxTrend * 100;
              return (
                <div className="admin-player-statistics__trend-day" key={point.day} title={`${point.day} · 新增 ${point.newPlayers} · 活跃 ${point.activePlayers ?? '未覆盖'}`}>
                  <span className="admin-player-statistics__trend-bars">
                    <i className="new" style={{ height: point.newPlayers > 0 ? `max(3px, ${newHeight}%)` : '0%' }} />
                    <i className="active" style={{ height: point.activePlayers && point.activePlayers > 0 ? `max(3px, ${activeHeight}%)` : '0%' }} />
                    {!point.covered ? <i className="uncovered" /> : null}
                  </span>
                  <small>{point.day.slice(5)}</small>
                </div>
              );
            })}
          </div>
        </article>

        <article className="admin-player-statistics__card">
          <header><div><h3>留存</h3><small>注册后目标北京时间自然日内至少一次成功经济操作</small></div></header>
          <div className="admin-player-statistics__retention">
            {([
              ['D1', retention.d1],
              ['D7', retention.d7],
              ['D30', retention.d30],
            ] as const).map(([label, row]) => (
              <div key={label}>
                <span><strong>{label}</strong><small>{row.retained}/{row.eligible} 人</small></span>
                <b>{row.eligible > 0 ? formatPercentBps(row.rateBps) : '覆盖不足'}</b>
                <RatioBar value={row.rateBps} label={`${label} 留存`} />
              </div>
            ))}
          </div>
          <div className="admin-player-statistics__acquisition">
            <h4>区间注册来源</h4>
            <dl>
              <div><dt>直接建档</dt><dd>{acquisition.direct}</dd></div>
              <div><dt>分享链接</dt><dd>{acquisition.shareLink}</dd></div>
              <div><dt>手动邀请码</dt><dd>{acquisition.manualCode}</dd></div>
              <div><dt>奖励被阻止</dt><dd>{acquisition.blocked}</dd></div>
            </dl>
          </div>
        </article>
      </section>

      <section className="admin-player-statistics__two-column">
        <article className="admin-player-statistics__card">
          <header><div><h3>经营成长漏斗</h3><small>阶段人数使用当前权威状态与已记录里程碑，耗时只统计精确时间</small></div></header>
          <div className="admin-player-statistics__funnel">
            {funnel.stages.map((stage) => (
              <div key={stage.id}>
                <span><strong>{stage.label}</strong><small>{stage.medianHours === null ? '历史耗时待积累' : `中位 ${stage.medianHours} 小时`}</small></span>
                <b>{stage.count}</b>
                <RatioBar value={stage.conversionBps} label={`${stage.label}阶段转化`} />
                <small>相邻转化 {formatPercentBps(stage.conversionBps)}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="admin-player-statistics__card">
          <header><div><h3>当前经营参与</h3><small>只读诊断，不参与人口需求预算或排行榜</small></div></header>
          <div className="admin-player-statistics__participation">
            {participation.rows.map((row) => (
              <div key={row.id}>
                <span><strong>{row.label}</strong><small>{row.count}/{snapshot.totalPlayers}</small></span>
                <RatioBar value={row.shareBps} label={row.label} />
                <b>{formatPercentBps(row.shareBps)}</b>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="admin-player-statistics__two-column">
        <article className="admin-player-statistics__card">
          <header><div><h3>财富分布</h3><small>商品与工厂只按最近一次订单簿真实成交价估值</small></div></header>
          <section className="admin-player-statistics__wealth-summary">
            <Metric label="玩家财富总额" value={<Amount value={wealth.total} />} />
            <Metric label="人均／中位" value={<><Amount value={wealth.average} />／<Amount value={wealth.median} /></>} />
            <Metric label="P90／P99" value={<><Amount value={wealth.p90} />／<Amount value={wealth.p99} /></>} />
            <Metric label="前 10% 占比" value={formatPercentBps(wealth.top10ShareBps)} detail={`前 1% ${formatPercentBps(wealth.top1ShareBps)}`} />
          </section>
          <div className="admin-player-statistics__composition">
            {composition.map(([label, value]) => {
              const shareBps = ratioBps(value, compositionTotal);
              return <div key={label}><span><strong>{label}</strong><small><Amount value={value} /> · {formatPercentBps(shareBps)}</small></span><RatioBar value={shareBps} label={`${label}资产占比`} /></div>;
            })}
            <div><span><strong>冻结资产</strong><small>{formatPercentBps(wealth.frozenShareBps)} · 与资产类别重叠</small></span><RatioBar value={wealth.frozenShareBps} label="冻结资产占比" /></div>
          </div>
          <div className="admin-player-statistics__wealth-brackets">
            {wealth.brackets.map((row) => <div key={row.id}><span>{row.label}</span><strong>{row.count}</strong></div>)}
          </div>
          {wealth.unpricedAssetPlayers > 0 ? <small className="admin-player-statistics__note">{wealth.unpricedAssetPlayers} 名玩家持有尚无真实成交估值的商品或工厂。</small> : null}
        </article>

        <article className="admin-player-statistics__card">
          <header><div><h3>需要关注的玩家群体</h3><small>客观条件聚合，不返回邮箱、IP、邀请码或交易对手</small></div></header>
          <div className="admin-player-statistics__attention">
            {statistics.attention.map((item) => (
              <div key={item.id}>
                <span><StatusTag tone={attentionTone(item)}>{item.count}</StatusTag><strong>{item.label}</strong></span>
                <small>{item.count === 0 ? '当前无玩家命中' : `占总玩家 ${formatPercentBps(ratioBps(item.count, snapshot.totalPlayers))}`}</small>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}

function ratioBps(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Math.max(0, Math.min(10_000, Math.round(numerator / denominator * 10_000)));
}
