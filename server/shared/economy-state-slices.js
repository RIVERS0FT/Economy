// Slice revisions are transport metadata inside the existing player/market partitions.
// They never create field-level server patches or another EconomyState partition.
// Server delivery still replaces the complete parent partition snapshot when that partition changes.
export const STATE_SLICE_DEFINITIONS = Object.freeze({
  'player.identity': Object.freeze({
    partition: 'player',
    keys: Object.freeze(['userId', 'playerName', 'registeredAt', 'saveEpoch', 'commodityName']),
  }),
  'player.assets': Object.freeze({
    partition: 'player',
    keys: Object.freeze([
      'credits',
      'frozenCredits',
      'gems',
      'inventories',
      'provinceInventories',
      'provinceAssetSummaries',
      'warehouseStoredQuantity',
      'assetSummary',
      'onlineAutoBuyPolicies',
      'onlineAutoSellPolicies',
      'onlineAutoBuyManagedOrderIds',
      'onlineAutoSellManagedOrderIds',
      'inventoryFreezeSources',
      'inventory',
      'frozenInventory',
    ]),
  }),
  'player.production': Object.freeze({
    partition: 'player',
    keys: Object.freeze([
      'facilityGroups',
      'provinceFacilityGroups',
      'facilityConstruction',
      'factoryAutoOperationPolicies',
      'commercialBuildingGroups',
    ]),
  }),
  'player.progression': Object.freeze({
    partition: 'player',
    keys: Object.freeze(['research', 'work', 'checkIn']),
  }),
  'player.bank': Object.freeze({
    partition: 'player',
    keys: Object.freeze(['bankAccount', 'bankSummary']),
  }),
  'player.stats': Object.freeze({
    partition: 'player',
    keys: Object.freeze(['stats', 'lastProcessedAt']),
  }),
  'player.misc': Object.freeze({
    partition: 'player',
    keys: Object.freeze(['transportRoutes', 'transportShipments']),
    fallback: true,
  }),
  'market.orders': Object.freeze({
    partition: 'market',
    keys: Object.freeze(['orders', 'facilityListings']),
  }),
  'market.quotes': Object.freeze({
    partition: 'market',
    keys: Object.freeze([
      'markets',
      'provinceMarkets',
      'facilityMarkets',
      'provinceFacilityMarkets',
      'valuationPrices',
      'marketPrice',
      'marketPriceHistory',
      'demand',
    ]),
  }),
  'market.calendar': Object.freeze({
    partition: 'market',
    keys: Object.freeze(['economicCalendar']),
  }),
  'market.misc': Object.freeze({ partition: 'market', keys: Object.freeze([]), fallback: true }),
});

export const STATE_SLICE_NAMES = Object.freeze(Object.keys(STATE_SLICE_DEFINITIONS));

export const STATE_SLICE_NAMES_BY_PARTITION = Object.freeze({
  player: Object.freeze(STATE_SLICE_NAMES.filter((name) => STATE_SLICE_DEFINITIONS[name].partition === 'player')),
  market: Object.freeze(STATE_SLICE_NAMES.filter((name) => STATE_SLICE_DEFINITIONS[name].partition === 'market')),
});

const EXPLICIT_SLICE_BY_PARTITION_KEY = Object.freeze(Object.fromEntries(
  Object.entries(STATE_SLICE_DEFINITIONS)
    .filter(([, definition]) => definition.fallback !== true)
    .flatMap(([name, definition]) => definition.keys.map((key) => [`${definition.partition}:${key}`, name])),
));

export function stateSliceNameForKey(partitionName, key) {
  const explicit = EXPLICIT_SLICE_BY_PARTITION_KEY[`${partitionName}:${key}`];
  if (explicit) return explicit;
  if (partitionName === 'player' || partitionName === 'market') return `${partitionName}.misc`;
  return null;
}
