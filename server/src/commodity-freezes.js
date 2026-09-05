/** Commodity custody. The aggregate frozen balance is always backed by source entries. */
const KINDS = new Set(['production', 'commercial', 'contract', 'auction', 'legacy']);
const LEGACY_KEY = 'legacy:unattributed';

function quantity(value, label = '商品数量') {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${label}必须为非负安全整数`);
  return value;
}

export function commodityFreezeKey(kind, sourceId) {
  if (!KINDS.has(kind) || typeof sourceId !== 'string' || !sourceId) throw new TypeError('商品冻结来源无效');
  return `${kind}:${sourceId}`;
}

export function frozenForSource(inventory, kind, sourceId) {
  return quantity(inventory?.freezes?.[commodityFreezeKey(kind, sourceId)]?.quantity ?? 0);
}

function ensureLedger(inventory) {
  quantity(inventory.available ?? 0);
  quantity(inventory.frozen ?? 0);
  if (!inventory.freezes) {
    inventory.freezes = {};
    if (inventory.frozen > 0) inventory.freezes[LEGACY_KEY] = {
      kind: 'legacy', sourceId: 'unattributed', quantity: inventory.frozen,
    };
  }
  assertCommodityFreezeInvariant(inventory);
  return inventory.freezes;
}

/** Reclassify an exact pre-existing business reservation; never create or release goods. */
export function adoptLegacyCommodityFreeze(inventory, kind, sourceId, existingQuantity) {
  quantity(existingQuantity);
  if (existingQuantity === 0) return;
  const entries = ensureLedger(inventory);
  const key = commodityFreezeKey(kind, sourceId);
  const present = frozenForSource(inventory, kind, sourceId);
  const missing = Math.max(0, existingQuantity - present);
  if (!missing) return;
  const legacy = entries[LEGACY_KEY];
  if ((legacy?.quantity ?? 0) < missing) throw new Error('历史冻结与业务来源不一致，不能挪用其他冻结');
  legacy.quantity -= missing;
  if (!legacy.quantity) delete entries[LEGACY_KEY];
  entries[key] = { kind, sourceId, quantity: present + missing };
}

export function freezeCommodity(inventory, kind, sourceId, amount) {
  quantity(amount);
  if (!amount) return 0;
  const key = commodityFreezeKey(kind, sourceId);
  const entries = ensureLedger(inventory);
  if (inventory.available < amount) throw new Error('可用商品不足，不能冻结');
  const next = quantity((inventory.frozen ?? 0) + amount, '冻结库存');
  const sourceQuantity = quantity(frozenForSource(inventory, kind, sourceId) + amount);
  inventory.available -= amount;
  inventory.frozen = next;
  entries[key] = { kind, sourceId, quantity: sourceQuantity };
  return amount;
}

export function consumeCommodityFreeze(inventory, kind, sourceId, amount) {
  quantity(amount);
  if (!amount) return 0;
  const key = commodityFreezeKey(kind, sourceId);
  const entries = ensureLedger(inventory);
  const owned = frozenForSource(inventory, kind, sourceId);
  if (owned < amount) throw new Error('对应来源的冻结商品不足');
  inventory.frozen -= amount;
  if (owned === amount) delete entries[key];
  else entries[key].quantity = owned - amount;
  if (Object.keys(entries).length === 0) delete inventory.freezes;
  return amount;
}

export function releaseCommodityFreeze(inventory, kind, sourceId, amount) {
  quantity(amount);
  quantity((inventory.available ?? 0) + amount, '可用库存');
  consumeCommodityFreeze(inventory, kind, sourceId, amount);
  if (amount) inventory.available += amount;
  return amount;
}

export function transferCommodityFreeze(inventory, kind, fromSourceId, toSourceId, amount) {
  quantity(amount);
  if (!amount || fromSourceId === toSourceId) return;
  const entries = ensureLedger(inventory);
  const targetKey = commodityFreezeKey(kind, toSourceId);
  const targetQuantity = quantity(frozenForSource(inventory, kind, toSourceId) + amount);
  consumeCommodityFreeze(inventory, kind, fromSourceId, amount);
  inventory.frozen = quantity(inventory.frozen + amount);
  entries[targetKey] = { kind, sourceId: toSourceId, quantity: targetQuantity };
  inventory.freezes = entries;
}

/** Only the named consumer can use its own custody; other consumers only see available. */
export function consumeBuildingCommodity(inventory, kind, sourceId, amount) {
  quantity(amount);
  const own = Math.min(amount, frozenForSource(inventory, kind, sourceId));
  if ((inventory.available ?? 0) < amount - own) throw new Error('经营商品不足');
  consumeCommodityFreeze(inventory, kind, sourceId, own);
  inventory.available -= amount - own;
}

export function assertCommodityFreezeInvariant(inventory) {
  if (!inventory?.freezes) return true; // Legacy balances are classified without changing assets.
  let total = 0;
  for (const [key, entry] of Object.entries(inventory.freezes)) {
    if (!entry || key !== commodityFreezeKey(entry.kind, entry.sourceId)) throw new Error('商品冻结来源键不一致');
    total = quantity(total + quantity(entry.quantity), '冻结合计');
  }
  if (total !== inventory.frozen) throw new Error('冻结明细合计与冻结库存不一致');
  return true;
}

/** Compatibility inventory merging preserves custody as well as aggregate balances. */
export function mergeCommodityInventory(target, source) {
  if (target.freezes || source.freezes) {
    const left = ensureLedger(target);
    const right = ensureLedger(source);
    for (const [key, entry] of Object.entries(right)) {
      left[key] = { ...entry, quantity: quantity((left[key]?.quantity || 0) + entry.quantity) };
    }
  }
  target.available = quantity((target.available || 0) + (source.available || 0));
  target.frozen = quantity((target.frozen || 0) + (source.frozen || 0));
  target.inTransit = quantity((target.inTransit || 0) + (source.inTransit || 0));
  assertCommodityFreezeInvariant(target);
}

/** Retired player orders may release only their own custody or unclassified legacy balance. */
export function releaseLegacyOrderFreeze(inventory, orderId, maximum) {
  quantity(maximum);
  const sourceId = `order:${orderId}`;
  ensureLedger(inventory);
  const available = frozenForSource(inventory, 'legacy', sourceId)
    + frozenForSource(inventory, 'legacy', 'unattributed');
  const amount = Math.min(maximum, available);
  adoptLegacyCommodityFreeze(inventory, 'legacy', sourceId, amount);
  releaseCommodityFreeze(inventory, 'legacy', sourceId, amount);
  return amount;
}
