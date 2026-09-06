import { CompactNumber } from '../ui/CompactNumber';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { feature, merge } from 'topojson-client';
import usStateAtlas from 'us-atlas/states-10m.json';
import regionCatalog from '../../../shared/provinces.json';
import type { ProvinceAssetSummary, ProvinceDefinition, TransportModeId } from '../../types';
import { formatNumber } from '../../utils/formatters';
import { formatTransportDuration } from '../../utils/provinceLogistics';
import { LiveServerTime } from '../time/LiveServerTime';
import { useWorkspaceTooltipLayer } from '../ui/WorkspaceFloatingLayer';
import {
  hideTopLayerPopover,
  showTopLayerPopover,
  supportsTopLayerPopover,
} from '../ui/topLayer';
import {
  createProvinceMapCamera,
  PROVINCE_MAP_ZOOM_MAX,
  PROVINCE_MAP_ZOOM_MIN,
  type ProvinceMapCameraController,
} from './provinceMapCamera';
import { createProvinceMapProjection, provinceGeometryPath } from './provinceMapProjection';
import { createProvinceMapRasterSnapshot } from './provinceMapRasterSnapshot';
import {
  layoutProvinceMapRoutes,
  provinceMapPointAlongPolyline,
  provinceMapRouteBasePointsForDirection,
} from './provinceMapRouteLayout';
import {
  layoutProvinceMapLabels,
  type ProvinceMapLabelLayout,
  type ProvinceMapLabelSource,
} from './provinceMapStaticLabels';
import {
  createProvinceMapTransportPhysicalPaths,
  transportCapitalRouteDataKind,
} from './provinceMapTransportNetwork';
import {
  createProvinceMapMainlandFocusBounds,
  createProvinceMapWorldFillPath,
  createProvinceMapWorldStrokePath,
} from './provinceMapWorldOutline';

const MOBILE_MAP_MAX_WIDTH = 720;
const ROUTE_STROKE_MIN_SCALE = 0.5;
const BOUNDARY_STROKE_MIN_SCALE = 0.65;
const ROUTE_STOP_CUTOUT_PADDING = 0.5;

export type ProvinceMapLens = 'political' | 'assets' | 'industry' | 'market' | 'alerts';

export interface ProvinceMapRouteOverlay {
  id: string;
  routeId?: string;
  mode: TransportModeId;
  stops: string[];
  kind: 'draft' | 'saved' | 'highlight';
}

export interface ProvinceMapRoutePicking {
  active: boolean;
  stops: string[];
  onPickProvince: (provinceId: string) => void;
}

export interface ProvinceMapShipmentOverlay {
  id: string;
  routeId?: string;
  routeName: string;
  mode: TransportModeId;
  arrivesAt: number;
  legPlan: Array<{
    fromProvinceId: string;
    toProvinceId: string;
    departsAt: number;
    arrivesAt: number;
    remainingLoad: number;
  }>;
  cargo: Array<{
    productName: string;
    quantity: number;
    destinationName?: string;
  }>;
}

const regionByMapName = new Map(regionCatalog.map((region) => [region.mapName, region]));
const atlasTopology = usStateAtlas as unknown as Parameters<typeof feature>[0];
const atlasStateObject = (usStateAtlas as unknown as { objects: { states: Parameters<typeof feature>[1] } }).objects.states;
const atlasStateCollection = feature(atlasTopology, atlasStateObject);
if (atlasStateCollection.type !== 'FeatureCollection') throw new Error('US_STATE_ATLAS_FEATURE_COLLECTION_REQUIRED');

const mainlandFeatures = atlasStateCollection.features.flatMap((stateFeature) => {
  const mapName = String(stateFeature.properties?.name || '');
  const region = regionByMapName.get(mapName);
  if (!region) return [];
  return [{
    provinceId: region.id,
    provinceName: region.name,
    mapName,
    geometry: stateFeature.geometry,
    anchor: [region.longitude, region.latitude] as [number, number],
  }];
});
const atlasStateGeometryCollection = atlasStateObject as unknown as {
  geometries: Array<{ properties?: { name?: string } }>;
};
const mainlandTopologyGeometries = atlasStateGeometryCollection.geometries.filter((geometry) => (
  regionByMapName.has(String(geometry.properties?.name || ''))
));
const mainlandOutlineGeometry = merge(
  atlasTopology as Parameters<typeof merge>[0],
  mainlandTopologyGeometries as Parameters<typeof merge>[1],
);

const provinceMapProjection = createProvinceMapProjection(mainlandFeatures.map((entry) => entry.geometry));
const provinceMapWorldFillPath = createProvinceMapWorldFillPath(provinceMapProjection);
const provinceMapWorldStrokePath = createProvinceMapWorldStrokePath(provinceMapProjection);
const provinceMapMainlandOutlinePath = provinceGeometryPath(mainlandOutlineGeometry, provinceMapProjection);
const provinceMapMainlandFocusBounds = createProvinceMapMainlandFocusBounds(provinceMapProjection);
const capitalPointByProvinceId = new Map(
  regionCatalog.map((region) => {
    const capital = region as ProvinceDefinition;
    return [region.id, provinceMapProjection.project([capital.capitalLongitude, capital.capitalLatitude])] as const;
  }),
);
const transportPhysicalPathByEdge = createProvinceMapTransportPhysicalPaths((coordinate) => provinceMapProjection.project(coordinate));
const provinceMapWorld = mainlandFeatures.map((entry) => ({ ...entry, path: provinceGeometryPath(entry.geometry, provinceMapProjection) }));
const provinceMapLabelSources: ProvinceMapLabelSource[] = mainlandFeatures.map((entry) => ({
  provinceId: entry.provinceId,
  provinceName: entry.provinceName,
  anchor: entry.anchor,
  geometry: entry.geometry,
}));
const [routeMaskX, routeMaskY, routeMaskWidth, routeMaskHeight] = provinceMapProjection.viewBox
  .split(' ')
  .map((value) => Number(value));

interface ProvinceMapDatum {
  name: string;
  provinceId: string;
  provinceName: string;
  storedQuantity: number;
  facilityCount: number;
  runningFacilityCount: number;
  blockedFacilityCount: number;
  openOrderCount: number;
  areaColor: string;
  borderColor: string;
}

function datumFor(province: ProvinceDefinition, summary: ProvinceAssetSummary | undefined, lens: ProvinceMapLens): ProvinceMapDatum {
  const storedQuantity = Number(summary?.storedQuantity || 0);
  const facilityCount = Number(summary?.facilityCount || 0);
  const blockedFacilityCount = Number(summary?.blockedFacilityCount || 0);
  const openOrderCount = Number(summary?.openOrderCount || 0);
  const hasAssets = storedQuantity > 0 || facilityCount > 0;
  const areaColor = lens === 'political'
      ? 'var(--color-map-region-default)'
      : lens === 'industry'
        ? facilityCount > 0 ? 'var(--color-success-soft)' : 'var(--color-map-region-default)'
        : lens === 'market'
          ? openOrderCount > 0 ? 'var(--color-warning-soft)' : 'var(--color-map-region-default)'
          : lens === 'alerts'
            ? blockedFacilityCount > 0 ? 'var(--color-danger-soft)' : 'var(--color-map-region-default)'
            : blockedFacilityCount > 0
              ? 'var(--color-danger-soft)'
              : hasAssets ? 'var(--color-success-soft)' : 'var(--color-map-region-default)';
  return {
    name: province.name,
    provinceId: province.id,
    provinceName: province.name,
    storedQuantity,
    facilityCount,
    runningFacilityCount: Number(summary?.runningFacilityCount || 0),
    blockedFacilityCount,
    openOrderCount,
    areaColor,
    borderColor: lens === 'alerts' && blockedFacilityCount > 0 ? 'var(--color-danger)' : 'var(--color-map-region-border)',
  };
}

function formatGeometryValue(value: number) {
  return Number(value.toFixed(2));
}

function routeStopRadius(index: number, stopCount: number) {
  return index === 0 || index === stopCount - 1 ? 5 : 4;
}

function updateSettledStrokeScales(container: HTMLElement) {
  const rawZoom = Number(container.dataset.mapZoomCurrent || PROVINCE_MAP_ZOOM_MIN);
  const zoom = Math.max(
    PROVINCE_MAP_ZOOM_MIN,
    Math.min(PROVINCE_MAP_ZOOM_MAX, Number.isFinite(rawZoom) ? rawZoom : PROVINCE_MAP_ZOOM_MIN),
  );
  const zoomProgress = (zoom - PROVINCE_MAP_ZOOM_MIN) / Math.max(1, PROVINCE_MAP_ZOOM_MAX - PROVINCE_MAP_ZOOM_MIN);
  const routeScale = ROUTE_STROKE_MIN_SCALE + (1 - ROUTE_STROKE_MIN_SCALE) * zoomProgress;
  const boundaryScale = BOUNDARY_STROKE_MIN_SCALE + (1 - BOUNDARY_STROKE_MIN_SCALE) * zoomProgress;
  const routeValue = routeScale.toFixed(4);
  const boundaryValue = boundaryScale.toFixed(4);
  const changed = container.style.getPropertyValue('--province-map-route-stroke-scale') !== routeValue
    || container.style.getPropertyValue('--province-map-boundary-stroke-scale') !== boundaryValue;
  container.style.setProperty('--province-map-route-stroke-scale', routeValue);
  container.style.setProperty('--province-map-boundary-stroke-scale', boundaryValue);
  container.dataset.mapRouteStrokeScale = routeValue;
  container.dataset.mapBoundaryStrokeScale = boundaryValue;
  return changed;
}

function tooltipRows(datum: ProvinceMapDatum) {
  return [
    `本地库存：${formatNumber(datum.storedQuantity)}`,
    `工厂：${formatNumber(datum.facilityCount)}`,
    `运行中：${formatNumber(datum.runningFacilityCount)}`,
    `本地挂单：${formatNumber(datum.openOrderCount)}`,
  ];
}

function currentShipmentPosition(shipment: ProvinceMapShipmentOverlay, now: number) {
  if (shipment.legPlan.length < 1) return null;
  const leg = shipment.legPlan.find((candidate) => now >= candidate.departsAt && now < candidate.arrivesAt)
    ?? shipment.legPlan.find((candidate) => now < candidate.arrivesAt)
    ?? shipment.legPlan[shipment.legPlan.length - 1];
  const baseSegment = provinceMapRouteBasePointsForDirection(
    shipment.mode,
    leg.fromProvinceId,
    leg.toProvinceId,
    capitalPointByProvinceId,
    transportPhysicalPathByEdge,
  );
  const pathPoints = baseSegment?.points;
  if (!pathPoints || pathPoints.length < 2) return null;
  const duration = Math.max(1, leg.arrivesAt - leg.departsAt);
  const progress = Math.max(0, Math.min(1, (now - leg.departsAt) / duration));
  const point = provinceMapPointAlongPolyline(pathPoints, progress);
  if (!point) return null;
  return {
    x: point.x,
    y: point.y,
    fromProvinceId: leg.fromProvinceId,
    toProvinceId: leg.toProvinceId,
    remainingLoad: leg.remainingLoad,
  };
}
function ShipmentMarkerIcon({ mode }: { mode: TransportModeId }) {
  if (mode === 'air') {
    return <path className="province-map-shipment-icon" d="M -7 1 L 7 -3 L 2 2 L 1 6 L -1 6 L -2 2 Z" />;
  }
  if (mode === 'rail') {
    return (
      <g className="province-map-shipment-icon">
        <rect x="-6" y="-5" width="12" height="9" rx="2" />
        <circle cx="-3.5" cy="5" r="1.5" />
        <circle cx="3.5" cy="5" r="1.5" />
      </g>
    );
  }
  return (
    <g className="province-map-shipment-icon">
      <rect x="-6" y="-3.5" width="10" height="7" rx="2" />
      <path d="M 4 -2 L 7 -2 L 7 3.5 L 4 3.5 Z" />
      <circle cx="-3" cy="4.5" r="1.5" />
      <circle cx="4.5" cy="4.5" r="1.5" />
    </g>
  );
}

export function UsMainlandMap({
  provinces,
  summaries,
  selectedProvinceId,
  onSelectProvince,
  lens = 'assets',
  routePicking = null,
  routeOverlays = [],
  shipmentOverlays = [],
  referenceNow = Date.now(),
}: {
  provinces: ProvinceDefinition[];
  summaries: Record<string, ProvinceAssetSummary>;
  selectedProvinceId: string | null;
  onSelectProvince: (provinceId: string) => void;
  lens?: ProvinceMapLens;
  routePicking?: ProvinceMapRoutePicking | null;
  routeOverlays?: ProvinceMapRouteOverlay[];
  shipmentOverlays?: ProvinceMapShipmentOverlay[];
  referenceNow?: number;
}) {
  const routeNodeMaskId = `province-map-route-node-mask-${useId().replace(/:/g, '')}`;
  const tooltipLayer = useWorkspaceTooltipLayer();
  const tooltipTopLayerActive = supportsTopLayerPopover() && Boolean(tooltipLayer);
  const data = useMemo(() => provinces.map((province) => datumFor(province, summaries[province.id], lens)), [lens, provinces, summaries]);
  const datumByProvinceId = useMemo(() => new Map(data.map((datum) => [datum.provinceId, datum])), [data]);
  const selectedProvince = provinces.find((province) => province.id === selectedProvinceId);
  const provinceNameById = useMemo(() => new Map(provinces.map((province) => [province.id, province.name])), [provinces]);
  const viewportRef = useRef<HTMLDivElement>(null);
  const cameraSurfaceRef = useRef<HTMLDivElement>(null);
  const rasterCanvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<ProvinceMapCameraController | null>(null);
  const rasterGenerationRef = useRef(0);
  const rasterRevisionRef = useRef(0);
  const rasterRefreshPendingRef = useRef(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const labelRevisionRef = useRef(0);
  const [labels, setLabels] = useState<ProvinceMapLabelLayout[]>([]);
  const [hoveredProvinceId, setHoveredProvinceId] = useState<string | null>(null);
  const [hoveredShipmentId, setHoveredShipmentId] = useState<string | null>(null);
  const hoveredDatum = hoveredProvinceId ? datumByProvinceId.get(hoveredProvinceId) ?? null : null;
  const hoveredShipment = hoveredShipmentId ? shipmentOverlays.find((shipment) => shipment.id === hoveredShipmentId) ?? null : null;
  const routePickingActive = Boolean(routePicking?.active);
  const routeLayout = useMemo(
    () => layoutProvinceMapRoutes(routeOverlays, capitalPointByProvinceId, transportPhysicalPathByEdge),
    [routeOverlays],
  );

  const routeRenderData = useMemo(() => routeOverlays.flatMap((overlay) => {
    const geometry = routeLayout.byOverlayId.get(overlay.id);
    if (!geometry || geometry.stopPoints.length < 2 || geometry.segments.length < 1) return [];
    const networkSegmentCount = geometry.segments.filter((segment) => segment.networkGeometry).length;
    const geometrySource = overlay.mode === 'air'
      ? 'air'
      : networkSegmentCount === geometry.segments.length
        ? 'network'
        : networkSegmentCount > 0 ? 'mixed' : 'direct';
    return [{ overlay, geometry, networkSegmentCount, geometrySource }];
  }), [routeLayout, routeOverlays]);

  const routeNodeCutouts = useMemo(() => {
    const cutoutByPoint = new Map<string, { x: number; y: number; radius: number }>();
    for (const entry of routeRenderData) {
      entry.geometry.stopPoints.forEach((point, index) => {
        const x = formatGeometryValue(point.x);
        const y = formatGeometryValue(point.y);
        const radius = routeStopRadius(index, entry.geometry.stopPoints.length) + ROUTE_STOP_CUTOUT_PADDING;
        const key = `${x}:${y}`;
        const existing = cutoutByPoint.get(key);
        if (!existing || radius > existing.radius) cutoutByPoint.set(key, { x, y, radius });
      });
    }
    return [...cutoutByPoint.values()];
  }, [routeRenderData]);

  const routePathsMarkup = useMemo(() => routeRenderData.map((entry) => {
    const { overlay, geometry, networkSegmentCount, geometrySource } = entry;
    return (
      <g
        key={overlay.id}
        className="province-map-route"
        data-route-id={overlay.id}
        data-route-owner-id={overlay.routeId ?? overlay.id}
        data-route-kind={overlay.kind}
        data-transport-mode={overlay.mode}
        data-route-stop-count={overlay.stops.length}
        data-route-geometry-source={geometrySource}
        data-route-network-segment-count={networkSegmentCount}
      >
        <path className="province-map-route-path" d={geometry.path} vectorEffect="non-scaling-stroke" />
      </g>
    );
  }), [routeRenderData]);

  const routeNodesMarkup = useMemo(() => routeRenderData.map((entry) => {
    const { overlay, geometry } = entry;
    return (
      <g
        key={`nodes-${overlay.id}`}
        className="province-map-route-node-entry"
        data-route-node-owner-id={overlay.routeId ?? overlay.id}
        data-route-kind={overlay.kind}
        data-transport-mode={overlay.mode}
        data-route-stop-count={overlay.stops.length}
      >
        {geometry.stopPoints.map((point, index) => (
          <circle
            key={`${overlay.id}-stop-${index}`}
            className="province-map-route-stop"
            data-stop-index={index}
            data-stop-first={index === 0 ? 'true' : 'false'}
            data-stop-last={index === geometry.stopPoints.length - 1 ? 'true' : 'false'}
            cx={formatGeometryValue(point.x)}
            cy={formatGeometryValue(point.y)}
            r={routeStopRadius(index, geometry.stopPoints.length)}
          />
        ))}
      </g>
    );
  }), [routeRenderData]);

  const renderShipmentMarkup = (now: number) => shipmentOverlays.map((shipment) => {
    const position = currentShipmentPosition(shipment, now);
    if (!position) return null;
    const selected = hoveredShipmentId === shipment.id;
    const cargoLabel = shipment.cargo.length > 0
      ? shipment.cargo.map((entry) => `${entry.productName}${entry.quantity}`).join('、')
      : '无剩余货物';
    return (
      <g
        key={shipment.id}
        className="province-map-shipment"
        data-shipment-id={shipment.id}
        data-route-id={shipment.routeId ?? ''}
        data-transport-mode={shipment.mode}
        data-selected={selected ? 'true' : 'false'}
        transform={`translate(${formatGeometryValue(position.x)} ${formatGeometryValue(position.y)})`}
        role="button"
        tabIndex={0}
        aria-label={`${shipment.routeName}，${cargoLabel}`}
        onPointerDown={(event) => event.stopPropagation()}
        onPointerEnter={(event) => {
          setHoveredProvinceId(null);
          setHoveredShipmentId(shipment.id);
          if (tooltipRef.current) tooltipRef.current.style.transform = `translate3d(${Math.min(window.innerWidth - 300, event.clientX + 14)}px, ${Math.min(window.innerHeight - 220, event.clientY + 14)}px, 0)`;
        }}
        onPointerLeave={() => setHoveredShipmentId((current) => current === shipment.id ? null : current)}
        onFocus={(event) => {
          setHoveredProvinceId(null);
          setHoveredShipmentId(shipment.id);
          const rect = event.currentTarget.getBoundingClientRect();
          if (tooltipRef.current) tooltipRef.current.style.transform = `translate3d(${Math.min(window.innerWidth - 300, rect.right + 10)}px, ${Math.min(window.innerHeight - 220, rect.top)}px, 0)`;
        }}
        onBlur={() => setHoveredShipmentId((current) => current === shipment.id ? null : current)}
        onClick={(event) => {
          event.stopPropagation();
          setHoveredProvinceId(null);
          setHoveredShipmentId(shipment.id);
        }}
      >
        <circle className="province-map-shipment-hit" r="12" />
        <circle className="province-map-shipment-badge" r="8" />
        <ShipmentMarkerIcon mode={shipment.mode} />
      </g>
    );
  });

  const updateViewportMetadata = useCallback((container: HTMLElement) => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!(width > 0) || !(height > 0)) return;
    container.dataset.mapFitMode = 'mainland-area-target';
    container.dataset.mapContainViewport = `${width}x${height}`;
    container.dataset.mapIntrinsicAspect = provinceMapProjection.aspect.toFixed(6);
    container.dataset.mapTooltipMode = width > MOBILE_MAP_MAX_WIDTH ? 'desktop' : 'hidden-mobile';
    container.dataset.mapWorldContext = 'continents-10m-fill-110m-stroke';
    container.dataset.mapWorldFillResolution = '10m';
    container.dataset.mapWorldStrokeResolution = '110m';
    container.dataset.mapMainlandOutlineResolution = '10m';
    container.dataset.mapWorldInteractive = 'false';
    container.dataset.mapRasterMode = 'preloaded-full-world-svg-snapshot';
    if (!container.dataset.mapRasterReady) container.dataset.mapRasterReady = 'false';
  }, []);

  const refreshRasterSnapshot = useCallback(() => {
    const container = viewportRef.current;
    const surface = cameraSurfaceRef.current;
    const canvas = rasterCanvasRef.current;
    if (!container || !surface || !canvas) return;
    // A content update during input still invalidates an older decoder result.
    // Remember the work instead of silently losing it until another prop update.
    rasterRefreshPendingRef.current = true;
    const generation = rasterGenerationRef.current + 1;
    rasterGenerationRef.current = generation;
    if (container.dataset.mapZoomActive === 'true') return;
    if (Number(container.dataset.mapLabelCount || 0) !== provinceMapLabelSources.length) return;
    const svg = surface.querySelector<SVGSVGElement>('.province-map-world-svg');
    const preloadViewBox = container.dataset.mapCameraPreloadViewBox;
    const viewportWidth = container.clientWidth;
    const viewportHeight = container.clientHeight;
    if (!svg || !preloadViewBox || !(viewportWidth > 0) || !(viewportHeight > 0)) return;

    rasterRefreshPendingRef.current = false;
    container.dataset.mapRasterReady = 'false';
    container.dataset.mapRasterError = '';
    const rasterScale = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    const pixelWidth = Math.max(1, Math.round(viewportWidth * rasterScale));
    const pixelHeight = Math.max(1, Math.round(viewportHeight * rasterScale));
    container.dataset.mapRasterScale = rasterScale.toFixed(2);
    container.dataset.mapRasterPixelSize = `${pixelWidth}x${pixelHeight}`;

    void createProvinceMapRasterSnapshot(svg, preloadViewBox, pixelWidth, pixelHeight).then((snapshot) => {
      try {
        if (rasterGenerationRef.current !== generation) return;
        // Decoding is asynchronous: idle at request time does not mean idle now.
        // Do not replace pixels or switch the active fallback to a different layer.
        if (container.dataset.mapZoomActive === 'true') {
          rasterRefreshPendingRef.current = true;
          return;
        }
        const context = canvas.getContext('2d', { alpha: true });
        if (!context) {
          container.dataset.mapRasterReady = 'false';
          container.dataset.mapRasterError = 'context-unavailable';
          return;
        }
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
        context.clearRect(0, 0, pixelWidth, pixelHeight);
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        context.drawImage(snapshot.image, 0, 0, pixelWidth, pixelHeight);
        rasterRevisionRef.current += 1;
        container.dataset.mapRasterRevision = String(rasterRevisionRef.current);
        container.dataset.mapRasterReady = 'true';
        container.dataset.mapRasterError = '';
      } finally {
        snapshot.dispose();
      }
    }).catch(() => {
      if (rasterGenerationRef.current !== generation) return;
      if (container.dataset.mapZoomActive === 'true') {
        rasterRefreshPendingRef.current = true;
        return;
      }
      container.dataset.mapRasterReady = 'false';
      container.dataset.mapRasterError = 'snapshot-failed';
    });
  }, []);

  useLayoutEffect(() => {
    const container = viewportRef.current;
    const surface = cameraSurfaceRef.current;
    if (!container || !surface) return undefined;
    cameraRef.current?.destroy();
    cameraRef.current = createProvinceMapCamera(container, surface, { focusBounds: provinceMapMainlandFocusBounds });
    updateViewportMetadata(container);
    if (updateSettledStrokeScales(container)) rasterRefreshPendingRef.current = true;
    let idleRefreshFrame: number | null = null;
    const queueIdleRefresh = () => {
      if (idleRefreshFrame !== null) return;
      idleRefreshFrame = requestAnimationFrame(() => {
        idleRefreshFrame = null;
        refreshRasterSnapshot();
      });
    };
    // Observe only the existing active/idle boundary, never Camera frame writes.
    const settleObserver = new MutationObserver(() => {
      if (container.dataset.mapZoomActive === 'true') return;
      if (updateSettledStrokeScales(container)) rasterRefreshPendingRef.current = true;
      if (rasterRefreshPendingRef.current) queueIdleRefresh();
    });
    settleObserver.observe(container, { attributes: true, attributeFilter: ['data-map-zoom-active'] });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
      updateViewportMetadata(container);
      cameraRef.current?.reset();
      if (updateSettledStrokeScales(container)) rasterRefreshPendingRef.current = true;
      queueIdleRefresh();
    });
    observer?.observe(container);
    return () => {
      observer?.disconnect();
      settleObserver.disconnect();
      if (idleRefreshFrame !== null) cancelAnimationFrame(idleRefreshFrame);
      rasterGenerationRef.current += 1;
      rasterRefreshPendingRef.current = false;
      container.dataset.mapRasterReady = 'false';
      cameraRef.current?.destroy();
      cameraRef.current = null;
    };
  }, [refreshRasterSnapshot, updateViewportMetadata]);

  useLayoutEffect(() => {
    const container = viewportRef.current;
    if (!container) return undefined;
    let cancelled = false;
    const renderLabels = () => {
      if (cancelled) return;
      const fontFamily = getComputedStyle(container).fontFamily || 'sans-serif';
      const nextLabels = layoutProvinceMapLabels(provinceMapLabelSources, provinceMapProjection, fontFamily);
      labelRevisionRef.current += 1;
      container.dataset.mapLabelLayoutRevision = String(labelRevisionRef.current);
      container.dataset.mapLabelCount = String(nextLabels.length);
      container.dataset.mapCurvedLabelCount = String(nextLabels.filter((label) => label.curved).length);
      container.dataset.mapLabelMode = 'curved-chinese-full-name';
      container.dataset.mapLabelGeometryMode = 'static-world-natural-ratio-rigid-glyphs';
      container.dataset.mapLabelCameraMode = 'shared-static-world';
      setLabels(nextLabels);
    };
    renderLabels();
    void document.fonts?.ready.then(renderLabels);
    return () => { cancelled = true; };
  }, []);

  useLayoutEffect(() => {
    if (labels.length !== provinceMapLabelSources.length) return undefined;
    const frame = requestAnimationFrame(refreshRasterSnapshot);
    return () => cancelAnimationFrame(frame);
  }, [data, labels, referenceNow, refreshRasterSnapshot, routeOverlays, selectedProvinceId, shipmentOverlays]);

  useEffect(() => {
    const container = viewportRef.current;
    if (!container) return;
    container.dataset.mapSelectedProvinceId = selectedProvinceId ?? '';
  }, [selectedProvinceId]);

  useLayoutEffect(() => {
    if ((!hoveredProvinceId && !hoveredShipmentId) || !tooltipTopLayerActive) return undefined;
    const tooltip = tooltipRef.current;
    if (!tooltip) return undefined;
    showTopLayerPopover(tooltip);
    return () => hideTopLayerPopover(tooltip);
  }, [hoveredProvinceId, hoveredShipmentId, tooltipTopLayerActive, tooltipLayer]);

  const selectProvince = useCallback((provinceId: string) => {
    if (routePicking?.active) {
      routePicking.onPickProvince(provinceId);
      return;
    }
    onSelectProvince(provinceId);
  }, [onSelectProvince, routePicking]);

  const handleRegionKeyDown = useCallback((event: KeyboardEvent<SVGPathElement>, provinceId: string) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    selectProvince(provinceId);
  }, [selectProvince]);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if ((!hoveredProvinceId && !hoveredShipmentId) || !tooltipRef.current) return;
    const left = Math.min(window.innerWidth - 300, Math.max(8, event.clientX + 14));
    const top = Math.min(window.innerHeight - 220, Math.max(8, event.clientY + 14));
    tooltipRef.current.style.transform = `translate3d(${left}px, ${top}px, 0)`;
  }, [hoveredProvinceId, hoveredShipmentId]);

  const tooltipNode = hoveredShipment ? (
    <LiveServerTime referenceNow={referenceNow} intervalMs={500}>
      {(now) => {
        const hoveredShipmentPosition = currentShipmentPosition(hoveredShipment, now);
        if (!hoveredShipmentPosition) return null;
        return (
          <div
            ref={tooltipRef}
            className="economy-chart-tooltip ui-tooltip-surface province-map-tooltip province-map-static-tooltip province-map-shipment-tooltip"
            data-tooltip-kind="shipment"
            data-tooltip-layer={tooltipLayer ? 'workspace' : 'local'}
            data-top-layer={tooltipTopLayerActive ? 'true' : undefined}
            popover={tooltipTopLayerActive ? 'manual' : undefined}
            role="status"
          >
            <strong>{hoveredShipment.routeName}</strong>
            <span>{provinceNameById.get(hoveredShipmentPosition.fromProvinceId) ?? hoveredShipmentPosition.fromProvinceId} → {provinceNameById.get(hoveredShipmentPosition.toProvinceId) ?? hoveredShipmentPosition.toProvinceId}</span>
            <span>剩余时间：{formatTransportDuration(Math.max(0, hoveredShipment.arrivesAt - now))}</span>
            <span>当前载荷：<CompactNumber value={hoveredShipmentPosition.remainingLoad} /></span>
            {hoveredShipment.cargo.length > 0 ? hoveredShipment.cargo.map((entry, index) => (
              <span key={`${entry.productName}-${entry.destinationName}-${index}`} className="province-map-shipment-tooltip-cargo">
                {entry.productName} ×<CompactNumber value={entry.quantity} />{entry.destinationName ? ` → ${entry.destinationName}` : null}
              </span>
            )) : <span>没有剩余货物</span>}
          </div>
        );
      }}
    </LiveServerTime>
  ) : hoveredDatum ? (
    <div
      ref={tooltipRef}
      className="economy-chart-tooltip ui-tooltip-surface province-map-tooltip province-map-static-tooltip"
      data-tooltip-layer={tooltipLayer ? 'workspace' : 'local'}
      data-top-layer={tooltipTopLayerActive ? 'true' : undefined}
      popover={tooltipTopLayerActive ? 'manual' : undefined}
      aria-hidden="true"
    >
      <strong>{hoveredDatum.provinceName}</strong>
      {tooltipRows(hoveredDatum).map((row) => <span key={row}>{row}</span>)}
    </div>
  ) : null;

  const accessibleSummary = `世界战略地图以 10m 大陆填充和同源 110m 简化海岸描边提供地理背景，美国本土连续 ${provinces.length} 州是唯一可经营和交互地区。${selectedProvince ? `当前打开${selectedProvince.name}页面。` : '当前没有打开州页面。'}当前有 ${shipmentOverlays.length} 笔运输在途。美国外边界由同一份 10m 州界拓扑合并生成，并覆盖大陆对应海岸线，避免双重边线。权威世界背景、州面、州名、运输路线和在途标记位于同一个静态 SVG 世界面；镜头输入 active 时只显示由该 SVG 预生成的临时全世界栅格快照并继续使用同一个 Camera transform，停手后立即回到根 SVG 的最终 viewBox 矢量画面。最小 1 倍镜头把美国本土居中，Camera 的 world bounds 在初始化或真实容器变化时固定，放大后根据当前倍率反求视场并在同一固定边界内约束中心。${routePickingActive ? '当前处于运输路线选州模式，只能按顺序选择美国本土州面作为站点，再次点击起点州可以闭环。' : '点击美国本土州面可以打开对应州页面，'}滚轮或双指可以缩放，拖动地图可以平移，双击或双触地图空白可以重置到最小居中镜头。`;

  return (
    <div className="province-map-chart" data-province-count={provinces.length} data-map-feature-count={provinceMapWorld.length} data-selected-province-id={selectedProvinceId ?? ''} data-map-lens={lens} data-map-zoom-min="1" data-map-zoom-max="4" data-map-label-mode="curved-chinese-full-name" data-map-world-context="continents-10m-fill-110m-stroke" data-route-picking={routePickingActive ? 'true' : 'false'} data-route-overlay-count={routeOverlays.length} data-route-network-kind={transportCapitalRouteDataKind} data-route-physical-edge-count={transportPhysicalPathByEdge.size} data-shipment-overlay-count={shipmentOverlays.length}>
      <div className="province-map-echart province-map-static-map" role="group" aria-label="世界战略地图，美国本土连续四十八州可交互" data-map-ready="true" data-testid="us-mainland-map" data-route-picking={routePickingActive ? 'true' : 'false'} data-route-overlay-count={routeOverlays.length} data-shipment-overlay-count={shipmentOverlays.length}>
        <div
          ref={viewportRef}
          className="economy-chart__canvas province-map-static-viewport"
          onPointerMove={handlePointerMove}
          onPointerDown={() => { setHoveredProvinceId(null); setHoveredShipmentId(null); }}
          onWheelCapture={() => { setHoveredProvinceId(null); setHoveredShipmentId(null); }}
          data-map-world-path-count={provinceMapWorld.length}
          data-map-world-shadow-path-count="1"
          data-map-world-fill-path-count="1"
          data-map-world-outline-path-count="1"
          data-map-mainland-outline-path-count="1"
          data-map-path-revision="1"
        >
          <div ref={cameraSurfaceRef} className="province-map-camera-surface">
            <svg className="province-map-world-svg" viewBox={provinceMapProjection.viewBox} preserveAspectRatio="xMidYMid meet" role="group" aria-label="世界战略地图，美国连续四十八州可交互">
              <g className="province-map-world">
                <g className="province-map-world-context" pointerEvents="none" aria-hidden="true">
                  <path
                    className="province-map-world-shadow"
                    data-world-shadow="outer"
                    data-world-resolution="110m"
                    data-interactive="false"
                    d={provinceMapWorldStrokePath}
                    fillRule="evenodd"
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="none"
                  />
                  <path
                    className="province-map-world-fill"
                    data-world-fill="continents"
                    data-world-resolution="10m"
                    data-interactive="false"
                    d={provinceMapWorldFillPath}
                    fillRule="evenodd"
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="none"
                  />
                  <path
                    className="province-map-world-outline"
                    data-world-outline="continents-110m-stroke"
                    data-world-resolution="110m"
                    data-interactive="false"
                    d={provinceMapWorldStrokePath}
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="none"
                  />
                  <path
                    className="province-map-mainland-seam"
                    data-mainland-outline-source="us-atlas-states-10m"
                    data-interactive="false"
                    d={provinceMapMainlandOutlinePath}
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="none"
                  />
                  <path
                    className="province-map-mainland-outline"
                    data-mainland-outline="states-10m-union"
                    data-mainland-outline-source="us-atlas-states-10m"
                    data-interactive="false"
                    d={provinceMapMainlandOutlinePath}
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="none"
                  />
                </g>
                <g className="province-map-regions">
                  {provinceMapWorld.map((entry) => {
                    const datum = datumByProvinceId.get(entry.provinceId);
                    if (!datum) return null;
                    const selected = entry.provinceId === selectedProvinceId;
                    const routePickable = routePickingActive;
                    const style = {
                      '--province-map-area-color': datum.areaColor,
                      '--province-map-border-color': datum.borderColor,
                    } as CSSProperties;
                    return (
                      <path
                        key={entry.provinceId}
                        className="province-map-region"
                        data-province-id={entry.provinceId}
                        data-province-name={entry.provinceName}
                        data-selected={selected ? 'true' : 'false'}
                        data-route-pickable={routePickable ? 'true' : 'false'}
                        d={entry.path}
                        fillRule="evenodd"
                        vectorEffect="non-scaling-stroke"
                        style={style}
                        role="button"
                        tabIndex={0}
                        aria-label={entry.provinceName}
                        onClick={() => selectProvince(entry.provinceId)}
                        onKeyDown={(event) => handleRegionKeyDown(event, entry.provinceId)}
                        onPointerEnter={() => { setHoveredShipmentId(null); setHoveredProvinceId(entry.provinceId); }}
                        onPointerLeave={() => setHoveredProvinceId((current) => current === entry.provinceId ? null : current)}
                      />
                    );
                  })}
                </g>
                <g className="province-map-routes" pointerEvents="none" aria-hidden="true">
                  <defs>
                    <mask
                      id={routeNodeMaskId}
                      className="province-map-route-node-cutout-mask"
                      data-route-node-cutout-count={routeNodeCutouts.length}
                      x={routeMaskX}
                      y={routeMaskY}
                      width={routeMaskWidth}
                      height={routeMaskHeight}
                      maskUnits="userSpaceOnUse"
                      maskContentUnits="userSpaceOnUse"
                      style={{ maskType: 'luminance' }}
                    >
                      <rect x={routeMaskX} y={routeMaskY} width={routeMaskWidth} height={routeMaskHeight} fill="white" />
                      {routeNodeCutouts.map((cutout) => (
                        <circle
                          key={`${cutout.x}:${cutout.y}`}
                          className="province-map-route-node-cutout"
                          cx={cutout.x}
                          cy={cutout.y}
                          r={cutout.radius}
                          fill="black"
                        />
                      ))}
                    </mask>
                  </defs>
                  <g className="province-map-route-path-layer" mask={`url(#${routeNodeMaskId})`}>{routePathsMarkup}</g>
                  <g className="province-map-route-node-layer">{routeNodesMarkup}</g>
                </g>
                <g className="province-map-label-camera" pointerEvents="none" aria-hidden="true">
                  {labels.map((label) => (
                    <g
                      key={label.provinceId}
                      className="province-map-label"
                      data-province-id={label.provinceId}
                      data-map-state-label={label.provinceName}
                      data-label-fit="inside"
                      data-label-curved={label.curved ? 'true' : 'false'}
                      data-label-glyph-mode="rigid"
                      data-label-natural-aspect={label.naturalAspect.toFixed(4)}
                      data-label-available-length={label.availableLength.toFixed(2)}
                      data-label-available-height={label.availableHeight.toFixed(2)}
                      data-label-used-width={label.usedWidth.toFixed(2)}
                      data-label-used-height={label.usedHeight.toFixed(2)}
                      data-label-axis-angle={label.axisAngle.toFixed(2)}
                      data-label-center-x={label.center.x.toFixed(2)}
                      data-label-center-y={label.center.y.toFixed(2)}
                      data-selected={label.provinceId === selectedProvinceId ? 'true' : 'false'}
                      style={{ fontSize: `${label.fontSize.toFixed(2)}px`, strokeWidth: `${label.strokeWidth.toFixed(2)}px` }}
                    >
                      {label.glyphs.map((glyph, index) => (
                        <text
                          key={`${label.provinceId}-${index}`}
                          className="province-map-label-glyph"
                          data-glyph-index={index}
                          data-glyph-rotation={glyph.rotation.toFixed(2)}
                          data-glyph-box-width={glyph.boxWidth.toFixed(2)}
                          data-glyph-box-height={glyph.boxHeight.toFixed(2)}
                          x="0"
                          y="0"
                          dominantBaseline="central"
                          textAnchor="middle"
                          transform={`translate(${formatGeometryValue(glyph.x)} ${formatGeometryValue(glyph.y)}) rotate(${formatGeometryValue(glyph.rotation)})`}
                        >
                          {glyph.value}
                        </text>
                      ))}
                    </g>
                  ))}
                </g>
                <g className="province-map-shipments" data-map-clock-scope="shipment-leaf">
                  {shipmentOverlays.length > 0 ? (
                    <LiveServerTime referenceNow={referenceNow} intervalMs={500}>
                      {renderShipmentMarkup}
                    </LiveServerTime>
                  ) : null}
                </g>
              </g>
            </svg>
            <canvas ref={rasterCanvasRef} className="province-map-camera-raster" aria-hidden="true" />
          </div>
          {tooltipNode ? (tooltipLayer ? createPortal(tooltipNode, tooltipLayer) : tooltipNode) : null}
        </div>
        <span className="economy-chart__accessible-summary">{accessibleSummary}</span>
      </div>
    </div>
  );
}
