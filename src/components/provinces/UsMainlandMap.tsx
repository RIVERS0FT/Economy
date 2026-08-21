import { useCallback, useEffect, useMemo, useRef } from 'react';
import { feature } from 'topojson-client';
import usStateAtlas from 'us-atlas/states-10m.json';
import regionCatalog from '../../../shared/provinces.json';
import type { ProvinceAssetSummary, ProvinceDefinition } from '../../types';
import { formatNumber } from '../../utils/formatters';
import {
  EconomyChart,
  type EconomyChartCanvasClickEvent,
  type EconomyChartClickEvent,
  type EconomyChartDoubleClickEvent,
} from '../charts/EconomyChart';
import { commonTooltip } from '../charts/chartOptions';
import {
  registerEChartsMap,
  type EChartsCoreOption,
  type EChartsType,
} from '../charts/echartsCore';
import {
  createProvinceMapLabelRenderer,
  type ProvinceMapLabelRenderer,
  type ProvinceMapLabelSource,
} from './provinceMapLabels';

const US_MAINLAND_MAP_NAME = 'economy-us-mainland-states';
const US_MAINLAND_ASPECT_SCALE = 0.75;
const MAP_CONTAIN_INSET = 0.96;
const MOBILE_MAP_MAX_WIDTH = 720;
const MOBILE_BLANK_DOUBLE_TAP_MS = 360;
const MOBILE_BLANK_DOUBLE_TAP_DISTANCE = 28;

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

const usMainlandGeoJson = {
  ...atlasStateCollection,
  features: atlasStateCollection.features.flatMap((stateFeature) => {
    const mapName = String(stateFeature.properties?.name || '');
    const region = regionByMapName.get(mapName);
    if (!region) return [];
    return [{
      ...stateFeature,
      properties: {
        ...stateFeature.properties,
        name: region.name,
        mapName,
        provinceId: region.id,
      },
    }];
  }),
};

const provinceMapLabelSources: ProvinceMapLabelSource[] = atlasStateCollection.features.flatMap((stateFeature) => {
  const mapName = String(stateFeature.properties?.name || '');
  const region = regionByMapName.get(mapName);
  if (!region) return [];
  return [{
    provinceId: region.id,
    provinceName: region.name,
    anchor: [region.longitude, region.latitude],
    geometry: stateFeature.geometry,
  }];
});

function coordinateBounds(value: unknown, bounds: {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}) {
  if (!Array.isArray(value)) return;
  if (
    value.length >= 2
    && typeof value[0] === 'number'
    && Number.isFinite(value[0])
    && typeof value[1] === 'number'
    && Number.isFinite(value[1])
  ) {
    bounds.minX = Math.min(bounds.minX, value[0]);
    bounds.minY = Math.min(bounds.minY, value[1]);
    bounds.maxX = Math.max(bounds.maxX, value[0]);
    bounds.maxY = Math.max(bounds.maxY, value[1]);
    return;
  }
  for (const nested of value) coordinateBounds(nested, bounds);
}

function geometryBounds(value: unknown, bounds: Parameters<typeof coordinateBounds>[1]) {
  if (!value || typeof value !== 'object') return;
  const geometry = value as { coordinates?: unknown; geometries?: unknown[] };
  coordinateBounds(geometry.coordinates, bounds);
  for (const nested of geometry.geometries || []) geometryBounds(nested, bounds);
}

function mainlandMapAspect() {
  const bounds = {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  };
  for (const mapFeature of usMainlandGeoJson.features) {
    geometryBounds(mapFeature.geometry, bounds);
  }
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  if (!(width > 0) || !(height > 0)) return 1;
  return (width / height) * US_MAINLAND_ASPECT_SCALE;
}

const US_MAINLAND_MAP_ASPECT = mainlandMapAspect();

function containLayoutSize(width: number, height: number) {
  if (!(width > 0) || !(height > 0)) return '100%';
  const requiredSize = US_MAINLAND_MAP_ASPECT >= 1
    ? Math.min(width, height * US_MAINLAND_MAP_ASPECT)
    : Math.min(width / US_MAINLAND_MAP_ASPECT, height);
  const referenceSize = Math.min(width, height);
  return `${((requiredSize / referenceSize) * MAP_CONTAIN_INSET * 100).toFixed(4)}%`;
}

registerEChartsMap(US_MAINLAND_MAP_NAME, usMainlandGeoJson);

interface ProvinceMapDatum {
  name: string;
  value: number;
  provinceId: string;
  provinceName: string;
  storedQuantity: number;
  facilityCount: number;
  runningFacilityCount: number;
  blockedFacilityCount: number;
  openOrderCount: number;
  locked: boolean;
  itemStyle: {
    areaColor: string;
    borderColor?: string;
  };
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
  const value = lens === 'industry'
    ? facilityCount
    : lens === 'market'
      ? openOrderCount
      : lens === 'alerts'
        ? blockedFacilityCount
        : storedQuantity + facilityCount;
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
    value,
    provinceId: province.id,
    provinceName: province.name,
    storedQuantity,
    facilityCount,
    runningFacilityCount: Number(summary?.runningFacilityCount || 0),
    blockedFacilityCount,
    openOrderCount,
    locked,
    itemStyle: {
      areaColor,
      ...(lens === 'alerts' && blockedFacilityCount > 0 ? { borderColor: 'var(--color-danger)' } : {}),
    },
  };
}

function tooltipContent(params: unknown) {
  const event = params as { name?: string; data?: ProvinceMapDatum };
  const datum = event.data;
  if (!datum?.provinceId) return String(event.name || '州级地区');
  return [
    `<strong>${datum.provinceName}</strong>`,
    ...(datum.locked ? ['<span style="color:var(--color-warning)">未解锁</span>'] : []),
    `本地库存：${formatNumber(datum.storedQuantity)}`,
    `工厂：${formatNumber(datum.facilityCount)}`,
    `运行中：${formatNumber(datum.runningFacilityCount)}`,
    `本地挂单：${formatNumber(datum.openOrderCount)}`,
  ].join('<br/>');
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
  const provinceIdByDisplayName = useMemo(() => new Map(
    provinces.map((province) => [province.name, province.id]),
  ), [provinces]);
  const selectedProvince = provinces.find((province) => province.id === selectedProvinceId);
  const selectedMap = useMemo(() => Object.fromEntries(
    provinces.map((province) => [province.name, province.id === selectedProvinceId]),
  ), [provinces, selectedProvinceId]);
  const data = useMemo(() => provinces.map((province) => (
    datumFor(province, summaries[province.id], lens, !unlockedSet.has(province.id))
  )), [lens, provinces, summaries, unlockedSet]);
  const lastBlankTapRef = useRef<{ at: number; x: number; y: number } | null>(null);
  const labelRendererRef = useRef<ProvinceMapLabelRenderer | null>(null);
  const selectedProvinceIdRef = useRef(selectedProvinceId);
  selectedProvinceIdRef.current = selectedProvinceId;

  const applyContainCamera = useCallback((chart: EChartsType) => {
    const width = chart.getWidth();
    const height = chart.getHeight();
    if (!(width > 0) || !(height > 0)) return;
    const layoutSize = containLayoutSize(width, height);
    chart.setOption({
      series: [{
        id: 'us-mainland-map',
        center: null,
        zoom: 1,
        layoutCenter: ['50%', '50%'],
        layoutSize,
      }],
    }, {
      notMerge: false,
      lazyUpdate: false,
    });
    const container = chart.getDom();
    container.dataset.mapFitMode = 'contain';
    container.dataset.mapContainLayoutSize = layoutSize;
    container.dataset.mapIntrinsicAspect = US_MAINLAND_MAP_ASPECT.toFixed(6);
    container.dataset.mapContainViewport = `${width}x${height}`;
    labelRendererRef.current?.schedule();
  }, []);

  const applyResponsiveTooltip = useCallback((chart: EChartsType) => {
    const showTooltip = chart.getWidth() > MOBILE_MAP_MAX_WIDTH;
    chart.setOption({
      tooltip: {
        ...commonTooltip,
        show: showTooltip,
      },
    }, {
      notMerge: false,
      lazyUpdate: false,
    });
    if (!showTooltip) chart.dispatchAction({ type: 'hideTip' });
    chart.getDom().dataset.mapTooltipMode = showTooltip ? 'desktop' : 'hidden-mobile';
  }, []);

  const installProvinceLabels = useCallback((chart: EChartsType) => {
    labelRendererRef.current?.destroy();
    labelRendererRef.current = createProvinceMapLabelRenderer(
      chart,
      provinceMapLabelSources,
      () => selectedProvinceIdRef.current,
    );
  }, []);

  useEffect(() => () => {
    labelRendererRef.current?.destroy();
    labelRendererRef.current = null;
  }, []);

  const option = useMemo<EChartsCoreOption>(() => ({
    animationDuration: 260,
    animationDurationUpdate: 220,
    tooltip: {
      ...commonTooltip,
      trigger: 'item',
      className: `${commonTooltip.className} province-map-tooltip`,
      formatter: tooltipContent,
    },
    series: [{
      id: 'us-mainland-map',
      type: 'map',
      map: US_MAINLAND_MAP_NAME,
      nameProperty: 'name',
      selectedMode: 'single',
      selectedMap,
      roam: true,
      roamTrigger: 'global',
      scaleLimit: { min: 0.5, max: 4 },
      aspectScale: US_MAINLAND_ASPECT_SCALE,
      label: {
        show: false,
      },
      itemStyle: {
        areaColor: 'var(--color-map-region-default)',
        borderColor: 'var(--color-map-region-border)',
        borderWidth: 1,
      },
      emphasis: {
        label: {
          show: false,
        },
        itemStyle: {
          areaColor: 'var(--color-surface-hover)',
          borderColor: 'var(--color-success)',
          borderWidth: 1.5,
        },
      },
      select: {
        label: {
          show: false,
        },
        itemStyle: {
          areaColor: 'var(--color-success-strong)',
          borderColor: 'var(--color-success)',
          borderWidth: 2,
        },
      },
      data,
    }],
  }), [data, selectedMap]);

  const handleMapClick = (event: EconomyChartClickEvent) => {
    if (event.seriesType !== 'map') return;
    const provinceId = provinceIdByDisplayName.get(String(event.name || ''));
    if (provinceId) onSelectProvince(provinceId);
  };

  const handleMapCanvasClick = useCallback((
    event: EconomyChartCanvasClickEvent,
    chart: EChartsType,
  ) => {
    if (event.target) {
      lastBlankTapRef.current = null;
      return;
    }
    const pointerType = String(event.event?.pointerType || '');
    const nativeType = String(event.event?.type || '');
    if (pointerType !== 'touch' && !nativeType.startsWith('touch')) return;
    const x = Number(event.offsetX);
    const y = Number(event.offsetY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const rawTime = Number(event.event?.timeStamp);
    const at = Number.isFinite(rawTime) && rawTime > 0 ? rawTime : performance.now();
    const previous = lastBlankTapRef.current;
    lastBlankTapRef.current = { at, x, y };
    if (!previous) return;
    const elapsed = at - previous.at;
    const distance = Math.hypot(x - previous.x, y - previous.y);
    if (elapsed < 0 || elapsed > MOBILE_BLANK_DOUBLE_TAP_MS || distance > MOBILE_BLANK_DOUBLE_TAP_DISTANCE) return;
    lastBlankTapRef.current = null;
    applyContainCamera(chart);
    chart.getDom().dataset.mapCameraReset = 'blank-double-tap';
  }, [applyContainCamera]);

  const handleMapDoubleClick = useCallback((
    event: EconomyChartDoubleClickEvent,
    chart: EChartsType,
  ) => {
    if (event.target || event.event?.pointerType === 'touch') return;
    applyContainCamera(chart);
    chart.getDom().dataset.mapCameraReset = 'blank-double-click';
  }, [applyContainCamera]);

  const handleChartReady = useCallback((chart: EChartsType) => {
    applyContainCamera(chart);
    applyResponsiveTooltip(chart);
    installProvinceLabels(chart);
  }, [applyContainCamera, applyResponsiveTooltip, installProvinceLabels]);

  const handleChartResize = useCallback((chart: EChartsType) => {
    applyContainCamera(chart);
    applyResponsiveTooltip(chart);
  }, [applyContainCamera, applyResponsiveTooltip]);

  const handleOptionApplied = useCallback(() => {
    labelRendererRef.current?.schedule();
  }, []);

  const accessibleSummary = `美国本土州级经营地图，共 ${provinces.length} 个可经营地区。${selectedProvince ? `当前打开${selectedProvince.name}页面。` : '当前没有打开州页面。'}州面内使用中文州全名，名称随地图一起缩放和平移。点击州面可以打开对应州页面，滚轮或双指可以缩放，拖动地图可以平移，双击或双触地图空白可以重置缩放和平移。`;
  return (
    <div
      className="province-map-chart"
      data-province-count={provinces.length}
      data-map-feature-count={usMainlandGeoJson.features.length}
      data-selected-province-id={selectedProvinceId ?? ''}
      data-map-lens={lens}
      data-map-zoom-min="0.5"
      data-map-zoom-max="4"
      data-map-label-mode="curved-chinese-full-name"
    >
      <EconomyChart
        option={option}
        ariaLabel="美国本土州级经营地图"
        accessibleSummary={accessibleSummary}
        className="province-map-echart"
        testId="us-mainland-map"
        updateMode="merge"
        onChartReady={handleChartReady}
        onOptionApplied={handleOptionApplied}
        onResize={handleChartResize}
        onClick={handleMapClick}
        onCanvasClick={handleMapCanvasClick}
        onDoubleClick={handleMapDoubleClick}
      />
    </div>
  );
}
