import { useMemo } from 'react';
import { feature } from 'topojson-client';
import usStateAtlas from 'us-atlas/states-10m.json';
import regionCatalog from '../../../shared/provinces.json';
import type { ProvinceAssetSummary, ProvinceDefinition } from '../../types';
import { formatNumber } from '../../utils/formatters';
import {
  EconomyChart,
  type EconomyChartClickEvent,
} from '../charts/EconomyChart';
import {
  registerEChartsMap,
  type EChartsCoreOption,
} from '../charts/echartsCore';

const US_MAINLAND_MAP_NAME = 'economy-us-mainland-states';
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
): ProvinceMapDatum {
  const storedQuantity = Number(summary?.storedQuantity || 0);
  const facilityCount = Number(summary?.facilityCount || 0);
  const blockedFacilityCount = Number(summary?.blockedFacilityCount || 0);
  const hasAssets = storedQuantity > 0 || facilityCount > 0;
  return {
    name: province.shortName,
    value: facilityCount,
    provinceId: province.id,
    provinceName: province.name,
    storedQuantity,
    facilityCount,
    runningFacilityCount: Number(summary?.runningFacilityCount || 0),
    blockedFacilityCount,
    openOrderCount: Number(summary?.openOrderCount || 0),
    itemStyle: {
      areaColor: blockedFacilityCount > 0
        ? 'var(--color-danger-soft)'
        : hasAssets
          ? 'var(--color-success-soft)'
          : 'var(--color-surface-soft)',
      ...(blockedFacilityCount > 0 ? { borderColor: 'var(--color-danger)' } : {}),
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
}: {
  provinces: ProvinceDefinition[];
  summaries: Record<string, ProvinceAssetSummary>;
  selectedProvinceId: string;
  onSelectProvince: (provinceId: string) => void;
}) {
  const provinceIdByMapName = useMemo(() => new Map(
    provinces.map((province) => [province.shortName, province.id]),
  ), [provinces]);
  const selectedProvince = provinces.find((province) => province.id === selectedProvinceId)
    ?? provinces[0];
  const data = useMemo(() => provinces.map((province) => (
    datumFor(province, summaries[province.id])
  )), [provinces, summaries]);
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
      selectedMap: selectedProvince ? { [selectedProvince.shortName]: true } : {},
      roam: true,
      scaleLimit: { min: 1, max: 8 },
      zoom: 1.08,
      layoutCenter: ['50%', '50%'],
      layoutSize: '94%',
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
          layoutCenter: ['50%', '39%'],
          layoutSize: '84%',
          zoom: 1.02,
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
  }), [data, selectedProvince]);

  const handleMapClick = (event: EconomyChartClickEvent) => {
    if (event.seriesType !== 'map') return;
    const provinceId = provinceIdByMapName.get(String(event.name || ''));
    if (provinceId) onSelectProvince(provinceId);
  };

  const accessibleSummary = `美国本土州级经营地图，共 ${provinces.length} 个可经营地区。当前选择${selectedProvince?.name || '加利福尼亚州'}。可使用页面上的州级地区选择器进行键盘操作。`;
  return (
    <div
      className="province-map-chart"
      data-province-count={provinces.length}
      data-map-feature-count={usMainlandGeoJson.features.length}
      data-selected-province-id={selectedProvinceId}
    >
      <EconomyChart
        option={option}
        ariaLabel="美国本土州级经营地图"
        accessibleSummary={accessibleSummary}
        className="province-map-echart"
        testId="us-mainland-map"
        onClick={handleMapClick}
      />
    </div>
  );
}
