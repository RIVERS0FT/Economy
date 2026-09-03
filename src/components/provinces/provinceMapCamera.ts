import {
  createProvinceMapViewBoxCamera,
  PROVINCE_MAP_ZOOM_MAX,
  PROVINCE_MAP_ZOOM_MIN,
  type ProvinceMapCameraController,
  type ProvinceMapCameraFocusBounds,
} from './provinceMapViewBoxCamera';

export { PROVINCE_MAP_ZOOM_MAX, PROVINCE_MAP_ZOOM_MIN };
export type { ProvinceMapCameraController, ProvinceMapCameraFocusBounds };

export interface ProvinceMapCameraOptions {
  focusBounds?: ProvinceMapCameraFocusBounds;
}

export function createProvinceMapCamera(
  container: HTMLElement,
  surface: HTMLElement,
  options: ProvinceMapCameraOptions = {},
): ProvinceMapCameraController {
  return createProvinceMapViewBoxCamera(container, surface, options.focusBounds);
}
