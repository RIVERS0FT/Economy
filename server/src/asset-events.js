/**
 * Player-facing activity history belongs to the browser only.
 *
 * This cleanup is called immediately before every SQLite write and after
 * loading legacy state. It removes historical presentation data without
 * changing authoritative funds, inventory, facility, order, listing, market
 * or stats.
 */
export function stripPlayerLogs(world) {
  if (!world || typeof world !== 'object') return world;
  world.players ||= {};
  for (const player of Object.values(world.players)) {
    delete player.trades;
    delete player.ledger;
    delete player.assetEvents;
  }
  world.version = 9;
  return world;
}
