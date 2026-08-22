import type { EChartsType } from '../charts/echartsCore';

export interface ProvinceMapLayoutCamera {
  centerX: number;
  centerY: number;
  sizePercent: number;
}

function pixelToLayoutPercent(value: number, extent: number) {
  if (!(extent > 0)) return '50.000000%';
  return `${(value / extent * 100).toFixed(6)}%`;
}

function layoutSizePercent(value: number) {
  return `${Math.max(Number.EPSILON, value).toFixed(6)}%`;
}

export function commitProvinceMapLayoutCamera(
  chart: EChartsType,
  seriesId: string,
  camera: ProvinceMapLayoutCamera,
) {
  chart.setOption({
    series: [{
      id: seriesId,
      zoom: 1,
      layoutCenter: [
        pixelToLayoutPercent(camera.centerX, chart.getWidth()),
        pixelToLayoutPercent(camera.centerY, chart.getHeight()),
      ],
      layoutSize: layoutSizePercent(camera.sizePercent),
    }],
  }, {
    notMerge: false,
    lazyUpdate: false,
  });
}
