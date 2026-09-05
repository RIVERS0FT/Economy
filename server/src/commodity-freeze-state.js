import { FACILITY_TYPE_CATALOG } from './industry-catalog.js';
import { COMMERCIAL_BUILDING_TYPE_CATALOG } from './commercial-catalog.js';
import { adoptLegacyCommodityFreeze, assertCommodityFreezeInvariant, frozenForSource } from './commodity-freezes.js';
import { provinceScopedKey, splitProvinceScopedKey } from './provinces.js';

const facilityNames = new Map(FACILITY_TYPE_CATALOG.map((type) => [type.id, type.name]));
const commercialNames = new Map(COMMERCIAL_BUILDING_TYPE_CATALOG.map((type) => [type.id, type.name]));
const integer = (value) => Number.isSafeInteger(value) && value >= 0;

/** Cold migration only. Reclassification never changes available, frozen or total goods. */
export function migrateCommodityFreezeSources(world) {
  const candidates = new Map();
  const add = (userId, region, productId, kind, sourceId, quantity) => {
    if (!integer(quantity) || quantity === 0) return;
    const inventory = world.players?.[String(userId)]?.inventories?.[provinceScopedKey(region, productId)];
    if (!inventory) return;
    const entries = candidates.get(inventory) || [];
    entries.push({ kind, sourceId: String(sourceId), quantity });
    candidates.set(inventory, entries);
  };
  for (const contract of world.productionContracts || []) {
    if (contract.kind !== 'supply') continue;
    add(contract.supplierId, contract.provinceId, contract.productId, 'contract', contract.id, contract.supplierReservedQuantity);
    const renewal = contract.renewalProposal;
    if (renewal?.status === 'accepted') add(contract.supplierId, contract.provinceId, contract.productId,
      'contract', `${contract.id}:renewal`, renewal.supplierReservedQuantity);
  }
  for (const auction of world.assetAuctions || []) {
    if (auction.sellerType === 'market_reserve' || auction.escrowStatus !== 'held') continue;
    for (const item of auction.items || [auction]) {
      if (item.assetKind !== 'commodity') continue;
      add(auction.sellerId, item.provinceId || auction.provinceId, item.assetId || item.productId,
        'auction', auction.id, item.quantity);
    }
  }
  for (const player of Object.values(world.players || {})) {
    for (const inventory of Object.values(player.inventories || {})) {
      assertCommodityFreezeInvariant(inventory);
      if (!(inventory.frozen > 0)) continue;
      // Unknown history remains frozen. Never infer ownership from a current building's quantity.
      if (!inventory.freezes) adoptLegacyCommodityFreeze(inventory, 'legacy', 'unattributed', inventory.frozen);
      const entries = candidates.get(inventory) || [];
      const missing = entries.reduce((sum, entry) => sum + Math.max(0,
        entry.quantity - frozenForSource(inventory, entry.kind, entry.sourceId)), 0);
      if (missing > frozenForSource(inventory, 'legacy', 'unattributed')) continue;
      for (const entry of entries) adoptLegacyCommodityFreeze(inventory, entry.kind, entry.sourceId, entry.quantity);
    }
  }
  return world;
}

function sourceLabel(entry) {
  if (entry.kind === 'production') return facilityNames.get(splitProvinceScopedKey(entry.sourceId).assetId) || entry.sourceId;
  if (entry.kind === 'commercial') return commercialNames.get(splitProvinceScopedKey(entry.sourceId).assetId) || entry.sourceId;
  if (entry.kind === 'contract') return `供货合同 ${entry.sourceId}`;
  if (entry.kind === 'auction') return `拍卖 ${entry.sourceId}`;
  return '历史冻结（待核对来源）';
}

/** Private player projection, delivered with inventory totals in the same assets revision. */
export function createCommodityFreezeClientState(player) {
  const inventoryFreezeDetails = {};
  for (const [key, inventory] of Object.entries(player?.inventories || {})) {
    if (!(inventory.frozen > 0)) continue;
    assertCommodityFreezeInvariant(inventory);
    const entries = inventory.freezes ? Object.values(inventory.freezes)
      : [{ kind: 'legacy', sourceId: 'unattributed', quantity: inventory.frozen }];
    inventoryFreezeDetails[key] = entries.filter((entry) => entry.quantity > 0)
      .map((entry) => ({ kind: entry.kind, sourceId: entry.sourceId, quantity: entry.quantity, label: sourceLabel(entry) }))
      .sort((a, b) => a.kind.localeCompare(b.kind) || a.sourceId.localeCompare(b.sourceId));
  }
  return { inventoryFreezeDetails };
}
