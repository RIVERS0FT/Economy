import type { EChartsType } from '../charts/echartsCore';

const MAP_SERIES_ID = 'us-mainland-map';
export const MAP_ZOOM_MIN = 0.5;
export const MAP_ZOOM_MAX = 4;
const WHEEL_ZOOM_SENSITIVITY = 0.0016;
const MAX_WHEEL_LOG_STEP = 0.2;
const MAX_FRAME_LOG_STEP = Math.log(1.11);
const WHEEL_RESPONSE_MS = 60;
const PINCH_RESPONSE_MS = 50;
const WHEEL_COMMIT_IDLE_MS = 96;
const PINCH_COMMIT_IDLE_MS = 80;
const ZOOM_SETTLE_LOG_EPSILON = 0.001;
const ZOOM_TRANSFORM_LOG_EPSILON = 0.000001;
const MAX_FRAME_DELTA_MS = 50;
const MULTITOUCH_TAP_SUPPRESS_MS = 420;

export interface ProvinceMapZoomInterpolator {
  reset: (zoom?: number) => void;
  cancel: () => void;
  shouldSuppressTap: () => boolean;
  destroy: () => void;
}

interface PinchEventLike {
  pinchScale?: number;
  pinchX?: number;
  pinchY?: number;
  event?: Event;
}

interface WheelBounds {
  left: number;
  top: number;
}

type ZoomInputMode = 'idle' | 'wheel' | 'pinch' | 'reset';

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function currentMapZoom(chart: EChartsType) {
  const option = chart.getOption() as { series?: Array<{ id?: string; zoom?: number }> };
  const series = option.series?.find((candidate) => candidate.id === MAP_SERIES_ID) ?? option.series?.[0];
  const zoom = Number(series?.zoom ?? 1);
  return Number.isFinite(zoom) && zoom > 0 ? clamp(zoom, MAP_ZOOM_MIN, MAP_ZOOM_MAX) : 1;
}

function normalizeWheelDelta(event: WheelEvent, container: HTMLElement) {
  const modeScale = event.deltaMode === 1
    ? 16
    : event.deltaMode === 2
      ? Math.max(1, container.clientHeight)
      : 1;
  return Number(event.deltaY) * modeScale;
}

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function zoomStepMagnitude(step: number) {
  return step >= 1 ? step : 1 / Math.max(Number.EPSILON, step);
}

export function createProvinceMapZoomInterpolator(
  chart: EChartsType,
  syncCameraImmediately?: () => void,
): ProvinceMapZoomInterpolator {
  const container = chart.getDom();
  const reducedMotionQuery = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;
  const activeTouchPointerIds = new Set<number>();
  let reducedMotion = reducedMotionQuery?.matches ?? prefersReducedMotion();
  let committedZoom = currentMapZoom(chart);
  let currentZoom = committedZoom;
  let targetZoom = committedZoom;
  let originX = chart.getWidth() / 2;
  let originY = chart.getHeight() / 2;
  let responseMs = WHEEL_RESPONSE_MS;
  let frame: number | null = null;
  let settleTimer: ReturnType<typeof setTimeout> | null = null;
  let multiTouchIdleTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingTapClearTimer: ReturnType<typeof setTimeout> | null = null;
  let lastFrameTime: number | null = null;
  let frameCount = 0;
  let commitCount = 0;
  let lastStepMagnitude = 1;
  let maxStepMagnitude = 1;
  let inputMode: ZoomInputMode = 'idle';
  let transientActive = false;
  let settleRequested = false;
  let multiTouchSequenceActive = false;
  let multiTouchSequenceCount = 0;
  let pendingSuppressedTouchTap = false;
  let suppressTapUntil = 0;
  let wheelBounds: WheelBounds | null = null;
  let destroyed = false;

  const publishMultiTouchState = () => {
    container.dataset.mapMultitouchActive = multiTouchSequenceActive ? 'true' : 'false';
    container.dataset.mapMultitouchSequenceCount = String(multiTouchSequenceCount);
    container.dataset.mapMultitouchPointerCount = String(activeTouchPointerIds.size);
    container.dataset.mapMultitouchTapPending = pendingSuppressedTouchTap ? 'true' : 'false';
    container.dataset.mapTapSuppressMs = String(MULTITOUCH_TAP_SUPPRESS_MS);
  };

  const refreshTapSuppression = () => {
    suppressTapUntil = Date.now() + MULTITOUCH_TAP_SUPPRESS_MS;
  };

  const cancelPendingTapClearTimer = () => {
    if (pendingTapClearTimer !== null) clearTimeout(pendingTapClearTimer);
    pendingTapClearTimer = null;
  };

  const setPendingSuppressedTouchTap = (pending: boolean) => {
    cancelPendingTapClearTimer();
    if (pendingSuppressedTouchTap === pending) return;
    pendingSuppressedTouchTap = pending;
    publishMultiTouchState();
  };

  const shouldSuppressPendingTap = () => {
    if (!pendingSuppressedTouchTap) return false;
    if (pendingTapClearTimer === null) {
      pendingTapClearTimer = setTimeout(() => {
        pendingTapClearTimer = null;
        if (destroyed) return;
        pendingSuppressedTouchTap = false;
        publishMultiTouchState();
      }, 0);
    }
    return true;
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
    setPendingSuppressedTouchTap(true);
    refreshTapSuppression();
    scheduleMultiTouchInactiveFallback();
    publishMultiTouchState();
  };

  const finishMultiTouchSequence = () => {
    if (!multiTouchSequenceActive) return;
    refreshTapSuppression();
    multiTouchSequenceActive = false;
    cancelMultiTouchIdleTimer();
    publishMultiTouchState();
  };

  const publishStaticState = () => {
    container.dataset.mapZoomMode = 'interpolated';
    container.dataset.mapZoomCameraMode = 'echarts-geo-roam';
    container.dataset.mapZoomHotPath = 'geo-roam';
    container.dataset.mapZoomCommitMode = 'settle-marker';
  };

  const publishState = (active: boolean) => {
    container.dataset.mapZoomCurrent = currentZoom.toFixed(5);
    container.dataset.mapZoomCommitted = committedZoom.toFixed(5);
    container.dataset.mapZoomTarget = targetZoom.toFixed(5);
    container.dataset.mapZoomActive = active ? 'true' : 'false';
    container.dataset.mapZoomFrameCount = String(frameCount);
    container.dataset.mapZoomCommitCount = String(commitCount);
    container.dataset.mapZoomLastStep = lastStepMagnitude.toFixed(5);
    container.dataset.mapZoomMaxStep = maxStepMagnitude.toFixed(5);
    container.dataset.mapZoomInputMode = inputMode;
    container.dataset.mapZoomResponseMs = String(responseMs);
    publishMultiTouchState();
  };

  const applyCameraZoomStep = (nextZoom: number) => {
    const incrementalScale = nextZoom / Math.max(Number.EPSILON, currentZoom);
    const logStep = Math.log(incrementalScale);
    if (!Number.isFinite(logStep) || Math.abs(logStep) <= ZOOM_TRANSFORM_LOG_EPSILON) {
      currentZoom = nextZoom;
      return;
    }
    chart.dispatchAction({
      type: 'geoRoam',
      seriesId: MAP_SERIES_ID,
      zoom: incrementalScale,
      originX,
      originY,
    } as Parameters<EChartsType['dispatchAction']>[0]);
    currentZoom = nextZoom;
    lastStepMagnitude = zoomStepMagnitude(incrementalScale);
    maxStepMagnitude = Math.max(maxStepMagnitude, lastStepMagnitude);
    frameCount += 1;
    syncCameraImmediately?.();
  };

  const cancelFrame = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    lastFrameTime = null;
  };

  const cancelSettleTimer = () => {
    if (settleTimer !== null) clearTimeout(settleTimer);
    settleTimer = null;
    settleRequested = false;
  };

  const commitSettledZoom = () => {
    if (!transientActive || destroyed || chart.isDisposed()) return;
    committedZoom = currentMapZoom(chart);
    currentZoom = committedZoom;
    targetZoom = committedZoom;
    transientActive = false;
    settleRequested = false;
    wheelBounds = null;
    lastFrameTime = null;
    commitCount += 1;
    publishState(false);
  };

  const animate = (timestamp: number) => {
    frame = null;
    if (destroyed || chart.isDisposed()) return;

    const currentLog = Math.log(currentZoom);
    const targetLog = Math.log(targetZoom);
    const remainingLog = targetLog - currentLog;
    if (Math.abs(remainingLog) <= ZOOM_SETTLE_LOG_EPSILON) {
      applyCameraZoomStep(targetZoom);
      currentZoom = targetZoom;
      if (settleRequested) commitSettledZoom();
      else publishState(true);
      lastFrameTime = null;
      return;
    }

    const deltaTime = lastFrameTime === null
      ? 1000 / 60
      : clamp(timestamp - lastFrameTime, 1, MAX_FRAME_DELTA_MS);
    lastFrameTime = timestamp;
    const alpha = reducedMotion || responseMs <= 0
      ? 1
      : 1 - Math.exp(-deltaTime / responseMs);
    const rawLogStep = remainingLog * alpha;
    const logStep = reducedMotion
      ? remainingLog
      : clamp(rawLogStep, -MAX_FRAME_LOG_STEP, MAX_FRAME_LOG_STEP);
    let nextZoom = clamp(Math.exp(currentLog + logStep), MAP_ZOOM_MIN, MAP_ZOOM_MAX);
    if (Math.abs(Math.log(targetZoom / nextZoom)) <= ZOOM_SETTLE_LOG_EPSILON) {
      nextZoom = targetZoom;
    }
    applyCameraZoomStep(nextZoom);

    if (currentZoom === targetZoom) {
      if (settleRequested) commitSettledZoom();
      else publishState(true);
      lastFrameTime = null;
      return;
    }

    publishState(true);
    frame = requestAnimationFrame(animate);
  };

  const schedule = () => {
    if (destroyed || chart.isDisposed() || frame !== null) return;
    frame = requestAnimationFrame(animate);
  };

  const scheduleSettleCommit = (mode: Exclude<ZoomInputMode, 'idle' | 'reset'>) => {
    if (settleTimer !== null) clearTimeout(settleTimer);
    settleRequested = false;
    settleTimer = setTimeout(() => {
      settleTimer = null;
      settleRequested = true;
      if (Math.abs(Math.log(targetZoom / currentZoom)) <= ZOOM_SETTLE_LOG_EPSILON) {
        applyCameraZoomStep(targetZoom);
        currentZoom = targetZoom;
        commitSettledZoom();
        return;
      }
      schedule();
    }, mode === 'pinch' ? PINCH_COMMIT_IDLE_MS : WHEEL_COMMIT_IDLE_MS);
  };

  const beginTransientZoom = () => {
    if (transientActive) return;
    committedZoom = currentMapZoom(chart);
    currentZoom = committedZoom;
    targetZoom = committedZoom;
    transientActive = true;
    chart.dispatchAction({ type: 'hideTip' });
  };

  const setTargetZoom = (
    zoom: number,
    nextOriginX: number,
    nextOriginY: number,
    mode: Exclude<ZoomInputMode, 'idle' | 'reset'>,
  ) => {
    const nextZoom = clamp(zoom, MAP_ZOOM_MIN, MAP_ZOOM_MAX);
    if (!Number.isFinite(nextZoom)) return;
    beginTransientZoom();
    originX = clamp(nextOriginX, 0, Math.max(0, chart.getWidth()));
    originY = clamp(nextOriginY, 0, Math.max(0, chart.getHeight()));
    targetZoom = nextZoom;
    inputMode = mode;
    responseMs = mode === 'pinch' ? PINCH_RESPONSE_MS : WHEEL_RESPONSE_MS;
    scheduleSettleCommit(mode);
    publishState(true);
    if (Math.abs(Math.log(targetZoom / currentZoom)) <= ZOOM_TRANSFORM_LOG_EPSILON) {
      currentZoom = targetZoom;
      publishState(true);
      return;
    }
    schedule();
  };

  const handleWheel = (event: WheelEvent) => {
    if (destroyed || chart.isDisposed()) return;
    const delta = normalizeWheelDelta(event, container);
    if (!Number.isFinite(delta) || Math.abs(delta) < 0.01) return;
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY) * 1.2) return;
    event.preventDefault();
    event.stopPropagation();
    if (!wheelBounds) {
      const bounds = container.getBoundingClientRect();
      wheelBounds = { left: bounds.left, top: bounds.top };
    }
    const nextOriginX = Number.isFinite(event.clientX) ? event.clientX - wheelBounds.left : chart.getWidth() / 2;
    const nextOriginY = Number.isFinite(event.clientY) ? event.clientY - wheelBounds.top : chart.getHeight() / 2;
    const inputLogStep = clamp(
      -delta * WHEEL_ZOOM_SENSITIVITY,
      -MAX_WHEEL_LOG_STEP,
      MAX_WHEEL_LOG_STEP,
    );
    setTargetZoom(
      targetZoom * Math.exp(inputLogStep),
      nextOriginX,
      nextOriginY,
      'wheel',
    );
  };

  const handlePinch = (rawEvent: unknown) => {
    if (destroyed || chart.isDisposed()) return;
    const event = rawEvent as PinchEventLike;
    const pinchScale = Number(event.pinchScale);
    const pinchX = Number(event.pinchX);
    const pinchY = Number(event.pinchY);
    if (!(pinchScale > 0) || !Number.isFinite(pinchScale)) return;
    wheelBounds = null;
    beginMultiTouchSequence();
    event.event?.preventDefault?.();
    setTargetZoom(
      targetZoom * pinchScale,
      Number.isFinite(pinchX) ? pinchX : chart.getWidth() / 2,
      Number.isFinite(pinchY) ? pinchY : chart.getHeight() / 2,
      'pinch',
    );
  };

  const handlePointerDown = (event: PointerEvent) => {
    if (event.pointerType === 'touch') {
      activeTouchPointerIds.add(event.pointerId);
      if (activeTouchPointerIds.size >= 2) {
        beginMultiTouchSequence();
        return;
      }
      publishMultiTouchState();
    }
    if (multiTouchSequenceActive || Date.now() <= suppressTapUntil) return;
    setPendingSuppressedTouchTap(false);
  };

  const handlePointerUp = (event: PointerEvent) => {
    if (event.pointerType !== 'touch') return;
    activeTouchPointerIds.delete(event.pointerId);
    if (multiTouchSequenceActive && activeTouchPointerIds.size === 0) {
      finishMultiTouchSequence();
      return;
    }
    publishMultiTouchState();
  };

  const handleTouchStart = (event: TouchEvent) => {
    if (event.touches.length >= 2) {
      beginMultiTouchSequence();
      return;
    }
    if (event.touches.length !== 1) return;
    setPendingSuppressedTouchTap(multiTouchSequenceActive || Date.now() <= suppressTapUntil);
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
    scheduleMultiTouchInactiveFallback();
    publishMultiTouchState();
  };

  const handleReducedMotionChange = (event: MediaQueryListEvent) => {
    reducedMotion = event.matches;
  };

  container.addEventListener('wheel', handleWheel, { passive: false });
  container.addEventListener('pointerdown', handlePointerDown, { passive: true, capture: true });
  container.addEventListener('pointerup', handlePointerUp, { passive: true, capture: true });
  container.addEventListener('pointercancel', handlePointerUp, { passive: true, capture: true });
  container.addEventListener('touchstart', handleTouchStart, { passive: true, capture: true });
  container.addEventListener('touchmove', handleTouchMove, { passive: true, capture: true });
  container.addEventListener('touchend', handleTouchEnd, { passive: true, capture: true });
  container.addEventListener('touchcancel', handleTouchEnd, { passive: true, capture: true });
  chart.getZr().on('pinch', handlePinch);
  reducedMotionQuery?.addEventListener('change', handleReducedMotionChange);
  publishStaticState();
  publishState(false);

  return {
    reset: (zoom = 1) => {
      cancelFrame();
      cancelSettleTimer();
      committedZoom = clamp(zoom, MAP_ZOOM_MIN, MAP_ZOOM_MAX);
      currentZoom = committedZoom;
      targetZoom = committedZoom;
      originX = chart.getWidth() / 2;
      originY = chart.getHeight() / 2;
      responseMs = WHEEL_RESPONSE_MS;
      inputMode = 'reset';
      transientActive = false;
      wheelBounds = null;
      lastStepMagnitude = 1;
      publishState(false);
    },
    cancel: () => {
      cancelFrame();
      cancelSettleTimer();
      committedZoom = currentMapZoom(chart);
      currentZoom = committedZoom;
      targetZoom = committedZoom;
      inputMode = 'idle';
      transientActive = false;
      wheelBounds = null;
      syncCameraImmediately?.();
      publishState(false);
    },
    shouldSuppressTap: () => multiTouchSequenceActive || Date.now() <= suppressTapUntil || shouldSuppressPendingTap(),
    destroy: () => {
      destroyed = true;
      cancelFrame();
      cancelSettleTimer();
      cancelMultiTouchIdleTimer();
      cancelPendingTapClearTimer();
      activeTouchPointerIds.clear();
      wheelBounds = null;
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('pointerdown', handlePointerDown, true);
      container.removeEventListener('pointerup', handlePointerUp, true);
      container.removeEventListener('pointercancel', handlePointerUp, true);
      container.removeEventListener('touchstart', handleTouchStart, true);
      container.removeEventListener('touchmove', handleTouchMove, true);
      container.removeEventListener('touchend', handleTouchEnd, true);
      container.removeEventListener('touchcancel', handleTouchEnd, true);
      if (!chart.isDisposed()) chart.getZr().off('pinch', handlePinch);
      reducedMotionQuery?.removeEventListener('change', handleReducedMotionChange);
      delete container.dataset.mapZoomMode;
      delete container.dataset.mapZoomCurrent;
      delete container.dataset.mapZoomCommitted;
      delete container.dataset.mapZoomTarget;
      delete container.dataset.mapZoomActive;
      delete container.dataset.mapZoomFrameCount;
      delete container.dataset.mapZoomCommitCount;
      delete container.dataset.mapZoomLastStep;
      delete container.dataset.mapZoomMaxStep;
      delete container.dataset.mapZoomInputMode;
      delete container.dataset.mapZoomResponseMs;
      delete container.dataset.mapZoomCameraMode;
      delete container.dataset.mapZoomHotPath;
      delete container.dataset.mapZoomCommitMode;
      delete container.dataset.mapMultitouchActive;
      delete container.dataset.mapMultitouchSequenceCount;
      delete container.dataset.mapMultitouchPointerCount;
      delete container.dataset.mapMultitouchTapPending;
      delete container.dataset.mapTapSuppressMs;
    },
  };
}
