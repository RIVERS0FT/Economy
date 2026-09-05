/**
 * Named allocations are part of inventory.frozen, never additional inventory.
 * Unclassified legacy escrow remains frozen until its owning domain releases it.
 * Callers supply one player's one-province inventory; this module never moves goods.
 */
const KINDS = new Set(['production', 'commercial', 'contract', 'auction', 'legacy']);

function fail(message) {
  const error = new Error(message);
  error.code = 'INVENTORY_FREEZE_INVALID';
  error.statusCode = 409;
  throw error;
}

function quantity(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) fail(`${label}必须是非负安全整数`);
  return value;
}

function safeSum(left, right, label) {
  const value = left + right;
  return quantity(value, label);
}

function sourceKey(source) {
  if (!source || !KINDS.has(source.kind) || typeof source.sourceId !== 'string'
    || source.sourceId.length === 0 || source.sourceId.length > 256) fail('冻结来源无效');
  return JSON.stringify([source.kind, source.sourceId]);
}

function snapshot(inventory) {
  if (!inventory || typeof inventory !== 'object') fail('库存不存在');
  const available = quantity(inventory.available, '可用库存');
  const frozen = quantity(inventory.frozen, '冻结库存');
  safeSum(available, frozen, '库存总量');
  const entries = inventory.freezeAllocations ?? [];
  if (!Array.isArray(entries)) fail('冻结来源记录无效');
  const seen = new Set();
  let namedTotal = 0;
  const allocations = entries.map((entry) => {
    const key = sourceKey(entry);
    if (seen.has(key)) fail('冻结来源重复');
    seen.add(key);
    const amount = quantity(entry.quantity, '来源冻结数量');
    namedTotal = safeSum(namedTotal, amount, '已归属冻结数量');
    return { kind: entry.kind, sourceId: entry.sourceId, label: String(entry.label || entry.sourceId), quantity: amount };
  });
  if (namedTotal > frozen) fail('来源冻结数量超过冻结库存');
  return { available, frozen, allocations, unclassified: frozen - namedTotal };
}

function commit(inventory, state) {
  inventory.available = state.available;
  inventory.frozen = state.frozen;
  const entries = state.allocations.filter((entry) => entry.quantity > 0);
  if (entries.length > 0) inventory.freezeAllocations = entries;
  else delete inventory.freezeAllocations;
}

function findAllocation(state, source) {
  const key = sourceKey(source);
  return state.allocations.find((entry) => sourceKey(entry) === key);
}

/** Pure read. The returned objects cannot mutate authoritative allocations. */
export function inventoryFreezeAllocations(inventory) {
  return snapshot(inventory).allocations.filter((entry) => entry.quantity > 0);
}

export function inventoryFrozenForSource(inventory, source) {
  return findAllocation(snapshot(inventory), source)?.quantity ?? 0;
}

export function inventoryUsableBySource(inventory, source) {
  const state = snapshot(inventory);
  return safeSum(state.available, findAllocation(state, source)?.quantity ?? 0, '业务可用库存');
}

export function freezeInventory(inventory, source, amount) {
  quantity(amount, '冻结数量');
  const state = snapshot(inventory);
  const existing = findAllocation(state, source);
  if (amount > state.available) fail('可用库存不足，不能冻结不存在的商品');
  if (amount === 0) return 0;
  const nextFrozen = safeSum(state.frozen, amount, '冻结库存');
  const nextSource = safeSum(existing?.quantity ?? 0, amount, '来源冻结数量');
  if (existing) existing.quantity = nextSource;
  else state.allocations.push({
    kind: source.kind,
    sourceId: source.sourceId,
    label: String(source.label || source.sourceId),
    quantity: nextSource,
  });
  state.available -= amount;
  state.frozen = nextFrozen;
  commit(inventory, state);
  return amount;
}

/** Release only this source. Unknown legacy escrow is never silently released. */
export function releaseInventoryFreeze(inventory, source, amount) {
  const state = snapshot(inventory);
  const existing = findAllocation(state, source);
  const released = quantity(amount ?? existing?.quantity ?? 0, '解冻数量');
  if (released > (existing?.quantity ?? 0)) fail('解冻数量超过该来源冻结数量');
  if (released === 0) return 0;
  state.available = safeSum(state.available, released, '可用库存');
  state.frozen -= released;
  existing.quantity -= released;
  commit(inventory, state);
  return released;
}

/** Consumed goods leave inventory; they must not remain in the freeze total. */
export function consumeInventoryForSource(inventory, source, amount) {
  quantity(amount, '消费数量');
  const state = snapshot(inventory);
  const existing = findAllocation(state, source);
  const owned = existing?.quantity ?? 0;
  if (amount > safeSum(state.available, owned, '业务可用库存')) fail('本业务可用商品不足');
  if (amount === 0) return 0;
  const fromFrozen = Math.min(owned, amount);
  if (existing) existing.quantity -= fromFrozen;
  state.frozen -= fromFrozen;
  state.available -= amount - fromFrozen;
  commit(inventory, state);
  return amount;
}

/**
 * Multi-input allocation is all-or-nothing even outside the outer world transaction.
 * Entries may share an inventory object; each later entry sees the earlier staged use.
 */
export function freezeInventoryBatch(requests) {
  if (!Array.isArray(requests)) fail('冻结批次无效');
  const staged = new Map();
  for (const request of requests) {
    if (!request || !request.inventory) fail('冻结批次库存无效');
    let draft = staged.get(request.inventory);
    if (!draft) {
      snapshot(request.inventory);
      draft = {
        available: request.inventory.available,
        frozen: request.inventory.frozen,
        ...(request.inventory.freezeAllocations
          ? { freezeAllocations: request.inventory.freezeAllocations.map((entry) => ({ ...entry })) }
          : {}),
      };
      staged.set(request.inventory, draft);
    }
    freezeInventory(draft, request.source, request.quantity);
  }
  const total = requests.reduce((sum, request) => safeSum(sum, request.quantity, '批次冻结数量'), 0);
  for (const [inventory, draft] of staged) commit(inventory, snapshot(draft));
  return total;
}

/**
 * External rows describe escrow already included in inventory.frozen (contracts,
 * auctions). A mismatch is reported as unknown, never converted into free stock.
 */
export function inventoryFreezeBreakdown(inventory, externalRows = []) {
  const state = snapshot(inventory);
  if (!Array.isArray(externalRows)) fail('外部冻结来源无效');
  const rows = state.allocations.filter((entry) => entry.quantity > 0);
  const seen = new Set(rows.map(sourceKey));
  let remainder = state.unclassified;
  let inconsistent = false;
  for (const candidate of externalRows) {
    const key = sourceKey(candidate);
    if (seen.has(key)) continue;
    seen.add(key);
    const amount = quantity(candidate.quantity, '外部冻结数量');
    if (amount === 0) continue;
    if (amount > remainder) {
      inconsistent = true;
      continue;
    }
    rows.push({ kind: candidate.kind, sourceId: candidate.sourceId,
      label: String(candidate.label || candidate.sourceId), quantity: amount });
    remainder -= amount;
  }
  if (remainder > 0) rows.push({ kind: 'legacy', sourceId: 'unclassified', label: '待核对冻结', quantity: remainder });
  return { total: state.frozen, entries: rows, inconsistent };
}
