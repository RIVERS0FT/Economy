import type { EconomyState } from '../types';
import { operationalFacilityGroups } from './operationalFacilityGroups.js';

/** Province-scoped records are authoritative; the selected-province compatibility view is never double counted. */
export function overviewOperations(game: EconomyState) {
  const validProvinces = new Set((game.provinces ?? []).map((province) => province.id));
  const facilities = { total: 0, running: 0, error: 0, stopped: 0 };
  for (const group of operationalFacilityGroups(game)) {
    const count = Math.max(0, group.count);
    facilities.total += count;
    facilities[group.status] += count;
  }
  return {
    facilities,
    commercialCount: (game.commercialBuildingGroups ?? []).reduce((sum, group) => (
      sum + (validProvinces.has(group.provinceId) ? Math.max(0, group.count) : 0)
    ), 0),
    routeCount: game.transportRoutes?.length ?? 0,
    activeContracts: game.productionContractSummary?.active ?? 0,
  };
}
