import { FACILITY_TYPE_CATALOG, PRODUCT_CATALOG } from './industry-catalog.js';
import { COMMERCIAL_BUILDING_TYPE_CATALOG } from './commercial-catalog.js';
import { factoryAutoOperationPolicyFor } from './factory-auto-operation.js';
import { commercialAutoOperationPolicyFor } from '../../shared/commercial-auto-operation.js';
import { splitProvinceScopedKey } from './provinces.js';
import { measureRequestPhase, setRequestGauge } from './request-performance.js';
import { normalizeProvinceId, provinceScopedKey } from './provinces.js';
import { installProvinceRuntimeAliases } from './provinces.js';
import { getPlayerActionMetadata, requireOrderExecutionMetadata } from './player-action-registry.js';

export const WORLD_STORAGE_SCHEMA_VERSION = 2;
export const AUTHORITATIVE_WORLD_VERSION = 33;

const CORE_LOCAL_SEGMENTS = Object.freeze([
  'bank',
  'weeklyCashSettlement',
  'populationEconomy',
  'marketDemand',
  'stats',
  'moneyPrecision',
  'auctionFeeEscrowCredits',
  'systemMarketAudit',
  'transportShipments',
  'version',
]);

function playerKey(value) {
  return String(Math.trunc(Number(value)));
}

function worldSegmentKeys(world) {
  return Object.keys(world || {}).filter((key) => key !== 'players').sort();
}

function snapshotBytes(snapshot) {
  let bytes = 0;
  for (const value of snapshot?.playerStateJsonById?.values?.() || []) bytes += Buffer.byteLength(value);
  for (const value of snapshot?.segmentStateJsonByKey?.values?.() || []) bytes += Buffer.byteLength(value);
  return bytes;
}

function publishSnapshotGauges(snapshot) {
  setRequestGauge('worldStorageSchemaVersion', WORLD_STORAGE_SCHEMA_VERSION);
  setRequestGauge('worldPlayerRowCount', snapshot?.playerStateJsonById?.size || 0);
  setRequestGauge('worldSegmentCount', snapshot?.segmentStateJsonByKey?.size || 0);
  setRequestGauge('worldStorageBytes', snapshotBytes(snapshot));
}

export function installSegmentedWorldStorage(store) {
  store.database.exec(`
    CREATE TABLE IF NOT EXISTS economy_world_meta (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      revision INTEGER NOT NULL,
      world_version INTEGER NOT NULL,
      storage_schema_version INTEGER NOT NULL CHECK (storage_schema_version >= 2),
      updated_at INTEGER NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS economy_world_players (
      user_id INTEGER PRIMARY KEY,
      updated_revision INTEGER NOT NULL,
      state_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS economy_world_segments (
      segment_key TEXT PRIMARY KEY,
      updated_revision INTEGER NOT NULL,
      state_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_economy_world_players_revision
      ON economy_world_players(updated_revision);
    CREATE INDEX IF NOT EXISTS idx_economy_world_segments_revision
      ON economy_world_segments(updated_revision);
  `);

  store.selectWorldMetaV2 = store.database.prepare(`
    SELECT revision, world_version, storage_schema_version, updated_at
    FROM economy_world_meta WHERE id = 1
  `);
  store.upsertWorldMetaV2 = store.database.prepare(`
    INSERT INTO economy_world_meta (
      id, revision, world_version, storage_schema_version, updated_at
    ) VALUES (1, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      revision = excluded.revision,
      world_version = excluded.world_version,
      storage_schema_version = excluded.storage_schema_version,
      updated_at = excluded.updated_at
  `);
  store.selectWorldPlayersV2 = store.database.prepare(`
    SELECT user_id, updated_revision, state_json
    FROM economy_world_players ORDER BY user_id
  `);
  store.upsertWorldPlayerV2 = store.database.prepare(`
    INSERT INTO economy_world_players (user_id, updated_revision, state_json, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      updated_revision = excluded.updated_revision,
      state_json = excluded.state_json,
      updated_at = excluded.updated_at
  `);
  store.deleteWorldPlayerV2 = store.database.prepare(
    'DELETE FROM economy_world_players WHERE user_id = ?',
  );
  store.deleteAllWorldPlayersV2 = store.database.prepare('DELETE FROM economy_world_players');
  store.selectWorldSegmentsV2 = store.database.prepare(`
    SELECT segment_key, updated_revision, state_json
    FROM economy_world_segments ORDER BY segment_key
  `);
  store.upsertWorldSegmentV2 = store.database.prepare(`
    INSERT INTO economy_world_segments (segment_key, updated_revision, state_json, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(segment_key) DO UPDATE SET
      updated_revision = excluded.updated_revision,
      state_json = excluded.state_json,
      updated_at = excluded.updated_at
  `);
  store.deleteWorldSegmentV2 = store.database.prepare(
    'DELETE FROM economy_world_segments WHERE segment_key = ?',
  );
  store.deleteAllWorldSegmentsV2 = store.database.prepare('DELETE FROM economy_world_segments');
  store.updateLegacyWorldManifestV2 = store.database.prepare(`
    UPDATE economy_world
    SET revision = ?, state_json = ?, updated_at = ?
    WHERE id = 1
  `);
}

export function createFullMutationScope() {
  return {
    allPlayers: true,
    allSegments: true,
    playerIds: null,
    segments: null,
    orderIndexes: null,
    marketKeys: null,
    facilityMarketKeys: null,
    includeAuctionEscrow: true,
    label: 'full-world',
  };
}

function auctionParticipantIds(world, payload, userId) {
  const ids = new Set([playerKey(userId)]);
  const auctionId = String(payload?.auctionId || payload?.id || '');
  const auction = (world?.assetAuctions || []).find((entry) => String(entry?.id || '') === auctionId);
  if (!auction) return ids;
  for (const value of [
    auction.sellerId,
    auction.ownerId,
    auction.highestBidderId,
    auction.highestBid?.bidderId,
  ]) {
    const numeric = Number(value);
    if (Number.isSafeInteger(numeric) && numeric > 0) ids.add(playerKey(numeric));
  }
  return ids;
}

function isOpenOrder(order) {
  return Number(order?.remaining || 0) > 0 && ['open', 'partial'].includes(String(order?.status || ''));
}

function orderKind(order) {
  return order?.assetKind === 'facility' ? 'facility' : 'commodity';
}

function orderAssetId(order) {
  return String(
    order?.assetId
    || (orderKind(order) === 'facility' ? order?.facilityTypeId : order?.productId)
    || '',
  );
}

function commodityProductId(value) {
  return String(value?.productId || value?.assetId || 'wheat');
}

function orderIndexesForAssets(world, assets, { ownerId = null } = {}) {
  const wanted = new Set(assets.map(({ provinceId, kind, assetId }) => (
    `${normalizeProvinceId(provinceId)}:${kind}:${assetId}`
  )));
  const indexes = new Set();
  for (const [index, order] of (world?.orders || []).entries()) {
    if (!isOpenOrder(order)) continue;
    if (ownerId !== null && Number(order?.ownerId) !== Number(ownerId)) continue;
    if (wanted.has(`${normalizeProvinceId(order.provinceId)}:${orderKind(order)}:${orderAssetId(order)}`)) indexes.add(index);
  }
  return indexes;
}

function playerIdsForOrderIndexes(world, userId, orderIndexes) {
  const ids = new Set([playerKey(userId)]);
  for (const index of orderIndexes || []) {
    const order = world?.orders?.[index];
    if (order?.ownerType !== 'player') continue;
    const ownerId = Number(order.ownerId);
    if (Number.isSafeInteger(ownerId) && ownerId > 0) ids.add(playerKey(ownerId));
  }
  return ids;
}

function crossingOrderParticipantIds(world, payload, userId) {
  const ids = new Set([playerKey(userId)]);
  const kind = payload?.assetKind === 'facility' ? 'facility' : 'commodity';
  const assetId = kind === 'facility'
    ? String(payload?.assetId || payload?.facilityTypeId || '')
    : commodityProductId(payload);
  const side = payload?.side === 'buy' ? 'buy' : payload?.side === 'sell' ? 'sell' : null;
  const price = Number(payload?.price ?? payload?.unitPrice ?? payload?.maxPrice);
  const provinceId = normalizeProvinceId(payload?.provinceId);
  if (!assetId || !side || !Number.isFinite(price)) return ids;
  const opposite = side === 'buy' ? 'sell' : 'buy';
  for (const order of world?.orders || []) {
    if (
      !isOpenOrder(order)
      || orderKind(order) !== kind
      || orderAssetId(order) !== assetId
      || normalizeProvinceId(order.provinceId) !== provinceId
    ) continue;
    if (order.side !== opposite || order.ownerType !== 'player') continue;
    const restingPrice = Number(order.price);
    if (!Number.isFinite(restingPrice)) continue;
    const crosses = side === 'buy' ? restingPrice <= price : restingPrice >= price;
    if (!crosses) continue;
    const ownerId = Number(order.ownerId);
    if (Number.isSafeInteger(ownerId) && ownerId > 0) ids.add(playerKey(ownerId));
  }
  return ids;
}

function orderScope(world, userId, assets, {
  label,
  mutateMarkets = false,
  currentPlayerOrdersOnly = false,
} = {}) {
  const normalizedAssets = assets
    .map(({ provinceId, kind, assetId }) => ({
      provinceId: normalizeProvinceId(provinceId),
      kind,
      assetId: String(assetId || ''),
    }))
    .filter(({ kind, assetId }) => (kind === 'commodity' || kind === 'facility') && assetId);
  if (normalizedAssets.length === 0) return null;
  const orderIndexes = orderIndexesForAssets(world, normalizedAssets, {
    ownerId: currentPlayerOrdersOnly ? userId : null,
  });
  const playerIds = currentPlayerOrdersOnly
    ? new Set([playerKey(userId)])
    : playerIdsForOrderIndexes(world, userId, orderIndexes);
  const marketKeys = new Set(normalizedAssets
    .filter(({ kind }) => kind === 'commodity')
    .map(({ provinceId, assetId }) => provinceScopedKey(provinceId, assetId)));
  const facilityMarketKeys = new Set(normalizedAssets
    .filter(({ kind }) => kind === 'facility')
    .map(({ provinceId, assetId }) => provinceScopedKey(provinceId, assetId)));
  const segments = new Set([...CORE_LOCAL_SEGMENTS, 'orders']);
  if (mutateMarkets && marketKeys.size > 0) segments.add('markets');
  if (mutateMarkets && facilityMarketKeys.size > 0) segments.add('facilityMarkets');
  return {
    allPlayers: false,
    allSegments: false,
    playerIds,
    segments,
    orderIndexes,
    marketKeys: mutateMarkets ? marketKeys : new Set(),
    facilityMarketKeys: mutateMarkets ? facilityMarketKeys : new Set(),
    includeAuctionEscrow: false,
    label: String(label || 'orders:local'),
  };
}

function ordinaryOrderAsset(payload) {
  if (payload?.assetKind === 'facility') {
    return {
      provinceId: payload?.provinceId,
      kind: 'facility',
      assetId: String(payload?.assetId || payload?.facilityTypeId || ''),
    };
  }
  return { provinceId: payload?.provinceId, kind: 'commodity', assetId: commodityProductId(payload) };
}

function procurementAssets(payload) {
  const source = payload?.materialOrderPrices || payload?.materialPriceCaps;
  if (!source || typeof source !== 'object' || Array.isArray(source)) return [];
  return Object.keys(source).map((productId) => ({
    provinceId: payload?.provinceId,
    kind: 'commodity',
    assetId: productId,
  }));
}

function procurementCancelAssets(world, payload) {
  const orderIds = new Set((payload?.orderIds || []).map((value) => String(value || '')).filter(Boolean));
  const assets = new Map();
  for (const order of world?.orders || []) {
    if (!orderIds.has(String(order?.id || ''))) continue;
    assets.set(`${normalizeProvinceId(order.provinceId)}:${orderKind(order)}:${orderAssetId(order)}`, {
      provinceId: order.provinceId,
      kind: orderKind(order),
      assetId: orderAssetId(order),
    });
  }
  return [...assets.values()];
}

function cancelScope(world, userId, payload) {
  const orderId = String(payload?.orderId || '');
  const index = (world?.orders || []).findIndex((candidate) => String(candidate?.id || '') === orderId);
  const order = index >= 0 ? world.orders[index] : null;
  if (!order || Number(order?.ownerId) !== Number(userId) || !isOpenOrder(order)) return null;
  return {
    allPlayers: false,
    allSegments: false,
    playerIds: new Set([playerKey(userId)]),
    segments: new Set([...CORE_LOCAL_SEGMENTS, 'orders']),
    orderIndexes: new Set([index]),
    marketKeys: new Set(),
    facilityMarketKeys: new Set(),
    includeAuctionEscrow: false,
    label: `${orderKind(order)}:cancelOrder`,
  };
}

function addPlayerId(ids, value) {
  const numeric = Number(value);
  if (Number.isSafeInteger(numeric) && numeric > 0) ids.add(playerKey(numeric));
}

function ownedOrderIndexesInProvince(world, userId, provinceId, { openOnly = true } = {}) {
  const selectedProvinceId = normalizeProvinceId(provinceId);
  const indexes = new Set();
  for (const [index, order] of (world?.orders || []).entries()) {
    if (order?.ownerType !== 'player' || Number(order.ownerId) !== Number(userId)) continue;
    if (normalizeProvinceId(order.provinceId) !== selectedProvinceId) continue;
    if (openOnly && !isOpenOrder(order)) continue;
    indexes.add(index);
  }
  return indexes;
}

function factoryMutationProvinceIds(payload) {
  const targets = Array.isArray(payload?.targets) ? payload.targets : [];
  if (targets.length > 0) {
    return [...new Set(targets.map((target) => normalizeProvinceId(target?.provinceId)))];
  }
  return [normalizeProvinceId(payload?.provinceId)];
}

function factoryAutoOperationScope(world, userId, payload) {
  const orderIndexes = new Set();
  for (const provinceId of factoryMutationProvinceIds(payload)) {
    for (const index of ownedOrderIndexesInProvince(world, userId, provinceId)) orderIndexes.add(index);
  }
  const procurement = payload?.autoProcure === true ? procurementAssets(payload) : [];
  for (const index of orderIndexesForAssets(world, procurement)) orderIndexes.add(index);
  const marketKeys = new Set(procurement.map(({ provinceId: assetProvinceId, assetId }) => (
    provinceScopedKey(assetProvinceId, assetId)
  )));
  const segments = new Set([...CORE_LOCAL_SEGMENTS, 'orders']);
  if (marketKeys.size > 0) segments.add('markets');
  return {
    allPlayers: false,
    allSegments: false,
    playerIds: playerIdsForOrderIndexes(world, userId, orderIndexes),
    segments,
    orderIndexes,
    marketKeys,
    facilityMarketKeys: new Set(),
    includeAuctionEscrow: false,
    label: 'facility:auto-operation-rebuild',
  };
}

function profileMutationScope(userId) {
  return {
    allPlayers: false,
    allSegments: false,
    playerIds: new Set([playerKey(userId)]),
    segments: new Set(CORE_LOCAL_SEGMENTS),
    orderIndexes: new Set(),
    marketKeys: new Set(),
    facilityMarketKeys: new Set(),
    includeAuctionEscrow: false,
    label: 'profile:update',
  };
}

function contractParticipantIds(world, userId) {
  const ids = new Set([playerKey(userId)]);
  for (const contract of world?.productionContracts || []) {
    for (const field of [
      'publisherId',
      'buyerId',
      'supplierId',
      'lenderId',
      'borrowerId',
      'lessorId',
      'lesseeId',
    ]) addPlayerId(ids, contract?.[field]);
  }
  return ids;
}

function contractMutationScope(world, userId, payload, action) {
  return {
    allPlayers: false,
    allSegments: false,
    playerIds: contractParticipantIds(world, userId),
    segments: new Set([...CORE_LOCAL_SEGMENTS, 'productionContracts']),
    orderIndexes: new Set(),
    marketKeys: new Set(),
    facilityMarketKeys: new Set(),
    includeAuctionEscrow: false,
    label: `contract:${action}`,
  };
}

function facilityListingMutationScope(world, userId, payload, action) {
  const ids = new Set([playerKey(userId)]);
  const listingId = String(payload?.listingId || '');
  const listing = (world?.facilityListings || []).find((entry) => String(entry?.id || '') === listingId);
  if (listing?.ownerType === 'player') addPlayerId(ids, listing.ownerId);
  return {
    allPlayers: false,
    allSegments: false,
    playerIds: ids,
    segments: new Set([...CORE_LOCAL_SEGMENTS, 'facilityListings']),
    orderIndexes: new Set(),
    marketKeys: new Set(),
    facilityMarketKeys: new Set(),
    includeAuctionEscrow: false,
    label: `facility-listing:${action}`,
  };
}

function saveDeletionMutationScope(userId, payload) {
  const preflight = payload?.preflight === true;
  const segments = new Set(CORE_LOCAL_SEGMENTS);
  if (!preflight) {
    for (const key of ['orders', 'facilityListings', 'assetAuctions', 'productionContracts']) segments.add(key);
  }
  return {
    allPlayers: false,
    allSegments: false,
    playerIds: new Set([playerKey(userId)]),
    segments,
    orderIndexes: new Set(),
    marketKeys: new Set(),
    facilityMarketKeys: new Set(),
    includeAuctionEscrow: !preflight,
    label: preflight ? 'save-deletion:preflight' : 'save-deletion:commit',
  };
}

function orderValidationScope(userId, label) {
  return {
    allPlayers: false,
    allSegments: false,
    playerIds: new Set([playerKey(userId)]),
    segments: new Set([...CORE_LOCAL_SEGMENTS, 'orders']),
    orderIndexes: new Set(),
    marketKeys: new Set(),
    facilityMarketKeys: new Set(),
    includeAuctionEscrow: false,
    label,
  };
}

function interactiveScopeError(action, message, code = 'INTERACTIVE_ACTION_SCOPE_UNDECLARED', statusCode = 500) {
  setRequestGauge('unexpectedFullWorldAction', 1);
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.action = String(action || '');
  return error;
}

function publishMutationScopeGauges(scope) {
  setRequestGauge('mutationScopeFullWorld', scope.allPlayers && scope.allSegments ? 1 : 0);
  setRequestGauge('mutationScopePlayerCount', scope.playerIds?.size || 0);
  setRequestGauge('mutationScopeSegmentCount', scope.segments?.size || 0);
  setRequestGauge('mutationScopeOrderCount', scope.orderIndexes?.size || 0);
  setRequestGauge('mutationScopeMarketKeyCount', scope.marketKeys?.size || 0);
  setRequestGauge('mutationScopeFacilityMarketKeyCount', scope.facilityMarketKeys?.size || 0);
}

function finalizeInteractiveMutationScope(action, scope) {
  if (
    !scope
    || scope.allPlayers
    || scope.allSegments
    || scope.playerIds === null
    || scope.segments === null
  ) {
    throw interactiveScopeError(
      action,
      `正式玩家动作不得使用未声明或无界 Mutation Scope：${String(action || '')}`,
    );
  }
  setRequestGauge('unexpectedFullWorldAction', 0);
  publishMutationScopeGauges(scope);
  return scope;
}

function invalidScopeInput(action, payload) {
  const execution = action === 'placeOrder' ? `，execution=${String(payload?.execution || '')}` : '';
  return interactiveScopeError(
    action,
    `无法从动作参数推导安全 Mutation Scope：${String(action || '')}${execution}`,
    'INTERACTIVE_ACTION_SCOPE_INPUT_INVALID',
    400,
  );
}

/** Every player action can confirm production. Clone only that player's operating footprint and counterparties. */
function includeCycleSettlementScope(world, userId, scope) {
  const player = world?.players?.[playerKey(userId)];
  if (!player) return scope;
  const regions = new Set();
  const autoSaleRegions = new Set();
  const keys = new Set();
  for (const group of player.facilityGroups || []) {
    if (!group.enabled) continue;
    const provinceId = normalizeProvinceId(group.provinceId);
    const type = FACILITY_TYPE_CATALOG.find((item) => item.id === group.facilityTypeId);
    const recipe = type?.recipes?.find((item) => item.id === group.activeRecipeId)
      || type?.recipes?.find((item) => item.id === type.defaultRecipeId) || type?.recipes?.[0];
    if (!recipe) continue;
    regions.add(provinceId);
    if (factoryAutoOperationPolicyFor(player, provinceId, group.facilityTypeId).enabled) autoSaleRegions.add(provinceId);
    for (const item of [...(recipe.inputs || []), recipe.output]) keys.add(provinceScopedKey(provinceId, item.productId));
  }
  for (const group of player.commercialBuildingGroups || []) {
    if (!group.enabled && !group.cycleActive && !(group.pendingRevenue > 0)) continue;
    const provinceId = normalizeProvinceId(group.provinceId);
    const type = COMMERCIAL_BUILDING_TYPE_CATALOG.find((item) => item.id === group.commercialTypeId);
    if (!type) continue;
    regions.add(provinceId);
    if (group.enabled && commercialAutoOperationPolicyFor(group).enabled) autoSaleRegions.add(provinceId);
    for (const item of type.consumptionInputs) keys.add(provinceScopedKey(provinceId, item.productId));
  }
  if (!regions.size) return scope;
  for (const [key, inventory] of Object.entries(player.inventories || {})) {
    const { provinceId, assetId } = splitProvinceScopedKey(key);
    if (autoSaleRegions.has(provinceId) && (inventory.available > 0 || inventory.frozen > 0)
      && PRODUCT_CATALOG.some((product) => product.id === assetId)) keys.add(provinceScopedKey(provinceId, assetId));
  }
  scope.segments.add('orders');
  scope.segments.add('markets');
  for (const key of keys) scope.marketKeys.add(key);
  for (const contract of world.productionContracts || []) {
    if (contract.kind !== 'supply' || contract.supplyMode !== 'daily' || contract.status !== 'active'
      || (Number(contract.buyerId) !== Number(userId) && Number(contract.supplierId) !== Number(userId))) continue;
    scope.segments.add('productionContracts');
    for (const id of [contract.buyerId, contract.supplierId]) {
      if (Number.isSafeInteger(Number(id)) && Number(id) > 0) scope.playerIds.add(playerKey(id));
    }
  }
  return scope;
}

export function createRuntimeMutationScope(world, userId, action, payload, {
  scheduledProcessing = true,
} = {}) {
  if (!scheduledProcessing) return createFullMutationScope();

  const metadata = getPlayerActionMetadata(action);
  if (!metadata) {
    throw interactiveScopeError(action, `正式玩家动作未登记 Mutation Scope：${String(action || '')}`);
  }
  if (metadata.lifecycle !== 'active' || metadata.mutationScope === 'none') {
    throw interactiveScopeError(
      action,
      `非活动玩家动作不得进入权威写事务：${String(action || '')}`,
      'INTERACTIVE_ACTION_RETIRED',
      410,
    );
  }

  let scope = null;
  switch (metadata.mutationScope) {
    case 'local-player':
      scope = {
        allPlayers: false,
        allSegments: false,
        playerIds: new Set([playerKey(userId)]),
        segments: new Set(CORE_LOCAL_SEGMENTS),
        orderIndexes: new Set(),
        marketKeys: new Set(),
        facilityMarketKeys: new Set(),
        includeAuctionEscrow: false,
        label: `local:${action}`,
      };
      break;
    case 'factory':
      scope = factoryAutoOperationScope(world, userId, payload);
      break;
    case 'profile':
      scope = profileMutationScope(userId);
      break;
    case 'contract':
      scope = contractMutationScope(world, userId, payload, action);
      break;
    case 'facility-listing':
      scope = facilityListingMutationScope(world, userId, payload, action);
      break;
    case 'save-deletion':
      scope = saveDeletionMutationScope(userId, payload);
      break;
    case 'auction':
      scope = {
        allPlayers: false,
        allSegments: false,
        playerIds: auctionParticipantIds(world, payload, userId),
        segments: new Set([...CORE_LOCAL_SEGMENTS, 'assetAuctions']),
        orderIndexes: new Set(),
        marketKeys: new Set(),
        facilityMarketKeys: new Set(),
        includeAuctionEscrow: true,
        label: `auction:${action}`,
      };
      break;
    case 'order': {
      if (action === 'cancelOrder') {
        scope = cancelScope(world, userId, payload)
          || orderValidationScope(userId, 'order:cancel-validation');
        break;
      }
      if (action !== 'placeOrder') break;
      const execution = String(payload?.execution || '');
      const executionMetadata = requireOrderExecutionMetadata(execution);
      if (executionMetadata.mutationScope === 'factory-policy') {
        scope = factoryAutoOperationScope(world, userId, payload);
        break;
      }
      if (executionMetadata.mutationScope === 'local-order-policy') {
        scope = orderScope(world, userId, [ordinaryOrderAsset(payload)], {
          label: `commodity:${executionMetadata.label}`,
          currentPlayerOrdersOnly: true,
        });
        break;
      }
      if (executionMetadata.mutationScope === 'procurement') {
        scope = orderScope(world, userId, procurementAssets(payload), {
          label: 'commodity:facility-build-procurement',
          mutateMarkets: true,
        });
        break;
      }
      if (executionMetadata.mutationScope === 'procurement-cancel') {
        scope = orderScope(world, userId, procurementCancelAssets(world, payload), {
          label: 'commodity:facility-build-procurement-cancel',
          currentPlayerOrdersOnly: true,
        }) || orderValidationScope(userId, 'commodity:facility-build-procurement-cancel-validation');
        break;
      }
      if (executionMetadata.mutationScope === 'active-order') {
        const asset = ordinaryOrderAsset(payload);
        const label = !execution && asset.kind === 'commodity'
          ? 'commodity:placeOrder'
          : `${asset.kind}:placeOrder${execution ? `:${execution}` : ''}`;
        scope = orderScope(world, userId, [asset], {
          label,
          mutateMarkets: true,
        });
        if (scope) scope.playerIds = crossingOrderParticipantIds(world, payload, userId);
      }
      break;
    }
    default:
      break;
  }

  if (!scope) throw invalidScopeInput(action, payload);
  return finalizeInteractiveMutationScope(action, includeCycleSettlementScope(world, userId, scope));
}

function cloneScopedObject(source, keys) {
  if (keys === null) return structuredClone(source || {});
  const clone = { ...(source || {}) };
  for (const key of keys || []) {
    if (Object.hasOwn(source || {}, key)) clone[key] = structuredClone(source[key]);
  }
  return clone;
}

function cloneScopedOrders(orders, orderIndexes) {
  if (orderIndexes === null) return structuredClone(orders || []);
  const clone = [...(orders || [])];
  for (const index of orderIndexes || []) {
    if (Number.isInteger(index) && index >= 0 && index < clone.length) {
      clone[index] = structuredClone(clone[index]);
    }
  }
  return clone;
}

export function cloneWorldForMutation(world, scope = createFullMutationScope()) {
  const draft = { ...world };
  if (scope.allPlayers || scope.playerIds === null) {
    draft.players = structuredClone(world?.players || {});
  } else {
    draft.players = { ...(world?.players || {}) };
    for (const id of scope.playerIds || []) {
      if (Object.hasOwn(world?.players || {}, id)) {
        draft.players[id] = structuredClone(world.players[id]);
      }
    }
  }

  const segments = scope.allSegments || scope.segments === null
    ? worldSegmentKeys(world)
    : [...(scope.segments || [])];
  for (const key of segments) {
    if (key === 'players' || !Object.hasOwn(world || {}, key)) continue;
    if (key === 'orders' && !scope.allSegments) {
      draft.orders = cloneScopedOrders(world.orders, scope.orderIndexes ?? null);
      continue;
    }
    if (key === 'markets' && !scope.allSegments) {
      draft.markets = cloneScopedObject(world.markets, scope.marketKeys ?? null);
      continue;
    }
    if (key === 'facilityMarkets' && !scope.allSegments) {
      draft.facilityMarkets = cloneScopedObject(world.facilityMarkets, scope.facilityMarketKeys ?? null);
      continue;
    }
    draft[key] = structuredClone(world[key]);
  }
  return installProvinceRuntimeAliases(draft);
}

export function snapshotSegmentedWorld(world) {
  return measureRequestPhase('worldSegmentSnapshotMs', () => {
    const playerStateJsonById = new Map();
    for (const [id, player] of Object.entries(world?.players || {})) {
      playerStateJsonById.set(playerKey(id), JSON.stringify(player));
    }
    const segmentStateJsonByKey = new Map();
    for (const key of worldSegmentKeys(world)) {
      segmentStateJsonByKey.set(key, JSON.stringify(world[key]));
    }
    const snapshot = { playerStateJsonById, segmentStateJsonByKey };
    publishSnapshotGauges(snapshot);
    return snapshot;
  });
}

export function readSegmentedWorld(store) {
  const meta = store.selectWorldMetaV2.get();
  if (!meta) return null;
  if (Number(meta.storage_schema_version) !== WORLD_STORAGE_SCHEMA_VERSION) {
    throw new Error(`不支持的世界存储版本：${meta.storage_schema_version}`);
  }

  return measureRequestPhase('worldSegmentLoadMs', () => {
    const world = { players: {} };
    const playerStateJsonById = new Map();
    for (const row of store.selectWorldPlayersV2.all()) {
      const id = playerKey(row.user_id);
      const stateJson = String(row.state_json);
      world.players[id] = JSON.parse(stateJson);
      playerStateJsonById.set(id, stateJson);
    }
    const segmentStateJsonByKey = new Map();
    for (const row of store.selectWorldSegmentsV2.all()) {
      const key = String(row.segment_key);
      const stateJson = String(row.state_json);
      world[key] = JSON.parse(stateJson);
      segmentStateJsonByKey.set(key, stateJson);
    }
    if (world.version === undefined) world.version = Number(meta.world_version || 0);
    const snapshot = { playerStateJsonById, segmentStateJsonByKey };
    publishSnapshotGauges(snapshot);
    return {
      revision: Number(meta.revision),
      worldVersion: Number(meta.world_version || 0),
      storageSchemaVersion: Number(meta.storage_schema_version || 0),
      updatedAt: Number(meta.updated_at || 0),
      world,
      snapshot,
    };
  });
}

export function segmentedSnapshotsEqual(left, right) {
  if (!left || !right) return false;
  if (left.playerStateJsonById?.size !== right.playerStateJsonById?.size) return false;
  if (left.segmentStateJsonByKey?.size !== right.segmentStateJsonByKey?.size) return false;
  for (const [key, value] of left.playerStateJsonById || []) {
    if (right.playerStateJsonById?.get(key) !== value) return false;
  }
  for (const [key, value] of left.segmentStateJsonByKey || []) {
    if (right.segmentStateJsonByKey?.get(key) !== value) return false;
  }
  return true;
}

export function writeFullSegmentedWorld(store, revision, world, now) {
  const snapshot = snapshotSegmentedWorld(world);
  measureRequestPhase('worldSegmentWriteMs', () => {
    store.deleteAllWorldPlayersV2.run();
    store.deleteAllWorldSegmentsV2.run();
    for (const [id, stateJson] of snapshot.playerStateJsonById) {
      store.upsertWorldPlayerV2.run(Number(id), Number(revision), stateJson, now);
    }
    for (const [key, stateJson] of snapshot.segmentStateJsonByKey) {
      store.upsertWorldSegmentV2.run(key, Number(revision), stateJson, now);
    }
    store.upsertWorldMetaV2.run(
      Number(revision),
      Number(world?.version || 0),
      WORLD_STORAGE_SCHEMA_VERSION,
      now,
    );
    store.updateLegacyWorldManifestV2.run(
      Number(revision),
      legacyManifest(world),
      now,
    );
  });
  publishSnapshotGauges(snapshot);
  return snapshot;
}

function normalizedScope(scope, world) {
  if (!scope) return createFullMutationScope();
  const normalized = {
    allPlayers: Boolean(scope.allPlayers || scope.playerIds === null),
    allSegments: Boolean(scope.allSegments || scope.segments === null),
    playerIds: scope.playerIds === null
      ? null
      : new Set([...(scope.playerIds || [])].map(playerKey)),
    segments: scope.segments === null ? null : new Set(scope.segments || []),
    orderIndexes: scope.orderIndexes === null ? null : new Set(scope.orderIndexes || []),
    marketKeys: scope.marketKeys === null ? null : new Set(scope.marketKeys || []),
    facilityMarketKeys: scope.facilityMarketKeys === null ? null : new Set(scope.facilityMarketKeys || []),
    includeAuctionEscrow: scope.includeAuctionEscrow !== false,
    label: String(scope.label || 'mutation'),
  };
  if (!normalized.allSegments) {
    for (const key of ['version', 'moneyPrecision', 'auctionFeeEscrowCredits']) {
      if (Object.hasOwn(world || {}, key)) normalized.segments.add(key);
    }
  }
  return normalized;
}

function requestedPlayerIds(scope, world, snapshot) {
  if (!scope.allPlayers) return new Set(scope.playerIds || []);
  return new Set([
    ...Object.keys(world?.players || {}).map(playerKey),
    ...(snapshot?.playerStateJsonById?.keys?.() || []),
  ]);
}

function requestedSegmentKeys(scope, world, snapshot) {
  const current = new Set(worldSegmentKeys(world));
  const previous = new Set(snapshot?.segmentStateJsonByKey?.keys?.() || []);
  const keys = scope.allSegments
    ? new Set([...current, ...previous])
    : new Set(scope.segments || []);
  for (const key of current) if (!previous.has(key)) keys.add(key);
  for (const key of previous) if (!current.has(key)) keys.add(key);
  keys.delete('lastProcessedAt');
  return keys;
}

function legacyManifest(world) {
  return JSON.stringify({
    version: Number(world?.version || 0),
    storageSchemaVersion: WORLD_STORAGE_SCHEMA_VERSION,
    segmented: true,
  });
}

export function prepareSegmentedWorldWrite(store, revision, world, now, mutationScope) {
  const scope = normalizedScope(mutationScope, world);
  const baseSnapshot = store.worldCache?.segmentedSnapshot || snapshotSegmentedWorld(store.worldCache?.world || world);
  const playerStateJsonById = new Map(baseSnapshot.playerStateJsonById);
  const segmentStateJsonByKey = new Map(baseSnapshot.segmentStateJsonByKey);
  const playerWrites = [];
  const playerDeletes = [];
  const segmentWrites = [];
  const segmentDeletes = [];

  measureRequestPhase('worldSegmentCompareMs', () => {
    for (const id of requestedPlayerIds(scope, world, baseSnapshot)) {
      const player = world?.players?.[id];
      if (!player) {
        if (playerStateJsonById.has(id)) {
          playerDeletes.push(id);
          playerStateJsonById.delete(id);
        }
        continue;
      }
      const stateJson = JSON.stringify(player);
      if (stateJson === playerStateJsonById.get(id)) continue;
      playerWrites.push([id, stateJson]);
      playerStateJsonById.set(id, stateJson);
    }

    for (const key of requestedSegmentKeys(scope, world, baseSnapshot)) {
      if (!Object.hasOwn(world || {}, key)) {
        if (segmentStateJsonByKey.has(key)) {
          segmentDeletes.push(key);
          segmentStateJsonByKey.delete(key);
        }
        continue;
      }
      const stateJson = JSON.stringify(world[key]);
      if (stateJson === segmentStateJsonByKey.get(key)) continue;
      segmentWrites.push([key, stateJson]);
      segmentStateJsonByKey.set(key, stateJson);
    }
  });

  const changed = playerWrites.length > 0
    || playerDeletes.length > 0
    || segmentWrites.length > 0
    || segmentDeletes.length > 0;
  if (!changed) {
    publishSnapshotGauges(baseSnapshot);
    return {
      changed: false,
      revision: Number(revision),
      nextRevision: Number(revision),
      snapshot: baseSnapshot,
      scope,
      playerWrites,
      playerDeletes,
      segmentWrites,
      segmentDeletes,
    };
  }

  world.lastProcessedAt = now;
  const processedAtJson = JSON.stringify(world.lastProcessedAt);
  if (processedAtJson !== segmentStateJsonByKey.get('lastProcessedAt')) {
    const existing = segmentWrites.findIndex(([key]) => key === 'lastProcessedAt');
    if (existing >= 0) segmentWrites.splice(existing, 1);
    segmentWrites.push(['lastProcessedAt', processedAtJson]);
    segmentStateJsonByKey.set('lastProcessedAt', processedAtJson);
  }

  const snapshot = { playerStateJsonById, segmentStateJsonByKey };
  publishSnapshotGauges(snapshot);
  return {
    changed: true,
    revision: Number(revision),
    nextRevision: Number(revision) + 1,
    snapshot,
    scope,
    playerWrites,
    playerDeletes,
    segmentWrites,
    segmentDeletes,
  };
}

export function applySegmentedWorldWrite(store, plan, world, now) {
  if (!plan?.changed) return Number(plan?.revision || 0);
  measureRequestPhase('worldSegmentWriteMs', () => {
    for (const id of plan.playerDeletes) store.deleteWorldPlayerV2.run(Number(id));
    for (const [id, stateJson] of plan.playerWrites) {
      store.upsertWorldPlayerV2.run(Number(id), plan.nextRevision, stateJson, now);
    }
    for (const key of plan.segmentDeletes) store.deleteWorldSegmentV2.run(key);
    for (const [key, stateJson] of plan.segmentWrites) {
      store.upsertWorldSegmentV2.run(key, plan.nextRevision, stateJson, now);
    }
  });
  measureRequestPhase('worldMetaUpdateMs', () => {
    store.upsertWorldMetaV2.run(
      plan.nextRevision,
      Number(world?.version || 0),
      WORLD_STORAGE_SCHEMA_VERSION,
      now,
    );
    store.updateLegacyWorldManifestV2.run(
      plan.nextRevision,
      legacyManifest(world),
      now,
    );
  });
  setRequestGauge('worldDirtyPlayerRows', plan.playerWrites.length + plan.playerDeletes.length);
  setRequestGauge('worldDirtySegments', plan.segmentWrites.length + plan.segmentDeletes.length);
  publishSnapshotGauges(plan.snapshot);
  return plan.nextRevision;
}
