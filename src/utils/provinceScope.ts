import type { EconomyState, ProvinceDefinition } from '../types';

export const DEFAULT_PROVINCE_ID = '110000';

function normalizeProvinceId(game: EconomyState, provinceId: string) {
  return game.provinces.some((province) => province.id === provinceId)
    ? provinceId
    : game.defaultProvinceId || DEFAULT_PROVINCE_ID;
}

function scopedRecord<T>(source: Record<string, T> | undefined, provinceId: string) {
  const prefix = `${provinceId}:`;
  return Object.fromEntries(Object.entries(source || {}).flatMap(([key, value]) => (
    key.startsWith(prefix) ? [[key.slice(prefix.length), value]] : []
  )));
}

export function provinceFor(game: EconomyState, provinceId: string): ProvinceDefinition {
  const selectedProvinceId = normalizeProvinceId(game, provinceId);
  return game.provinces.find((province) => province.id === selectedProvinceId) ?? game.provinces[0];
}

export function scopeEconomyState(game: EconomyState, requestedProvinceId: string): EconomyState {
  const provinceId = normalizeProvinceId(game, requestedProvinceId);
  const inventories = game.provinceInventories?.[provinceId] || {};
  const facilityGroups = game.provinceFacilityGroups?.[provinceId] || [];
  const markets = game.provinceMarkets?.[provinceId] || {};
  const facilityMarkets = game.provinceFacilityMarkets?.[provinceId] || {};
  const allProvinceOrders = game.orders || [];
  const orders = allProvinceOrders.filter((order) => order.provinceId === provinceId);
  const wheatInventory = inventories.wheat || { available: 0, frozen: 0, inTransit: 0 };
  const wheatMarket = markets.wheat;
  const warehouseStoredQuantity = Object.values(inventories).reduce((sum, inventory) => (
    sum + Math.max(0, Number(inventory.available || 0)) + Math.max(0, Number(inventory.frozen || 0))
  ), 0);
  const valuationPrices = {
    ...Object.fromEntries(game.products.map((product) => [
      `commodity:${product.id}`,
      Number(markets[product.id]?.lastTradePrice || 0),
    ])),
    ...Object.fromEntries(game.facilityTypes.map((facility) => [
      `facility:${facility.id}`,
      Number(facilityMarkets[facility.id]?.lastTradePrice || 0),
    ])),
  };
  const optional = game as EconomyState & Record<string, unknown>;
  return {
    ...game,
    allProvinceOrders,
    inventories,
    warehouseStoredQuantity,
    inventoryFreezeDetails: scopedRecord(game.inventoryFreezeDetails, provinceId),
    cycleAutoSaleCounts: scopedRecord(game.cycleAutoSaleCounts, provinceId),
    facilityGroups,
    markets,
    facilityMarkets,
    orders,
    valuationPrices,
    inventory: wheatInventory.available,
    frozenInventory: wheatInventory.frozen,
    marketPrice: Number(wheatMarket?.lastPrice || 0),
    marketPriceHistory: wheatMarket?.priceHistory || [],
    demand: wheatMarket?.demand || game.demand,
    onlineAutoBuyPolicies: scopedRecord(optional.onlineAutoBuyPolicies as Record<string, unknown> | undefined, provinceId),
    onlineAutoSellPolicies: scopedRecord(optional.onlineAutoSellPolicies as Record<string, unknown> | undefined, provinceId),
    onlineAutoBuyManagedOrderIds: scopedRecord(optional.onlineAutoBuyManagedOrderIds as Record<string, unknown> | undefined, provinceId),
    onlineAutoSellManagedOrderIds: scopedRecord(optional.onlineAutoSellManagedOrderIds as Record<string, unknown> | undefined, provinceId),
    factoryAutoOperationPolicies: scopedRecord(optional.factoryAutoOperationPolicies as Record<string, unknown> | undefined, provinceId),
  } as EconomyState;
}
