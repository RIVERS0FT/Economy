import { useMemo } from 'react';
import chinaGeoJson from 'china-geojson/src/geojson/china.json';
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

const CHINA_PROVINCE_MAP_NAME = 'economy-china-provinces';
const OMITTED_MAP_FEATURE_NAMES = new Set(['南海诸岛']);
const HOVER_LABEL_REGION_NAMES = new Set([
  '北京',
  '天津',
  '河北',
  '上海',
  '江苏',
  '浙江',
  '福建',
  '重庆',
  '宁夏',
  '海南',
  '台湾',
  '香港',
  '澳门',
]);

const chinaProvinceGeoJson = {
  ...chinaGeoJson,
  features: chinaGeoJson.features.filter((feature) => (
    !OMITTED_MAP_FEATURE_NAMES.has(String(feature?.properties?.name || ''))
  )),
};

registerEChartsMap(CHINA_PROVINCE_MAP_NAME, chinaProvinceGeoJson);

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
      show: !HOVER_LABEL_REGION_NAMES.has(province.shortName),
    },
  };
}

function tooltipContent(params: unknown) {
  const event = params as { name?: string; data?: ProvinceMapDatum };
  const datum = event.data;
  if (!datum?.provinceId) return String(event.name || '省级地区');
  return [
    `<strong>${datum.provinceName}</strong>`,
    `本地库存：${formatNumber(datum.storedQuantity)}`,
    `工厂：${formatNumber(datum.facilityCount)}`,
    `运行中：${formatNumber(datum.runningFacilityCount)}`,
    `本地挂单：${formatNumber(datum.openOrderCount)}`,
  ].join('<br/>');
}

export function ChinaProvinceMap({
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
      id: 'china-province-map',
      type: 'map',
      map: CHINA_PROVINCE_MAP_NAME,
      nameProperty: 'name',
      selectedMode: 'single',
      selectedMap: selectedProvince ? { [selectedProvince.shortName]: true } : {},
      roam: true,
      scaleLimit: { min: 1, max: 8 },
      zoom: 1.12,
      layoutCenter: ['50%', '50%'],
      layoutSize: '98%',
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
          layoutCenter: ['50%', '38%'],
          layoutSize: '72%',
          zoom: 1.04,
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

  const accessibleSummary = `中国省级经营地图，共 ${provinces.length} 个可经营地区。当前选择${selectedProvince?.name || '北京市'}。可使用页面上的省级地区选择器进行键盘操作。`;
  return (
    <div
      className="province-map-chart"
      data-province-count={provinces.length}
      data-map-feature-count={chinaProvinceGeoJson.features.length}
      data-selected-province-id={selectedProvinceId}
    >
      <EconomyChart
        option={option}
        ariaLabel="中国省级经营地图"
        accessibleSummary={accessibleSummary}
        className="province-map-echart"
        testId="china-province-map"
        onClick={handleMapClick}
      />
    </div>
  );
}
