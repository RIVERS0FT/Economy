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
const MIN_ZOOM_EPSILON = 1e-5;

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

interface SourceViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CameraWorldBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface CameraMetrics {
  viewportWidth: number;
  viewportHeight: number;
  baseViewWidth: number;
  baseViewHeight: number;
  baseAreaRatio: number;
  baseCenterX: number;
  baseCenterY: number;
  worldBounds: CameraWorldBounds;
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

function baseViewSize(
  viewportWidth: number,
  viewportHeight: number,
  focusWidth: number,
  focusHeight: number,
) {
  const aspect = viewportWidth / Math.max(1, viewportHeight);
  const focusArea = focusWidth * focusHeight;
  const targetViewArea = focusArea / MAINLAND_MIN_AREA_RATIO;
  let width = Math.sqrt(targetViewArea * aspect);
  let height = width / aspect;

  const availableWidth = Math.max(1, viewportWidth - MAINLAND_PAN_EDGE_INSET * 2);
  const availableHeight = Math.max(1, viewportHeight - MAINLAND_PAN_EDGE_INSET * 2);
  const fitScale = Math.min(availableWidth / focusWidth, availableHeight / focusHeight);
  if (fitScale > 0 && Number.isFinite(fitScale)) {
    const fitWidth = viewportWidth / fitScale;
    const fitHeight = viewportHeight / fitScale;
    if (width < fitWidth || height < fitHeight) {
      const factor = Math.max(fitWidth / width, fitHeight / height);
      width *= factor;
      height *= factor;
    }
  }

  return {
    width,
    height,
    areaRatio: focusArea / Math.max(Number.EPSILON, width * height),
  };
}

function clampCameraCenter(
  centerX: number,
  centerY: number,
  viewWidth: number,
  viewHeight: number,
  bounds: CameraWorldBounds,
) {
  const minCenterX = bounds.minX + viewWidth / 2;
  const maxCenterX = bounds.maxX - viewWidth / 2;
  const minCenterY = bounds.minY + viewHeight / 2;
  const maxCenterY = bounds.maxY - viewHeight / 2;
  return {
    centerX: minCenterX > maxCenterX
      ? (bounds.minX + bounds.maxX) / 2
      : clamp(centerX, minCenterX, maxCenterX),
    centerY: minCenterY > maxCenterY
      ? (bounds.minY + bounds.maxY) / 2
      : clamp(centerY, minCenterY, maxCenterY),
  };
}

function formatCameraValue(value: number) {
  const rounded = Number(value.toFixed(4));
  return Object.is(rounded, -0) ? 0 : rounded;
}

function serializeViewBox(view: SourceViewBox) {
  return `${formatCameraValue(view.x)} ${formatCameraValue(view.y)} ${formatCameraValue(view.width)} ${formatCameraValue(view.height)}`;
}

export function createProvinceMapCamera(
  container: HTMLElement,
  surface: HTMLElement,
  options: ProvinceMapCameraOptions = {},
): ProvinceMapCameraController {
  const svg = surface.querySelector<SVGSVGElement>('.province-map-world-svg');
  const raster = surface.querySelector<HTMLCanvasElement>('.province-map-camera-raster');
  if (!svg) throw new Error('PROVINCE_MAP_WORLD_SVG_REQUIRED');
  if (!raster) throw new Error('PROVINCE_MAP_RASTER_REQUIRED');

  const sourceBase = svg.viewBox.baseVal;
  const sourceViewBox: SourceViewBox = {
    x: sourceBase.x,
    y: sourceBase.y,
    width: sourceBase.width,
    height: sourceBase.height,
  };
  let current: CameraState = {
    centerX: sourceViewBox.x + sourceViewBox.width / 2,
    centerY: sourceViewBox.y + sourceViewBox.height / 2,
    zoom: PROVINCE_MAP_ZOOM_MIN,
  };
  let target: CameraState = { ...current };
  let committed: CameraState = { ...current };
  let transientBasisView: SourceViewBox | null = null;
  let transientUsesRaster = false;
  let metrics: CameraMetrics | null = null;
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
  let interactionBounds: DOMRect | null = null;
  let lastBlankTap: { at: number; x: number; y: number } | null = null;
  let multiTouchSequenceActive = false;
  let multiTouchSequenceCount = 0;
  let pendingSuppressedTouchTap = false;
  let suppressTapUntil = 0;
  let suppressedMultiTouchTapCount = 0;
  const pointers = new Map<number, PointerPosition>();
  const activeTouchPointerIds = new Set<number>();

  container.dataset.mapRenderer = 'static-svg';
  container.dataset.mapCameraMode = 'svg-viewbox';
  container.dataset.mapCameraHotPath = 'single-css-transform-write';
  container.dataset.mapCameraTransientMode = 'compositor-transform';
  container.dataset.mapCameraPreloadMode = 'fixed-world-viewbox';
  container.dataset.mapCameraGeometryMode = 'immutable-svg-world';
  container.dataset.mapCameraRasterMode = 'settled-svg-active-raster-snapshot';
  container.dataset.mapZoomMode = 'svg-viewbox';
  container.dataset.mapZoomCameraMode = 'fixed-world-viewbox';
  container.dataset.mapZoomHotPath = 'css-transform';
  container.dataset.mapZoomCommitMode = 'settle-viewbox';
  container.dataset.mapZoomScaleMode = 'logical-fixed-world';
  container.dataset.mapTapSuppressMs = String(MULTITOUCH_TAP_SUPPRESS_MS);
  container.dataset.mapCameraBoundaryMode = options.focusBounds ? 'fixed-world-bounds' : 'source-viewbox';
  container.dataset.mapPanBoundary = options.focusBounds ? 'fixed-world-context' : 'source-viewbox';
  container.dataset.mapPanClampMode = options.focusBounds ? 'fixed-world-viewbox' : 'none';
  container.dataset.mapPanEdgeInset = String(MAINLAND_PAN_EDGE_INSET);
  container.dataset.mapFocusAreaTarget = MAINLAND_MIN_AREA_RATIO.toFixed(6);
  container.dataset.mapContextExpandX = MAINLAND_CONTEXT_EXPAND_X.toFixed(2);
  container.dataset.mapContextExpandY = MAINLAND_CONTEXT_EXPAND_Y.toFixed(2);

  const readMetrics = () => {
    if (metrics) return metrics;
    const viewportWidth = container.clientWidth;
    const viewportHeight = container.clientHeight;
    if (!(viewportWidth > 0) || !(viewportHeight > 0)) return null;

    if (!options.focusBounds) {
      const baseCenterX = sourceViewBox.x + sourceViewBox.width / 2;
      const baseCenterY = sourceViewBox.y + sourceViewBox.height / 2;
      metrics = {
        viewportWidth,
        viewportHeight,
        baseViewWidth: sourceViewBox.width,
        baseViewHeight: sourceViewBox.height,
        baseAreaRatio: 0,
        baseCenterX,
        baseCenterY,
        worldBounds: {
          minX: sourceViewBox.x,
          minY: sourceViewBox.y,
          maxX: sourceViewBox.x + sourceViewBox.width,
          maxY: sourceViewBox.y + sourceViewBox.height,
        },
      };
      return metrics;
    }

    const focusWidth = options.focusBounds.maxX - options.focusBounds.minX;
    const focusHeight = options.focusBounds.maxY - options.focusBounds.minY;
    const base = baseViewSize(viewportWidth, viewportHeight, focusWidth, focusHeight);
    const baseCenterX = (options.focusBounds.minX + options.focusBounds.maxX) / 2;
    const baseCenterY = (options.focusBounds.minY + options.focusBounds.maxY) / 2;
    const worldWidth = Math.max(focusWidth * (1 + MAINLAND_CONTEXT_EXPAND_X * 2), base.width);
    const worldHeight = Math.max(focusHeight * (1 + MAINLAND_CONTEXT_EXPAND_Y * 2), base.height);
    metrics = {
      viewportWidth,
      viewportHeight,
      baseViewWidth: base.width,
      baseViewHeight: base.height,
      baseAreaRatio: base.areaRatio,
      baseCenterX,
      baseCenterY,
      worldBounds: {
        minX: baseCenterX - worldWidth / 2,
        minY: baseCenterY - worldHeight / 2,
        maxX: baseCenterX + worldWidth / 2,
        maxY: baseCenterY + worldHeight / 2,
      },
    };
    return metrics;
  };

  const viewSizeFor = (zoom: number, currentMetrics = readMetrics()) => ({
    width: (currentMetrics?.baseViewWidth ?? sourceViewBox.width) / Math.max(Number.EPSILON, zoom),
    height: (currentMetrics?.baseViewHeight ?? sourceViewBox.height) / Math.max(Number.EPSILON, zoom),
  });

  const normalizedState = (state: CameraState, currentMetrics = readMetrics()): CameraState => {
    const zoom = clamp(state.zoom, PROVINCE_MAP_ZOOM_MIN, PROVINCE_MAP_ZOOM_MAX);
    if (!currentMetrics) return { ...state, zoom };
    if (zoom <= PROVINCE_MAP_ZOOM_MIN + MIN_ZOOM_EPSILON) {
      return {
        centerX: currentMetrics.baseCenterX,
        centerY: currentMetrics.baseCenterY,
        zoom: PROVINCE_MAP_ZOOM_MIN,
      };
    }
    const size = viewSizeFor(zoom, currentMetrics);
    const clamped = clampCameraCenter(
      state.centerX,
      state.centerY,
      size.width,
      size.height,
      currentMetrics.worldBounds,
    );
    return { ...clamped, zoom };
  };

  const viewBoxFor = (state: CameraState, currentMetrics = readMetrics()) => {
    const normalized = normalizedState(state, currentMetrics);
    const size = viewSizeFor(normalized.zoom, currentMetrics);
    return {
      x: normalized.centerX - size.width / 2,
      y: normalized.centerY - size.height / 2,
      width: size.width,
      height: size.height,
      centerX: normalized.centerX,
      centerY: normalized.centerY,
      zoom: normalized.zoom,
    };
  };

  const preloadViewFor = (currentMetrics = readMetrics()): SourceViewBox => {
    if (!currentMetrics) return { ...sourceViewBox };
    const bounds = currentMetrics.worldBounds;
    const worldWidth = bounds.maxX - bounds.minX;
    const worldHeight = bounds.maxY - bounds.minY;
    const aspect = currentMetrics.viewportWidth / Math.max(1, currentMetrics.viewportHeight);
    let width = worldWidth;
    let height = width / Math.max(Number.EPSILON, aspect);
    if (height < worldHeight) {
      height = worldHeight;
      width = height * aspect;
    }
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    return {
      x: centerX - width / 2,
      y: centerY - height / 2,
      width,
      height,
    };
  };

  const readBounds = () => interactionBounds ?? (interactionBounds = container.getBoundingClientRect());
  const localPoint = (clientX: number, clientY: number): PointerPosition => {
    const bounds = readBounds();
    return { x: clientX - bounds.left, y: clientY - bounds.top };
  };

  const screenPointToWorld = (point: PointerPosition, state = target) => {
    const currentMetrics = readMetrics();
    const view = viewBoxFor(state, currentMetrics);
    const viewportWidth = Math.max(1, currentMetrics?.viewportWidth ?? container.clientWidth);
    const viewportHeight = Math.max(1, currentMetrics?.viewportHeight ?? container.clientHeight);
    return {
      x: view.x + (point.x / viewportWidth) * view.width,
      y: view.y + (point.y / viewportHeight) * view.height,
    };
  };

  const clampTarget = () => {
    const before = target;
    const next = normalizedState(target, readMetrics());
    target = next;
    if (
      Math.abs(before.centerX - next.centerX) > 0.0001
      || Math.abs(before.centerY - next.centerY) > 0.0001
    ) panClampCount += 1;
  };

  const publishMultiTouchState = () => {
    container.dataset.mapMultitouchActive = multiTouchSequenceActive ? 'true' : 'false';
    container.dataset.mapMultitouchSequenceCount = String(multiTouchSequenceCount);
    container.dataset.mapMultitouchPointerCount = String(activeTouchPointerIds.size);
    container.dataset.mapMultitouchTapPending = pendingSuppressedTouchTap ? 'true' : 'false';
    container.dataset.mapSuppressedMultitouchTapCount = String(suppressedMultiTouchTapCount);
  };

  const publishState = () => {
    const currentMetrics = readMetrics();
    const currentView = viewBoxFor(current, currentMetrics);
    const targetView = viewBoxFor(target, currentMetrics);
    const bounds = currentMetrics?.worldBounds;
    container.dataset.mapZoomCurrent = currentView.zoom.toFixed(5);
    container.dataset.mapZoomTarget = targetView.zoom.toFixed(5);
    container.dataset.mapZoomBaseScale = '1.000000';
    container.dataset.mapFocusAreaActual = (currentMetrics?.baseAreaRatio ?? 0).toFixed(6);
    container.dataset.mapCameraX = currentView.x.toFixed(3);
    container.dataset.mapCameraY = currentView.y.toFixed(3);
    container.dataset.mapCameraTargetX = targetView.x.toFixed(3);
    container.dataset.mapCameraTargetY = targetView.y.toFixed(3);
    container.dataset.mapCameraViewWidth = currentView.width.toFixed(3);
    container.dataset.mapCameraViewHeight = currentView.height.toFixed(3);
    container.dataset.mapCameraWorldBounds = bounds
      ? `${bounds.minX.toFixed(4)} ${bounds.minY.toFixed(4)} ${bounds.maxX.toFixed(4)} ${bounds.maxY.toFixed(4)}`
      : '';
    container.dataset.mapCameraPreloadViewBox = serializeViewBox(preloadViewFor(currentMetrics));
    container.dataset.mapPanClampCount = String(panClampCount);
    container.dataset.mapZoomActive = active ? 'true' : 'false';
    container.dataset.mapRasterActive = active && transientUsesRaster ? 'true' : 'false';
    container.dataset.mapZoomFrameCount = String(frameCount);
    container.dataset.mapCameraWriteCount = String(writeCount);
    container.dataset.mapZoomInputMode = inputMode;
    publishMultiTouchState();
  };

  const transientTransformFor = (state: CameraState, currentMetrics = readMetrics()) => {
    const basisView = transientBasisView ?? viewBoxFor(committed, currentMetrics);
    const nextView = viewBoxFor(state, currentMetrics);
    const viewportWidth = Math.max(1, currentMetrics?.viewportWidth ?? container.clientWidth);
    const viewportHeight = Math.max(1, currentMetrics?.viewportHeight ?? container.clientHeight);
    const scaleX = basisView.width / Math.max(Number.EPSILON, nextView.width);
    const scaleY = basisView.height / Math.max(Number.EPSILON, nextView.height);
    const scale = (scaleX + scaleY) / 2;
    const translateX = ((basisView.x - nextView.x) / Math.max(Number.EPSILON, nextView.width)) * viewportWidth;
    const translateY = ((basisView.y - nextView.y) / Math.max(Number.EPSILON, nextView.height)) * viewportHeight;
    return `translate3d(${formatCameraValue(translateX)}px, ${formatCameraValue(translateY)}px, 0) scale(${formatCameraValue(scale)})`;
  };

  const clearTransientTransforms = () => {
    surface.style.removeProperty('transform');
    raster.style.removeProperty('transform');
  };

  const writeTransientTransform = (transform: string) => {
    if (transientUsesRaster) raster.style.transform = transform;
    else surface.style.transform = transform;
  };

  const prepareTransientSurface = () => {
    const currentMetrics = readMetrics();
    transientUsesRaster = container.dataset.mapRasterReady === 'true';
    transientBasisView = preloadViewFor(currentMetrics);
    const transform = transientTransformFor(current, currentMetrics);
    clearTransientTransforms();
    if (transientUsesRaster) {
      svg.style.opacity = '0';
      raster.style.transform = transform;
      writeCount += 1;
      return;
    }
    svg.setAttribute('viewBox', serializeViewBox(transientBasisView));
    surface.style.transform = transform;
    writeCount += 2;
  };

  const writeCamera = () => {
    frame = null;
    if (destroyed) return;
    current = normalizedState(target, metrics);
    target = { ...current };
    writeTransientTransform(transientTransformFor(current, metrics));
    frameCount += 1;
    writeCount += 1;
  };

  const commitCamera = () => {
    const view = viewBoxFor(current, metrics);
    svg.setAttribute('viewBox', serializeViewBox(view));
    clearTransientTransforms();
    svg.style.removeProperty('opacity');
    transientBasisView = null;
    transientUsesRaster = false;
    committed = { ...current };
    writeCount += 1;
  };

  const setActive = (nextActive: boolean) => {
    if (active === nextActive) return;
    active = nextActive;
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
    commitCamera();
    inputMode = 'idle';
    setActive(false);
    interactionBounds = null;
  };

  const scheduleSettle = () => {
    settleDeadline = performance.now() + INPUT_SETTLE_MS;
    if (settleTimer === null) settleTimer = setTimeout(finishSettle, INPUT_SETTLE_MS);
  };

  const scheduleWrite = (mode: Exclude<CameraInputMode, 'idle' | 'reset'>) => {
    inputMode = mode;
    if (!active) {
      prepareTransientSurface();
      setActive(true);
    }
    if (frame === null) frame = requestAnimationFrame(writeCamera);
    scheduleSettle();
  };

  const applyZoomAround = (nextZoom: number, point: PointerPosition) => {
    const currentMetrics = readMetrics();
    const worldPoint = screenPointToWorld(point, target);
    const zoom = clamp(nextZoom, PROVINCE_MAP_ZOOM_MIN, PROVINCE_MAP_ZOOM_MAX);
    const nextSize = viewSizeFor(zoom, currentMetrics);
    const viewportWidth = Math.max(1, currentMetrics?.viewportWidth ?? container.clientWidth);
    const viewportHeight = Math.max(1, currentMetrics?.viewportHeight ?? container.clientHeight);
    target = {
      zoom,
      centerX: worldPoint.x - (point.x / viewportWidth - 0.5) * nextSize.width,
      centerY: worldPoint.y - (point.y / viewportHeight - 0.5) * nextSize.height,
    };
    clampTarget();
  };

  const reset = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    if (settleTimer !== null) clearTimeout(settleTimer);
    settleTimer = null;
    settleDeadline = 0;
    interactionBounds = null;
    metrics = null;
    transientBasisView = null;
    transientUsesRaster = false;
    const currentMetrics = readMetrics();
    target = {
      centerX: currentMetrics?.baseCenterX ?? sourceViewBox.x + sourceViewBox.width / 2,
      centerY: currentMetrics?.baseCenterY ?? sourceViewBox.y + sourceViewBox.height / 2,
      zoom: PROVINCE_MAP_ZOOM_MIN,
    };
    clampTarget();
    current = { ...target };
    committed = { ...current };
    inputMode = 'reset';
    active = false;
    const view = viewBoxFor(current, currentMetrics);
    svg.setAttribute('viewBox', serializeViewBox(view));
    clearTransientTransforms();
    svg.style.removeProperty('opacity');
    writeCount += 1;
    publishState();
  };

  const firstTwoTouchPositions = () => {
    const values = [...activeTouchPointerIds]
      .map((pointerId) => pointers.get(pointerId))
      .filter((point): point is PointerPosition => Boolean(point));
    return values.length >= 2 ? [values[0], values[1]] as const : null;
  };

  const updatePinchReference = () => {
    const values = firstTwoTouchPositions();
    pinchReference = values
      ? { midpoint: midpoint(values[0], values[1]), distance: Math.max(1, distance(values[0], values[1])) }
      : null;
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
    lastBlankTap = null;
    scheduleMultiTouchInactiveFallback();
    publishMultiTouchState();
  };

  const shouldSuppressTap = () => (
    multiTouchSequenceActive
    || Date.now() <= suppressTapUntil
    || pendingSuppressedTouchTap
  );

  const handleWheel = (event: WheelEvent) => {
    if (destroyed) return;
    const delta = normalizeWheelDelta(event, container);
    if (!Number.isFinite(delta) || Math.abs(delta) < 0.01) return;
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY) * 1.2) return;
    if (!active) interactionBounds = null;
    event.preventDefault();
    event.stopPropagation();
    const logStep = clamp(
      -delta * WHEEL_ZOOM_SENSITIVITY,
      -MAX_WHEEL_LOG_STEP,
      MAX_WHEEL_LOG_STEP,
    );
    applyZoomAround(target.zoom * Math.exp(logStep), localPoint(event.clientX, event.clientY));
    scheduleWrite('wheel');
  };

  const handlePointerDown = (event: PointerEvent) => {
    if (destroyed || (event.pointerType === 'mouse' && event.button !== 0)) return;
    if (pointers.size === 0) interactionBounds = null;
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

    if (activeTouchPointerIds.size >= 2) {
      beginMultiTouchSequence();
      const values = firstTwoTouchPositions();
      if (!values) return;
      const nextMidpoint = midpoint(values[0], values[1]);
      const nextDistance = Math.max(1, distance(values[0], values[1]));
      const reference = pinchReference ?? { midpoint: nextMidpoint, distance: nextDistance };
      const worldPoint = screenPointToWorld(reference.midpoint, target);
      const currentMetrics = readMetrics();
      const zoom = clamp(
        target.zoom * (nextDistance / reference.distance),
        PROVINCE_MAP_ZOOM_MIN,
        PROVINCE_MAP_ZOOM_MAX,
      );
      const nextSize = viewSizeFor(zoom, currentMetrics);
      const viewportWidth = Math.max(1, currentMetrics?.viewportWidth ?? container.clientWidth);
      const viewportHeight = Math.max(1, currentMetrics?.viewportHeight ?? container.clientHeight);
      target = {
        zoom,
        centerX: worldPoint.x - (nextMidpoint.x / viewportWidth - 0.5) * nextSize.width,
        centerY: worldPoint.y - (nextMidpoint.y / viewportHeight - 0.5) * nextSize.height,
      };
      clampTarget();
      pinchReference = { midpoint: nextMidpoint, distance: nextDistance };
      dragDistance += Math.hypot(next.x - previous.x, next.y - previous.y);
      suppressNextDragClick = true;
      scheduleWrite('pinch');
      return;
    }

    const dx = next.x - previous.x;
    const dy = next.y - previous.y;
    if (dx === 0 && dy === 0) return;
    const currentMetrics = readMetrics();
    const size = viewSizeFor(target.zoom, currentMetrics);
    const viewportWidth = Math.max(1, currentMetrics?.viewportWidth ?? container.clientWidth);
    const viewportHeight = Math.max(1, currentMetrics?.viewportHeight ?? container.clientHeight);
    target.centerX -= (dx / viewportWidth) * size.width;
    target.centerY -= (dy / viewportHeight) * size.height;
    clampTarget();
    dragDistance += Math.hypot(dx, dy);
    if (dragDistance > POINTER_DRAG_THRESHOLD) suppressNextDragClick = true;
    scheduleWrite('move');
  };

  const handlePointerEnd = (event: PointerEvent) => {
    if (!pointers.has(event.pointerId)) return;
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
  container.addEventListener('pointerdown', handlePointerDown);
  container.addEventListener('pointermove', handlePointerMove);
  container.addEventListener('pointerup', handlePointerEnd);
  container.addEventListener('pointercancel', handlePointerEnd);
  container.addEventListener('touchstart', handleTouchStart, { passive: true });
  container.addEventListener('touchmove', handleTouchMove, { passive: true });
  container.addEventListener('touchend', handleTouchEnd, { passive: true });
  container.addEventListener('touchcancel', handleTouchEnd, { passive: true });
  container.addEventListener('dblclick', handleDoubleClick);
  container.addEventListener('click', handleClickCapture, true);

  reset();

  return {
    reset,
    destroy() {
      destroyed = true;
      if (frame !== null) cancelAnimationFrame(frame);
      if (settleTimer !== null) clearTimeout(settleTimer);
      if (multiTouchIdleTimer !== null) clearTimeout(multiTouchIdleTimer);
      transientBasisView = null;
      transientUsesRaster = false;
      clearTransientTransforms();
      svg.style.removeProperty('opacity');
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('pointerdown', handlePointerDown);
      container.removeEventListener('pointermove', handlePointerMove);
      container.removeEventListener('pointerup', handlePointerEnd);
      container.removeEventListener('pointercancel', handlePointerEnd);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
      container.removeEventListener('dblclick', handleDoubleClick);
      container.removeEventListener('click', handleClickCapture, true);
    },
  };
}
