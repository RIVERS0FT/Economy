import type { TabId } from '../config/navigation';

export const MAX_PLAYER_PAGE_STACK_DEPTH = 20;

export type ProvinceSection = 'overview' | 'market' | 'commerce' | 'buildings' | 'warehouse';

export type PlayerPageLocation =
  | { type: 'map' }
  | { type: 'tab'; tab: Exclude<TabId, 'map'> }
  | { type: 'province'; provinceId: string; section: ProvinceSection }
  | { type: 'regional-product'; host: 'province' | 'market'; provinceId: string; productId: string }
  | { type: 'regional-commercial'; provinceId: string; commercialTypeId: string }
  | { type: 'regional-facility'; host: 'province' | 'buildings'; provinceId: string; facilityTypeId: string }
  | { type: 'global-market-product'; productId: string }
  | { type: 'global-building'; facilityTypeId: string }
  | { type: 'transport-route'; routeId: string };

export function playerPageLocationForTab(tab: TabId): PlayerPageLocation {
  return tab === 'map' ? { type: 'map' } : { type: 'tab', tab };
}

export function tabForPlayerPageLocation(location: PlayerPageLocation): TabId {
  if (location.type === 'map') return 'map';
  if (location.type === 'tab') return location.tab;
  if (location.type === 'province' || location.type === 'regional-commercial') return 'province';
  if (location.type === 'global-market-product') return 'market';
  if (location.type === 'global-building') return 'buildings';
  if (location.type === 'transport-route') return 'transport';
  if (location.type === 'regional-product') return location.host === 'province' ? 'province' : 'market';
  return location.host === 'province' ? 'province' : 'buildings';
}

export function playerPageLocationKey(location: PlayerPageLocation) {
  if (location.type === 'map') return 'map';
  if (location.type === 'tab') return `tab:${location.tab}`;
  if (location.type === 'province') return `province:${location.provinceId}:${location.section}`;
  if (location.type === 'regional-product') {
    return `regional-product:${location.host}:${location.provinceId}:${location.productId}`;
  }
  if (location.type === 'regional-commercial') {
    return `regional-commercial:${location.provinceId}:${location.commercialTypeId}`;
  }
  if (location.type === 'regional-facility') {
    return `regional-facility:${location.host}:${location.provinceId}:${location.facilityTypeId}`;
  }
  if (location.type === 'global-market-product') return `global-market-product:${location.productId}`;
  if (location.type === 'transport-route') return `transport-route:${location.routeId}`;
  return `global-building:${location.facilityTypeId}`;
}

export function appendPlayerPageHistory(
  history: readonly PlayerPageLocation[],
  current: PlayerPageLocation,
) {
  const maximumHistoryDepth = MAX_PLAYER_PAGE_STACK_DEPTH - 1;
  const next = [...history, current];
  if (next.length <= maximumHistoryDepth) return next;

  if (next[0]?.type === 'map' && maximumHistoryDepth > 1) {
    return [next[0], ...next.slice(-(maximumHistoryDepth - 1))];
  }
  return next.slice(-maximumHistoryDepth);
}
