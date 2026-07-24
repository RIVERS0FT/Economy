import { createPopulationAdminSummary } from './population-admin-control.js';

export function getStableAdminSummary(store, user, now = Date.now()) {
  store.requireAdmin(user);
  return store.transaction(() => {
    const { revision, stateJson, world } = store.loadWorld(now);
    store.processWorldIfDue(world, now, user.id, { force: true });
    const openOrders = (world.orders || []).filter((order) => (
      order.remaining > 0 && (order.status === 'open' || order.status === 'partial')
    ));
    const nextRevision = store.saveWorldIfChanged(revision, world, now, stateJson);
    return {
      playerCount: Object.keys(world.players || {}).length,
      openOrderCount: openOrders.length,
      commodityOrderCount: openOrders.filter((order) => order.assetKind !== 'facility').length,
      facilityOrderCount: openOrders.filter((order) => order.assetKind === 'facility').length,
      openAuctionCount: world.assetAuctions.filter((auction) => auction.status === 'open').length,
      openContractCount: (world.productionContracts || []).filter((contract) => (
        contract.status === 'open' || contract.status === 'active'
      )).length,
      worldVersion: Number(world.version || 0),
      revision: nextRevision,
      lastProcessedAt: Number(world.lastProcessedAt || now),
      apiStatus: 'ok',
      populationEconomy: createPopulationAdminSummary(world, now),
    };
  });
}
