import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { feature } from 'topojson-client';
import regionCatalog from '../shared/provinces.json' with { type: 'json' };
import {
  buildCapitalPairRoutes,
  buildTransportNetworkGraph,
} from './transport-capital-route-core.mjs';

const require = createRequire(import.meta.url);
const usStateAtlas = require('us-atlas/states-10m.json');

export const TRANSPORT_NETWORK_SCHEMA_VERSION = 1;
export const NATURAL_EARTH_COMMIT = 'ca96624a56bd078437bca8184e78163e5039ad19';
export const ROAD_SOURCE_URL = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${NATURAL_EARTH_COMMIT}/geojson/ne_10m_roads.geojson`;
export const RAIL_SOURCE_URL = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${NATURAL_EARTH_COMMIT}/geojson/ne_10m_railroads.geojson`;
const REQUEST_TIMEOUT_MS = 120_000;
const OUTPUT_PATH = resolve('src/generated/transport-capital-routes.json');
const EXPECTED_CAPITAL_COUNT = 48;
const EXPECTED_PAIR_COUNT = EXPECTED_CAPITAL_COUNT * (EXPECTED_CAPITAL_COUNT - 1) / 2;
const CONTIGUOUS_BOUNDS = { minLongitude: -125.5, maxLongitude: -66, minLatitude: 24, maxLatitude: 49.5 };

function insideBounds([longitude, latitude]) {
  return longitude >= CONTIGUOUS_BOUNDS.minLongitude
    && longitude <= CONTIGUOUS_BOUNDS.maxLongitude
    && latitude >= CONTIGUOUS_BOUNDS.minLatitude
    && latitude <= CONTIGUOUS_BOUNDS.maxLatitude;
}

async function fetchJson(url, attempt = 0) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/geo+json, application/json;q=0.9',
        'User-Agent': 'RIVERS0FT-Economy-transport-route-generator/1.0',
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    const payload = await response.json();
    if (!Array.isArray(payload?.features)) throw new Error('GEOJSON_FEATURE_COLLECTION_REQUIRED');
    return payload;
  } catch (error) {
    if (attempt >= 2) throw new Error(`TRANSPORT_NETWORK_FETCH_FAILED:${url}:${error instanceof Error ? error.message : String(error)}`);
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 1_000 * (attempt + 1)));
    return fetchJson(url, attempt + 1);
  } finally {
    clearTimeout(timeout);
  }
}

function featurePaths(featureValue) {
  const geometry = featureValue?.geometry;
  if (!geometry) return [];
  if (geometry.type === 'LineString') return [geometry.coordinates];
  if (geometry.type === 'MultiLineString') return geometry.coordinates;
  return [];
}

function validCoordinate(value) {
  return Array.isArray(value)
    && value.length >= 2
    && Number.isFinite(Number(value[0]))
    && Number.isFinite(Number(value[1]));
}

function pointInRing(point, ring) {
  let inside = false;
  for (let left = ring.length - 1, right = 0; right < ring.length; left = right, right += 1) {
    const [leftX, leftY] = ring[left];
    const [rightX, rightY] = ring[right];
    const crosses = (rightY > point[1]) !== (leftY > point[1])
      && point[0] < ((leftX - rightX) * (point[1] - rightY)) / ((leftY - rightY) || Number.EPSILON) + rightX;
    if (crosses) inside = !inside;
  }
  return inside;
}

function pointInPolygon(point, polygon) {
  if (!Array.isArray(polygon) || polygon.length < 1 || !pointInRing(point, polygon[0])) return false;
  for (let holeIndex = 1; holeIndex < polygon.length; holeIndex += 1) {
    if (pointInRing(point, polygon[holeIndex])) return false;
  }
  return true;
}

function pointInGeometry(point, geometry) {
  if (!geometry) return false;
  if (geometry.type === 'Polygon') return pointInPolygon(point, geometry.coordinates);
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.some((polygon) => pointInPolygon(point, polygon));
  return false;
}

const atlasTopology = usStateAtlas;
const atlasStateObject = usStateAtlas.objects.states;
const atlasStateCollection = feature(atlasTopology, atlasStateObject);
if (atlasStateCollection.type !== 'FeatureCollection') throw new Error('US_STATE_ATLAS_FEATURE_COLLECTION_REQUIRED');
const contiguousMapNames = new Set(regionCatalog.map((province) => province.mapName));
const contiguousStateGeometries = atlasStateCollection.features
  .filter((stateFeature) => contiguousMapNames.has(String(stateFeature.properties?.name || '')))
  .map((stateFeature) => stateFeature.geometry);
if (contiguousStateGeometries.length !== EXPECTED_CAPITAL_COUNT) throw new Error('TRANSPORT_NETWORK_CONTIGUOUS_STATE_GEOMETRY_MISSING');

function insideContiguousUnitedStates(point) {
  return insideBounds(point) && contiguousStateGeometries.some((geometry) => pointInGeometry(point, geometry));
}

function segmentMidpoint(left, right) {
  return [(Number(left[0]) + Number(right[0])) / 2, (Number(left[1]) + Number(right[1])) / 2];
}

function segmentizeNaturalEarthFeatures(features, mode) {
  const output = [];
  for (const sourceFeature of features) {
    if (mode === 'road' && String(sourceFeature?.properties?.sov_a3 || '') !== 'USA') continue;
    for (const path of featurePaths(sourceFeature)) {
      const coordinates = path.filter(validCoordinate).map((coordinate) => [Number(coordinate[0]), Number(coordinate[1])]);
      for (let index = 0; index < coordinates.length - 1; index += 1) {
        const left = coordinates[index];
        const right = coordinates[index + 1];
        const midpoint = segmentMidpoint(left, right);
        if (!insideContiguousUnitedStates(midpoint)) continue;
        output.push({
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: [left, right] },
        });
      }
    }
  }
  return output;
}

function assertCompleteRouteSet(mode, routes) {
  const keys = Object.keys(routes);
  if (keys.length !== EXPECTED_PAIR_COUNT) throw new Error(`TRANSPORT_NETWORK_PAIR_COUNT_INVALID:${mode}:${keys.length}:${EXPECTED_PAIR_COUNT}`);
  for (const [key, coordinates] of Object.entries(routes)) {
    if (!Array.isArray(coordinates) || coordinates.length < 2) throw new Error(`TRANSPORT_NETWORK_ROUTE_INVALID:${mode}:${key}`);
    if (coordinates.length > 96) throw new Error(`TRANSPORT_NETWORK_ROUTE_TOO_DETAILED:${mode}:${key}:${coordinates.length}`);
  }
}

export async function generateTransportCapitalRoutes() {
  if (!Array.isArray(regionCatalog) || regionCatalog.length !== EXPECTED_CAPITAL_COUNT) throw new Error('TRANSPORT_NETWORK_REQUIRES_48_CAPITALS');
  const [roadPayload, railPayload] = await Promise.all([
    fetchJson(ROAD_SOURCE_URL),
    fetchJson(RAIL_SOURCE_URL),
  ]);
  const roadFeatures = segmentizeNaturalEarthFeatures(roadPayload.features, 'road');
  const railFeatures = segmentizeNaturalEarthFeatures(railPayload.features, 'rail');
  const roadGraph = buildTransportNetworkGraph(roadFeatures, 'road');
  const railGraph = buildTransportNetworkGraph(railFeatures, 'rail');
  if (roadGraph.edgeCount < 100 || railGraph.edgeCount < 100) {
    throw new Error(`TRANSPORT_NETWORK_GRAPH_TOO_SMALL:road=${roadGraph.edgeCount}:rail=${railGraph.edgeCount}`);
  }
  const road = buildCapitalPairRoutes(roadGraph, regionCatalog);
  const rail = buildCapitalPairRoutes(railGraph, regionCatalog);
  assertCompleteRouteSet('road', road.routes);
  assertCompleteRouteSet('rail', rail.routes);
  const output = {
    version: TRANSPORT_NETWORK_SCHEMA_VERSION,
    kind: 'natural-earth-capital-pairs',
    capitalCount: regionCatalog.length,
    pairCountPerMode: EXPECTED_PAIR_COUNT,
    sourceCommit: NATURAL_EARTH_COMMIT,
    sources: {
      road: {
        id: 'natural-earth-10m-roads',
        url: ROAD_SOURCE_URL,
        publicDomain: true,
        rawFeatureCount: roadPayload.features.length,
        retainedSegmentCount: roadFeatures.length,
        componentNodeCount: road.componentNodeCount,
        maxCapitalSnapDistanceKm: Number(road.maxSnapDistanceKm.toFixed(2)),
      },
      rail: {
        id: 'natural-earth-10m-railroads',
        url: RAIL_SOURCE_URL,
        publicDomain: true,
        rawFeatureCount: railPayload.features.length,
        retainedSegmentCount: railFeatures.length,
        componentNodeCount: rail.componentNodeCount,
        maxCapitalSnapDistanceKm: Number(rail.maxSnapDistanceKm.toFixed(2)),
      },
    },
    routes: { road: road.routes, rail: rail.routes },
  };
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  return output;
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirectRun) {
  const output = await generateTransportCapitalRoutes();
  console.log(`transport capital route snapshot generated: ${output.kind}, road=${Object.keys(output.routes.road).length}, rail=${Object.keys(output.routes.rail).length}`);
}
