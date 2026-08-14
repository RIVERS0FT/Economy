import provinceCatalog from '../../shared/provinces.json' with { type: 'json' };

export const PROVINCE_CATALOG = Object.freeze(provinceCatalog.map((province) => Object.freeze({ ...province })));
export const DEFAULT_PROVINCE_ID = '110000';

const PROVINCE_IDS = new Set(PROVINCE_CATALOG.map((province) => province.id));
const SCOPED_KEY_SEPARATOR = ':';

function defineDefaultProvinceAlias(record, assetId) {
  if (!record || !assetId) return;
  const descriptor = Object.getOwnPropertyDescriptor(record, assetId);
  if (descriptor?.enumerable) return;
  const scopedKey = provinceScopedKey(DEFAULT_PROVINCE_ID, assetId);
  Object.defineProperty(record, assetId, {
    configurable: true,
    enumerable: false,
    get() {
      return this[scopedKey];
    },
    set(value) {
      this[scopedKey] = value;
    },
  });
}

export function normalizeProvinceId(value) {
  const id = String(value || '');
  return PROVINCE_IDS.has(id) ? id : DEFAULT_PROVINCE_ID;
}

export function provinceScopedKey(provinceId, assetId) {
  return `${normalizeProvinceId(provinceId)}${SCOPED_KEY_SEPARATOR}${String(assetId || '')}`;
}

export function splitProvinceScopedKey(value) {
  const key = String(value || '');
  const separatorIndex = key.indexOf(SCOPED_KEY_SEPARATOR);
  if (separatorIndex < 0) return { provinceId: DEFAULT_PROVINCE_ID, assetId: key };
  return {
    provinceId: normalizeProvinceId(key.slice(0, separatorIndex)),
    assetId: key.slice(separatorIndex + 1),
  };
}

export function installDefaultProvinceAliases(record) {
  for (const key of Object.getOwnPropertyNames(record || {})) {
    if (key.includes(SCOPED_KEY_SEPARATOR)) continue;
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    if (descriptor?.enumerable || Object.hasOwn(record, provinceScopedKey(DEFAULT_PROVINCE_ID, key))) continue;
    delete record[key];
  }
  for (const key of Object.keys(record || {})) {
    const { provinceId, assetId } = splitProvinceScopedKey(key);
    if (provinceId === DEFAULT_PROVINCE_ID && key.includes(SCOPED_KEY_SEPARATOR)) {
      defineDefaultProvinceAlias(record, assetId);
    }
  }
  return record;
}

export function installProvinceRuntimeAliases(world) {
  if (!world || typeof world !== 'object') return world;
  installDefaultProvinceAliases(world.markets);
  installDefaultProvinceAliases(world.facilityMarkets);
  for (const player of Object.values(world.players || {})) {
    installDefaultProvinceAliases(player?.inventories);
    installDefaultProvinceAliases(player?.onlineAutoBuyPolicies);
    installDefaultProvinceAliases(player?.onlineAutoSellPolicies);
    installDefaultProvinceAliases(player?.onlineAutoBuyOrderIds);
    installDefaultProvinceAliases(player?.onlineAutoSellOrderIds);
  }
  return world;
}

export function migrateProvinceInventories(player) {
  player.inventories ||= {};
  for (const [key, inventory] of Object.entries({ ...player.inventories })) {
    if (key.includes(SCOPED_KEY_SEPARATOR)) continue;
    const scopedKey = provinceScopedKey(DEFAULT_PROVINCE_ID, key);
    const target = player.inventories[scopedKey] ||= { available: 0, frozen: 0 };
    target.available = Number(target.available || 0) + Number(inventory?.available || 0);
    target.frozen = Number(target.frozen || 0) + Number(inventory?.frozen || 0);
    delete player.inventories[key];
  }
  return installDefaultProvinceAliases(player.inventories);
}

export function inventoryForProvince(player, productId, provinceId = DEFAULT_PROVINCE_ID) {
  migrateProvinceInventories(player);
  const key = provinceScopedKey(provinceId, productId);
  player.inventories[key] ||= { available: 0, frozen: 0 };
  if (normalizeProvinceId(provinceId) === DEFAULT_PROVINCE_ID) {
    defineDefaultProvinceAlias(player.inventories, String(productId || ''));
  }
  return player.inventories[key];
}

export function inventoriesForProvince(player, provinceId = DEFAULT_PROVINCE_ID) {
  const selectedProvinceId = normalizeProvinceId(provinceId);
  const inventories = {};
  for (const [key, inventory] of Object.entries(player?.inventories || {})) {
    const scoped = splitProvinceScopedKey(key);
    if (scoped.provinceId === selectedProvinceId) inventories[scoped.assetId] = inventory;
  }
  return inventories;
}

export function inventoryStatesByProvince(player) {
  const states = {};
  for (const [key, inventory] of Object.entries(player?.inventories || {})) {
    const { provinceId, assetId } = splitProvinceScopedKey(key);
    states[provinceId] ||= {};
    states[provinceId][assetId] = inventory;
  }
  return states;
}

export function marketStatesByProvince(markets) {
  const states = {};
  for (const [key, market] of Object.entries(markets || {})) {
    const { provinceId, assetId } = splitProvinceScopedKey(key);
    states[provinceId] ||= {};
    states[provinceId][assetId] = market;
  }
  return states;
}

export function provinceAssetSummaries(player, orders = []) {
  const summaries = Object.fromEntries(PROVINCE_CATALOG.map((province) => [province.id, {
    provinceId: province.id,
    storedQuantity: 0,
    facilityCount: 0,
    runningFacilityCount: 0,
    blockedFacilityCount: 0,
    openOrderCount: 0,
  }]));
  for (const [key, inventory] of Object.entries(player?.inventories || {})) {
    const { provinceId } = splitProvinceScopedKey(key);
    summaries[provinceId].storedQuantity += Math.max(0, Number(inventory?.available || 0))
      + Math.max(0, Number(inventory?.frozen || 0));
  }
  for (const group of player?.facilityGroups || []) {
    const provinceId = normalizeProvinceId(group?.provinceId);
    const count = Math.max(0, Number(group?.count || 0));
    summaries[provinceId].facilityCount += count;
    if (group?.status === 'running') summaries[provinceId].runningFacilityCount += Math.max(0, Number(group?.participatingCount || 0));
    if (group?.status === 'error') summaries[provinceId].blockedFacilityCount += count;
  }
  for (const order of orders || []) {
    if (Number(order?.ownerId) !== Number(player?.userId)) continue;
    if (!(order?.status === 'open' || order?.status === 'partial') || Number(order?.remaining || 0) <= 0) continue;
    summaries[normalizeProvinceId(order?.provinceId)].openOrderCount += 1;
  }
  return summaries;
}

export function migrateProvinceFields(world) {
  world.orders ||= [];
  for (const order of world.orders) order.provinceId = normalizeProvinceId(order.provinceId);
  for (const contract of world.productionContracts || []) {
    if (contract?.kind === 'loan' || contract?.kind === 'facility_lease') {
      contract.provinceId = normalizeProvinceId(contract.provinceId);
    }
  }
  for (const player of Object.values(world.players || {})) {
    if (player.inventories) migrateProvinceInventories(player);
    for (const group of player.facilityGroups || []) group.provinceId = normalizeProvinceId(group.provinceId);
    for (const collateral of player.bankAccount?.activeLoan?.collateral || []) {
      collateral.provinceId = normalizeProvinceId(collateral.provinceId);
    }
  }
  if (world.bank?.facilityReserves && typeof world.bank.facilityReserves === 'object') {
    const reserves = {};
    for (const [key, quantity] of Object.entries(world.bank.facilityReserves)) {
      const { provinceId, assetId } = splitProvinceScopedKey(key);
      const scopedKey = provinceScopedKey(provinceId, assetId);
      reserves[scopedKey] = Number(reserves[scopedKey] || 0) + Math.max(0, Number(quantity || 0));
    }
    world.bank.facilityReserves = reserves;
  }
  const migrateMarketRecord = (record) => {
    const migrated = {};
    for (const [key, market] of Object.entries(record || {})) {
      const scoped = splitProvinceScopedKey(key);
      const targetKey = provinceScopedKey(scoped.provinceId, scoped.assetId);
      migrated[targetKey] ||= market;
    }
    return migrated;
  };
  world.markets = installDefaultProvinceAliases(migrateMarketRecord(world.markets));
  world.facilityMarkets = installDefaultProvinceAliases(migrateMarketRecord(world.facilityMarkets));
  return world;
}
