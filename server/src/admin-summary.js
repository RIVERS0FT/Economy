import { createPopulationAdminSummary } from './population-admin-control.js';
import { measureRequestPhase } from './request-performance.js';

function buildAdminSummary(store, world, revision, now) {
  let openOrderCount = 0;
  let commodityOrderCount = 0;
  let facilityOrderCount = 0;
  for (const order of world.orders || []) {
    if (!(Number(order?.remaining) > 0) || !['open', 'partial'].includes(order?.status)) continue;
    openOrderCount += 1;
    if (order.assetKind === 'facility') facilityOrderCount += 1;
    else commodityOrderCount += 1;
  }

  return {
    playerCount: Object.keys(world.players || {}).length,
    openOrderCount,
    commodityOrderCount,
    facilityOrderCount,
    openAuctionCount: (world.assetAuctions || []).filter((auction) => auction.status === 'open').length,
    openContractCount: (world.productionContracts || []).filter((contract) => (
      contract.status === 'open' || contract.status === 'active'
    )).length,
    worldVersion: Number(world.version || 0),
    revision: Number(revision),
    lastProcessedAt: Number(world.lastProcessedAt || now),
    apiStatus: 'ok',
    authoritativeWriteExecutor: store.getAuthoritativeWriteDiagnostics(),
    populationEconomy: createPopulationAdminSummary(world, now),
  };
}

function committedWorldForAdminSummary(store, now) {
  if (store.worldCache?.world) {
    return {
      revision: Number(store.worldCache.revision),
      world: store.worldCache.world,
    };
  }
  return store.transaction(() => {
    const { revision, world } = store.loadWorld(now);
    return { revision: Number(revision), world };
  }, { immediate: false });
}

export function getStableAdminSummary(store, user, now = Date.now()) {
  store.requireAdmin(user);
  const { revision, world } = committedWorldForAdminSummary(store, now);
  return measureRequestPhase('adminSummaryProjectionMs', () => (
    buildAdminSummary(store, world, revision, now)
  ));
}
