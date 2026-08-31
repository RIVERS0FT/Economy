export function normalizePlayerReferenceId(value) {
  const normalized = Number(value);
  return Number.isSafeInteger(normalized) && normalized > 0 ? normalized : null;
}

export function playerById(world, userId) {
  const normalized = normalizePlayerReferenceId(userId);
  return normalized === null ? null : world?.players?.[String(normalized)] || null;
}

export function playerDisplayName(world, userId, fallback = undefined) {
  const normalized = normalizePlayerReferenceId(userId);
  const name = String(playerById(world, normalized)?.playerName || '').trim();
  if (name) return name;
  const fallbackName = fallback === undefined || fallback === null ? '' : String(fallback).trim();
  if (fallbackName) return fallbackName;
  return normalized === null ? '玩家' : `玩家 ${normalized}`;
}
