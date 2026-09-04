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
  'commercialBuildingTypes',
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

function validPartitionSnapshot(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function catalogIntegrityIssue(catalog) {
  if (!validPartitionSnapshot(catalog)) return 'catalog 分区缺失';
  if (!Number.isInteger(catalog.version)) return 'catalog.version 无效';
  for (const key of ['products', 'facilityTypes', 'commercialBuildingTypes', 'researchLevels', 'provinces']) {
    if (!Array.isArray(catalog[key])) return `catalog.${key} 不是有效数组`;
  }
  if (catalog.products.length === 0) return 'catalog.products 为空';
  if (catalog.facilityTypes.length === 0) return 'catalog.facilityTypes 为空';
  if (catalog.commercialBuildingTypes.length === 0) return 'catalog.commercialBuildingTypes 为空';
  if (catalog.researchLevels.length === 0) return 'catalog.researchLevels 为空';
  if (catalog.provinces.length === 0) return 'catalog.provinces 为空';
  if (typeof catalog.defaultProvinceId !== 'string' || !catalog.defaultProvinceId) {
    return 'catalog.defaultProvinceId 缺失';
  }
  const hasDefaultProvince = catalog.provinces.some((province) => (
    validPartitionSnapshot(province) && province.id === catalog.defaultProvinceId
  ));
  if (!hasDefaultProvince) return 'catalog.defaultProvinceId 不存在于 catalog.provinces';
  return '';
}

export function isValidCatalogPartitionSnapshot(catalog) {
  return catalogIntegrityIssue(catalog) === '';
}

function assertValidCatalogPartitionSnapshot(catalog) {
  const issue = catalogIntegrityIssue(catalog);
  if (issue) throw new Error(`客户端目录分区不完整：${issue}`);
}

function serializeAndDigestJson(value) {
  const json = JSON.stringify(value);
  return {
    digest: createHash('sha256').update(json).digest('base64url'),
    bytes: Buffer.byteLength(json),
  };
}

function digestJson(value) {
  return serializeAndDigestJson(value).digest;
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
    const fieldBytes = new Map();
    for (const partitionName of STATE_PARTITION_NAMES) {
      if (skipCatalog && partitionName === 'catalog') continue;
      for (const [key, value] of Object.entries(partitions?.[partitionName] || {})) {
        const serialized = serializeAndDigestJson(value);
        digests.set(key, serialized.digest);
        fieldBytes.set(key, serialized.bytes);
      }
    }
    for (const [partitionName, partition] of Object.entries(partitions || {})) {
      if (skipCatalog && partitionName === 'catalog') continue;
      const entries = Object.keys(partition || {});
      const bytes = 2 + entries.reduce((sum, key, index) => (
        sum
        + Buffer.byteLength(JSON.stringify(key))
        + 1
        + Number(fieldBytes.get(key) || 0)
        + (index > 0 ? 1 : 0)
      ), 0);
      setRequestGauge(`state${partitionName[0].toUpperCase()}${partitionName.slice(1)}PartitionJsonBytes`, bytes);
    }
    const trackedFields = {
      orders: 'stateOrdersJsonBytes',
      provinceMarkets: 'stateProvinceMarketsJsonBytes',
      provinceFacilityMarkets: 'stateProvinceFacilityMarketsJsonBytes',
    };
    for (const [key, gauge] of Object.entries(trackedFields)) {
      if (fieldBytes.has(key)) setRequestGauge(gauge, fieldBytes.get(key));
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
    && isValidCatalogPartitionSnapshot(catalogSnapshot?.partition)
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
  assertValidCatalogPartitionSnapshot(partitions.catalog);
  const reusableCatalog = Boolean(
    catalogSnapshot?.revision
    && isValidCatalogPartitionSnapshot(catalogSnapshot?.partition)
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
  let prepared = snapshot?.partitions && snapshot?.partitionRevisions
    ? {
        partitions: snapshot.partitions,
        partitionRevisions: snapshot.partitionRevisions,
        sliceRevisions: snapshot.sliceRevisions ?? createSliceRevisions(snapshot.partitions),
      }
    : snapshot?.state
      ? createStatePartitionSnapshot(snapshot.state)
      : null;
  if (prepared && !isValidCatalogPartitionSnapshot(prepared.partitions?.catalog) && snapshot?.state) {
    prepared = createStatePartitionSnapshot(snapshot.state);
  }
  if (!prepared) return { revision: snapshot?.revision, unchanged: true, serverNow: responseServerNow };
  assertValidCatalogPartitionSnapshot(prepared.partitions?.catalog);
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

export function createPartitionedActionDelivery(
  actionResponse,
  knownRevisions = {},
  serverNow = Date.now(),
) {
  const commandRevision = Number(actionResponse?.revision);
  if (!Number.isInteger(commandRevision) || commandRevision < 0) {
    throw new Error('游戏操作未返回有效的提交修订号');
  }
  const snapshot = actionResponse?.stateSnapshot;
  if (!snapshot || typeof snapshot !== 'object') {
    throw new Error('游戏操作未返回提交后的权威状态');
  }
  const delivery = createPartitionedStateDelivery(snapshot, knownRevisions, serverNow);
  if (!Number.isInteger(delivery.revision) || delivery.revision < commandRevision) {
    throw new Error('动作后的权威状态落后于已提交操作');
  }
  return {
    result: {
      ok: actionResponse?.result?.ok === true,
      message: String(actionResponse?.result?.message || ''),
    },
    commandRevision,
    ...delivery,
  };
}
