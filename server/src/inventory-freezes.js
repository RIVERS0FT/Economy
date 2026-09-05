import { inventoryForProvince, normalizeProvinceId } from './provinces.js';

const BUILDING_FREEZE_KINDS = new Set(['production', 'commercial']);

function nonNegativeInteger(value) {
  const normalized = Math.floor(Number(value));
  return Number.isSafeInteger(normalized) && normalized >= 0 ? normalized : 0;
}

function sourceKey({ kind, provinceId, productId, sourceId }) {
  return `${kind}:${normalizeProvinceId(provinceId)}:${String(productId || '')}:${String(sourceId || '')}`;
}

function normalizeSource(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const kind = String(value.kind || '');
  const productId = String(value.productId || '');
  const sourceId = String(value.sourceId || '');
  const quantity = nonNegativeInteger(value.quantity);
  if (!BUILDING_FREEZE_KINDS.has(kind) || !productId || !sourceId || quantity < 1) return null;
  return {
    kind,
    provinceId: normalizeProvinceId(value.provinceId),
    productId,
    sourceId,
    sourceLabel: String(value.sourceLabel || sourceId),
    quantity,
  };
}

export function ensureInventoryFreezeSources(player) {
  if (!player || typeof player !== 'object') return [];
  const byKey = new Map();
  for (const value of Array.isArray(player.inventoryFreezeSources) ? player.inventoryFreezeSources : []) {
    const source = normalizeSource(value);
    if (!source) continue;
    const key = sourceKey(source);
    const existing = byKey.get(key);
    if (existing) existing.quantity += source.quantity;
    else byKey.set(key, source);
  }
  player.inventoryFreezeSources = [...byKey.values()];
  return player.inventoryFreezeSources;
}

export function sourceFrozenQuantity(player, spec) {
  const key = sourceKey(spec);
  return ensureInventoryFreezeSources(player).reduce((sum, source) => (
    sourceKey(source) === key ? sum + nonNegativeInteger(source.quantity) : sum
  ), 0);
}

function writeSourceQuantity(player, spec, quantity) {
  const normalizedQuantity = nonNegativeInteger(quantity);
  const key = sourceKey(spec);
  const sources = ensureInventoryFreezeSources(player).filter((source) => sourceKey(source) !== key);
  if (normalizedQuantity > 0) {
    sources.push({
      kind: String(spec.kind),
      provinceId: normalizeProvinceId(spec.provinceId),
      productId: String(spec.productId),
      sourceId: String(spec.sourceId),
      sourceLabel: String(spec.sourceLabel || spec.sourceId),
      quantity: normalizedQuantity,
    });
  }
  player.inventoryFreezeSources = sources;
  return normalizedQuantity;
}

export function setInventoryFreezeTarget(player, spec, targetQuantity) {
  const target = nonNegativeInteger(targetQuantity);
  const inventory = inventoryForProvince(player, spec.productId, spec.provinceId);
  const current = Math.min(sourceFrozenQuantity(player, spec), nonNegativeInteger(inventory.frozen));
  if (target > current) {
    const added = Math.min(target - current, nonNegativeInteger(inventory.available));
    if (added > 0) {
      inventory.available -= added;
      inventory.frozen = nonNegativeInteger(inventory.frozen) + added;
    }
    return writeSourceQuantity(player, spec, current + added);
  }
  if (target < current) {
    const released = Math.min(current - target, nonNegativeInteger(inventory.frozen));
    if (released > 0) {
      inventory.frozen -= released;
      inventory.available = nonNegativeInteger(inventory.available) + released;
    }
    return writeSourceQuantity(player, spec, current - released);
  }
  return writeSourceQuantity(player, spec, current);
}

export function thawInventoryFreeze(player, spec, quantity) {
  const inventory = inventoryForProvince(player, spec.productId, spec.provinceId);
  const current = Math.min(sourceFrozenQuantity(player, spec), nonNegativeInteger(inventory.frozen));
  const thawed = Math.min(current, nonNegativeInteger(quantity));
  if (thawed < 1) return 0;
  inventory.frozen -= thawed;
  inventory.available = nonNegativeInteger(inventory.available) + thawed;
  writeSourceQuantity(player, spec, current - thawed);
  return thawed;
}

export function consumeInventoryFreeze(player, spec, quantity) {
  const inventory = inventoryForProvince(player, spec.productId, spec.provinceId);
  const current = Math.min(sourceFrozenQuantity(player, spec), nonNegativeInteger(inventory.frozen));
  const consumed = Math.min(current, nonNegativeInteger(quantity));
  if (consumed < 1) return 0;
  inventory.frozen -= consumed;
  writeSourceQuantity(player, spec, current - consumed);
  return consumed;
}

export function releaseInventoryFreezeSource(player, { kind, provinceId, sourceId }) {
  let released = 0;
  for (const source of [...ensureInventoryFreezeSources(player)]) {
    if (
      source.kind !== kind
      || source.provinceId !== normalizeProvinceId(provinceId)
      || source.sourceId !== String(sourceId || '')
    ) continue;
    const inventory = inventoryForProvince(player, source.productId, source.provinceId);
    const amount = Math.min(nonNegativeInteger(source.quantity), nonNegativeInteger(inventory.frozen));
    if (amount > 0) {
      inventory.frozen -= amount;
      inventory.available = nonNegativeInteger(inventory.available) + amount;
      released += amount;
    }
    writeSourceQuantity(player, source, 0);
  }
  return released;
}

export function createInventoryFreezeClientState(player) {
  return {
    inventoryFreezeSources: ensureInventoryFreezeSources(player).map((source) => ({ ...source })),
  };
}
