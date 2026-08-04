import { createHash } from 'node:crypto';
import { measureRequestPhase, setRequestGauge } from './request-performance.js';

export const STATE_PARTITION_NAMES = Object.freeze([
  'catalog',
  'player',
  'market',
  'auction',
  'contract',
  'leaderboard',
]);

const CATALOG_KEYS = new Set(['version', 'products', 'facilityTypes', 'researchLevels']);
const MARKET_KEYS = new Set([
  'markets',
  'facilityMarkets',
  'orders',
  'facilityListings',
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

function revisionForPartition(partition) {
  return measureRequestPhase('partitionHashMs', () => createHash('sha256')
    .update(JSON.stringify(partition))
    .digest('base64url')
    .slice(0, 16));
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

export function createPartitionRevisions(partitions, { catalogSnapshot } = {}) {
  return Object.fromEntries(STATE_PARTITION_NAMES.map((name) => {
    if (
      name === 'catalog'
      && catalogSnapshot?.revision
      && catalogSnapshot?.partition
      && Number(catalogSnapshot.version) === Number(partitions.catalog?.version)
    ) {
      partitions.catalog = catalogSnapshot.partition;
      return [name, catalogSnapshot.revision];
    }
    return [name, revisionForPartition(partitions[name] || {})];
  }));
}

export function createStatePartitionSnapshot(state, { catalogSnapshot } = {}) {
  const partitions = measureRequestPhase('partitionBuildMs', () => splitClientState(state));
  const partitionRevisions = createPartitionRevisions(partitions, { catalogSnapshot });
  setRequestGauge('statePartitionCount', STATE_PARTITION_NAMES.length);
  return { partitions, partitionRevisions };
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
    ? { partitions: snapshot.partitions, partitionRevisions: snapshot.partitionRevisions }
    : snapshot?.state
      ? createStatePartitionSnapshot(snapshot.state)
      : null;
  if (!prepared) return { revision: snapshot?.revision, unchanged: true, serverNow: responseServerNow };
  const { partitions, partitionRevisions } = prepared;
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
