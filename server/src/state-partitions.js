import { createHash } from 'node:crypto';
import {
  STATE_SLICE_NAMES,
  stateSliceNameForKey,
} from '../shared/economy-state-slices.js';
import { measureRequestPhase, setRequestGauge } from './request-performance.js';

export const STATE_PARTITION_NAMES = Object.freeze([
  'catalog',
  'player',
  'market',
  'auction',
  'contract',
  'leaderboard',
]);

const CATALOG_KEYS = new Set([
  'version',
  'products',
  'facilityTypes',
  'researchLevels',
  'researchTechnologies',
  'provinces',
  'defaultProvinceId',
]);
const MARKET_KEYS = new Set([
  'markets',
  'provinceMarkets',
  'facilityMarkets',
  'provinceFacilityMarkets',
  'orders',
  'facilityListings',
  'transportShipments',
  'valuationPrices',
  'marketPrice',
  'marketPriceHistory',
  'demand',
  'economicCalendar',
]);
const AUCTION_KEYS = new Set(['assetAuctions']);
const CONTRACT_KEYS = new Set(['productionContracts', 'productionContractSummary']);
const LEADERBOARD_KEYS = new Set(['leaderboard', 'leaderboards']);
const REVISION_TOKEN = /^[A-Za-z0-9_-]{8,64}$/;

function partitionNameForKey(key) {
  if (CATALOG_KEYS.has(key)) return 'catalog';
  if (MARKET_KEYS.has(key)) return 'market';
  if (AUCTION_KEYS.has(key)) return 'auction';
  if (CONTRACT_KEYS.has(key)) return 'contract';
  if (LEADERBOARD_KEYS.has(key)) return 'leaderboard';
  return 'player';
}

function digestJson(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('base64url');
}

function revisionFromKeyDigests(entries) {
  const hash = createHash('sha256');
  for (const [key, digest] of [...entries].sort((left, right) => left[0].localeCompare(right[0]))) {
    hash.update(key);
    hash.update('\0');
    hash.update(digest);
    hash.update('\0');
  }
  return hash.digest('base64url').slice(0, 16);
}

function keyDigestsForPartitions(partitions, { skipCatalog = false } = {}) {
  return measureRequestPhase('partitionHashMs', () => {
    const digests = new Map();
    for (const partitionName of STATE_PARTITION_NAMES) {
      if (skipCatalog && partitionName === 'catalog') continue;
      for (const [key, value] of Object.entries(partitions?.[partitionName] || {})) {
        digests.set(key, digestJson(value));
      }
    }
    return digests;
  });
}

function revisionForPartition(partition, keyDigests) {
  return revisionFromKeyDigests(Object.keys(partition || {}).map((key) => [
    key,
    keyDigests.get(key) || digestJson(partition[key]),
  ]));
}

function normalizeRevisionRecord(value) {
  const normalized = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return normalized;
  for (const name of STATE_PARTITION_NAMES) {
    const revision = String(value[name] || '');
    if (REVISION_TOKEN.test(revision)) normalized[name] = revision;
  }
  return normalized;
}

function normalizeServerNow(value) {
  const serverNow = Number(value);
  return Number.isFinite(serverNow) && serverNow >= 0 ? serverNow : Date.now();
}

export function splitClientState(state) {
  const partitions = Object.fromEntries(STATE_PARTITION_NAMES.map((name) => [name, {}]));
  for (const [key, value] of Object.entries(state || {})) {
    partitions[partitionNameForKey(key)][key] = value;
  }
  return partitions;
}

function splitStateSlices(partitions) {
  const slices = Object.fromEntries(STATE_SLICE_NAMES.map((name) => [name, {}]));
  for (const partitionName of ['player', 'market']) {
    for (const [key, value] of Object.entries(partitions[partitionName] || {})) {
      const sliceName = stateSliceNameForKey(partitionName, key);
      if (sliceName) slices[sliceName][key] = value;
    }
  }
  return slices;
}

export function createSliceRevisions(partitions, { keyDigests } = {}) {
  const digests = keyDigests || keyDigestsForPartitions(partitions, { skipCatalog: true });
  const slices = splitStateSlices(partitions);
  return Object.fromEntries(STATE_SLICE_NAMES.map((name) => [
    name,
    revisionForPartition(slices[name] || {}, digests),
  ]));
}

export function createPartitionRevisions(partitions, { catalogSnapshot, keyDigests } = {}) {
  const reusableCatalog = Boolean(
    catalogSnapshot?.revision
    && catalogSnapshot?.partition
    && Number(catalogSnapshot.version) === Number(partitions.catalog?.version)
  );
  const digests = keyDigests || keyDigestsForPartitions(partitions, { skipCatalog: reusableCatalog });
  return Object.fromEntries(STATE_PARTITION_NAMES.map((name) => {
    if (name === 'catalog' && reusableCatalog) {
      partitions.catalog = catalogSnapshot.partition;
      return [name, catalogSnapshot.revision];
    }
    return [name, revisionForPartition(partitions[name] || {}, digests)];
  }));
}

export function createStatePartitionSnapshot(state, { catalogSnapshot } = {}) {
  const partitions = measureRequestPhase('partitionBuildMs', () => splitClientState(state));
  const reusableCatalog = Boolean(
    catalogSnapshot?.revision
    && catalogSnapshot?.partition
    && Number(catalogSnapshot.version) === Number(partitions.catalog?.version)
  );
  const keyDigests = keyDigestsForPartitions(partitions, { skipCatalog: reusableCatalog });
  const partitionRevisions = createPartitionRevisions(partitions, { catalogSnapshot, keyDigests });
  const sliceRevisions = createSliceRevisions(partitions, { keyDigests });
  setRequestGauge('statePartitionCount', STATE_PARTITION_NAMES.length);
  setRequestGauge('stateSliceCount', STATE_SLICE_NAMES.length);
  setRequestGauge('stateHashedFieldCount', keyDigests.size);
  return { partitions, partitionRevisions, sliceRevisions };
}

export function combineStatePartitions(partitions = {}) {
  return Object.assign({}, ...STATE_PARTITION_NAMES.map((name) => partitions[name] || {}));
}

export function readKnownPartitionRevisionsFromSearch(searchParams) {
  return normalizeRevisionRecord(Object.fromEntries(
    STATE_PARTITION_NAMES.map((name) => [name, searchParams.get(name)]),
  ));
}

export function readKnownPartitionRevisionsFromHeader(value) {
  if (typeof value !== 'string' || value.length > 1_024) return {};
  try {
    return normalizeRevisionRecord(JSON.parse(value));
  } catch {
    return {};
  }
}

export function createPartitionedStateDelivery(snapshot, knownRevisions = {}, serverNow = Date.now()) {
  const responseServerNow = normalizeServerNow(serverNow);
  if (snapshot?.unchanged) return { revision: snapshot.revision, unchanged: true, serverNow: responseServerNow };
  const prepared = snapshot?.partitions && snapshot?.partitionRevisions
    ? {
        partitions: snapshot.partitions,
        partitionRevisions: snapshot.partitionRevisions,
        sliceRevisions: snapshot.sliceRevisions ?? createSliceRevisions(snapshot.partitions),
      }
    : snapshot?.state
      ? createStatePartitionSnapshot(snapshot.state)
      : null;
  if (!prepared) return { revision: snapshot?.revision, unchanged: true, serverNow: responseServerNow };
  const { partitions, partitionRevisions, sliceRevisions } = prepared;
  const known = normalizeRevisionRecord(knownRevisions);
  const patches = {};
  for (const name of STATE_PARTITION_NAMES) {
    if (known[name] !== partitionRevisions[name]) patches[name] = partitions[name];
  }
  return {
    revision: snapshot.revision,
    unchanged: Object.keys(patches).length === 0,
    serverNow: responseServerNow,
    partitionRevisions,
    sliceRevisions,
    patches,
  };
}

export function createPartitionedActionDelivery(actionResponse) {
  return {
    result: {
      ok: actionResponse?.result?.ok === true,
      message: String(actionResponse?.result?.message || ''),
    },
    revision: Number(actionResponse?.revision),
  };
}
