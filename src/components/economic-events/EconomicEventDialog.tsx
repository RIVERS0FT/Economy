import { useId, useLayoutEffect, useRef, useState } from 'react';
import { ECONOMIC_EVENT_ARTWORK, ECONOMIC_EVENT_FALLBACK_ARTWORK } from '../../economic-events/artwork';
import { economicEventPhase, economicEventScopeLabel, type PresentedEconomicEvent } from '../../economic-events/presentation';
import type { ProductDefinition } from '../../types';
import { formatDuration, formatTime } from '../../utils/formatters';
import { LiveServerTime } from '../time/LiveServerTime';
import { CompactNumber } from '../ui/CompactNumber';
import { PageHeader } from '../ui/layout';
import { ScrollArea } from '../ui/ScrollArea';

function EventArtwork({ event }: { event?: PresentedEconomicEvent }) {
  const [failed, setFailed] = useState(false);
  const source = ECONOMIC_EVENT_ARTWORK[event?.templateId ?? ''] ?? ECONOMIC_EVENT_FALLBACK_ARTWORK;
  return (
    <div className="economic-event-dialog__art" data-event-artwork={event?.templateId ?? 'fallback'}>
      <img
        src={failed ? ECONOMIC_EVENT_FALLBACK_ARTWORK : source}
        alt=""
        decoding="async"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

export function EconomicEventDialog({ event, products, referenceNow, onClose }: {
  event?: PresentedEconomicEvent;
  products: ProductDefinition[];
  referenceNow: number;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = `economic-event-title-${useId().replace(/:/g, '')}`;
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const opener = document.activeElement;
    dialog.showModal();
    dialog.querySelector<HTMLButtonElement>('.page-navigation-button--close')?.focus({ preventScroll: true });
    return () => {
      dialog.close();
      if ((opener instanceof HTMLElement || opener instanceof SVGElement) && opener.isConnected) {
        opener.focus({ preventScroll: true });
      } else {
        document.querySelector<SVGElement>('.province-map-region')?.focus({ preventScroll: true });
      }
    };
  }, []);
  const productNames = new Map(products.map((product) => [product.id, product.name]));
  return (
    <dialog
      ref={dialogRef}
      className="economic-event-dialog"
      aria-labelledby={titleId}
      data-economic-event-id={event?.id ?? ''}
      onKeyDown={(action) => {
        // Let the native dialog dispatch cancel, but do not close a page beneath it.
        if (action.key === 'Escape') action.stopPropagation();
      }}
      onCancel={(action) => { action.preventDefault(); action.stopPropagation(); onClose(); }}
    >
      <PageHeader
        title={<span id={titleId}>{event?.title ?? '事件详情'}</span>}
        closeAction={{ label: '关闭事件详情', onClick: onClose }}
      />
      <div className="economic-event-dialog__body">
        <EventArtwork key={event?.templateId ?? 'fallback'} event={event} />
        <ScrollArea
          axis="y"
          className="economic-event-dialog__scroll"
          viewportClassName="economic-event-dialog__content"
          viewportAriaLabel="事件内容"
          viewportTabIndex={0}
          scrollbarRevealOnHover={false}
        >
          {event ? (
            <LiveServerTime referenceNow={referenceNow}>
              {(now) => {
                const phase = economicEventPhase(event, now);
                const timing = phase === 'completed' ? '已结束'
                  : phase === 'upcoming' ? `${formatDuration(Math.max(0, event.startsAt - now))} 后开始`
                    : `${formatDuration(Math.max(0, event.endsAt - now))} 后结束`;
                return (
                  <div className="economic-event-dialog__copy" data-event-phase={phase}>
                    <p className="economic-event-dialog__status">{phase === 'active' ? '进行中' : phase === 'upcoming' ? '即将开始' : '已结束'}</p>
                    <p className="economic-event-dialog__scope">{economicEventScopeLabel(event)}</p>
                    <p>{event.description}</p>
                    <dl>
                      <div><dt>时间</dt><dd>{timing}</dd></div>
                      <div><dt>开始</dt><dd><time dateTime={new Date(event.startsAt).toISOString()}>{formatTime(event.startsAt)}</time></dd></div>
                      <div><dt>结束</dt><dd><time dateTime={new Date(event.endsAt).toISOString()}>{formatTime(event.endsAt)}</time></dd></div>
                    </dl>
                    {event.classLabels.length > 0 ? <section><h2>相关类别</h2><p>{event.classLabels.join('、')}</p></section> : null}
                    {event.productIds.length > 0 ? <section><h2>相关商品</h2><p>{event.productIds.map((id) => productNames.get(id) ?? id).join('、')}</p></section> : null}
                    {event.project ? (
                      <section><h2>项目进度</h2>
                        <p>完成目标 <CompactNumber value={event.project.completedGoalCount} /> / <CompactNumber value={event.project.goals.length} /></p>
                        <p>全服提交 <CompactNumber value={event.project.totalContributedQuantity} /> 件</p>
                        <p>我的贡献 <CompactNumber value={event.project.myContributedQuantity} /> 件</p>
                      </section>
                    ) : null}
                    {event.templateId !== 'public-project' ? <p className="economic-event-dialog__note">事件调整现有消费需求的选择权重，不增加人口总预算，不直接改变商品价格。</p> : null}
                  </div>
                );
              }}
            </LiveServerTime>
          ) : <p>该事件已不在当前公开日历中。</p>}
        </ScrollArea>
      </div>
    </dialog>
  );
}
