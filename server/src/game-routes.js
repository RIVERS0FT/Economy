import { requirePlayerActionMetadata } from './player-action-registry.js';

export function decodeRouteParameter(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    const error = new Error('请求路径编码无效');
    error.statusCode = 400;
    throw error;
  }
}

function resolveActionUnchecked(method, path) {
  if (method === 'POST' && path === '/api/game/check-in') return { action: 'checkIn', category: 'general' };
  if (method === 'POST' && path === '/api/game/production/settle') return { action: 'settleProduction', category: 'general' };
  if (method === 'POST' && path === '/api/game/facilities') return { action: 'buildFacility', category: 'general' };
  if (method === 'POST' && path === '/api/game/commercial-buildings') return { action: 'commercialBuilding', category: 'general' };
  if (method === 'POST' && path === '/api/game/facilities/recipes') return { action: 'setFacilityRecipes', category: 'general' };
  if (method === 'POST' && path === '/api/game/research/start') return { action: 'startResearch', category: 'general' };
  if (method === 'POST' && path === '/api/game/research/accelerate') return { action: 'accelerateResearch', category: 'general' };
  if (method === 'POST' && path === '/api/game/orders') return { action: 'placeOrder', category: 'orders' };
  if (method === 'POST' && path === '/api/game/gifts/redeem') return { action: 'redeemGift', category: 'general' };
  if (method === 'POST' && path === '/api/game/gem-shop/exchange') return { action: 'exchangeGems', category: 'general' };
  if (method === 'POST' && path === '/api/game/gem-shop/quote/reject') return { action: 'rejectGemShopQuote', category: 'general' };
  if (method === 'POST' && path === '/api/game/facilities/construction/accelerate') return { action: 'retiredFacilityConstructionAcceleration', category: 'general' };
  if (method === 'POST' && path === '/api/game/bank/deposits') return { action: 'bankDeposit', category: 'general' };
  if (method === 'POST' && path === '/api/game/bank/withdrawals') return { action: 'bankWithdraw', category: 'general' };
  if (method === 'POST' && path === '/api/game/bank/loans') return { action: 'bankBorrow', category: 'general' };
  if (method === 'PATCH' && path === '/api/game/profile') return { action: 'renamePlayer', category: 'general' };
  if (method === 'POST' && path === '/api/game/auctions') return { action: 'createAuction', category: 'orders' };
  if (method === 'POST' && path === '/api/game/contracts') return { action: 'createProductionContract', category: 'orders' };
  if (method === 'POST' && path === '/api/game/provinces/starting') return { action: 'chooseStartingProvince', category: 'general' };
  if (method === 'POST' && path === '/api/game/provinces/unlock') return { action: 'unlockProvince', category: 'general' };
  if (method === 'POST' && path === '/api/game/transport') return { action: 'transportShip', category: 'orders' };

  const bankLoanAction = path.match(/^\/api\/game\/bank\/loans\/([^/]+)\/(repay|auto-repay)$/);
  if (method === 'POST' && bankLoanAction) {
    return {
      action: bankLoanAction[2] === 'repay' ? 'bankRepay' : 'bankSetAutoRepay',
      category: 'general',
      routePayload: { loanId: decodeRouteParameter(bankLoanAction[1]) },
    };
  }


const contractNegotiationCreate = path.match(/^\/api\/game\/contracts\/([^/]+)\/negotiations$/);
if (method === 'POST' && contractNegotiationCreate) {
  return {
    action: 'proposeProductionContractNegotiation',
    category: 'orders',
    routePayload: { contractId: decodeRouteParameter(contractNegotiationCreate[1]) },
  };
}

const contractNegotiationAction = path.match(/^\/api\/game\/contracts\/([^/]+)\/negotiations\/([^/]+)\/(counter|accept|reject|revoke)$/);
if (method === 'POST' && contractNegotiationAction) {
  const actionMap = {
    counter: 'counterProductionContractNegotiation',
    accept: 'acceptProductionContractNegotiation',
    reject: 'rejectProductionContractNegotiation',
    revoke: 'revokeProductionContractNegotiation',
  };
  return {
    action: actionMap[contractNegotiationAction[3]],
    category: 'orders',
    routePayload: {
      contractId: decodeRouteParameter(contractNegotiationAction[1]),
      negotiationId: decodeRouteParameter(contractNegotiationAction[2]),
    },
  };
}

const contractRenewalAction = path.match(/^\/api\/game\/contracts\/([^/]+)\/renewal\/(propose|accept|reject|revoke)$/);
if (method === 'POST' && contractRenewalAction) {
  const actionMap = {
    propose: 'proposeProductionContractRenewal',
    accept: 'acceptProductionContractRenewal',
    reject: 'rejectProductionContractRenewal',
    revoke: 'revokeProductionContractRenewal',
  };
  return {
    action: actionMap[contractRenewalAction[2]],
    category: 'orders',
    routePayload: { contractId: decodeRouteParameter(contractRenewalAction[1]) },
  };
}

const contractAction = path.match(/^\/api\/game\/contracts\/([^/]+)\/(accept|cancel|prepare|fund|auto-reserve|auto-fund|request-termination|terminate-now|repay|auto-repay|lease-fund|lease-auto-fund)$/);
  if (method === 'POST' && contractAction) {
    const actionMap = {
      accept: 'acceptProductionContract',
      cancel: 'cancelProductionContract',
      prepare: 'prepareProductionContract',
      fund: 'fundProductionContract',
      'auto-reserve': 'setProductionContractAutoReserve',
      'auto-fund': 'setProductionContractAutoFund',
      'request-termination': 'requestProductionContractTermination',
      'terminate-now': 'terminateProductionContractNow',
      repay: 'repayPlayerLoan',
      'auto-repay': 'setPlayerLoanAutoRepay',
      'lease-fund': 'fundFacilityLease',
      'lease-auto-fund': 'setFacilityLeaseAutoFund',
    };
    return {
      action: actionMap[contractAction[2]],
      category: 'orders',
      routePayload: { contractId: decodeRouteParameter(contractAction[1]) },
    };
  }

  const auctionBid = path.match(/^\/api\/game\/auctions\/([^/]+)\/bids$/);
  if (method === 'POST' && auctionBid) {
    return { action: 'placeAuctionBid', category: 'orders', routePayload: { auctionId: decodeRouteParameter(auctionBid[1]) } };
  }

  const auctionCancel = path.match(/^\/api\/game\/auctions\/([^/]+)\/cancel$/);
  if (method === 'POST' && auctionCancel) {
    return { action: 'cancelAuction', category: 'orders', routePayload: { auctionId: decodeRouteParameter(auctionCancel[1]) } };
  }


  const facilityAction = path.match(/^\/api\/game\/facilities\/([^/]+)\/(start|pause|stop|list|recipe)$/);
  if (method === 'POST' && facilityAction) {
    const actionMap = {
      start: 'startFacility',
      pause: 'pauseFacility',
      stop: 'pauseFacility',
      list: 'retiredFacilityMarket',
      recipe: 'setFacilityRecipe',
    };
    return {
      action: actionMap[facilityAction[2]],
      category: 'general',
      routePayload: { facilityTypeId: decodeRouteParameter(facilityAction[1]) },
    };
  }

  const listingAction = path.match(/^\/api\/game\/facility-listings\/([^/]+)\/(cancel|buy)$/);
  if (method === 'POST' && listingAction) {
    return {
      action: listingAction[2] === 'cancel' ? 'cancelFacilityListing' : 'retiredFacilityMarket',
      category: 'general',
      routePayload: { listingId: decodeRouteParameter(listingAction[1]) },
    };
  }

  const orderAction = path.match(/^\/api\/game\/orders\/([^/]+)\/cancel$/);
  if (method === 'POST' && orderAction) {
    return { action: 'cancelOrder', category: 'orders', routePayload: { orderId: decodeRouteParameter(orderAction[1]) } };
  }
  return null;
}

export function resolveAction(method, path) {
  const route = resolveActionUnchecked(method, path);
  if (!route) return null;
  const metadata = requirePlayerActionMetadata(route.action);
  return { ...route, category: metadata.rateLimitCategory };
}
