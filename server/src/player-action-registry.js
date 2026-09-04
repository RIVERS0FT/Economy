const LATENCY_CLASS_BUDGETS_MS = Object.freeze({
  local: 250,
  market: 500,
  contract: 750,
});

const ACTIVE_MUTATION_SCOPES = new Set([
  'local-player',
  'factory',
  'profile',
  'contract',
  'facility-listing',
  'auction',
  'order',
  'save-deletion',
]);

function defineAction({
  rateLimitCategory = 'general',
  mutationScope,
  domain = 'general',
  latencyClass = 'local',
  acknowledgement = 'immediate',
  lifecycle = 'active',
  publicRoute = true,
  economicActivity = false,
  rebuildFactoryPolicies = false,
}) {
  if (!['general', 'orders'].includes(rateLimitCategory)) throw new Error(`无效玩家动作限流类别：${rateLimitCategory}`);
  if (lifecycle === 'active' && !ACTIVE_MUTATION_SCOPES.has(mutationScope)) {
    throw new Error(`活动玩家动作缺少显式 Mutation Scope：${mutationScope}`);
  }
  if (lifecycle !== 'active' && mutationScope !== 'none') {
    throw new Error(`退役玩家动作必须使用 none Mutation Scope：${mutationScope}`);
  }
  const latencyBudgetMs = Number(LATENCY_CLASS_BUDGETS_MS[latencyClass]);
  if (!Number.isFinite(latencyBudgetMs) || latencyBudgetMs <= 0) throw new Error(`无效玩家动作延迟等级：${latencyClass}`);
  return Object.freeze({
    rateLimitCategory,
    mutationScope,
    domain,
    latencyClass,
    latencyBudgetMs,
    acknowledgement,
    lifecycle,
    publicRoute,
    economicActivity,
    rebuildFactoryPolicies,
  });
}

function contractAction() {
  return defineAction({
    rateLimitCategory: 'orders',
    mutationScope: 'contract',
    domain: 'contract',
    latencyClass: 'contract',
    economicActivity: true,
  });
}

export const PLAYER_ACTION_REGISTRY = Object.freeze({
  saveDeletionPreflight: defineAction({ mutationScope: 'save-deletion', domain: 'save-deletion', latencyClass: 'market', publicRoute: false }),
  saveDeletion: defineAction({ mutationScope: 'save-deletion', domain: 'save-deletion', latencyClass: 'market', publicRoute: false }),
  checkIn: defineAction({ mutationScope: 'local-player' }),
  settleProduction: defineAction({ mutationScope: 'local-player', domain: 'production' }),
  buildFacility: defineAction({ mutationScope: 'factory', domain: 'facility', latencyClass: 'market', economicActivity: true, rebuildFactoryPolicies: true }),
  commercialBuilding: defineAction({ mutationScope: 'local-player', domain: 'commercial', economicActivity: true }),
  startResearch: defineAction({ mutationScope: 'local-player', domain: 'research', economicActivity: true }),
  accelerateResearch: defineAction({ mutationScope: 'local-player', domain: 'research', economicActivity: true }),
  placeOrder: defineAction({ rateLimitCategory: 'orders', mutationScope: 'order', domain: 'order', latencyClass: 'market', economicActivity: true }),
  redeemGift: defineAction({ mutationScope: 'local-player', economicActivity: true }),
  exchangeGems: defineAction({ mutationScope: 'local-player', economicActivity: true }),
  rejectGemShopQuote: defineAction({ mutationScope: 'local-player' }),
  retiredFacilityConstructionAcceleration: defineAction({ mutationScope: 'none', domain: 'retired', lifecycle: 'retired', acknowledgement: 'retired' }),
  bankDeposit: defineAction({ mutationScope: 'local-player', domain: 'bank', economicActivity: true }),
  bankWithdraw: defineAction({ mutationScope: 'local-player', domain: 'bank', economicActivity: true }),
  bankBorrow: defineAction({ mutationScope: 'local-player', domain: 'bank', economicActivity: true }),
  bankRepay: defineAction({ mutationScope: 'local-player', domain: 'bank', economicActivity: true }),
  bankSetAutoRepay: defineAction({ mutationScope: 'local-player', domain: 'bank', economicActivity: true }),
  renamePlayer: defineAction({ mutationScope: 'profile', domain: 'profile' }),
  createAuction: defineAction({ rateLimitCategory: 'orders', mutationScope: 'auction', domain: 'auction', latencyClass: 'market', economicActivity: true }),
  placeAuctionBid: defineAction({ rateLimitCategory: 'orders', mutationScope: 'auction', domain: 'auction', latencyClass: 'market', economicActivity: true }),
  cancelAuction: defineAction({ rateLimitCategory: 'orders', mutationScope: 'auction', domain: 'auction', latencyClass: 'market', economicActivity: true }),
  createProductionContract: contractAction(),
  acceptProductionContract: contractAction(),
  proposeProductionContractNegotiation: contractAction(),
  counterProductionContractNegotiation: contractAction(),
  acceptProductionContractNegotiation: contractAction(),
  rejectProductionContractNegotiation: contractAction(),
  revokeProductionContractNegotiation: contractAction(),
  cancelProductionContract: contractAction(),
  prepareProductionContract: contractAction(),
  fundProductionContract: contractAction(),
  setProductionContractAutoReserve: contractAction(),
  setProductionContractAutoFund: contractAction(),
  proposeProductionContractRenewal: contractAction(),
  acceptProductionContractRenewal: contractAction(),
  rejectProductionContractRenewal: contractAction(),
  revokeProductionContractRenewal: contractAction(),
  requestProductionContractTermination: contractAction(),
  terminateProductionContractNow: contractAction(),
  repayPlayerLoan: contractAction(),
  setPlayerLoanAutoRepay: contractAction(),
  fundFacilityLease: contractAction(),
  setFacilityLeaseAutoFund: contractAction(),
  chooseStartingProvince: defineAction({ mutationScope: 'local-player', domain: 'province' }),
  unlockProvince: defineAction({ mutationScope: 'local-player', domain: 'province' }),
  transportShip: defineAction({ rateLimitCategory: 'orders', mutationScope: 'local-player', domain: 'transport', latencyClass: 'market' }),
  startFacility: defineAction({ mutationScope: 'factory', domain: 'facility', latencyClass: 'market', economicActivity: true, rebuildFactoryPolicies: true }),
  pauseFacility: defineAction({ mutationScope: 'factory', domain: 'facility', latencyClass: 'market', economicActivity: true, rebuildFactoryPolicies: true }),
  setFacilityRecipe: defineAction({ mutationScope: 'factory', domain: 'facility', latencyClass: 'market', economicActivity: true, rebuildFactoryPolicies: true }),
  setFacilityRecipes: defineAction({ mutationScope: 'factory', domain: 'facility', latencyClass: 'market', economicActivity: true, rebuildFactoryPolicies: true }),
  listFacility: defineAction({ mutationScope: 'none', domain: 'retired', lifecycle: 'retired', acknowledgement: 'retired', publicRoute: false }),
  cancelFacilityListing: defineAction({ mutationScope: 'facility-listing', domain: 'facility-listing', latencyClass: 'market', economicActivity: true }),
  buyFacility: defineAction({ mutationScope: 'none', domain: 'retired', lifecycle: 'retired', acknowledgement: 'retired', publicRoute: false }),
  retiredFacilityMarket: defineAction({ mutationScope: 'none', domain: 'retired', lifecycle: 'retired', acknowledgement: 'retired' }),
  cancelOrder: defineAction({ rateLimitCategory: 'orders', mutationScope: 'order', domain: 'order', latencyClass: 'market', economicActivity: true }),
  collectFacility: defineAction({ mutationScope: 'factory', domain: 'facility', latencyClass: 'market', publicRoute: false, economicActivity: true }),
});

function defineOrderExecution(mutationScope, label) {
  return Object.freeze({ mutationScope, label });
}

export const ORDER_EXECUTION_REGISTRY = Object.freeze({
  '': defineOrderExecution('active-order', 'manual'),
  'online-auto-buy': defineOrderExecution('active-order', 'online-auto-buy'),
  'online-auto-sell': defineOrderExecution('active-order', 'online-auto-sell'),
  'online-auto-sell-policy': defineOrderExecution('local-order-policy', 'online-auto-sell-policy'),
  'online-auto-trade-policy': defineOrderExecution('local-order-policy', 'online-auto-trade-policy'),
  'factory-auto-operation-policy': defineOrderExecution('factory-policy', 'factory-auto-operation-policy'),
  'facility-build-procurement': defineOrderExecution('procurement', 'facility-build-procurement'),
  'facility-build-procurement-cancel': defineOrderExecution('procurement-cancel', 'facility-build-procurement-cancel'),
});

export function getPlayerActionMetadata(action) {
  return PLAYER_ACTION_REGISTRY[String(action || '')] || null;
}

export function requirePlayerActionMetadata(action) {
  const metadata = getPlayerActionMetadata(action);
  if (metadata) return metadata;
  const error = new Error(`玩家动作未登记：${String(action || '')}`);
  error.statusCode = 500;
  error.code = 'PLAYER_ACTION_UNREGISTERED';
  throw error;
}

export function getOrderExecutionMetadata(execution) {
  const key = String(execution || '');
  return ORDER_EXECUTION_REGISTRY[key] || null;
}

export function requireOrderExecutionMetadata(execution) {
  const key = String(execution || '');
  const metadata = getOrderExecutionMetadata(key);
  if (metadata) return metadata;
  const error = new Error(`订单执行方式未登记：${key}`);
  error.statusCode = 400;
  error.code = 'ORDER_EXECUTION_UNREGISTERED';
  throw error;
}

export function isPlayerActionDomain(action, domain) {
  return getPlayerActionMetadata(action)?.domain === domain;
}

export function isEconomicActivityAction(action) {
  return getPlayerActionMetadata(action)?.economicActivity === true;
}

export function rebuildsFactoryPolicies(action) {
  return getPlayerActionMetadata(action)?.rebuildFactoryPolicies === true;
}
