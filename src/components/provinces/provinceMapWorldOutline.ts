import { merge } from 'topojson-client';
import worldCountryAtlas from 'world-atlas/countries-10m.json';
import { provinceGeometryPath, type ProvinceMapProjection } from './provinceMapProjection';

export interface ProvinceMapMainlandFocusBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// world-atlas@2.0.2 countries-10m.json is derived from Natural Earth 1:10m public-domain data.
// Only land that can enter the deliberately limited North-American camera context is dissolved into
// the decorative background path. Country boundaries never reach the SVG, and the contiguous-US
// interaction layer remains the separate us-atlas states-10m operating geography.
const NORTH_AMERICA_CONTEXT_COUNTRY_IDS = new Set([
  '044', // Bahamas
  '084', // Belize
  '124', // Canada
  '188', // Costa Rica
  '192', // Cuba
  '214', // Dominican Republic
  '222', // El Salvador
  '304', // Greenland
  '320', // Guatemala
  '332', // Haiti
  '340', // Honduras
  '388', // Jamaica
  '484', // Mexico
  '558', // Nicaragua
  '591', // Panama
  '666', // Saint Pierre and Miquelon
  '840', // United States, including non-operating Alaska/Hawaii as world context only
]);

const worldTopology = worldCountryAtlas as unknown as Parameters<typeof merge>[0];
const worldCountryObject = (worldCountryAtlas as unknown as {
  objects: {
    countries: {
      geometries: Array<{ id?: string | number }>;
    };
  };
}).objects.countries;
const northAmericaContextGeometries = worldCountryObject.geometries.filter((geometry) => {
  const rawId = String(geometry.id ?? '');
  const normalizedId = rawId.padStart(3, '0');
  return NORTH_AMERICA_CONTEXT_COUNTRY_IDS.has(normalizedId);
});
if (northAmericaContextGeometries.length < 10) throw new Error('PROVINCE_MAP_WORLD_10M_CONTEXT_REQUIRED');
const northAmericaContextGeometry = merge(
  worldTopology,
  northAmericaContextGeometries as Parameters<typeof merge>[1],
);

export function createProvinceMapWorldOutlinePath(projection: ProvinceMapProjection) {
  return provinceGeometryPath(northAmericaContextGeometry, projection);
}

export function createProvinceMapMainlandFocusBounds(projection: ProvinceMapProjection): ProvinceMapMainlandFocusBounds {
  return {
    minX: 0,
    minY: 0,
    maxX: projection.width,
    maxY: projection.height,
  };
}
