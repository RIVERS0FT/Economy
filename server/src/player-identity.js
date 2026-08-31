// Stable numeric player IDs are authoritative relations; display names are read-time projections only.
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
