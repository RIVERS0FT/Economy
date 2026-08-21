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
const TRANSLATION_COMMIT_EPSILON = 0.01;
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

function mapRendererSurface(container: HTMLElement) {
  return [...container.querySelectorAll<SVGSVGElement>('svg')]
    .find((svg) => !svg.classList.contains('province-map-label-overlay')) ?? null;
}

function labelRendererSurface(container: HTMLElement) {
  return container.querySelector<SVGSVGElement>(':scope > .province-map-label-overlay');
}

function setTransientSurfaceTransform(surface: SVGSVGElement, transform: string) {
  surface.style.transformOrigin = '0 0';
  surface.style.setProperty('transform-box', 'border-box');
  surface.style.willChange = 'transform';
  surface.style.transform = transform;
}

function clearTransientSurfaceTransform(surface: SVGSVGElement | null) {
  if (!surface) return;
  surface.style.removeProperty('transform');
  surface.style.removeProperty('transform-origin');
  surface.style.removeProperty('transform-box');
  surface.style.removeProperty('will-change');
}

export function createProvinceMapZoomInterpolator(chart: EChartsType): ProvinceMapZoomInterpolator {
  const container = chart.getDom();
  let committedZoom = currentMapZoom(chart);
  let currentZoom = committedZoom;
  let targetZoom = committedZoom;
  let originX = chart.getWidth() / 2;
  let originY = chart.getHeight() / 2;
  let transientScale = 1;
  let transientTranslateX = 0;
  let transientTranslateY = 0;
  let responseMs = WHEEL_RESPONSE_MS;
  let frame: number | null = null;
  let clearFrame: number | null = null;
  let settleTimer: ReturnType<typeof setTimeout> | null = null;
  let lastFrameTime: number | null = null;
  let frameCount = 0;
  let commitCount = 0;
  let lastStepMagnitude = 1;
  let maxStepMagnitude = 1;
  let inputMode: ZoomInputMode = 'idle';
  let transientActive = false;
  let settleRequested = false;
  let destroyed = false;
  let rendererSurface = mapRendererSurface(container);
  let labelSurface = labelRendererSurface(container);

  const refreshSurfaces = () => {
    if (!rendererSurface?.isConnected) rendererSurface = mapRendererSurface(container);
    if (!labelSurface?.isConnected) labelSurface = labelRendererSurface(container);
    container.dataset.mapZoomSurfaceCount = String(Number(Boolean(rendererSurface)) + Number(Boolean(labelSurface)));
  };

  const publishState = (active: boolean) => {
    container.dataset.mapZoomMode = 'interpolated';
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
    container.dataset.mapZoomSurfaceMode = 'shared-css-transform';
    container.dataset.mapZoomHotPath = 'transform-only';
    refreshSurfaces();
  };

  const clearTransientSurfaces = () => {
    refreshSurfaces();
    clearTransientSurfaceTransform(rendererSurface);
    clearTransientSurfaceTransform(labelSurface);
  };

  const publishTransientTransform = () => {
    const transform = `matrix(${transientScale.toFixed(6)}, 0, 0, ${transientScale.toFixed(6)}, ${transientTranslateX.toFixed(3)}, ${transientTranslateY.toFixed(3)})`;
    refreshSurfaces();
    if (rendererSurface) setTransientSurfaceTransform(rendererSurface, transform);
    if (labelSurface) setTransientSurfaceTransform(labelSurface, transform);
    container.dataset.mapZoomTransientScale = transientScale.toFixed(6);
    container.dataset.mapZoomTransientTranslate = `${transientTranslateX.toFixed(3)},${transientTranslateY.toFixed(3)}`;
  };

  const applyTransientZoomStep = (nextZoom: number) => {
    const incrementalScale = nextZoom / Math.max(Number.EPSILON, currentZoom);
    const logStep = Math.log(incrementalScale);
    if (!Number.isFinite(logStep) || Math.abs(logStep) <= ZOOM_TRANSFORM_LOG_EPSILON) {
      currentZoom = nextZoom;
      return;
    }
    transientTranslateX = transientTranslateX * incrementalScale + (1 - incrementalScale) * originX;
    transientTranslateY = transientTranslateY * incrementalScale + (1 - incrementalScale) * originY;
    currentZoom = nextZoom;
    transientScale = currentZoom / Math.max(Number.EPSILON, committedZoom);
    lastStepMagnitude = zoomStepMagnitude(incrementalScale);
    maxStepMagnitude = Math.max(maxStepMagnitude, lastStepMagnitude);
    frameCount += 1;
    publishTransientTransform();
  };

  const cancelFrame = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    lastFrameTime = null;
  };

  const cancelClearFrame = () => {
    if (clearFrame !== null) cancelAnimationFrame(clearFrame);
    clearFrame = null;
  };

  const cancelSettleTimer = () => {
    if (settleTimer !== null) clearTimeout(settleTimer);
    settleTimer = null;
    settleRequested = false;
  };

  const scheduleCommittedTransformClear = () => {
    cancelClearFrame();
    clearFrame = requestAnimationFrame(() => {
      clearFrame = null;
      if (destroyed || chart.isDisposed()) return;
      clearTransientSurfaces();
      transientScale = 1;
      transientTranslateX = 0;
      transientTranslateY = 0;
      container.dataset.mapZoomTransientScale = '1.000000';
      container.dataset.mapZoomTransientTranslate = '0.000,0.000';
      publishState(false);
    });
  };

  const commitTransientZoom = () => {
    if (!transientActive || destroyed || chart.isDisposed()) return;
    const hasScale = Math.abs(Math.log(transientScale)) > ZOOM_TRANSFORM_LOG_EPSILON;
    const hasTranslation = Math.hypot(transientTranslateX, transientTranslateY) > TRANSLATION_COMMIT_EPSILON;
    if (hasScale) {
      const denominator = 1 - transientScale;
      const effectiveOriginX = transientTranslateX / denominator;
      const effectiveOriginY = transientTranslateY / denominator;
      chart.dispatchAction({
        type: 'geoRoam',
        seriesId: MAP_SERIES_ID,
        zoom: transientScale,
        originX: effectiveOriginX,
        originY: effectiveOriginY,
      } as Parameters<EChartsType['dispatchAction']>[0]);
      commitCount += 1;
    } else if (hasTranslation) {
      chart.dispatchAction({
        type: 'geoRoam',
        seriesId: MAP_SERIES_ID,
        dx: transientTranslateX,
        dy: transientTranslateY,
      } as Parameters<EChartsType['dispatchAction']>[0]);
      commitCount += 1;
    }
    committedZoom = currentZoom;
    targetZoom = currentZoom;
    transientActive = false;
    settleRequested = false;
    lastFrameTime = null;
    scheduleCommittedTransformClear();
    publishState(true);
  };

  const animate = (timestamp: number) => {
    frame = null;
    if (destroyed || chart.isDisposed()) return;

    const currentLog = Math.log(currentZoom);
    const targetLog = Math.log(targetZoom);
    const remainingLog = targetLog - currentLog;
    if (Math.abs(remainingLog) <= ZOOM_SETTLE_LOG_EPSILON) {
      applyTransientZoomStep(targetZoom);
      currentZoom = targetZoom;
      if (settleRequested) commitTransientZoom();
      else publishState(true);
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
    applyTransientZoomStep(nextZoom);

    if (currentZoom === targetZoom) {
      if (settleRequested) commitTransientZoom();
      else publishState(true);
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

  const scheduleSettleCommit = (mode: Exclude<ZoomInputMode, 'idle' | 'reset'>) => {
    if (settleTimer !== null) clearTimeout(settleTimer);
    settleRequested = false;
    settleTimer = setTimeout(() => {
      settleTimer = null;
      settleRequested = true;
      if (Math.abs(Math.log(targetZoom / currentZoom)) <= ZOOM_SETTLE_LOG_EPSILON) {
        applyTransientZoomStep(targetZoom);
        currentZoom = targetZoom;
        commitTransientZoom();
        return;
      }
      schedule();
    }, mode === 'pinch' ? PINCH_COMMIT_IDLE_MS : WHEEL_COMMIT_IDLE_MS);
  };

  const beginTransientZoom = () => {
    if (transientActive) return;
    cancelClearFrame();
    clearTransientSurfaces();
    committedZoom = currentMapZoom(chart);
    currentZoom = committedZoom;
    targetZoom = committedZoom;
    transientScale = 1;
    transientTranslateX = 0;
    transientTranslateY = 0;
    transientActive = true;
    container.dataset.mapZoomTransientScale = '1.000000';
    container.dataset.mapZoomTransientTranslate = '0.000,0.000';
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
  container.dataset.mapZoomTransientScale = '1.000000';
  container.dataset.mapZoomTransientTranslate = '0.000,0.000';
  publishState(false);

  return {
    reset: (zoom = 1) => {
      cancelFrame();
      cancelClearFrame();
      cancelSettleTimer();
      clearTransientSurfaces();
      committedZoom = clamp(zoom, MAP_ZOOM_MIN, MAP_ZOOM_MAX);
      currentZoom = committedZoom;
      targetZoom = committedZoom;
      originX = chart.getWidth() / 2;
      originY = chart.getHeight() / 2;
      transientScale = 1;
      transientTranslateX = 0;
      transientTranslateY = 0;
      responseMs = WHEEL_RESPONSE_MS;
      inputMode = 'reset';
      transientActive = false;
      lastStepMagnitude = 1;
      container.dataset.mapZoomTransientScale = '1.000000';
      container.dataset.mapZoomTransientTranslate = '0.000,0.000';
      publishState(false);
    },
    cancel: () => {
      cancelFrame();
      cancelClearFrame();
      cancelSettleTimer();
      clearTransientSurfaces();
      currentZoom = committedZoom;
      targetZoom = committedZoom;
      transientScale = 1;
      transientTranslateX = 0;
      transientTranslateY = 0;
      inputMode = 'idle';
      transientActive = false;
      container.dataset.mapZoomTransientScale = '1.000000';
      container.dataset.mapZoomTransientTranslate = '0.000,0.000';
      publishState(false);
    },
    destroy: () => {
      destroyed = true;
      cancelFrame();
      cancelClearFrame();
      cancelSettleTimer();
      clearTransientSurfaces();
      container.removeEventListener('wheel', handleWheel);
      if (!chart.isDisposed()) chart.getZr().off('pinch', handlePinch);
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
      delete container.dataset.mapZoomSurfaceMode;
      delete container.dataset.mapZoomSurfaceCount;
      delete container.dataset.mapZoomHotPath;
      delete container.dataset.mapZoomTransientScale;
      delete container.dataset.mapZoomTransientTranslate;
    },
  };
}
