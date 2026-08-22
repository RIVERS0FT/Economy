import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { feature } from 'topojson-client';
import usStateAtlas from 'us-atlas/states-10m.json';
import regionCatalog from '../../../shared/provinces.json';
import type { ProvinceAssetSummary, ProvinceDefinition } from '../../types';
import { formatNumber } from '../../utils/formatters';
import { createProvinceMapCamera, type ProvinceMapCameraController } from './provinceMapCamera';
import {
  createProvinceMapProjection,
  provinceGeometryPath,
} from './provinceMapProjection';
import {
  layoutProvinceMapLabels,
  type ProvinceMapLabelLayout,
  type ProvinceMapLabelSource,
} from './provinceMapStaticLabels';

const MOBILE_MAP_MAX_WIDTH = 720;

export type ProvinceMapLens = 'political' | 'assets' | 'industry' | 'market' | 'alerts';

const regionByMapName = new Map(regionCatalog.map((region) => [region.mapName, region]));
const atlasTopology = usStateAtlas as unknown as Parameters<typeof feature>[0];
const atlasStateObject = (usStateAtlas as unknown as {
  objects: { states: Parameters<typeof feature>[1] };
}).objects.states;
const atlasStateCollection = feature(atlasTopology, atlasStateObject);

if (atlasStateCollection.type !== 'FeatureCollection') {
  throw new Error('US_STATE_ATLAS_FEATURE_COLLECTION_REQUIRED');
}

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

const provinceMapProjection = createProvinceMapProjection(mainlandFeatures.map((entry) => entry.geometry));
const provinceMapWorld = mainlandFeatures.map((entry) => ({
  ...entry,
  path: provinceGeometryPath(entry.geometry, provinceMapProjection),
}));
const provinceMapLabelSources: ProvinceMapLabelSource[] = mainlandFeatures.map((entry) => ({
  provinceId: entry.provinceId,
  provinceName: entry.provinceName,
  anchor: entry.anchor,
  geometry: entry.geometry,
}));

interface ProvinceMapDatum {
  name: string;
  provinceId: string;
  provinceName: string;
  storedQuantity: number;
  facilityCount: number;
  runningFacilityCount: number;
  blockedFacilityCount: number;
  openOrderCount: number;
  locked: boolean;
  areaColor: string;
  borderColor: string;
}

function datumFor(
  province: ProvinceDefinition,
  summary: ProvinceAssetSummary | undefined,
  lens: ProvinceMapLens,
  locked = false,
): ProvinceMapDatum {
  const storedQuantity = Number(summary?.storedQuantity || 0);
  const facilityCount = Number(summary?.facilityCount || 0);
  const blockedFacilityCount = Number(summary?.blockedFacilityCount || 0);
  const openOrderCount = Number(summary?.openOrderCount || 0);
  const hasAssets = storedQuantity > 0 || facilityCount > 0;
  const areaColor = locked
    ? 'var(--color-map-region-locked)'
    : lens === 'political'
      ? 'var(--color-map-region-default)'
      : lens === 'industry'
        ? facilityCount > 0 ? 'var(--color-success-soft)' : 'var(--color-map-region-default)'
        : lens === 'market'
          ? openOrderCount > 0 ? 'var(--color-warning-soft)' : 'var(--color-map-region-default)'
          : lens === 'alerts'
            ? blockedFacilityCount > 0 ? 'var(--color-danger-soft)' : 'var(--color-map-region-default)'
            : blockedFacilityCount > 0
              ? 'var(--color-danger-soft)'
              : hasAssets
                ? 'var(--color-success-soft)'
                : 'var(--color-map-region-default)';
  return {
    name: province.name,
    provinceId: province.id,
    provinceName: province.name,
    storedQuantity,
    facilityCount,
    runningFacilityCount: Number(summary?.runningFacilityCount || 0),
    blockedFacilityCount,
    openOrderCount,
    locked,
    areaColor,
    borderColor: lens === 'alerts' && blockedFacilityCount > 0
      ? 'var(--color-danger)'
      : 'var(--color-map-region-border)',
  };
}

function formatGeometryValue(value: number) {
  return Number(value.toFixed(2));
}

function tooltipRows(datum: ProvinceMapDatum) {
  return [
    `本地库存：${formatNumber(datum.storedQuantity)}`,
    `工厂：${formatNumber(datum.facilityCount)}`,
    `运行中：${formatNumber(datum.runningFacilityCount)}`,
    `本地挂单：${formatNumber(datum.openOrderCount)}`,
  ];
}

export function UsMainlandMap({
  provinces,
  summaries,
  selectedProvinceId,
  onSelectProvince,
  lens = 'assets',
  unlockedProvinceIds,
}: {
  provinces: ProvinceDefinition[];
  summaries: Record<string, ProvinceAssetSummary>;
  selectedProvinceId: string | null;
  onSelectProvince: (provinceId: string) => void;
  lens?: ProvinceMapLens;
  unlockedProvinceIds?: string[];
}) {
  const unlockedSet = useMemo(() => new Set(unlockedProvinceIds || []), [unlockedProvinceIds]);
  const data = useMemo(() => provinces.map((province) => (
    datumFor(province, summaries[province.id], lens, !unlockedSet.has(province.id))
  )), [lens, provinces, summaries, unlockedSet]);
  const datumByProvinceId = useMemo(() => new Map(data.map((datum) => [datum.provinceId, datum])), [data]);
  const selectedProvince = provinces.find((province) => province.id === selectedProvinceId);
  const viewportRef = useRef<HTMLDivElement>(null);
  const cameraSurfaceRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<ProvinceMapCameraController | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const labelRevisionRef = useRef(0);
  const [labels, setLabels] = useState<ProvinceMapLabelLayout[]>([]);
  const [hoveredProvinceId, setHoveredProvinceId] = useState<string | null>(null);
  const hoveredDatum = hoveredProvinceId ? datumByProvinceId.get(hoveredProvinceId) ?? null : null;

  const updateViewportMetadata = useCallback((container: HTMLElement) => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!(width > 0) || !(height > 0)) return;
    container.dataset.mapFitMode = 'contain-static-svg';
    container.dataset.mapContainViewport = `${width}x${height}`;
    container.dataset.mapIntrinsicAspect = provinceMapProjection.aspect.toFixed(6);
    container.dataset.mapTooltipMode = width > MOBILE_MAP_MAX_WIDTH ? 'desktop' : 'hidden-mobile';
  }, []);

  useLayoutEffect(() => {
    const container = viewportRef.current;
    const surface = cameraSurfaceRef.current;
    if (!container || !surface) return undefined;
    cameraRef.current?.destroy();
    cameraRef.current = createProvinceMapCamera(container, surface);
    updateViewportMetadata(container);
    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => {
        updateViewportMetadata(container);
        cameraRef.current?.reset();
      });
    observer?.observe(container);
    return () => {
      observer?.disconnect();
      cameraRef.current?.destroy();
      cameraRef.current = null;
    };
  }, [updateViewportMetadata]);

  useLayoutEffect(() => {
    const container = viewportRef.current;
    if (!container) return undefined;
    let cancelled = false;
    const renderLabels = () => {
      if (cancelled) return;
      const fontFamily = getComputedStyle(container).fontFamily || 'sans-serif';
      const nextLabels = layoutProvinceMapLabels(
        provinceMapLabelSources,
        provinceMapProjection,
        fontFamily,
      );
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
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const container = viewportRef.current;
    if (!container) return;
    container.dataset.mapSelectedProvinceId = selectedProvinceId ?? '';
  }, [selectedProvinceId]);

  const selectProvince = useCallback((provinceId: string) => {
    onSelectProvince(provinceId);
  }, [onSelectProvince]);

  const handleRegionKeyDown = useCallback((event: KeyboardEvent<SVGPathElement>, provinceId: string) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    selectProvince(provinceId);
  }, [selectProvince]);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!hoveredProvinceId || !tooltipRef.current) return;
    const left = Math.min(window.innerWidth - 260, Math.max(8, event.clientX + 14));
    const top = Math.min(window.innerHeight - 180, Math.max(8, event.clientY + 14));
    tooltipRef.current.style.transform = `translate3d(${left}px, ${top}px, 0)`;
  }, [hoveredProvinceId]);

  const accessibleSummary = `美国本土州级经营地图，共 ${provinces.length} 个可经营地区。${selectedProvince ? `当前打开${selectedProvince.name}页面。` : '当前没有打开州页面。'}州面和中文州全名位于同一个静态 SVG 世界面，通过同一个合成相机同步缩放和平移。点击州面可以打开对应州页面，滚轮或双指可以缩放，拖动地图可以平移，双击或双触地图空白可以重置缩放和平移。`;

  return (
    <div
      className="province-map-chart"
      data-province-count={provinces.length}
      data-map-feature-count={provinceMapWorld.length}
      data-selected-province-id={selectedProvinceId ?? ''}
      data-map-lens={lens}
      data-map-zoom-min="0.5"
      data-map-zoom-max="4"
      data-map-label-mode="curved-chinese-full-name"
    >
      <div
        className="province-map-echart province-map-static-map"
        role="group"
        aria-label="美国本土州级经营地图"
        data-map-ready="true"
        data-testid="us-mainland-map"
      >
        <div
          ref={viewportRef}
          className="economy-chart__canvas province-map-static-viewport"
          onPointerMove={handlePointerMove}
          onPointerDown={() => setHoveredProvinceId(null)}
          onWheelCapture={() => setHoveredProvinceId(null)}
          data-map-world-path-count={provinceMapWorld.length}
          data-map-path-revision="1"
        >
          <div ref={cameraSurfaceRef} className="province-map-camera-surface">
            <svg
              className="province-map-world-svg"
              viewBox={provinceMapProjection.viewBox}
              preserveAspectRatio="xMidYMid meet"
              aria-hidden="true"
              focusable="false"
            >
              <g className="province-map-world">
                <g className="province-map-regions">
                  {provinceMapWorld.map((entry) => {
                    const datum = datumByProvinceId.get(entry.provinceId);
                    if (!datum) return null;
                    const selected = entry.provinceId === selectedProvinceId;
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
                        data-locked={datum.locked ? 'true' : 'false'}
                        d={entry.path}
                        fillRule="evenodd"
                        style={style}
                        role="button"
                        tabIndex={0}
                        aria-label={`${entry.provinceName}${datum.locked ? '，未解锁' : ''}`}
                        onClick={() => selectProvince(entry.provinceId)}
                        onKeyDown={(event) => handleRegionKeyDown(event, entry.provinceId)}
                        onPointerEnter={() => setHoveredProvinceId(entry.provinceId)}
                        onPointerLeave={() => setHoveredProvinceId((current) => (
                          current === entry.provinceId ? null : current
                        ))}
                      />
                    );
                  })}
                </g>
                <g className="province-map-label-camera" pointerEvents="none">
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
                      style={{
                        fontSize: `${label.fontSize.toFixed(2)}px`,
                        strokeWidth: `${label.strokeWidth.toFixed(2)}px`,
                      }}
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
              </g>
            </svg>
          </div>
          {hoveredDatum ? (
            <div
              ref={tooltipRef}
              className="economy-chart-tooltip ui-tooltip-surface province-map-tooltip province-map-static-tooltip"
              aria-hidden="true"
            >
              <strong>{hoveredDatum.provinceName}</strong>
              {hoveredDatum.locked ? <span className="province-map-tooltip__locked">未解锁</span> : null}
              {tooltipRows(hoveredDatum).map((row) => <span key={row}>{row}</span>)}
            </div>
          ) : null}
        </div>
        <span className="economy-chart__accessible-summary">{accessibleSummary}</span>
      </div>
    </div>
  );
}
