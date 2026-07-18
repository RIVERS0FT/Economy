import { processCollectibleAuctions } from './collectibles.js';
import { processFacilityGroupWorld } from './facility-groups.js';
import { installLeaderboardStoreHooks, prepareLeaderboardStore } from './leaderboards.js';
import { EconomyStore } from './storage.js';

installLeaderboardStoreHooks(EconomyStore);

export function getStableAdminSummary(store, user, now = Date.now()) {
  store.requireAdmin(user);
  prepareLeaderboardStore(store, user, now);
  return store.transaction(() => {
    const { revision, stateJson, world } = store.loadWorld(now);
    processFacilityGroupWorld(world, now);
    processCollectibleAuctions(world, now);
    const openOrders = (world.orders || []).filter((order) => (
      order.remaining > 0 && (order.status === 'open' || order.status === 'partial')
    ));
    const nextRevision = store.saveWorldIfChanged(revision, world, now, stateJson);
    return {
      playerCount: Object.keys(world.players || {}).length,
      openOrderCount: openOrders.length,
      commodityOrderCount: openOrders.filter((order) => order.assetKind !== 'facility').length,
      facilityOrderCount: openOrders.filter((order) => order.assetKind === 'facility').length,
      collectibleCount: world.collectibles.length,
      openAuctionCount: world.collectibleAuctions.filter((auction) => auction.status === 'open').length,
      worldVersion: Number(world.version || 0),
      revision: nextRevision,
      lastProcessedAt: Number(world.lastProcessedAt || now),
      apiStatus: 'ok',
    };
  });
}
