import { useMemo } from 'react';
import { LiveServerTime } from './time/LiveServerTime';
import { EmptyState, Panel } from './ui/layout';
import type { EconomicCalendarEvent, ProductDefinition, ProductMarketState } from '../types';
import { formatDuration, formatNumber, formatTime } from '../utils/formatters';
import { eventMarketFeedback } from '../utils/marketDecisionSignals';

function signedPercentBps(value: number | null) {
  if (value === null) return '暂无足够成交';
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${(Math.abs(value) / 100).toFixed(1)}%`;
}

export function EconomicEventLogPanel({
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
        <Panel className="widget economic-event-log-panel">
          <h2 className="economic-event-log-title">公开经济事件</h2>
          <div className="economic-event-log-list" role="list" aria-label="近期与未来七天经济事件">
            {events.map((event) => {
              const completed = event.endsAt <= now;
              const active = event.startsAt <= now && now < event.endsAt;
              const upcoming = now < event.startsAt;
              const remaining = active ? event.endsAt - now : event.startsAt - now;
              const timingLabel = upcoming
                ? `距离开始还有 ${formatDuration(Math.max(0, remaining))}`
                : active
                  ? `正在进行 · 距离结束还有 ${formatDuration(Math.max(0, remaining))}`
                  : '已经结束';
              const productLabels = event.productIds.map((id) => productNames.get(id) || id).join('、');
              const feedback = completed
                ? eventMarketFeedback(markets, event.productIds, event.startsAt, event.endsAt)
                : null;

              return (
                <details
                  className={`economic-event-log-entry${active ? ' is-active' : ''}${completed ? ' is-completed' : ''}`}
                  key={event.id}
                  role="listitem"
                >
                  <summary>
                    <strong>{event.title}</strong>
                    <span>{timingLabel}</span>
                  </summary>
                  <div className="economic-event-log-details">
                    <p>{event.description}</p>
                    <dl>
                      <div>
                        <dt>状态</dt>
                        <dd>{active ? '生效中' : completed ? '已结束' : '即将开始'}</dd>
                      </div>
                      <div>
                        <dt>开始</dt>
                        <dd><time dateTime={new Date(event.startsAt).toISOString()}>{formatTime(event.startsAt)}</time></dd>
                      </div>
                      <div>
                        <dt>结束</dt>
                        <dd><time dateTime={new Date(event.endsAt).toISOString()}>{formatTime(event.endsAt)}</time></dd>
                      </div>
                    </dl>
                    <small>重点类别：{event.classLabels.join('、')}</small>
                    <small>重点商品：{productLabels}</small>
                    <small>事件只调整既有人口直接需求的选择权重，人口总预算与货币发行保持不变。</small>
                    {completed && feedback ? (
                      <span className="economic-event-log-feedback">
                        事件窗口真实成交 {formatNumber(feedback.volume)} 件 · 平均价格变化 {signedPercentBps(feedback.averageChangeBps)}
                      </span>
                    ) : null}
                  </div>
                </details>
              );
            })}
            {events.length === 0 ? <EmptyState>近期与未来七天暂无已公布的经济事件。</EmptyState> : null}
          </div>
        </Panel>
      )}
    </LiveServerTime>
  );
}