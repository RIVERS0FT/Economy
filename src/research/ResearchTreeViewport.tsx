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

interface ViewportFrame extends ViewportSize {
  left: number;
  top: number;
}

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 1.6;
const PAN_VISIBLE_MARGIN = 64;
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
  frame: ViewportFrame = { ...viewport, left: 0, top: 0 },
) {
  return clampResearchTreeViewport({
    zoom,
    panX: frame.left + frame.width / 2 - point.x * zoom,
    panY: frame.top + frame.height * 0.42 - point.y * zoom,
  }, viewport, world);
}

function fitState(viewport: ViewportSize, world: ViewportSize, frame: ViewportFrame) {
  const zoom = clamp(Math.min(
    frame.width / world.width,
    frame.height / world.height,
  ), MIN_ZOOM, MAX_ZOOM);
  return clampResearchTreeViewport({
    zoom,
    panX: frame.left + (frame.width - world.width * zoom) / 2,
    panY: frame.top + (frame.height - world.height * zoom) / 2,
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

  const visibleFrame = useCallback((): ViewportFrame => {
    const size = viewportSizeRef.current;
    const viewport = viewportRef.current;
    const rect = viewport?.getBoundingClientRect();
    const panel = viewport?.parentElement?.querySelector<HTMLElement>('.research-action-panel');
    const panelRect = panel?.getBoundingClientRect();
    const controls = viewport?.querySelector<HTMLElement>('.research-tree-controls')?.getBoundingClientRect();
    const padding = 24;
    const left = panelRect && panelRect.width > 0 && rect
      ? Math.min(panelRect.right - rect.left + padding, size.width - 160)
      : padding;
    const bottom = controls && rect ? size.height - (controls.top - rect.top) + 12 : padding;
    return { left, top: padding, width: Math.max(1, size.width - left - padding), height: Math.max(1, size.height - padding - bottom) };
  }, []);

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
    if (rect.width < 1 || rect.height < 1) return;
    const size = { width: Math.max(1, rect.width), height: Math.max(1, rect.height) };
    viewportSizeRef.current = size;
    setState((current) => {
      if (!initializedRef.current) {
        initializedRef.current = true;
        const target = focusPoint ?? { x: width / 2, y: height / 2 };
        const frame = visibleFrame();
        const zoom = Math.max(0.55, Math.min(defaultZoomForWidth(size.width), frame.width / width));
        const next = centeredState(target, zoom, size, { width, height }, frame);
        // Fit the full width when readable; otherwise keep the initial target
        // safely inside the unobscured area and retain pan/zoom exploration.
        if (width * zoom <= frame.width) next.panX = frame.left + (frame.width - width * zoom) / 2;
        if (height * zoom <= frame.height) next.panY = frame.top + (frame.height - height * zoom) / 2;
        return next;
      }
      return clampResearchTreeViewport(current, size, { width, height });
    });
  }, [focusPoint, height, width, visibleFrame]);

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
    setState((current) => centeredState(point, current.zoom, size, world, visibleFrame()));
  }, [focusPoint, height, width, visibleFrame]);

  const fitTree = useCallback(() => {
    setState(fitState(viewportSizeRef.current, world, visibleFrame()));
  }, [height, width, visibleFrame]);

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
      setState((current) => centeredState({ x, y }, current.zoom, size, { width, height }, visibleFrame()));
      return;
    }
    centerCurrent();
  }, [centerCurrent, height, width, visibleFrame]);

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
      const frame = visibleFrame();
      const screenX = current.panX + x * current.zoom;
      const screenY = current.panY + y * current.zoom;
      const halfWidth = target.offsetWidth * current.zoom / 2 + 12;
      const halfHeight = target.offsetHeight * current.zoom / 2 + 12;
      const left = frame.left + halfWidth;
      const right = frame.left + frame.width - halfWidth;
      const top = frame.top + halfHeight;
      const bottom = frame.top + frame.height - halfHeight;
      let dx = 0;
      let dy = 0;
      if (screenX < left) dx = left - screenX;
      else if (screenX > right) dx = right - screenX;
      if (screenY < top) dy = top - screenY;
      else if (screenY > bottom) dy = bottom - screenY;
      return dx || dy ? clampState({ ...current, panX: current.panX + dx, panY: current.panY + dy }) : current;
    });
  }, [clampState, visibleFrame]);

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
