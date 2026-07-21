import { createHash } from 'node:crypto';

export const STATE_PARTITION_NAMES = Object.freeze([
  'catalog',
  'player',
  'market',
  'auction',
  'leaderboard',
]);

const CATALOG_KEYS = new Set(['version', 'products', 'facilityTypes']);
const MARKET_KEYS = new Set([
  'markets',
  'facilityMarkets',
  'orders',
  'facilityListings',
  'valuationPrices',
  'marketPrice',
  'marketPriceHistory',
  'demand',
]);
const AUCTION_KEYS = new Set(['collectibles', 'assetAuctions', 'collectibleAuctions']);
const LEADERBOARD_KEYS = new Set(['leaderboard']);
const REVISION_TOKEN = /^[A-Za-z0-9_-]{8,64}$/;

function partitionNameForKey(key) {
  if (CATALOG_KEYS.has(key)) return 'catalog';
  if (MARKET_KEYS.has(key)) return 'market';
  if (AUCTION_KEYS.has(key)) return 'auction';
  if (LEADERBOARD_KEYS.has(key)) return 'leaderboard';
  return 'player';
}

function revisionForPartition(partition) {
  return createHash('sha256')
    .update(JSON.stringify(partition))
    .digest('base64url')
    .slice(0, 16);
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

export function createPartitionRevisions(partitions) {
  return Object.fromEntries(STATE_PARTITION_NAMES.map((name) => [
    name,
    revisionForPartition(partitions[name] || {}),
  ]));
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
  if (snapshot?.unchanged || !snapshot?.state) return { ...snapshot, serverNow: responseServerNow };
  const partitions = splitClientState(snapshot.state);
  const partitionRevisions = createPartitionRevisions(partitions);
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
