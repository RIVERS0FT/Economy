export function decodeRouteParameter(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    const error = new Error('请求路径编码无效');
    error.statusCode = 400;
    throw error;
  }
}

export function resolveAction(method, path) {
  if (method === 'POST' && path === '/api/game/work') return { action: 'work', category: 'general' };
  if (method === 'POST' && path === '/api/game/facilities') return { action: 'buildFacility', category: 'general' };
  if (method === 'POST' && path === '/api/game/orders') return { action: 'placeOrder', category: 'orders' };
  if (method === 'POST' && path === '/api/game/warehouse/upgrade') return { action: 'upgradeWarehouse', category: 'general' };
  if (method === 'POST' && path === '/api/game/gifts/redeem') return { action: 'redeemGift', category: 'general' };
  if (method === 'POST' && path === '/api/game/gem-shop/exchange') return { action: 'exchangeGems', category: 'general' };
  if (method === 'PATCH' && path === '/api/game/profile') return { action: 'renamePlayer', category: 'general' };
  if (method === 'POST' && path === '/api/game/auctions') return { action: 'createAuction', category: 'orders' };
  if (method === 'POST' && path === '/api/game/contracts') return { action: 'createProductionContract', category: 'orders' };

  const contractAction = path.match(/^\/api\/game\/contracts\/([^/]+)\/(accept|cancel|prepare|fund|auto-reserve|auto-fund|request-termination|terminate-now)$/);
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

  if (method === 'POST' && path === '/api/game/collectible-auctions') {
    return { action: 'createCollectibleAuction', category: 'orders' };
  }

  const collectibleBid = path.match(/^\/api\/game\/collectible-auctions\/([^/]+)\/bids$/);
  if (method === 'POST' && collectibleBid) {
    return { action: 'placeCollectibleBid', category: 'orders', routePayload: { auctionId: decodeRouteParameter(collectibleBid[1]) } };
  }

  const collectibleCancel = path.match(/^\/api\/game\/collectible-auctions\/([^/]+)\/cancel$/);
  if (method === 'POST' && collectibleCancel) {
    return { action: 'cancelCollectibleAuction', category: 'orders', routePayload: { auctionId: decodeRouteParameter(collectibleCancel[1]) } };
  }

  const facilityAction = path.match(/^\/api\/game\/facilities\/([^/]+)\/(start|pause|stop|list|recipe)$/);
  if (method === 'POST' && facilityAction) {
    const actionMap = {
      start: 'startFacility',
      pause: 'pauseFacility',
      stop: 'pauseFacility',
      list: 'listFacility',
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
      action: listingAction[2] === 'cancel' ? 'cancelFacilityListing' : 'buyFacility',
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
