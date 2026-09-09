import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { economicEventMapVisible, economicEventPhase, economicEventScopeLabel, layoutEconomicEventMarkers } from '../../economic-events/presentation';
import { useNow } from '../../hooks/useNow';
import type { ProvinceMapPoint } from '../provinces/provinceMapProjection';
import { useEconomicEvents } from './EconomicEventContext';

export function EconomicEventMapLayer({ capitalPoints, globalPoint, hidden, onContentChange }: {
  capitalPoints: ReadonlyMap<string, ProvinceMapPoint>;
  globalPoint: ProvinceMapPoint;
  hidden: boolean;
  onContentChange: () => void;
}) {
  const context = useEconomicEvents();
  const now = useNow(context?.referenceNow ?? 0);
  const groupRef = useRef<SVGGElement>(null);
  const [unitsPerPixel, setUnitsPerPixel] = useState(1);
  useLayoutEffect(() => {
    const svg = groupRef.current?.ownerSVGElement;
    const viewport = svg?.closest<HTMLElement>('.province-map-static-viewport');
    if (!svg || !viewport) return;
    let frame: number | null = null;
    const update = () => {
      frame = null;
      if (viewport.dataset.mapZoomActive === 'true') return;
      const scale = svg.getScreenCTM()?.a;
      if (scale && scale > 0) setUnitsPerPixel((previous) => Math.abs(previous - 1 / scale) < 0.00001 ? previous : 1 / scale);
    };
    const schedule = () => { if (frame === null) frame = requestAnimationFrame(update); };
    const observer = new MutationObserver(schedule);
    observer.observe(viewport, { attributes: true, attributeFilter: ['data-map-zoom-active'] });
    const resize = new ResizeObserver(schedule);
    resize.observe(viewport);
    schedule();
    return () => { observer.disconnect(); resize.disconnect(); if (frame !== null) cancelAnimationFrame(frame); };
  }, []);
  const events = context?.events;
  const visible = hidden ? [] : (events ?? []).filter((event) => economicEventMapVisible(event, now));
  const phaseKey = visible.map((event) => `${event.id}:${economicEventPhase(event, now)}`).join('|');
  const markers = useMemo(
    () => layoutEconomicEventMarkers(visible, capitalPoints, globalPoint, unitsPerPixel),
    // The shared clock updates only this leaf; positions change only at real boundaries.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, phaseKey, capitalPoints, globalPoint, unitsPerPixel],
  );
  useLayoutEffect(onContentChange, [markers, onContentChange]);
  return (
    <g ref={groupRef} className="province-map-economic-events" data-event-marker-count={markers.length}>
      {markers.map(({ event, anchor, position }) => (
        <g key={event.id}>
          <line className="economic-event-marker__leader" x1={anchor.x} y1={anchor.y} x2={position.x} y2={position.y} vectorEffect="non-scaling-stroke" pointerEvents="none" />
          <circle className="economic-event-marker__anchor" cx={anchor.x} cy={anchor.y} r={2.5 * unitsPerPixel} pointerEvents="none" />
          <g
            className="economic-event-marker"
            data-economic-event-marker={event.id}
            data-event-phase={economicEventPhase(event, now)}
            data-event-template={event.templateId}
            data-anchor-x={anchor.x}
            data-anchor-y={anchor.y}
            transform={`translate(${position.x} ${position.y}) scale(${unitsPerPixel})`}
            role="button"
            tabIndex={0}
            aria-label={`${event.title}，${economicEventScopeLabel(event)}，打开事件详情`}
            aria-haspopup="dialog"
            onPointerDownCapture={(action) => action.stopPropagation()}
            onDoubleClickCapture={(action) => action.stopPropagation()}
            onClick={(action) => { action.stopPropagation(); action.currentTarget.focus({ preventScroll: true }); context?.openEvent(event.id); }}
            onKeyDown={(action) => {
              if (action.key !== 'Enter' && action.key !== ' ') return;
              action.preventDefault(); action.stopPropagation(); context?.openEvent(event.id);
            }}
          >
            <title>{event.title} · {economicEventScopeLabel(event)}</title>
            <rect className="economic-event-marker__hit" x="-22" y="-22" width="44" height="44" rx="12" />
            <circle className="economic-event-marker__badge" r="17" />
            <path className="economic-event-marker__icon" d="M-7-7H7V7H-7ZM-7-2H7M-3-9V-5M3-9V-5M-3 2H3M-3 5H1" />
          </g>
        </g>
      ))}
    </g>
  );
}
