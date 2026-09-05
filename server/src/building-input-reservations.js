import { COMMERCIAL_BUILDING_TYPE_CATALOG } from './commercial-buildings.js';
import { productionReservedQuantitiesForPlayer } from './facility-groups.js';
import { normalizeProvinceId } from './provinces.js';

const commercialTypes = new Map(COMMERCIAL_BUILDING_TYPE_CATALOG.map((type) => [type.id, type]));

/** One next operating cycle is protected even when automatic procurement is disabled. */
export function commercialInputReservations(player, provinceId) {
  const reserved = {};
  const selectedProvinceId = normalizeProvinceId(provinceId);
  for (const group of player?.commercialBuildingGroups || []) {
    if (!group.enabled || normalizeProvinceId(group.provinceId) !== selectedProvinceId) continue;
    const type = commercialTypes.get(group.commercialTypeId);
    const count = Number(group.count);
    if (!type || !Number.isSafeInteger(count) || count < 1) continue;
    for (const input of type.consumptionInputs) {
      reserved[input.productId] = (reserved[input.productId] || 0) + input.quantity * count;
    }
  }
  return reserved;
}

/** Shared inventory protection only, not shared production/asset eligibility. */
export function buildingReservedQuantitiesForPlayer(world, userId, provinceId) {
  const reserved = { ...productionReservedQuantitiesForPlayer(world, userId, provinceId) };
  for (const [productId, quantity] of Object.entries(commercialInputReservations(world.players?.[String(userId)], provinceId))) {
    reserved[productId] = (reserved[productId] || 0) + quantity;
  }
  return reserved;
}
