import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type WheelEvent as ReactWheelEvent,
} from 'react';

interface ViewportPoint {
  x: number;
  y: number;
}

interface ResearchTreeViewportProps {
  width: number;
  height: number;
  focusPoint?: ViewportPoint;
  children: ReactNode;
}

interface ViewportState {
  panX: number;
  panY: number;
  zoom: number;
}

interface ViewportSize {
  width: number;
  height: number;
}

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 1.6;
const PAN_VISIBLE_MARGIN = 64;
const FOCUS_VISIBLE_MARGIN = 88;
const DRAG_THRESHOLD = 6;
const KEYBOARD_PAN_STEP = 56;
const WHEEL_SETTLE_DELAY_MS = 140;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function defaultZoomForWidth(viewportWidth: number) {
  return clamp(viewportWidth / 980, 0.55, 1);
}

export function clampResearchTreeViewport(
  state: ViewportState,
  viewport: ViewportSize,
  world: ViewportSize,
): ViewportState {
  const scaledWidth = world.width * state.zoom;
  const scaledHeight = world.height * state.zoom;
  const panX = clamp(state.panX, PAN_VISIBLE_MARGIN - scaledWidth, viewport.width - PAN_VISIBLE_MARGIN);
  const panY = clamp(state.panY, PAN_VISIBLE_MARGIN - scaledHeight, viewport.height - PAN_VISIBLE_MARGIN);

  return { ...state, panX, panY };
}

export function zoomResearchTreeAtPoint(
  state: ViewportState,
  anchor: ViewportPoint,
  nextZoom: number,
): ViewportState {
  const zoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
  const worldX = (anchor.x - state.panX) / state.zoom;
  const worldY = (anchor.y - state.panY) / state.zoom;
  return {
    zoom,
    panX: anchor.x - worldX * zoom,
    panY: anchor.y - worldY * zoom,
  };
}

function centeredState(
  point: ViewportPoint,
  zoom: number,
  viewport: ViewportSize,
  world: ViewportSize,
) {
  return clampResearchTreeViewport({
    zoom,
    panX: viewport.width / 2 - point.x * zoom,
    panY: viewport.height * 0.42 - point.y * zoom,
  }, viewport, world);
}

function fitState(viewport: ViewportSize, world: ViewportSize) {
  const padding = 28;
  const zoom = clamp(Math.min(
    (viewport.width - padding * 2) / world.width,
    (viewport.height - padding * 2) / world.height,
  ), MIN_ZOOM, MAX_ZOOM);
  return clampResearchTreeViewport({
    zoom,
    panX: (viewport.width - world.width * zoom) / 2,
    panY: (viewport.height - world.height * zoom) / 2,
  }, viewport, world);
}

function midpoint(points: ViewportPoint[]) {
  return {
    x: (points[0].x + points[1].x) / 2,
    y: (points[0].y + points[1].y) / 2,
  };
}

function distance(points: ViewportPoint[]) {
  return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
}

function snapToDevicePixel(value: number) {
  const ratio = typeof window === 'undefined' ? 1 : Math.max(1, window.devicePixelRatio || 1);
  return Math.round(value * ratio) / ratio;
}

export function ResearchTreeViewport({ width, height, focusPoint, children }: ResearchTreeViewportProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const viewportSizeRef = useRef<ViewportSize>({ width: 1, height: 1 });
  const initializedRef = useRef(false);
  const pointersRef = useRef(new Map<number, ViewportPoint>());
  const lastSinglePointRef = useRef<ViewportPoint | null>(null);
  const pinchRef = useRef<{ midpoint: ViewportPoint; distance: number } | null>(null);
  const gestureOriginRef = useRef<ViewportPoint | null>(null);
  const gestureMovedRef = useRef(false);
  const gestureStartedOnNodeRef = useRef(false);
  const suppressClickRef = useRef(false);
  const wheelSettleTimerRef = useRef<number | null>(null);
  const [isDragging, setDragging] = useState(false);
  const [isTransforming, setTransforming] = useState(false);
  const [state, setState] = useState<ViewportState>({ panX: 0, panY: 0, zoom: 1 });
  const world = { width, height };

  const clampState = useCallback((next: ViewportState) => (
    clampResearchTreeViewport(next, viewportSizeRef.current, { width, height })
  ), [height, width]);

  const settleTransform = useCallback(() => {
    setTransforming(false);
    setState((current) => clampState({
      ...current,
      panX: snapToDevicePixel(current.panX),
      panY: snapToDevicePixel(current.panY),
    }));
  }, [clampState]);

  useEffect(() => () => {
    if (wheelSettleTimerRef.current !== null) window.clearTimeout(wheelSettleTimerRef.current);
  }, []);

  const measureAndClamp = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const size = { width: Math.max(1, rect.width), height: Math.max(1, rect.height) };
    viewportSizeRef.current = size;
    setState((current) => {
      if (!initializedRef.current) {
        initializedRef.current = true;
        const target = focusPoint ?? { x: width / 2, y: height / 2 };
        return centeredState(target, defaultZoomForWidth(size.width), size, { width, height });
      }
      return clampResearchTreeViewport(current, size, { width, height });
    });
  }, [focusPoint, height, width]);

  useLayoutEffect(() => {
    measureAndClamp();
    const viewport = viewportRef.current;
    if (!viewport || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => measureAndClamp());
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [measureAndClamp]);

  const localPoint = useCallback((clientX: number, clientY: number): ViewportPoint => {
    const rect = viewportRef.current?.getBoundingClientRect();
    return {
      x: clientX - (rect?.left ?? 0),
      y: clientY - (rect?.top ?? 0),
    };
  }, []);

  const updatePan = useCallback((dx: number, dy: number) => {
    setState((current) => clampState({ ...current, panX: current.panX + dx, panY: current.panY + dy }));
  }, [clampState]);

  const zoomAt = useCallback((anchor: ViewportPoint, zoom: number) => {
    setState((current) => clampState(zoomResearchTreeAtPoint(current, anchor, zoom)));
  }, [clampState]);

  const centerCurrent = useCallback(() => {
    const size = viewportSizeRef.current;
    const point = focusPoint ?? { x: width / 2, y: height / 2 };
    setState((current) => centeredState(point, current.zoom, size, world));
  }, [focusPoint, height, width]);

  const fitTree = useCallback(() => {
    setState(fitState(viewportSizeRef.current, world));
  }, [height, width]);

  const zoomBy = useCallback((factor: number) => {
    const size = viewportSizeRef.current;
    zoomAt({ x: size.width / 2, y: size.height / 2 }, state.zoom * factor);
  }, [state.zoom, zoomAt]);

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('.research-tree-controls')) return;
    const point = localPoint(event.clientX, event.clientY);
    const startedOnNode = Boolean(target.closest('.research-technology-node'));
    pointersRef.current.set(event.pointerId, point);
    setDragging(true);
    setTransforming(true);

    if (pointersRef.current.size === 1) {
      gestureMovedRef.current = false;
      gestureStartedOnNodeRef.current = startedOnNode;
      suppressClickRef.current = false;
      lastSinglePointRef.current = point;
      gestureOriginRef.current = point;
      pinchRef.current = null;
    } else if (pointersRef.current.size >= 2) {
      const points = [...pointersRef.current.values()].slice(0, 2);
      pinchRef.current = { midpoint: midpoint(points), distance: Math.max(1, distance(points)) };
      gestureMovedRef.current = true;
    }

    if (!startedOnNode) {
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* synthetic pointer events */ }
    }
  }, [localPoint]);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    const point = localPoint(event.clientX, event.clientY);
    pointersRef.current.set(event.pointerId, point);

    if (pointersRef.current.size >= 2) {
      const points = [...pointersRef.current.values()].slice(0, 2);
      const currentMidpoint = midpoint(points);
      const currentDistance = Math.max(1, distance(points));
      const previous = pinchRef.current;
      if (previous) {
        setState((current) => {
          const nextZoom = clamp(current.zoom * (currentDistance / previous.distance), MIN_ZOOM, MAX_ZOOM);
          const worldX = (previous.midpoint.x - current.panX) / current.zoom;
          const worldY = (previous.midpoint.y - current.panY) / current.zoom;
          return clampState({
            zoom: nextZoom,
            panX: currentMidpoint.x - worldX * nextZoom,
            panY: currentMidpoint.y - worldY * nextZoom,
          });
        });
      }
      pinchRef.current = { midpoint: currentMidpoint, distance: currentDistance };
      gestureMovedRef.current = true;
      event.preventDefault();
      return;
    }

    const previous = lastSinglePointRef.current;
    if (!previous) {
      lastSinglePointRef.current = point;
      return;
    }
    const origin = gestureOriginRef.current ?? previous;
    if (!gestureMovedRef.current && Math.hypot(point.x - origin.x, point.y - origin.y) >= DRAG_THRESHOLD) {
      gestureMovedRef.current = true;
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* synthetic pointer events */ }
    }
    if (gestureMovedRef.current) {
      updatePan(point.x - previous.x, point.y - previous.y);
      event.preventDefault();
    }
    lastSinglePointRef.current = point;
  }, [clampState, localPoint, updatePan]);

  const finishPointer = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size === 1) {
      const remaining = [...pointersRef.current.values()][0];
      lastSinglePointRef.current = remaining;
      gestureOriginRef.current = remaining;
      pinchRef.current = null;
    } else if (pointersRef.current.size === 0) {
      if (gestureMovedRef.current && gestureStartedOnNodeRef.current) {
        suppressClickRef.current = true;
        window.setTimeout(() => { suppressClickRef.current = false; }, 80);
      }
      lastSinglePointRef.current = null;
      gestureOriginRef.current = null;
      pinchRef.current = null;
      gestureStartedOnNodeRef.current = false;
      setDragging(false);
      settleTransform();
    }
  }, [settleTransform]);

  const handleClickCapture = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('.research-tree-controls')) return;
    if (!target.closest('.research-technology-node') || !suppressClickRef.current) return;
    suppressClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleDoubleClick = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches) return;
    const target = event.target as HTMLElement;
    if (target.closest('.research-tree-controls')) return;
    event.preventDefault();
    const node = target.closest<HTMLElement>('.research-technology-node');
    const x = Number(node?.dataset.researchNodeX);
    const y = Number(node?.dataset.researchNodeY);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      const size = viewportSizeRef.current;
      setState((current) => centeredState({ x, y }, current.zoom, size, { width, height }));
      return;
    }
    centerCurrent();
  }, [centerCurrent, height, width]);

  const handleWheel = useCallback((event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    setTransforming(true);
    if (wheelSettleTimerRef.current !== null) window.clearTimeout(wheelSettleTimerRef.current);
    const anchor = localPoint(event.clientX, event.clientY);
    const normalizedDeltaY = event.deltaMode === 1
      ? event.deltaY * 16
      : event.deltaMode === 2
        ? event.deltaY * viewportSizeRef.current.height
        : event.deltaY;
    const factor = Math.exp(-normalizedDeltaY * 0.002);
    zoomAt(anchor, state.zoom * factor);
    wheelSettleTimerRef.current = window.setTimeout(() => {
      wheelSettleTimerRef.current = null;
      settleTransform();
    }, WHEEL_SETTLE_DELAY_MS);
  }, [localPoint, settleTransform, state.zoom, zoomAt]);

  const handleKeyboard = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      zoomBy(1.15);
    } else if (event.key === '-') {
      event.preventDefault();
      zoomBy(1 / 1.15);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      updatePan(KEYBOARD_PAN_STEP, 0);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      updatePan(-KEYBOARD_PAN_STEP, 0);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      updatePan(0, KEYBOARD_PAN_STEP);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      updatePan(0, -KEYBOARD_PAN_STEP);
    } else if (event.key === '0') {
      event.preventDefault();
      fitTree();
    } else if (event.key === 'Home') {
      event.preventDefault();
      centerCurrent();
    }
  }, [centerCurrent, fitTree, updatePan, zoomBy]);

  const handleFocusCapture = useCallback((event: ReactFocusEvent<HTMLDivElement>) => {
    if (pointersRef.current.size > 0) return;
    const target = event.target as HTMLElement;
    const x = Number(target.dataset.researchNodeX);
    const y = Number(target.dataset.researchNodeY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    setState((current) => {
      const size = viewportSizeRef.current;
      const screenX = current.panX + x * current.zoom;
      const screenY = current.panY + y * current.zoom;
      let dx = 0;
      let dy = 0;
      if (screenX < FOCUS_VISIBLE_MARGIN) dx = FOCUS_VISIBLE_MARGIN - screenX;
      else if (screenX > size.width - FOCUS_VISIBLE_MARGIN) dx = size.width - FOCUS_VISIBLE_MARGIN - screenX;
      if (screenY < FOCUS_VISIBLE_MARGIN) dy = FOCUS_VISIBLE_MARGIN - screenY;
      else if (screenY > size.height - FOCUS_VISIBLE_MARGIN) dy = size.height - FOCUS_VISIBLE_MARGIN - screenY;
      return dx || dy ? clampState({ ...current, panX: current.panX + dx, panY: current.panY + dy }) : current;
    });
  }, [clampState]);

  const zoomPercent = Math.round(state.zoom * 100);
  const zoomTier = state.zoom < 0.5 ? 'overview' : 'detail';

  return (
    <div
      ref={viewportRef}
      className="research-tree-viewport"
      data-dragging={isDragging || undefined}
      data-transforming={isTransforming || undefined}
      data-pan-x={Math.round(state.panX * 100) / 100}
      data-pan-y={Math.round(state.panY * 100) / 100}
      data-zoom={Math.round(state.zoom * 1000) / 1000}
      data-zoom-tier={zoomTier}
      role="group"
      aria-label="可平移和缩放的产业科技树"
      tabIndex={0}
      onClickCapture={handleClickCapture}
      onDoubleClick={handleDoubleClick}
      onFocusCapture={handleFocusCapture}
      onKeyDown={handleKeyboard}
      onPointerCancel={finishPointer}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPointer}
      onWheel={handleWheel}
    >
      <div
        className="research-tree-transform-layer"
        style={{
          width: `${width}px`,
          height: `${height}px`,
          transform: `translate3d(${state.panX}px, ${state.panY}px, 0) scale(${state.zoom})`,
        } as CSSProperties}
      >
        {children}
      </div>
      <div className="research-tree-controls" aria-label="技术树视图控制">
        <button type="button" className="research-tree-control" aria-label="缩小技术树" onPointerDown={(event) => event.stopPropagation()} onClick={() => zoomBy(1 / 1.15)}>−</button>
        <span className="research-tree-zoom-readout" aria-live="polite">{zoomPercent}%</span>
        <button type="button" className="research-tree-control" aria-label="放大技术树" onPointerDown={(event) => event.stopPropagation()} onClick={() => zoomBy(1.15)}>+</button>
        <button type="button" className="research-tree-control research-tree-control--text" aria-label="定位当前科技" onPointerDown={(event) => event.stopPropagation()} onClick={centerCurrent}>当前</button>
        <button type="button" className="research-tree-control research-tree-control--text" aria-label="查看完整技术树" onPointerDown={(event) => event.stopPropagation()} onClick={fitTree}>全部</button>
      </div>
    </div>
  );
}
