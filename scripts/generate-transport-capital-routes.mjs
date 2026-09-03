import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildCapitalPairRoutes,
  buildTransportNetworkGraph,
  capitalPairKey,
} from './transport-capital-route-core.mjs';

export const TRANSPORT_NETWORK_SCHEMA_VERSION = 1;
export const CONTIGUOUS_US_BOUNDS = '-125.5,24,-66,49.5';
export const ROAD_LAYER_URL = 'https://services.arcgis.com/xOi1kZaI0eWDREZv/ArcGIS/rest/services/NTAD_National_Highway_Planning_Network/FeatureServer/0';
export const RAIL_LAYER_URL = 'https://services.arcgis.com/xOi1kZaI0eWDREZv/ArcGIS/rest/services/NTAD_North_American_Rail_Network_Lines/FeatureServer/0';
const PAGE_SIZE = 2000;
const PAGE_CONCURRENCY = 6;
const REQUEST_TIMEOUT_MS = 30_000;
const OUTPUT_PATH = resolve('src/generated/transport-capital-routes.json');
const PROVINCES_PATH = resolve('shared/provinces.json');

function sourceQuery(source, extras = {}) {
  const params = new URLSearchParams({
    where: source.where,
    geometry: CONTIGUOUS_US_BOUNDS,
    geometryType: 'esriGeometryEnvelope',
    spatialRel: 'esriSpatialRelIntersects',
    inSR: '4326',
    outSR: '4326',
    ...extras,
  });
  return `${source.url}/query?${params}`;
}

async function fetchJson(url, attempt = 0) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/geo+json, application/json;q=0.9' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    return await response.json();
  } catch (error) {
    if (attempt >= 2) throw new Error(`TRANSPORT_NETWORK_FETCH_FAILED:${url}:${error instanceof Error ? error.message : String(error)}`);
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500 * (2 ** attempt)));
    return fetchJson(url, attempt + 1);
  } finally {
    clearTimeout(timeout);
  }
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

async function fetchArcgisFeatures(source) {
  const countPayload = await fetchJson(sourceQuery(source, {
    returnCountOnly: 'true',
    returnGeometry: 'false',
    f: 'json',
  }));
  const count = Number(countPayload?.count);
  if (!Number.isInteger(count) || count < 1) throw new Error(`TRANSPORT_NETWORK_EMPTY:${source.id}`);
  const offsets = Array.from({ length: Math.ceil(count / PAGE_SIZE) }, (_, index) => index * PAGE_SIZE);
  const pages = await mapWithConcurrency(offsets, PAGE_CONCURRENCY, async (offset) => {
    const payload = await fetchJson(sourceQuery(source, {
      outFields: source.outFields,
      returnGeometry: 'true',
      orderByFields: 'OBJECTID ASC',
      resultOffset: String(offset),
      resultRecordCount: String(PAGE_SIZE),
      f: 'geojson',
    }));
    if (!Array.isArray(payload?.features)) throw new Error(`TRANSPORT_NETWORK_PAGE_INVALID:${source.id}:${offset}`);
    return payload.features;
  });
  const features = pages.flat();
  if (features.length < count) throw new Error(`TRANSPORT_NETWORK_PAGE_INCOMPLETE:${source.id}:${features.length}:${count}`);
  return features;
}

function placeholderRoutes(provinces) {
  const provinceById = new Map(provinces.map((province) => [province.id, province]));
  const ca = provinceById.get('110000');
  const tx = provinceById.get('US-TX');
  if (!ca || !tx) throw new Error('TRANSPORT_NETWORK_PLACEHOLDER_CAPITALS_MISSING');
  const start = [ca.capitalLongitude, ca.capitalLatitude];
  const end = [tx.capitalLongitude, tx.capitalLatitude];
  const key = capitalPairKey(ca.id, tx.id);
  return {
    road: {
      [key]: [start, [-119.7, 37.9], [-116.3, 36.2], [-112.1, 34.8], [-107.4, 33.1], [-102.6, 31.4], end],
    },
    rail: {
      [key]: [start, [-120.2, 39.1], [-116.8, 37.5], [-112.5, 35.4], [-108.1, 34.3], [-103.4, 32.3], end],
    },
  };
}

export async function generateTransportCapitalRoutes({ placeholder = false } = {}) {
  const provinces = JSON.parse(readFileSync(PROVINCES_PATH, 'utf8'));
  if (!Array.isArray(provinces) || provinces.length !== 48) throw new Error('TRANSPORT_NETWORK_REQUIRES_48_CAPITALS');
  let output;
  if (placeholder) {
    output = {
      version: TRANSPORT_NETWORK_SCHEMA_VERSION,
      kind: 'placeholder',
      capitalCount: provinces.length,
      sources: {},
      routes: placeholderRoutes(provinces),
    };
  } else {
    const roadSource = {
      id: 'ntad-nhpn',
      url: ROAD_LAYER_URL,
      where: '1=1',
      outFields: 'OBJECTID,KM',
    };
    const railSource = {
      id: 'ntad-narn',
      url: RAIL_LAYER_URL,
      where: "COUNTRY='US'",
      outFields: 'OBJECTID,FRFRANODE,TOFRANODE,COUNTRY,KM',
    };
    const [roadFeatures, railFeatures] = await Promise.all([
      fetchArcgisFeatures(roadSource),
      fetchArcgisFeatures(railSource),
    ]);
    const roadGraph = buildTransportNetworkGraph(roadFeatures, 'road');
    const railGraph = buildTransportNetworkGraph(railFeatures, 'rail');
    const road = buildCapitalPairRoutes(roadGraph, provinces);
    const rail = buildCapitalPairRoutes(railGraph, provinces);
    output = {
      version: TRANSPORT_NETWORK_SCHEMA_VERSION,
      kind: 'ntad-capital-pairs',
      generatedAt: new Date().toISOString(),
      capitalCount: provinces.length,
      sources: {
        road: { id: roadSource.id, url: ROAD_LAYER_URL, featureCount: roadFeatures.length, componentNodeCount: road.componentNodeCount, maxCapitalSnapDistanceKm: Number(road.maxSnapDistanceKm.toFixed(2)), publicDomain: true },
        rail: { id: railSource.id, url: RAIL_LAYER_URL, featureCount: railFeatures.length, componentNodeCount: rail.componentNodeCount, maxCapitalSnapDistanceKm: Number(rail.maxSnapDistanceKm.toFixed(2)), publicDomain: true },
      },
      routes: { road: road.routes, rail: rail.routes },
    };
  }
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  return output;
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirectRun) {
  const development = process.argv.includes('--development');
  const placeholder = process.argv.includes('--placeholder') || (development && Boolean(process.env.CI));
  const output = await generateTransportCapitalRoutes({ placeholder });
  const roadCount = Object.keys(output.routes.road).length;
  const railCount = Object.keys(output.routes.rail).length;
  console.log(`transport capital routes generated: ${output.kind}, road=${roadCount}, rail=${railCount}`);
}
