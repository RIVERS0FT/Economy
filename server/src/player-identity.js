// Stable numeric player IDs are authoritative relations; current display names are resolved only at DTO projection or immutable audit-snapshot boundaries.
export function playerDisplayName(world, userId, fallback = '玩家') {
  const id = Number(userId);
  if (!Number.isSafeInteger(id) || id <= 0) return fallback;
  const name = String(world?.players?.[String(id)]?.playerName || '').trim();
  return name || fallback;
}

export function optionalPlayerDisplayName(world, userId, fallback = '玩家') {
  const id = Number(userId);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return playerDisplayName(world, id, fallback);
}

export function stripMutablePlayerIdentityMirrors(world) {
  if (!world || typeof world !== 'object') return world;
  for (const order of Array.isArray(world.orders) ? world.orders : []) {
    if (order?.ownerType === 'player') delete order.ownerName;
    for (const fill of Array.isArray(order?.fills) ? order.fills : []) delete fill.counterparty;
  }
  for (const listing of Array.isArray(world.facilityListings) ? world.facilityListings : []) {
    if (listing?.ownerType === 'player') delete listing.ownerName;
  }
  return world;
}
