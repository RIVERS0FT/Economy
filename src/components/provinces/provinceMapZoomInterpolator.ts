import type { EChartsType } from '../charts/echartsCore';

const MAP_SERIES_ID = 'us-mainland-map';
export const MAP_ZOOM_MIN = 0.5;
export const MAP_ZOOM_MAX = 4;
const WHEEL_ZOOM_SENSITIVITY = 0.0016;
const MAX_WHEEL_LOG_STEP = 0.2;
const MAX_FRAME_LOG_STEP = Math.log(1.11);
const WHEEL_RESPONSE_MS = 60;
const PINCH_RESPONSE_MS = 50;
const ZOOM_SETTLE_LOG_EPSILON = 0.001;
const ZOOM_DISPATCH_LOG_EPSILON = 0.000001;
const MAX_FRAME_DELTA_MS = 50;

export interface ProvinceMapZoomInterpolator {
  reset: (zoom?: number) => void;
  cancel: () => void;
  destroy: () => void;
}

interface PinchEventLike {
  pinchScale?: number;
  pinchX?: number;
  pinchY?: number;
  event?: Event;
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

export function createProvinceMapZoomInterpolator(chart: EChartsType): ProvinceMapZoomInterpolator {
  const container = chart.getDom();
  let currentZoom = currentMapZoom(chart);
  let targetZoom = currentZoom;
  let originX = chart.getWidth() / 2;
  let originY = chart.getHeight() / 2;
  let responseMs = WHEEL_RESPONSE_MS;
  let frame: number | null = null;
  let lastFrameTime: number | null = null;
  let frameCount = 0;
  let lastStepMagnitude = 1;
  let maxStepMagnitude = 1;
  let inputMode: ZoomInputMode = 'idle';
  let destroyed = false;

  const publishState = (active: boolean) => {
    container.dataset.mapZoomMode = 'interpolated';
    container.dataset.mapZoomCurrent = currentZoom.toFixed(5);
    container.dataset.mapZoomTarget = targetZoom.toFixed(5);
    container.dataset.mapZoomActive = active ? 'true' : 'false';
    container.dataset.mapZoomFrameCount = String(frameCount);
    container.dataset.mapZoomLastStep = lastStepMagnitude.toFixed(5);
    container.dataset.mapZoomMaxStep = maxStepMagnitude.toFixed(5);
    container.dataset.mapZoomInputMode = inputMode;
    container.dataset.mapZoomResponseMs = String(responseMs);
  };

  const dispatchIncrementalZoom = (incrementalScale: number) => {
    const logStep = Math.log(incrementalScale);
    if (!Number.isFinite(logStep) || Math.abs(logStep) <= ZOOM_DISPATCH_LOG_EPSILON) return;
    chart.dispatchAction({
      type: 'geoRoam',
      seriesId: MAP_SERIES_ID,
      zoom: incrementalScale,
      originX,
      originY,
    } as Parameters<EChartsType['dispatchAction']>[0]);
    lastStepMagnitude = zoomStepMagnitude(incrementalScale);
    maxStepMagnitude = Math.max(maxStepMagnitude, lastStepMagnitude);
    frameCount += 1;
  };

  const cancelFrame = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    lastFrameTime = null;
  };

  const animate = (timestamp: number) => {
    frame = null;
    if (destroyed || chart.isDisposed()) return;

    const currentLog = Math.log(currentZoom);
    const targetLog = Math.log(targetZoom);
    const remainingLog = targetLog - currentLog;
    if (Math.abs(remainingLog) <= ZOOM_SETTLE_LOG_EPSILON) {
      dispatchIncrementalZoom(targetZoom / currentZoom);
      currentZoom = targetZoom;
      publishState(false);
      lastFrameTime = null;
      return;
    }

    const deltaTime = lastFrameTime === null
      ? 1000 / 60
      : clamp(timestamp - lastFrameTime, 1, MAX_FRAME_DELTA_MS);
    lastFrameTime = timestamp;
    const reducedMotion = prefersReducedMotion();
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
    dispatchIncrementalZoom(nextZoom / currentZoom);
    currentZoom = nextZoom;

    if (currentZoom === targetZoom) {
      publishState(false);
      lastFrameTime = null;
      return;
    }

    publishState(true);
    frame = requestAnimationFrame(animate);
  };

  const schedule = () => {
    if (destroyed || chart.isDisposed() || frame !== null) return;
    publishState(true);
    frame = requestAnimationFrame(animate);
  };

  const setTargetZoom = (
    zoom: number,
    nextOriginX: number,
    nextOriginY: number,
    mode: Exclude<ZoomInputMode, 'idle' | 'reset'>,
  ) => {
    const nextZoom = clamp(zoom, MAP_ZOOM_MIN, MAP_ZOOM_MAX);
    if (!Number.isFinite(nextZoom)) return;
    originX = clamp(nextOriginX, 0, Math.max(0, chart.getWidth()));
    originY = clamp(nextOriginY, 0, Math.max(0, chart.getHeight()));
    targetZoom = nextZoom;
    inputMode = mode;
    responseMs = mode === 'pinch' ? PINCH_RESPONSE_MS : WHEEL_RESPONSE_MS;
    if (Math.abs(Math.log(targetZoom / currentZoom)) <= ZOOM_DISPATCH_LOG_EPSILON) {
      currentZoom = targetZoom;
      publishState(false);
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
    const bounds = container.getBoundingClientRect();
    const nextOriginX = Number.isFinite(event.clientX) ? event.clientX - bounds.left : chart.getWidth() / 2;
    const nextOriginY = Number.isFinite(event.clientY) ? event.clientY - bounds.top : chart.getHeight() / 2;
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
    event.event?.preventDefault?.();
    setTargetZoom(
      targetZoom * pinchScale,
      Number.isFinite(pinchX) ? pinchX : chart.getWidth() / 2,
      Number.isFinite(pinchY) ? pinchY : chart.getHeight() / 2,
      'pinch',
    );
  };

  container.addEventListener('wheel', handleWheel, { passive: false });
  chart.getZr().on('pinch', handlePinch);
  publishState(false);

  return {
    reset: (zoom = 1) => {
      cancelFrame();
      currentZoom = clamp(zoom, MAP_ZOOM_MIN, MAP_ZOOM_MAX);
      targetZoom = currentZoom;
      originX = chart.getWidth() / 2;
      originY = chart.getHeight() / 2;
      responseMs = WHEEL_RESPONSE_MS;
      inputMode = 'reset';
      lastStepMagnitude = 1;
      publishState(false);
    },
    cancel: () => {
      cancelFrame();
      targetZoom = currentZoom;
      inputMode = 'idle';
      publishState(false);
    },
    destroy: () => {
      destroyed = true;
      cancelFrame();
      container.removeEventListener('wheel', handleWheel);
      if (!chart.isDisposed()) chart.getZr().off('pinch', handlePinch);
      delete container.dataset.mapZoomMode;
      delete container.dataset.mapZoomCurrent;
      delete container.dataset.mapZoomTarget;
      delete container.dataset.mapZoomActive;
      delete container.dataset.mapZoomFrameCount;
      delete container.dataset.mapZoomLastStep;
      delete container.dataset.mapZoomMaxStep;
      delete container.dataset.mapZoomInputMode;
      delete container.dataset.mapZoomResponseMs;
    },
  };
}
