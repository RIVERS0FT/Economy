import { useMemo } from 'react';
import { LiveServerTime } from '../../components/time/LiveServerTime';
import { Button, EmptyState, Panel, StatusTag, WidgetHeading } from '../../components/ui/layout';
import type { EconomicCalendarEvent, ProductDefinition, ProductMarketState } from '../../types';
import { formatDuration, formatNumber, formatTime } from '../../utils/formatters';
import { eventMarketFeedback } from '../../utils/marketDecisionSignals';

function signedPercentBps(value: number | null) {
  if (value === null) return '暂无足够成交';
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${(Math.abs(value) / 100).toFixed(1)}%`;
}

export function OverviewWorkButton({
  referenceNow,
  cooldownUntil,
  isWorking,
  onWork,
}: {
  referenceNow: number;
  cooldownUntil: number;
  isWorking: boolean;
  onWork: () => void;
}) {
  return (
    <LiveServerTime referenceNow={referenceNow}>
      {(now) => {
        const remaining = Math.max(0, cooldownUntil - now);
        return (
          <Button
            variant="secondary"
            className="overview-work-button"
            disabled={isWorking || remaining > 0}
            onClick={onWork}
          >
            {isWorking ? '处理中…' : remaining > 0 ? formatDuration(remaining) : '开始工作'}
          </Button>
        );
      }}
    </LiveServerTime>
  );
}

export function OverviewEconomicCalendarPanel({
  events,
  products,
  markets,
  referenceNow,
}: {
  events: EconomicCalendarEvent[];
  products: ProductDefinition[];
  markets: Record<string, ProductMarketState>;
  referenceNow: number;
}) {
  const productNames = useMemo(
    () => new Map(products.map((product) => [product.id, product.name])),
    [products],
  );
  return (
    <LiveServerTime referenceNow={referenceNow}>
      {(now) => (
        <Panel className="widget overview-economic-calendar-panel">
          <WidgetHeading
            title="公开经济事件日历"
            action={<StatusTag tone="info">近期结果 + 未来 7 天</StatusTag>}
          />
          <p className="overview-economic-calendar-note">
            事件只调整既有人口直接需求的类别与商品选择权重；人口总预算、直接／派生预算、市场储备和货币发行均保持不变。
          </p>
          <div className="overview-economic-event-list" role="list" aria-label="近期与未来七天公开经济事件">
            {events.map((event) => {
              const completed = event.endsAt <= now;
              const active = event.startsAt <= now && now < event.endsAt;
              const upcoming = now < event.startsAt;
              const remaining = active ? event.endsAt - now : event.startsAt - now;
              const productLabels = event.productIds.map((id) => productNames.get(id) || id).join('、');
              const feedback = completed ? eventMarketFeedback(markets, event.productIds, event.startsAt, event.endsAt) : null;
              return (
                <article className={`overview-economic-event${active ? ' is-active' : ''}${completed ? ' is-completed' : ''}`} key={event.id} role="listitem">
                  <header>
                    <StatusTag tone={active ? 'success' : completed ? 'neutral' : 'info'}>{active ? '生效中' : completed ? '已结束' : '即将开始'}</StatusTag>
                    <time dateTime={new Date(event.startsAt).toISOString()}>{formatTime(event.startsAt)}</time>
                  </header>
                  <strong>{event.title}</strong>
                  <p>{event.description}</p>
                  <small>重点类别：{event.classLabels.join('、')} · 重点商品：{productLabels}</small>
                  {completed && feedback ? (
                    <span className="overview-economic-event-feedback">
                      事件窗口真实成交 {formatNumber(feedback.volume)} 件 · 平均价格变化 {signedPercentBps(feedback.averageChangeBps)}
                    </span>
                  ) : (
                    <span>{active ? '距离结束' : upcoming ? '距离开始' : '等待服务器更新'} {formatDuration(Math.max(0, remaining))}</span>
                  )}
                </article>
              );
            })}
            {events.length === 0 ? <EmptyState>近期与未来七天暂无已公布的经济事件。</EmptyState> : null}
          </div>
        </Panel>
      )}
    </LiveServerTime>
  );
}
