export const PROVINCE_MAP_ZOOM_MIN = 0.5;
export const PROVINCE_MAP_ZOOM_MAX = 4;

const WHEEL_ZOOM_SENSITIVITY = 0.0016;
const MAX_WHEEL_LOG_STEP = 0.2;
const POINTER_DRAG_THRESHOLD = 4;
const INPUT_SETTLE_MS = 90;
const MOBILE_BLANK_DOUBLE_TAP_MS = 360;
const MOBILE_BLANK_DOUBLE_TAP_DISTANCE = 28;
const MULTITOUCH_TAP_SUPPRESS_MS = 420;

interface CameraState {
  x: number;
  y: number;
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

export function createProvinceMapCamera(
  container: HTMLElement,
  surface: HTMLElement,
): ProvinceMapCameraController {
  let current: CameraState = { x: 0, y: 0, zoom: 1 };
  let target: CameraState = { ...current };
  let frame: number | null = null;
  let settleTimer: ReturnType<typeof setTimeout> | null = null;
  let multiTouchIdleTimer: ReturnType<typeof setTimeout> | null = null;
  let frameCount = 0;
  let writeCount = 0;
  let inputMode: CameraInputMode = 'idle';
  let active = false;
  let destroyed = false;
  let dragDistance = 0;
  let suppressNextDragClick = false;
  let pinchReference: PinchReference | null = null;
  let interactionBounds: ContainerBounds | null = null;
  let lastBlankTap: { at: number; x: number; y: number } | null = null;
  let multiTouchSequenceActive = false;
  let multiTouchSequenceCount = 0;
  let pendingSuppressedTouchTap = false;
  let suppressTapUntil = 0;
  let suppressedMultiTouchTapCount = 0;
  const pointers = new Map<number, PointerPosition>();
  const activeTouchPointerIds = new Set<number>();

  container.dataset.mapRenderer = 'static-svg';
  container.dataset.mapCameraMode = 'html-compositor-transform';
  container.dataset.mapCameraHotPath = 'single-css-transform';
  container.dataset.mapCameraGeometryMode = 'immutable-svg-world';
  container.dataset.mapZoomMode = 'compositor';
  container.dataset.mapZoomCameraMode = 'static-svg-compositor';
  container.dataset.mapZoomHotPath = 'css-transform';
  container.dataset.mapZoomCommitMode = 'none';
  container.dataset.mapTapSuppressMs = String(MULTITOUCH_TAP_SUPPRESS_MS);

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
    active = nextActive;
    surface.style.willChange = nextActive ? 'transform' : '';
    publishState();
  };

  const writeCamera = () => {
    frame = null;
    if (destroyed) return;
    current = { ...target };
    surface.style.transform = `translate3d(${current.x.toFixed(3)}px, ${current.y.toFixed(3)}px, 0) scale(${current.zoom.toFixed(6)})`;
    frameCount += 1;
    writeCount += 1;
    publishState();
  };

  const scheduleWrite = (mode: Exclude<CameraInputMode, 'idle' | 'reset'>) => {
    inputMode = mode;
    if (!active) setActive(true);
    if (frame === null) frame = requestAnimationFrame(writeCamera);
    if (settleTimer !== null) clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      settleTimer = null;
      interactionBounds = null;
      inputMode = 'idle';
      setActive(false);
    }, INPUT_SETTLE_MS);
  };

  const applyZoomAround = (zoom: number, point: PointerPosition) => {
    const nextZoom = clamp(zoom, PROVINCE_MAP_ZOOM_MIN, PROVINCE_MAP_ZOOM_MAX);
    const localX = (point.x - target.x) / Math.max(Number.EPSILON, target.zoom);
    const localY = (point.y - target.y) / Math.max(Number.EPSILON, target.zoom);
    target = {
      zoom: nextZoom,
      x: point.x - localX * nextZoom,
      y: point.y - localY * nextZoom,
    };
  };

  const reset = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    if (settleTimer !== null) clearTimeout(settleTimer);
    settleTimer = null;
    interactionBounds = null;
    current = { x: 0, y: 0, zoom: 1 };
    target = { ...current };
    inputMode = 'reset';
    active = false;
    surface.style.willChange = '';
    surface.style.transform = 'translate3d(0px, 0px, 0) scale(1)';
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
    if (pointers.size === 0) interactionBounds = null;
    pointers.set(event.pointerId, localPoint(event.clientX, event.clientY));
    if (event.pointerType === 'touch') {
      activeTouchPointerIds.add(event.pointerId);
      if (activeTouchPointerIds.size >= 2) beginMultiTouchSequence();
      else if (!multiTouchSequenceActive && Date.now() > suppressTapUntil) pendingSuppressedTouchTap = false;
      publishMultiTouchState();
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
      target.x += nextMidpoint.x - reference.midpoint.x;
      target.y += nextMidpoint.y - reference.midpoint.y;
      applyZoomAround(target.zoom * (nextDistance / reference.distance), nextMidpoint);
      pinchReference = { midpoint: nextMidpoint, distance: nextDistance };
      dragDistance += Math.hypot(next.x - previous.x, next.y - previous.y);
      suppressNextDragClick = true;
      scheduleWrite('pinch');
      return;
    }

    const dx = next.x - previous.x;
    const dy = next.y - previous.y;
    if (dx === 0 && dy === 0) return;
    target.x += dx;
    target.y += dy;
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
      else if (multiTouchSequenceActive) refreshTapSuppression();
      publishMultiTouchState();
    }
    updatePinchReference();
    if (pointers.size === 0 && active && settleTimer === null) {
      interactionBounds = null;
      inputMode = 'idle';
      setActive(false);
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
      interactionBounds = null;
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
      surface.style.willChange = '';
    },
  };
}
