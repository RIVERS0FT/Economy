import { useCallback, useMemo } from 'react';
import { feature } from 'topojson-client';
import usStateAtlas from 'us-atlas/states-10m.json';
import regionCatalog from '../../../shared/provinces.json';
import type { ProvinceAssetSummary, ProvinceDefinition } from '../../types';
import { formatNumber } from '../../utils/formatters';
import {
  EconomyChart,
  type EconomyChartClickEvent,
  type EconomyChartDoubleClickEvent,
} from '../charts/EconomyChart';
import {
  registerEChartsMap,
  type EChartsCoreOption,
  type EChartsType,
} from '../charts/echartsCore';

const US_MAINLAND_MAP_NAME = 'economy-us-mainland-states';
const US_MAINLAND_ASPECT_SCALE = 0.75;
const MAP_CONTAIN_INSET = 0.96;
const HOVER_LABEL_STATE_CODES = new Set([
  'CT',
  'DE',
  'MD',
  'MA',
  'NH',
  'NJ',
  'RI',
  'VT',
]);

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
        name: region.shortName,
        mapName,
      },
    }];
  }),
};

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
  itemStyle: {
    areaColor: string;
    borderColor?: string;
  };
  label: {
    show: boolean;
  };
}

function datumFor(
  province: ProvinceDefinition,
  summary: ProvinceAssetSummary | undefined,
  lens: ProvinceMapLens,
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
  const areaColor = lens === 'political'
    ? 'var(--color-surface-soft)'
    : lens === 'industry'
      ? facilityCount > 0 ? 'var(--color-success-soft)' : 'var(--color-surface-soft)'
      : lens === 'market'
        ? openOrderCount > 0 ? 'var(--color-warning-soft)' : 'var(--color-surface-soft)'
        : lens === 'alerts'
          ? blockedFacilityCount > 0 ? 'var(--color-danger-soft)' : 'var(--color-surface-soft)'
          : blockedFacilityCount > 0
            ? 'var(--color-danger-soft)'
            : hasAssets
              ? 'var(--color-success-soft)'
              : 'var(--color-surface-soft)';
  return {
    name: province.shortName,
    value,
    provinceId: province.id,
    provinceName: province.name,
    storedQuantity,
    facilityCount,
    runningFacilityCount: Number(summary?.runningFacilityCount || 0),
    blockedFacilityCount,
    openOrderCount,
    itemStyle: {
      areaColor,
      ...(lens === 'alerts' && blockedFacilityCount > 0 ? { borderColor: 'var(--color-danger)' } : {}),
    },
    label: {
      show: !HOVER_LABEL_STATE_CODES.has(province.shortName),
    },
  };
}

function tooltipContent(params: unknown) {
  const event = params as { name?: string; data?: ProvinceMapDatum };
  const datum = event.data;
  if (!datum?.provinceId) return String(event.name || '州级地区');
  return [
    `<strong>${datum.provinceName}</strong>`,
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
}: {
  provinces: ProvinceDefinition[];
  summaries: Record<string, ProvinceAssetSummary>;
  selectedProvinceId: string | null;
  onSelectProvince: (provinceId: string) => void;
  lens?: ProvinceMapLens;
}) {
  const provinceIdByMapName = useMemo(() => new Map(
    provinces.map((province) => [province.shortName, province.id]),
  ), [provinces]);
  const selectedProvince = provinces.find((province) => province.id === selectedProvinceId);
  const selectedMap = useMemo(() => Object.fromEntries(
    provinces.map((province) => [province.shortName, province.id === selectedProvinceId]),
  ), [provinces, selectedProvinceId]);
  const data = useMemo(() => provinces.map((province) => (
    datumFor(province, summaries[province.id], lens)
  )), [lens, provinces, summaries]);
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
  }, []);
  const option = useMemo<EChartsCoreOption>(() => ({
    animationDuration: 260,
    animationDurationUpdate: 220,
    tooltip: {
      trigger: 'item',
      className: 'economy-chart-tooltip province-map-tooltip',
      borderColor: 'var(--color-border-strong)',
      backgroundColor: 'var(--color-surface-raised)',
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
      scaleLimit: { min: 1, max: 8 },
      aspectScale: US_MAINLAND_ASPECT_SCALE,
      labelLayout: {
        hideOverlap: true,
      },
      label: {
        show: true,
        color: 'var(--color-text-secondary)',
        fontFamily: 'inherit',
        fontSize: 10,
        formatter: (params: unknown) => {
          return String((params as { name?: string }).name || '');
        },
      },
      itemStyle: {
        areaColor: 'var(--color-surface-soft)',
        borderColor: 'var(--color-border-strong)',
        borderWidth: 1,
      },
      emphasis: {
        label: {
          show: true,
          color: 'var(--color-text-primary)',
          fontWeight: 700,
        },
        itemStyle: {
          areaColor: 'var(--color-surface-hover)',
          borderColor: 'var(--color-success)',
          borderWidth: 1.5,
        },
      },
      select: {
        label: {
          show: true,
          color: 'var(--color-text-primary)',
          fontWeight: 700,
        },
        itemStyle: {
          areaColor: 'var(--color-success-strong)',
          borderColor: 'var(--color-success)',
          borderWidth: 2,
        },
      },
      data,
    }],
    media: [{
      query: {
        maxAspectRatio: 0.8,
      },
      option: {
        series: [{
          label: {
            show: false,
          },
          data: data.map((datum) => ({
            ...datum,
            label: { show: false },
          })),
        }],
      },
    }],
  }), [data, selectedMap]);

  const handleMapClick = (event: EconomyChartClickEvent) => {
    if (event.seriesType !== 'map') return;
    const provinceId = provinceIdByMapName.get(String(event.name || ''));
    if (provinceId) onSelectProvince(provinceId);
  };

  const handleMapDoubleClick = useCallback((
    event: EconomyChartDoubleClickEvent,
    chart: EChartsType,
  ) => {
    if (event.target) return;
    applyContainCamera(chart);
    chart.getDom().dataset.mapCameraReset = 'blank-double-click';
  }, [applyContainCamera]);

  const accessibleSummary = `美国本土州级经营地图，共 ${provinces.length} 个可经营地区。${selectedProvince ? `当前打开${selectedProvince.name}页面。` : '当前没有打开州页面。'}点击州面可以打开对应州页面，双击地图空白可以重置缩放和平移。`;
  return (
    <div
      className="province-map-chart"
      data-province-count={provinces.length}
      data-map-feature-count={usMainlandGeoJson.features.length}
      data-selected-province-id={selectedProvinceId ?? ''}
      data-map-lens={lens}
    >
      <EconomyChart
        option={option}
        ariaLabel="美国本土州级经营地图"
        accessibleSummary={accessibleSummary}
        className="province-map-echart"
        testId="us-mainland-map"
        updateMode="merge"
        onChartReady={applyContainCamera}
        onResize={applyContainCamera}
        onClick={handleMapClick}
        onDoubleClick={handleMapDoubleClick}
      />
    </div>
  );
}
