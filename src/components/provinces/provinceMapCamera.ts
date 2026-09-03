export const PROVINCE_MAP_ZOOM_MIN = 1;
export const PROVINCE_MAP_ZOOM_MAX = 4;

const WHEEL_ZOOM_SENSITIVITY = 0.0016;
const MAX_WHEEL_LOG_STEP = 0.2;
const POINTER_DRAG_THRESHOLD = 4;
const INPUT_SETTLE_MS = 90;
const MOBILE_BLANK_DOUBLE_TAP_MS = 360;
const MOBILE_BLANK_DOUBLE_TAP_DISTANCE = 28;
const MULTITOUCH_TAP_SUPPRESS_MS = 420;
const MAINLAND_PAN_EDGE_INSET = 12;
const MAINLAND_MIN_AREA_RATIO = 2 / 3;
const MAINLAND_CONTEXT_EXPAND_X = 0.35;
const MAINLAND_CONTEXT_EXPAND_Y = 0.25;

interface CameraState {
  centerX: number;
  centerY: number;
  zoom: number;
}

interface PointerPosition {
  x: number;
  y: number;
}

interface PinchReference {
  midpoint: PointerPosition;
  distance: number;
}

interface ContainerBounds {
  left: number;
  top: number;
}

interface WorldRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface SvgViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CameraMetrics {
  viewportWidth: number;
  viewportHeight: number;
  baseViewWidth: number;
  baseViewHeight: number;
  baseAreaRatio: number;
  focusCenterX: number;
  focusCenterY: number;
  worldBounds: WorldRect;
}

export interface ProvinceMapCameraFocusBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface ProvinceMapCameraOptions {
  focusBounds?: ProvinceMapCameraFocusBounds;
}

export interface ProvinceMapCameraController {
  reset: () => void;
  destroy: () => void;
}

type CameraInputMode = 'idle' | 'wheel' | 'move' | 'pinch' | 'reset';

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeWheelDelta(event: WheelEvent, container: HTMLElement) {
  const modeScale = event.deltaMode === 1
    ? 16
    : event.deltaMode === 2
      ? Math.max(1, container.clientHeight)
      : 1;
  return Number(event.deltaY) * modeScale;
}

function midpoint(left: PointerPosition, right: PointerPosition): PointerPosition {
  return {
    x: (left.x + right.x) / 2,
    y: (left.y + right.y) / 2,
  };
}

function distance(left: PointerPosition, right: PointerPosition) {
  return Math.hypot(right.x - left.x, right.y - left.y);
}

function isProvinceTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('.province-map-region'));
}

function formatViewValue(value: number) {
  const rounded = Number(value.toFixed(4));
  return Object.is(rounded, -0) ? 0 : rounded;
}

function formatViewBox(viewBox: SvgViewBox) {
  return `${formatViewValue(viewBox.x)} ${formatViewValue(viewBox.y)} ${formatViewValue(viewBox.width)} ${formatViewValue(viewBox.height)}`;
}

function baseViewSize(
  viewportWidth: number,
  viewportHeight: number,
  focusWidth: number,
  focusHeight: number,
) {
  const aspect = Math.max(Number.EPSILON, viewportWidth / Math.max(1, viewportHeight));
  const focusArea = Math.max(Number.EPSILON, focusWidth * focusHeight);
  const targetArea = focusArea / MAINLAND_MIN_AREA_RATIO;
  const targetWidth = Math.sqrt(targetArea * aspect);
  const usableWidth = Math.max(1, viewportWidth - MAINLAND_PAN_EDGE_INSET * 2);
  const usableHeight = Math.max(1, viewportHeight - MAINLAND_PAN_EDGE_INSET * 2);
  const minimumWidthForFocus = focusWidth * viewportWidth / usableWidth;
  const minimumHeightForFocus = focusHeight * viewportHeight / usableHeight;
  const width = Math.max(targetWidth, minimumWidthForFocus, minimumHeightForFocus * aspect);
  return { width, height: width / aspect };
}

function clampCameraCenter(
  center: number,
  viewSize: number,
  minimum: number,
  maximum: number,
) {
  const worldSize = maximum - minimum;
  if (!(worldSize > viewSize)) return (minimum + maximum) / 2;
  return clamp(center, minimum + viewSize / 2, maximum - viewSize / 2);
}

export function createProvinceMapCamera(
  container: HTMLElement,
  surface: HTMLElement,
  options: ProvinceMapCameraOptions = {},
): ProvinceMapCameraController {
  const svg = surface.querySelector<SVGSVGElement>('.province-map-world-svg');
  if (!svg) throw new Error('PROVINCE_MAP_CAMERA_SVG_REQUIRED');
  const initialViewBox = svg.viewBox.baseVal;
  const sourceViewBox: SvgViewBox = initialViewBox && initialViewBox.width > 0 && initialViewBox.height > 0
    ? { x: initialViewBox.x, y: initialViewBox.y, width: initialViewBox.width, height: initialViewBox.height }
    : { x: 0, y: 0, width: 1, height: 1 };

  let current: CameraState = {
    centerX: sourceViewBox.x + sourceViewBox.width / 2,
    centerY: sourceViewBox.y + sourceViewBox.height / 2,
    zoom: 1,
  };
  let target: CameraState = { ...current };
  let frame: number | null = null;
  let settleTimer: ReturnType<typeof setTimeout> | null = null;
  let settleDeadline = 0;
  let multiTouchIdleTimer: ReturnType<typeof setTimeout> | null = null;
  let frameCount = 0;
  let writeCount = 0;
  let panClampCount = 0;
  let inputMode: CameraInputMode = 'idle';
  let active = false;
  let destroyed = false;
  let dragDistance = 0;
  let suppressNextDragClick = false;
  let pinchReference: PinchReference | null = null;
  let interactionBounds: ContainerBounds | null = null;
  let cameraMetrics: CameraMetrics | null = null;
  let lastBlankTap: { at: number; x: number; y: number } | null = null;
  let multiTouchSequenceActive = false;
  let multiTouchSequenceCount = 0;
  let pendingSuppressedTouchTap = false;
  let suppressTapUntil = 0;
  let suppressedMultiTouchTapCount = 0;
  const pointers = new Map<number, PointerPosition>();
  const activeTouchPointerIds = new Set<number>();

  surface.style.transform = 'none';
  surface.style.willChange = 'auto';
  surface.style.backfaceVisibility = 'visible';
  container.dataset.mapRenderer = 'static-svg';
  container.dataset.mapCameraMode = 'svg-viewbox';
  container.dataset.mapCameraHotPath = 'single-svg-viewbox-write';
  container.dataset.mapCameraGeometryMode = 'immutable-svg-world';
  container.dataset.mapZoomMode = 'svg-viewbox';
  container.dataset.mapZoomCameraMode = 'static-svg-viewbox';
  container.dataset.mapZoomHotPath = 'single-viewbox-attribute';
  container.dataset.mapZoomCommitMode = 'none';
  container.dataset.mapZoomScaleMode = 'logical-mainland-base';
  container.dataset.mapCameraBoundaryMode = options.focusBounds ? 'fixed-world-bounds' : 'source-viewbox';
  container.dataset.mapCameraCoordinateMode = 'svg-world-center';
  container.dataset.mapTapSuppressMs = String(MULTITOUCH_TAP_SUPPRESS_MS);
  container.dataset.mapPanBoundary = options.focusBounds ? 'fixed-world-context' : 'source-viewbox';
  container.dataset.mapPanClampMode = options.focusBounds ? 'fixed-world-viewbox' : 'none';
  container.dataset.mapPanEdgeInset = String(MAINLAND_PAN_EDGE_INSET);
  container.dataset.mapFocusAreaTarget = MAINLAND_MIN_AREA_RATIO.toFixed(6);
  container.dataset.mapContextExpandX = MAINLAND_CONTEXT_EXPAND_X.toFixed(2);
  container.dataset.mapContextExpandY = MAINLAND_CONTEXT_EXPAND_Y.toFixed(2);

  const readBounds = () => {
    if (interactionBounds) return interactionBounds;
    const bounds = container.getBoundingClientRect();
    interactionBounds = { left: bounds.left, top: bounds.top };
    return interactionBounds;
  };

  const localPoint = (clientX: number, clientY: number): PointerPosition => {
    const bounds = readBounds();
    return {
      x: clientX - bounds.left,
      y: clientY - bounds.top,
    };
  };

  const readCameraMetrics = (): CameraMetrics => {
    if (cameraMetrics) return cameraMetrics;
    const viewportWidth = Math.max(1, container.clientWidth);
    const viewportHeight = Math.max(1, container.clientHeight);
    const focus = options.focusBounds ?? {
      minX: sourceViewBox.x,
      minY: sourceViewBox.y,
      maxX: sourceViewBox.x + sourceViewBox.width,
      maxY: sourceViewBox.y + sourceViewBox.height,
    };
    const focusWidth = Math.max(Number.EPSILON, focus.maxX - focus.minX);
    const focusHeight = Math.max(Number.EPSILON, focus.maxY - focus.minY);
    const focusCenterX = (focus.minX + focus.maxX) / 2;
    const focusCenterY = (focus.minY + focus.maxY) / 2;
    const base = baseViewSize(viewportWidth, viewportHeight, focusWidth, focusHeight);
    const baseLeft = focusCenterX - base.width / 2;
    const baseRight = focusCenterX + base.width / 2;
    const baseTop = focusCenterY - base.height / 2;
    const baseBottom = focusCenterY + base.height / 2;
    const expandedLeft = focus.minX - focusWidth * MAINLAND_CONTEXT_EXPAND_X;
    const expandedRight = focus.maxX + focusWidth * MAINLAND_CONTEXT_EXPAND_X;
    const expandedTop = focus.minY - focusHeight * MAINLAND_CONTEXT_EXPAND_Y;
    const expandedBottom = focus.maxY + focusHeight * MAINLAND_CONTEXT_EXPAND_Y;
    cameraMetrics = {
      viewportWidth,
      viewportHeight,
      baseViewWidth: base.width,
      baseViewHeight: base.height,
      baseAreaRatio: (focusWidth * focusHeight) / Math.max(Number.EPSILON, base.width * base.height),
      focusCenterX,
      focusCenterY,
      worldBounds: {
        minX: Math.min(expandedLeft, baseLeft),
        minY: Math.min(expandedTop, baseTop),
        maxX: Math.max(expandedRight, baseRight),
        maxY: Math.max(expandedBottom, baseBottom),
      },
    };
    return cameraMetrics;
  };

  const viewBoxFor = (state: CameraState, metrics = readCameraMetrics()): SvgViewBox => {
    const zoom = clamp(state.zoom, PROVINCE_MAP_ZOOM_MIN, PROVINCE_MAP_ZOOM_MAX);
    const width = metrics.baseViewWidth / zoom;
    const height = metrics.baseViewHeight / zoom;
    return {
      x: state.centerX - width / 2,
      y: state.centerY - height / 2,
      width,
      height,
    };
  };

  const clampTargetToBounds = () => {
    const metrics = readCameraMetrics();
    target.zoom = clamp(target.zoom, PROVINCE_MAP_ZOOM_MIN, PROVINCE_MAP_ZOOM_MAX);
    const view = viewBoxFor(target, metrics);
    const nextCenterX = clampCameraCenter(
      target.centerX,
      view.width,
      metrics.worldBounds.minX,
      metrics.worldBounds.maxX,
    );
    const nextCenterY = clampCameraCenter(
      target.centerY,
      view.height,
      metrics.worldBounds.minY,
      metrics.worldBounds.maxY,
    );
    if (Math.abs(nextCenterX - target.centerX) > 0.0001 || Math.abs(nextCenterY - target.centerY) > 0.0001) {
      panClampCount += 1;
    }
    target.centerX = nextCenterX;
    target.centerY = nextCenterY;
  };

  const screenPointToWorld = (
    point: PointerPosition,
    state: CameraState,
    metrics = readCameraMetrics(),
  ): PointerPosition => {
    const view = viewBoxFor(state, metrics);
    const normalizedX = clamp(point.x / metrics.viewportWidth, 0, 1);
    const normalizedY = clamp(point.y / metrics.viewportHeight, 0, 1);
    return {
      x: view.x + view.width * normalizedX,
      y: view.y + view.height * normalizedY,
    };
  };

  const publishMultiTouchState = () => {
    container.dataset.mapMultitouchActive = multiTouchSequenceActive ? 'true' : 'false';
    container.dataset.mapMultitouchSequenceCount = String(multiTouchSequenceCount);
    container.dataset.mapMultitouchPointerCount = String(activeTouchPointerIds.size);
    container.dataset.mapMultitouchTapPending = pendingSuppressedTouchTap ? 'true' : 'false';
    container.dataset.mapSuppressedMultitouchTapCount = String(suppressedMultiTouchTapCount);
  };

  const publishState = () => {
    const metrics = readCameraMetrics();
    const currentView = viewBoxFor(current, metrics);
    const targetView = viewBoxFor(target, metrics);
    container.dataset.mapZoomCurrent = current.zoom.toFixed(5);
    container.dataset.mapZoomTarget = target.zoom.toFixed(5);
    container.dataset.mapZoomBaseScale = '1.000000';
    container.dataset.mapFocusAreaActual = metrics.baseAreaRatio.toFixed(6);
    container.dataset.mapCameraX = current.centerX.toFixed(3);
    container.dataset.mapCameraY = current.centerY.toFixed(3);
    container.dataset.mapCameraTargetX = target.centerX.toFixed(3);
    container.dataset.mapCameraTargetY = target.centerY.toFixed(3);
    container.dataset.mapCameraViewBox = formatViewBox(currentView);
    container.dataset.mapCameraTargetViewBox = formatViewBox(targetView);
    container.dataset.mapCameraWorldBounds = `${formatViewValue(metrics.worldBounds.minX)} ${formatViewValue(metrics.worldBounds.minY)} ${formatViewValue(metrics.worldBounds.maxX)} ${formatViewValue(metrics.worldBounds.maxY)}`;
    container.dataset.mapPanClampCount = String(panClampCount);
    container.dataset.mapZoomActive = active ? 'true' : 'false';
    container.dataset.mapZoomFrameCount = String(frameCount);
    container.dataset.mapCameraWriteCount = String(writeCount);
    container.dataset.mapZoomInputMode = inputMode;
    publishMultiTouchState();
  };

  const refreshTapSuppression = () => {
    suppressTapUntil = Date.now() + MULTITOUCH_TAP_SUPPRESS_MS;
  };

  const cancelMultiTouchIdleTimer = () => {
    if (multiTouchIdleTimer !== null) clearTimeout(multiTouchIdleTimer);
    multiTouchIdleTimer = null;
  };

  const scheduleMultiTouchInactiveFallback = () => {
    cancelMultiTouchIdleTimer();
    if (activeTouchPointerIds.size > 0) return;
    multiTouchIdleTimer = setTimeout(() => {
      multiTouchIdleTimer = null;
      if (destroyed) return;
      multiTouchSequenceActive = false;
      publishMultiTouchState();
    }, MULTITOUCH_TAP_SUPPRESS_MS);
  };

  const beginMultiTouchSequence = () => {
    const stateChanged = !multiTouchSequenceActive || !pendingSuppressedTouchTap;
    if (!multiTouchSequenceActive) multiTouchSequenceCount += 1;
    multiTouchSequenceActive = true;
    pendingSuppressedTouchTap = true;
    refreshTapSuppression();
    cancelMultiTouchIdleTimer();
    lastBlankTap = null;
    if (stateChanged) publishMultiTouchState();
  };

  const finishMultiTouchSequence = () => {
    if (!multiTouchSequenceActive) return;
    refreshTapSuppression();
    multiTouchSequenceActive = false;
    suppressNextDragClick = false;
    scheduleMultiTouchInactiveFallback();
    lastBlankTap = null;
    publishMultiTouchState();
  };

  const shouldSuppressTap = () => (
    multiTouchSequenceActive
    || Date.now() <= suppressTapUntil
    || pendingSuppressedTouchTap
  );

  const setActive = (nextActive: boolean) => {
    if (active === nextActive) return;
    active = nextActive;
    publishState();
  };

  const writeCamera = () => {
    frame = null;
    if (destroyed) return;
    current = { ...target };
    svg.setAttribute('viewBox', formatViewBox(viewBoxFor(current)));
    frameCount += 1;
    writeCount += 1;
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
    interactionBounds = null;
    cameraMetrics = null;
  };

  const scheduleSettle = () => {
    settleDeadline = performance.now() + INPUT_SETTLE_MS;
    if (settleTimer === null) settleTimer = setTimeout(finishSettle, INPUT_SETTLE_MS);
  };

  const scheduleWrite = (mode: Exclude<CameraInputMode, 'idle' | 'reset'>) => {
    inputMode = mode;
    if (!active) setActive(true);
    if (frame === null) frame = requestAnimationFrame(writeCamera);
    scheduleSettle();
  };

  const applyZoomAround = (logicalZoom: number, point: PointerPosition) => {
    const metrics = readCameraMetrics();
    const anchor = screenPointToWorld(point, target, metrics);
    target.zoom = clamp(logicalZoom, PROVINCE_MAP_ZOOM_MIN, PROVINCE_MAP_ZOOM_MAX);
    const nextView = viewBoxFor(target, metrics);
    const normalizedX = clamp(point.x / metrics.viewportWidth, 0, 1) - 0.5;
    const normalizedY = clamp(point.y / metrics.viewportHeight, 0, 1) - 0.5;
    target.centerX = anchor.x - normalizedX * nextView.width;
    target.centerY = anchor.y - normalizedY * nextView.height;
    clampTargetToBounds();
  };

  const reset = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    if (settleTimer !== null) clearTimeout(settleTimer);
    settleTimer = null;
    settleDeadline = 0;
    interactionBounds = null;
    cameraMetrics = null;
    const metrics = readCameraMetrics();
    target = {
      centerX: metrics.focusCenterX,
      centerY: metrics.focusCenterY,
      zoom: PROVINCE_MAP_ZOOM_MIN,
    };
    clampTargetToBounds();
    current = { ...target };
    inputMode = 'reset';
    active = false;
    svg.setAttribute('viewBox', formatViewBox(viewBoxFor(current, metrics)));
    writeCount += 1;
    publishState();
  };

  const handleWheel = (event: WheelEvent) => {
    if (destroyed) return;
    const delta = normalizeWheelDelta(event, container);
    if (!Number.isFinite(delta) || Math.abs(delta) < 0.01) return;
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY) * 1.2) return;
    event.preventDefault();
    event.stopPropagation();
    const point = localPoint(event.clientX, event.clientY);
    const logStep = clamp(
      -delta * WHEEL_ZOOM_SENSITIVITY,
      -MAX_WHEEL_LOG_STEP,
      MAX_WHEEL_LOG_STEP,
    );
    applyZoomAround(target.zoom * Math.exp(logStep), point);
    scheduleWrite('wheel');
  };

  const firstTwoTouchPositions = () => {
    const points = [...activeTouchPointerIds]
      .map((pointerId) => pointers.get(pointerId))
      .filter((point): point is PointerPosition => Boolean(point));
    return points.length >= 2 ? [points[0], points[1]] as const : null;
  };

  const updatePinchReference = () => {
    const points = firstTwoTouchPositions();
    if (!points) {
      pinchReference = null;
      return;
    }
    pinchReference = {
      midpoint: midpoint(points[0], points[1]),
      distance: Math.max(1, distance(points[0], points[1])),
    };
  };

  const handlePointerDown = (event: PointerEvent) => {
    if (destroyed || (event.pointerType === 'mouse' && event.button !== 0)) return;
    if (pointers.size === 0) {
      interactionBounds = null;
      cameraMetrics = null;
    }
    pointers.set(event.pointerId, localPoint(event.clientX, event.clientY));
    if (event.pointerType === 'touch') {
      activeTouchPointerIds.add(event.pointerId);
      if (activeTouchPointerIds.size >= 2) beginMultiTouchSequence();
      else {
        if (!multiTouchSequenceActive && Date.now() > suppressTapUntil) pendingSuppressedTouchTap = false;
        publishMultiTouchState();
      }
    }
    const captureTarget = event.target as Element & { setPointerCapture?: (pointerId: number) => void };
    captureTarget.setPointerCapture?.(event.pointerId);
    dragDistance = 0;
    if (activeTouchPointerIds.size >= 2) updatePinchReference();
  };

  const handlePointerMove = (event: PointerEvent) => {
    const previous = pointers.get(event.pointerId);
    if (!previous || destroyed) return;
    const next = localPoint(event.clientX, event.clientY);
    pointers.set(event.pointerId, next);

    if (pointers.size >= 2 && activeTouchPointerIds.size >= 2) {
      beginMultiTouchSequence();
      const points = firstTwoTouchPositions();
      if (!points) return;
      const nextMidpoint = midpoint(points[0], points[1]);
      const nextDistance = Math.max(1, distance(points[0], points[1]));
      const reference = pinchReference ?? { midpoint: nextMidpoint, distance: nextDistance };
      const metrics = readCameraMetrics();
      const anchor = screenPointToWorld(reference.midpoint, target, metrics);
      target.zoom = clamp(target.zoom * (nextDistance / reference.distance), PROVINCE_MAP_ZOOM_MIN, PROVINCE_MAP_ZOOM_MAX);
      const nextView = viewBoxFor(target, metrics);
      const normalizedX = clamp(nextMidpoint.x / metrics.viewportWidth, 0, 1) - 0.5;
      const normalizedY = clamp(nextMidpoint.y / metrics.viewportHeight, 0, 1) - 0.5;
      target.centerX = anchor.x - normalizedX * nextView.width;
      target.centerY = anchor.y - normalizedY * nextView.height;
      clampTargetToBounds();
      pinchReference = { midpoint: nextMidpoint, distance: nextDistance };
      dragDistance += Math.hypot(next.x - previous.x, next.y - previous.y);
      suppressNextDragClick = true;
      scheduleWrite('pinch');
      return;
    }

    const dx = next.x - previous.x;
    const dy = next.y - previous.y;
    if (dx === 0 && dy === 0) return;
    const metrics = readCameraMetrics();
    const view = viewBoxFor(target, metrics);
    target.centerX -= dx / metrics.viewportWidth * view.width;
    target.centerY -= dy / metrics.viewportHeight * view.height;
    clampTargetToBounds();
    dragDistance += Math.hypot(dx, dy);
    if (dragDistance > POINTER_DRAG_THRESHOLD) suppressNextDragClick = true;
    scheduleWrite('move');
  };

  const handlePointerEnd = (event: PointerEvent) => {
    const wasTracked = pointers.has(event.pointerId);
    if (!wasTracked) return;
    const endPoint = localPoint(event.clientX, event.clientY);
    pointers.delete(event.pointerId);
    if (event.pointerType === 'touch') {
      activeTouchPointerIds.delete(event.pointerId);
      if (multiTouchSequenceActive && activeTouchPointerIds.size === 0) finishMultiTouchSequence();
      else {
        if (multiTouchSequenceActive) refreshTapSuppression();
        publishMultiTouchState();
      }
    }
    updatePinchReference();
    if (pointers.size === 0 && active && settleTimer === null) {
      inputMode = 'idle';
      setActive(false);
      interactionBounds = null;
      cameraMetrics = null;
    }

    if (
      event.pointerType === 'touch'
      && dragDistance <= POINTER_DRAG_THRESHOLD
      && !isProvinceTarget(event.target)
    ) {
      if (shouldSuppressTap()) {
        lastBlankTap = null;
        return;
      }
      const rawTime = Number(event.timeStamp);
      const at = Number.isFinite(rawTime) && rawTime > 0 ? rawTime : performance.now();
      const previousTap = lastBlankTap;
      lastBlankTap = { at, ...endPoint };
      if (previousTap) {
        const elapsed = at - previousTap.at;
        const tapDistance = Math.hypot(endPoint.x - previousTap.x, endPoint.y - previousTap.y);
        if (
          elapsed >= 0
          && elapsed <= MOBILE_BLANK_DOUBLE_TAP_MS
          && tapDistance <= MOBILE_BLANK_DOUBLE_TAP_DISTANCE
        ) {
          lastBlankTap = null;
          reset();
          container.dataset.mapCameraReset = 'blank-double-tap';
        }
      }
    }
  };

  const handleTouchStart = (event: TouchEvent) => {
    if (event.touches.length >= 2) {
      beginMultiTouchSequence();
      return;
    }
    if (event.touches.length === 1 && !multiTouchSequenceActive && Date.now() > suppressTapUntil) {
      pendingSuppressedTouchTap = false;
      publishMultiTouchState();
    }
  };

  const handleTouchMove = (event: TouchEvent) => {
    if (event.touches.length >= 2) beginMultiTouchSequence();
  };

  const handleTouchEnd = (event: TouchEvent) => {
    if (!multiTouchSequenceActive) return;
    if (event.touches.length === 0) {
      activeTouchPointerIds.clear();
      finishMultiTouchSequence();
      return;
    }
    refreshTapSuppression();
    publishMultiTouchState();
  };

  const handleDoubleClick = (event: MouseEvent) => {
    if (destroyed || isProvinceTarget(event.target) || shouldSuppressTap()) return;
    event.preventDefault();
    reset();
    container.dataset.mapCameraReset = 'blank-double-click';
  };

  const handleClickCapture = (event: MouseEvent) => {
    if (shouldSuppressTap()) {
      pendingSuppressedTouchTap = false;
      suppressNextDragClick = false;
      suppressedMultiTouchTapCount += 1;
      lastBlankTap = null;
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

  container.addEventListener('wheel', handleWheel, { passive: false });
  container.addEventListener('pointerdown', handlePointerDown, true);
  container.addEventListener('pointermove', handlePointerMove, true);
  container.addEventListener('pointerup', handlePointerEnd, true);
  container.addEventListener('pointercancel', handlePointerEnd, true);
  container.addEventListener('touchstart', handleTouchStart, { passive: true, capture: true });
  container.addEventListener('touchmove', handleTouchMove, { passive: true, capture: true });
  container.addEventListener('touchend', handleTouchEnd, { passive: true, capture: true });
  container.addEventListener('touchcancel', handleTouchEnd, { passive: true, capture: true });
  container.addEventListener('dblclick', handleDoubleClick);
  container.addEventListener('click', handleClickCapture, true);
  reset();

  return {
    reset,
    destroy: () => {
      destroyed = true;
      if (frame !== null) cancelAnimationFrame(frame);
      if (settleTimer !== null) clearTimeout(settleTimer);
      cancelMultiTouchIdleTimer();
      frame = null;
      settleTimer = null;
      settleDeadline = 0;
      interactionBounds = null;
      cameraMetrics = null;
      pointers.clear();
      activeTouchPointerIds.clear();
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('pointerdown', handlePointerDown, true);
      container.removeEventListener('pointermove', handlePointerMove, true);
      container.removeEventListener('pointerup', handlePointerEnd, true);
      container.removeEventListener('pointercancel', handlePointerEnd, true);
      container.removeEventListener('touchstart', handleTouchStart, true);
      container.removeEventListener('touchmove', handleTouchMove, true);
      container.removeEventListener('touchend', handleTouchEnd, true);
      container.removeEventListener('touchcancel', handleTouchEnd, true);
      container.removeEventListener('dblclick', handleDoubleClick);
      container.removeEventListener('click', handleClickCapture, true);
      svg.setAttribute('viewBox', formatViewBox(sourceViewBox));
    },
  };
}
