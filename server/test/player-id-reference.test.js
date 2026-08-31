import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createWorld, ensurePlayer, FACILITY_TYPE_CATALOG } from '../src/domain.js';
import { applyAssetAuctionAction, createAssetAuctionClientState } from '../src/asset-auctions.js';
import { applyProductionContractAction, createProductionContractClientState } from '../src/contracts.js';
import { normalizeCommercialContract, publicCommercialContract } from '../src/commercial-contracts.js';
import { matchIncomingOrder } from '../src/order-matching.js';

function addPlayer(world, id, name, now = 1_000) {
  const account = ensurePlayer(world, { id, name }, now);
  account.playerName = name;
  account.credits = 100_000;
  account.frozenCredits = 0;
  return account;
}

function bareOrder({ id, side, ownerId, price, createdAt }) {
  return {
    id,
    assetKind: 'commodity',
    assetId: 'wheat',
    productId: 'wheat',
    provinceId: '110000',
    side,
    ownerType: 'player',
    ownerId,
    price,
    quantity: 1,
    remaining: 1,
    status: 'open',
    createdAt,
    fills: [],
  };
}

test('player orders persist ownerId only and matcher fills do not snapshot counterparty names', () => {
  const state = createWorld(1_000);
  addPlayer(state, 1, '甲');
  const response = applyAction(state, { id: 1 }, 'placeOrder', {
    assetKind: 'commodity', productId: 'wheat', side: 'buy', quantity: 1, price: 0.01,
  }, 2_000, { migrate: false, process: false });
  assert.equal(response.ok, true);
  const stored = state.orders.find((order) => order.ownerType === 'player' && Number(order.ownerId) === 1);
  assert.ok(stored);
  assert.equal(Object.hasOwn(stored, 'ownerName'), false);

  const sell = bareOrder({ id: 'sell', side: 'sell', ownerId: 2, price: 10, createdAt: 1 });
  const buy = bareOrder({ id: 'buy', side: 'buy', ownerId: 1, price: 10, createdAt: 2 });
  const matchWorld = { orders: [sell, buy] };
  matchIncomingOrder({ world: matchWorld, incoming: buy, createdAt: 3, settleTrade: () => {} });
  assert.equal(Object.hasOwn(buy.fills[0], 'counterparty'), false);
  assert.equal(Object.hasOwn(sell.fills[0], 'counterparty'), false);
  assert.equal(buy.fills[0].makerOrderId, sell.id);
  assert.equal(buy.fills[0].takerOrderId, buy.id);
});

test('player auction stores sellerId and resolves the current seller name only in client projection', () => {
  const state = createWorld(1_000);
  const seller = addPlayer(state, 1, '旧卖家');
  addPlayer(state, 2, '买家');
  seller.inventories.wheat.available = 5;
  const created = applyAssetAuctionAction(state, { id: 1 }, 'createAuction', {
    assetKind: 'commodity', assetId: 'wheat', quantity: 2, startingBid: 10, durationHours: 1,
  }, 2_000);
  assert.equal(created.ok, true);
  const auction = state.assetAuctions.at(-1);
  assert.equal(auction.sellerId, 1);
  assert.equal(Object.hasOwn(auction, 'sellerName'), false);
  assert.equal(createAssetAuctionClientState(state, 2, 2_100).assetAuctions.find((item) => item.id === auction.id).sellerName, '旧卖家');

  auction.sellerName = '旧兼容快照';
  seller.playerName = '新卖家';
  assert.equal(createAssetAuctionClientState(state, 2, 2_200).assetAuctions.find((item) => item.id === auction.id).sellerName, '新卖家');
  assert.equal(auction.sellerName, '旧兼容快照', '旧字段只读兼容，不通过投影或改名回写');
});

test('supply contract stores participant IDs while client names follow the current player profile', () => {
  const state = createWorld(1_000);
  const publisher = addPlayer(state, 1, '旧采购方');
  addPlayer(state, 2, '供应方');
  const created = applyProductionContractAction(state, { id: 1 }, 'createProductionContract', {
    kind: 'supply', publisherRole: 'buyer', productId: 'wheat', quantityPerDelivery: 1,
    unitPrice: 10, deliveryIntervalMs: 10 * 60 * 1000, totalDeliveries: 2, firstDeliveryDelayMs: 0,
  }, 2_000);
  assert.equal(created.ok, true);
  const contract = state.productionContracts.at(-1);
  assert.equal(contract.publisherId, 1);
  assert.equal(contract.buyerId, 1);
  assert.equal(Object.hasOwn(contract, 'publisherName'), false);
  assert.equal(Object.hasOwn(contract, 'buyerName'), false);
  assert.equal(Object.hasOwn(contract, 'supplierName'), false);
  let view = createProductionContractClientState(state, 2, 2_100).productionContracts.find((item) => item.id === contract.id);
  assert.equal(view.publisherName, '旧采购方');
  assert.equal(view.buyerName, '旧采购方');

  contract.publisherName = '旧合同快照';
  contract.buyerName = '旧合同快照';
  publisher.playerName = '新采购方';
  view = createProductionContractClientState(state, 2, 2_200).productionContracts.find((item) => item.id === contract.id);
  assert.equal(view.publisherName, '新采购方');
  assert.equal(view.buyerName, '新采购方');
  assert.equal(contract.publisherName, '旧合同快照');
});

test('commercial contract projection derives mutable names from stable participant IDs', () => {
  const state = createWorld(1_000);
  const borrower = addPlayer(state, 1, '旧借款方');
  addPlayer(state, 2, '出借方');
  const facility = FACILITY_TYPE_CATALOG[0];
  const contract = normalizeCommercialContract({
    id: 'loan-1', kind: 'loan', publisherSide: 'borrower', publisherId: 1,
    borrowerId: 1, lenderId: 2, principal: 10, interestRateBps: 500,
    termMs: 24 * 60 * 60 * 1000, facilityTypeId: facility.id, collateralQuantity: 1,
    status: 'active', createdAt: 1_000, acceptedAt: 1_100, dueAt: 2_000,
  });
  assert.equal(Object.hasOwn(contract, 'publisherName'), false);
  assert.equal(Object.hasOwn(contract, 'borrowerName'), false);
  assert.equal(Object.hasOwn(contract, 'lenderName'), false);
  let view = publicCommercialContract(state, contract, 1);
  assert.equal(view.publisherName, '旧借款方');
  assert.equal(view.borrowerName, '旧借款方');
  assert.equal(view.lenderName, '出借方');

  contract.publisherName = '旧合同名称';
  contract.borrowerName = '旧合同名称';
  borrower.playerName = '新借款方';
  view = publicCommercialContract(state, contract, 1);
  assert.equal(view.publisherName, '新借款方');
  assert.equal(view.borrowerName, '新借款方');
});

test('commercial lease normalization does not synthesize player name fields', () => {
  const state = createWorld(1_000);
  addPlayer(state, 1, '出租方');
  addPlayer(state, 2, '承租方');
  const facility = FACILITY_TYPE_CATALOG[0];
  const contract = normalizeCommercialContract({
    id: 'lease-1', kind: 'facility_lease', publisherSide: 'lessor', publisherId: 1,
    lessorId: 1, lesseeId: 2, provinceId: '110000', facilityTypeId: facility.id,
    quantity: 1, rentPerPeriod: 10, periodMs: 24 * 60 * 60 * 1000, totalPeriods: 2,
    firstPeriodDelayMs: 0, status: 'active', createdAt: 1_000, acceptedAt: 1_100, nextDueAt: 2_000,
  });
  assert.equal(Object.hasOwn(contract, 'publisherName'), false);
  assert.equal(Object.hasOwn(contract, 'lessorName'), false);
  assert.equal(Object.hasOwn(contract, 'lesseeName'), false);
  const view = publicCommercialContract(state, contract, 1);
  assert.equal(view.publisherName, '出租方');
  assert.equal(view.lessorName, '出租方');
  assert.equal(view.lesseeName, '承租方');
});
