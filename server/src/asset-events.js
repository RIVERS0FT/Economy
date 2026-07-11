/**
 * Player-facing activity history belongs to the browser only.
 *
 * This cleanup runs after loading legacy state and immediately before every
 * SQLite write. It removes historical presentation data without changing any
 * authoritative funds, inventory, facility, order, listing, market or stats.
 */
export function stripPlayerLogs(world) {
  if (!world || typeof world !== 'object') return world;
  world.players ||= {};
  for (const player of Object.values(world.players)) {
    delete player.trades;
    delete player.ledger;
    delete player.assetEvents;
  }
  world.version = 3;
  return world;
}
