export const PROVINCE_MAP_ZOOM_MIN = 1;
export const PROVINCE_MAP_ZOOM_MAX = 4;

const WHEEL_ZOOM_SENSITIVITY = 0.0016;
const MAX_WHEEL_LOG_STEP = 0.2;
const POINTER_DRAG_THRESHOLD = 4;
const INPUT_SETTLE_MS = 90;
const MOBILE_BLANK_DOUBLE_TAP_MS = 360;
const MOBILE_BLANK_DOUBLE_TAP_DISTANCE = 28;
const MULTITOUCH_TAP_SUPPRESS_MS = 420;
const MAINLAND_CONTEXT_EXPAND_X = 0.35;
const MAINLAND_CONTEXT_EXPAND_Y = 0.25;

interface Point { x: number; y: number; }
interface ViewBoxState { x: number; y: number; width: number; height: number; zoom: number; }

export interface ProvinceMapCameraFocusBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface ProvinceMapCameraController {
  reset: () => void;
  destroy: () => void;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeWheelDelta(event: WheelEvent, container: HTMLElement) {
  const modeScale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? Math.max(1, container.clientHeight) : 1;
  return Number(event.deltaY) * modeScale;
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function distance(a: Point, b: Point) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function isProvinceTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('.province-map-region'));
}

function parseViewBox(svg: SVGSVGElement) {
  const base = svg.viewBox.baseVal;
  return { x: base.x, y: base.y, width: base.width, height: base.height };
}

function format(value: number) {
  return Number(value.toFixed(4));
}

export function createProvinceMapViewBoxCamera(
  container: HTMLElement,
  surface: HTMLElement,
  focusBounds?: ProvinceMapCameraFocusBounds,
): ProvinceMapCameraController {
  const svg = surface.querySelector<SVGSVGElement>('.province-map-world-svg');
  if (!svg) throw new Error('PROVINCE_MAP_WORLD_SVG_REQUIRED');

  const initial = parseViewBox(svg);
  const focus = focusBounds ?? {
    minX: initial.x,
    minY: initial.y,
    maxX: initial.x + initial.width,
    maxY: initial.y + initial.height,
  };
  const focusWidth = focus.maxX - focus.minX;
  const focusHeight = focus.maxY - focus.minY;
  const fixedBounds = {
    minX: focus.minX - focusWidth * MAINLAND_CONTEXT_EXPAND_X,
    maxX: focus.maxX + focusWidth * MAINLAND_CONTEXT_EXPAND_X,
    minY: focus.minY - focusHeight * MAINLAND_CONTEXT_EXPAND_Y,
    maxY: focus.maxY + focusHeight * MAINLAND_CONTEXT_EXPAND_Y,
  };
  const fixedWidth = fixedBounds.maxX - fixedBounds.minX;
  const fixedHeight = fixedBounds.maxY - fixedBounds.minY;
  const baseAspect = initial.width / Math.max(Number.EPSILON, initial.height);
  let baseWidth = initial.width;
  let baseHeight = initial.height;
  if (baseWidth > fixedWidth || baseHeight > fixedHeight) {
    const fit = Math.min(fixedWidth / baseWidth, fixedHeight / baseHeight);
    baseWidth *= fit;
    baseHeight *= fit;
  }
  if (baseWidth / baseHeight > baseAspect) baseWidth = baseHeight * baseAspect;
  else baseHeight = baseWidth / baseAspect;

  const focusCenter = { x: (focus.minX + focus.maxX) / 2, y: (focus.minY + focus.maxY) / 2 };
  let current: ViewBoxState = { x: focusCenter.x - baseWidth / 2, y: focusCenter.y - baseHeight / 2, width: baseWidth, height: baseHeight, zoom: 1 };
  let target: ViewBoxState = { ...current };
  let frame: number | null = null;
  let settleTimer: ReturnType<typeof setTimeout> | null = null;
  let settleDeadline = 0;
  let destroyed = false;
  let active = false;
  let inputMode = 'idle';
  let frameCount = 0;
  let writeCount = 0;
  let panClampCount = 0;
  let dragDistance = 0;
  let suppressNextDragClick = false;
  let interactionRect: DOMRect | null = null;
  let pinchReference: { midpoint: Point; distance: number } | null = null;
  let lastBlankTap: { at: number; x: number; y: number } | null = null;
  let multiTouchSequenceActive = false;
  let multiTouchSequenceCount = 0;
  let pendingSuppressedTouchTap = false;
  let suppressTapUntil = 0;
  let suppressedMultiTouchTapCount = 0;
  let multiTouchIdleTimer: ReturnType<typeof setTimeout> | null = null;
  const pointers = new Map<number, Point>();
  const activeTouchPointerIds = new Set<number>();

  container.dataset.mapRenderer = 'static-svg';
  container.dataset.mapCameraMode = 'svg-viewbox';
  container.dataset.mapCameraHotPath = 'single-viewbox-write';
  container.dataset.mapCameraGeometryMode = 'immutable-svg-world';
  container.dataset.mapZoomMode = 'svg-viewbox';
  container.dataset.mapZoomCameraMode = 'fixed-world-viewbox';
  container.dataset.mapZoomHotPath = 'viewbox';
  container.dataset.mapZoomCommitMode = 'none';
  container.dataset.mapZoomScaleMode = 'logical-fixed-world';
  container.dataset.mapPanBoundary = 'fixed-world-context';
  container.dataset.mapPanClampMode = 'inverse-viewbox';
  container.dataset.mapTapSuppressMs = String(MULTITOUCH_TAP_SUPPRESS_MS);
  container.dataset.mapContextExpandX = MAINLAND_CONTEXT_EXPAND_X.toFixed(2);
  container.dataset.mapContextExpandY = MAINLAND_CONTEXT_EXPAND_Y.toFixed(2);
  container.dataset.mapCameraBoundaryMinX = fixedBounds.minX.toFixed(3);
  container.dataset.mapCameraBoundaryMinY = fixedBounds.minY.toFixed(3);
  container.dataset.mapCameraBoundaryMaxX = fixedBounds.maxX.toFixed(3);
  container.dataset.mapCameraBoundaryMaxY = fixedBounds.maxY.toFixed(3);

  const readRect = () => interactionRect ?? (interactionRect = container.getBoundingClientRect());
  const localPoint = (clientX: number, clientY: number): Point => {
    const rect = readRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };
  const screenToWorld = (point: Point, state = target): Point => {
    const rect = readRect();
    return {
      x: state.x + (point.x / Math.max(1, rect.width)) * state.width,
      y: state.y + (point.y / Math.max(1, rect.height)) * state.height,
    };
  };

  const clampTarget = () => {
    const centerX = target.x + target.width / 2;
    const centerY = target.y + target.height / 2;
    const minCenterX = fixedBounds.minX + target.width / 2;
    const maxCenterX = fixedBounds.maxX - target.width / 2;
    const minCenterY = fixedBounds.minY + target.height / 2;
    const maxCenterY = fixedBounds.maxY - target.height / 2;
    const nextCenterX = minCenterX > maxCenterX ? (fixedBounds.minX + fixedBounds.maxX) / 2 : clamp(centerX, minCenterX, maxCenterX);
    const nextCenterY = minCenterY > maxCenterY ? (fixedBounds.minY + fixedBounds.maxY) / 2 : clamp(centerY, minCenterY, maxCenterY);
    const nextX = nextCenterX - target.width / 2;
    const nextY = nextCenterY - target.height / 2;
    if (Math.abs(nextX - target.x) > 0.0001 || Math.abs(nextY - target.y) > 0.0001) panClampCount += 1;
    target.x = nextX;
    target.y = nextY;
  };

  const publishMultiTouchState = () => {
    container.dataset.mapMultitouchActive = multiTouchSequenceActive ? 'true' : 'false';
    container.dataset.mapMultitouchSequenceCount = String(multiTouchSequenceCount);
    container.dataset.mapMultitouchPointerCount = String(activeTouchPointerIds.size);
    container.dataset.mapMultitouchTapPending = pendingSuppressedTouchTap ? 'true' : 'false';
    container.dataset.mapSuppressedMultitouchTapCount = String(suppressedMultiTouchTapCount);
  };
  const publishState = () => {
    container.dataset.mapZoomCurrent = current.zoom.toFixed(5);
    container.dataset.mapZoomTarget = target.zoom.toFixed(5);
    container.dataset.mapZoomBaseScale = '1.000000';
    container.dataset.mapFocusAreaActual = '0.000000';
    container.dataset.mapCameraX = current.x.toFixed(3);
    container.dataset.mapCameraY = current.y.toFixed(3);
    container.dataset.mapCameraTargetX = target.x.toFixed(3);
    container.dataset.mapCameraTargetY = target.y.toFixed(3);
    container.dataset.mapCameraViewWidth = current.width.toFixed(3);
    container.dataset.mapCameraViewHeight = current.height.toFixed(3);
    container.dataset.mapPanClampCount = String(panClampCount);
    container.dataset.mapZoomActive = active ? 'true' : 'false';
    container.dataset.mapZoomFrameCount = String(frameCount);
    container.dataset.mapCameraWriteCount = String(writeCount);
    container.dataset.mapZoomInputMode = inputMode;
    publishMultiTouchState();
  };

  const writeCamera = () => {
    frame = null;
    if (destroyed) return;
    current = { ...target };
    svg.setAttribute('viewBox', `${format(current.x)} ${format(current.y)} ${format(current.width)} ${format(current.height)}`);
    frameCount += 1;
    writeCount += 1;
  };
  const setActive = (next: boolean) => {
    if (active === next) return;
    active = next;
    publishState();
  };
  const finishSettle = () => {
    settleTimer = null;
    if (destroyed) return;
    const remaining = settleDeadline - performance.now();
    if (remaining > 0 || frame !== null) {
      settleTimer = setTimeout(finishSettle, Math.max(1, remaining > 0 ? remaining : 16));
      return;
    }
    inputMode = 'idle';
    setActive(false);
    interactionRect = null;
  };
  const scheduleWrite = (mode: string) => {
    inputMode = mode;
    if (!active) setActive(true);
    if (frame === null) frame = requestAnimationFrame(writeCamera);
    settleDeadline = performance.now() + INPUT_SETTLE_MS;
    if (settleTimer === null) settleTimer = setTimeout(finishSettle, INPUT_SETTLE_MS);
  };

  const setZoomAround = (nextZoom: number, point: Point) => {
    const zoom = clamp(nextZoom, PROVINCE_MAP_ZOOM_MIN, PROVINCE_MAP_ZOOM_MAX);
    const world = screenToWorld(point);
    const nextWidth = baseWidth / zoom;
    const nextHeight = baseHeight / zoom;
    const rect = readRect();
    target = {
      zoom,
      width: nextWidth,
      height: nextHeight,
      x: world.x - (point.x / Math.max(1, rect.width)) * nextWidth,
      y: world.y - (point.y / Math.max(1, rect.height)) * nextHeight,
    };
    clampTarget();
  };

  const reset = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    if (settleTimer !== null) clearTimeout(settleTimer);
    settleTimer = null;
    interactionRect = null;
    target = { x: focusCenter.x - baseWidth / 2, y: focusCenter.y - baseHeight / 2, width: baseWidth, height: baseHeight, zoom: 1 };
    clampTarget();
    current = { ...target };
    inputMode = 'reset';
    active = false;
    svg.setAttribute('viewBox', `${format(current.x)} ${format(current.y)} ${format(current.width)} ${format(current.height)}`);
    writeCount += 1;
    publishState();
  };

  const firstTwoTouchPositions = () => {
    const values = [...activeTouchPointerIds].map((id) => pointers.get(id)).filter((value): value is Point => Boolean(value));
    return values.length >= 2 ? [values[0], values[1]] as const : null;
  };
  const updatePinchReference = () => {
    const values = firstTwoTouchPositions();
    pinchReference = values ? { midpoint: midpoint(values[0], values[1]), distance: Math.max(1, distance(values[0], values[1])) } : null;
  };
  const refreshTapSuppression = () => { suppressTapUntil = Date.now() + MULTITOUCH_TAP_SUPPRESS_MS; };
  const cancelMultiTouchIdleTimer = () => { if (multiTouchIdleTimer !== null) clearTimeout(multiTouchIdleTimer); multiTouchIdleTimer = null; };
  const beginMultiTouchSequence = () => {
    if (!multiTouchSequenceActive) multiTouchSequenceCount += 1;
    multiTouchSequenceActive = true;
    pendingSuppressedTouchTap = true;
    refreshTapSuppression();
    cancelMultiTouchIdleTimer();
    lastBlankTap = null;
    publishMultiTouchState();
  };
  const finishMultiTouchSequence = () => {
    if (!multiTouchSequenceActive) return;
    refreshTapSuppression();
    multiTouchSequenceActive = false;
    suppressNextDragClick = false;
    lastBlankTap = null;
    publishMultiTouchState();
    multiTouchIdleTimer = setTimeout(() => { multiTouchIdleTimer = null; publishMultiTouchState(); }, MULTITOUCH_TAP_SUPPRESS_MS);
  };
  const shouldSuppressTap = () => multiTouchSequenceActive || Date.now() <= suppressTapUntil || pendingSuppressedTouchTap;

  const handleWheel = (event: WheelEvent) => {
    const delta = normalizeWheelDelta(event, container);
    if (!Number.isFinite(delta) || Math.abs(delta) < 0.01 || Math.abs(event.deltaX) > Math.abs(event.deltaY) * 1.2) return;
    event.preventDefault();
    event.stopPropagation();
    const step = clamp(-delta * WHEEL_ZOOM_SENSITIVITY, -MAX_WHEEL_LOG_STEP, MAX_WHEEL_LOG_STEP);
    setZoomAround(target.zoom * Math.exp(step), localPoint(event.clientX, event.clientY));
    scheduleWrite('wheel');
  };
  const handlePointerDown = (event: PointerEvent) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (pointers.size === 0) interactionRect = null;
    pointers.set(event.pointerId, localPoint(event.clientX, event.clientY));
    if (event.pointerType === 'touch') {
      activeTouchPointerIds.add(event.pointerId);
      if (activeTouchPointerIds.size >= 2) beginMultiTouchSequence();
      else publishMultiTouchState();
    }
    (event.target as Element & { setPointerCapture?: (id: number) => void }).setPointerCapture?.(event.pointerId);
    dragDistance = 0;
    if (activeTouchPointerIds.size >= 2) updatePinchReference();
  };
  const handlePointerMove = (event: PointerEvent) => {
    const previous = pointers.get(event.pointerId);
    if (!previous) return;
    const next = localPoint(event.clientX, event.clientY);
    pointers.set(event.pointerId, next);
    if (activeTouchPointerIds.size >= 2) {
      beginMultiTouchSequence();
      const values = firstTwoTouchPositions();
      if (!values) return;
      const nextMid = midpoint(values[0], values[1]);
      const nextDistance = Math.max(1, distance(values[0], values[1]));
      const reference = pinchReference ?? { midpoint: nextMid, distance: nextDistance };
      const rect = readRect();
      target.x -= (nextMid.x - reference.midpoint.x) / Math.max(1, rect.width) * target.width;
      target.y -= (nextMid.y - reference.midpoint.y) / Math.max(1, rect.height) * target.height;
      setZoomAround(target.zoom * (nextDistance / reference.distance), nextMid);
      pinchReference = { midpoint: nextMid, distance: nextDistance };
      dragDistance += Math.hypot(next.x - previous.x, next.y - previous.y);
      suppressNextDragClick = true;
      scheduleWrite('pinch');
      return;
    }
    const rect = readRect();
    target.x -= (next.x - previous.x) / Math.max(1, rect.width) * target.width;
    target.y -= (next.y - previous.y) / Math.max(1, rect.height) * target.height;
    clampTarget();
    dragDistance += Math.hypot(next.x - previous.x, next.y - previous.y);
    if (dragDistance > POINTER_DRAG_THRESHOLD) suppressNextDragClick = true;
    scheduleWrite('move');
  };
  const handlePointerEnd = (event: PointerEvent) => {
    if (!pointers.has(event.pointerId)) return;
    const point = localPoint(event.clientX, event.clientY);
    pointers.delete(event.pointerId);
    if (event.pointerType === 'touch') {
      activeTouchPointerIds.delete(event.pointerId);
      if (multiTouchSequenceActive && activeTouchPointerIds.size === 0) finishMultiTouchSequence();
      else publishMultiTouchState();
    }
    updatePinchReference();
    if (event.pointerType === 'touch' && dragDistance <= POINTER_DRAG_THRESHOLD && !isProvinceTarget(event.target)) {
      if (shouldSuppressTap()) { lastBlankTap = null; return; }
      const at = performance.now();
      const previous = lastBlankTap;
      lastBlankTap = { at, ...point };
      if (previous && at - previous.at <= MOBILE_BLANK_DOUBLE_TAP_MS && Math.hypot(point.x - previous.x, point.y - previous.y) <= MOBILE_BLANK_DOUBLE_TAP_DISTANCE) {
        lastBlankTap = null;
        reset();
        container.dataset.mapCameraReset = 'blank-double-tap';
      }
    }
  };
  const handleDoubleClick = (event: MouseEvent) => {
    if (isProvinceTarget(event.target) || shouldSuppressTap()) return;
    event.preventDefault();
    reset();
    container.dataset.mapCameraReset = 'blank-double-click';
  };
  const handleClickCapture = (event: MouseEvent) => {
    if (shouldSuppressTap()) {
      pendingSuppressedTouchTap = false;
      suppressNextDragClick = false;
      suppressedMultiTouchTapCount += 1;
      publishMultiTouchState();
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (!suppressNextDragClick) return;
    suppressNextDragClick = false;
    event.preventDefault();
    event.stopPropagation();
  };
  const handleTouchStart = (event: TouchEvent) => { if (event.touches.length >= 2) beginMultiTouchSequence(); else if (Date.now() > suppressTapUntil) pendingSuppressedTouchTap = false; };
  const handleTouchMove = (event: TouchEvent) => { if (event.touches.length >= 2) beginMultiTouchSequence(); };
  const handleTouchEnd = (event: TouchEvent) => { if (multiTouchSequenceActive && event.touches.length === 0) finishMultiTouchSequence(); };

  container.addEventListener('wheel', handleWheel, { passive: false });
  container.addEventListener('pointerdown', handlePointerDown);
  container.addEventListener('pointermove', handlePointerMove);
  container.addEventListener('pointerup', handlePointerEnd);
  container.addEventListener('pointercancel', handlePointerEnd);
  container.addEventListener('dblclick', handleDoubleClick);
  container.addEventListener('click', handleClickCapture, true);
  container.addEventListener('touchstart', handleTouchStart, { passive: true });
  container.addEventListener('touchmove', handleTouchMove, { passive: true });
  container.addEventListener('touchend', handleTouchEnd, { passive: true });
  container.addEventListener('touchcancel', handleTouchEnd, { passive: true });

  reset();

  return {
    reset,
    destroy() {
      destroyed = true;
      if (frame !== null) cancelAnimationFrame(frame);
      if (settleTimer !== null) clearTimeout(settleTimer);
      if (multiTouchIdleTimer !== null) clearTimeout(multiTouchIdleTimer);
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('pointerdown', handlePointerDown);
      container.removeEventListener('pointermove', handlePointerMove);
      container.removeEventListener('pointerup', handlePointerEnd);
      container.removeEventListener('pointercancel', handlePointerEnd);
      container.removeEventListener('dblclick', handleDoubleClick);
      container.removeEventListener('click', handleClickCapture, true);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
    },
  };
}
