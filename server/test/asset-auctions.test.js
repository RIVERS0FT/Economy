import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAssetAuctionAction,
  createAssetAuctionClientState,
  migrateAssetAuctionWorld,
  processAssetAuctions,
} from '../src/asset-auctions.js';
import { createWorld, ensurePlayer } from '../src/domain.js';
import {
  createFacilityGroupClientState,
  migrateFacilityGroupWorld,
} from '../src/facility-groups.js';
import { createWarehouseUsage, ensureWarehouse } from '../src/warehouse.js';

const seller = { id: 1, name: '卖家' };
const bidderA = { id: 2, name: '买家甲' };
const bidderB = { id: 3, name: '买家乙' };

function world(now = 1_000) {
  const state = createWorld(now);
  for (const user of [seller, bidderA, bidderB]) {
    const account = ensurePlayer(state, user, now);
    account.playerName = user.name;
    account.credits = user.id === 1 ? 100 : 500;
    account.frozenCredits = 0;
    ensureWarehouse(account);
  }
  migrateAssetAuctionWorld(state, now);
  migrateFacilityGroupWorld(state, now);
  return state;
}

function createAuction(state, user, payload, now = 2_000) {
  return applyAssetAuctionAction(state, user, 'createAuction', payload, now);
}

function bid(state, user, auctionId, amount, now) {
  return applyAssetAuctionAction(state, user, 'placeAuctionBid', { auctionId, amount }, now);
}

test('商品拍卖冻结商品、为最高出价者预占仓库并在成交后转移数量', () => {
  const state = world();
  state.players['1'].inventories.wheat.available = 10;
  const priceHistoryLength = state.markets.wheat.priceHistory.length;

  const created = createAuction(state, seller, {
    assetKind: 'commodity',
    assetId: 'wheat',
    quantity: 4,
    startingBid: 80,
    durationHours: 1,
  });
  assert.equal(created.ok, true);
  assert.deepEqual(state.players['1'].inventories.wheat, { available: 6, frozen: 4 });
  const auction = state.assetAuctions.at(-1);

  assert.equal(bid(state, bidderA, auction.id, 90, 3_000).ok, true);
  assert.equal(createWarehouseUsage(state, state.players['2']).warehouseReservedQuantity, 4);
  assert.equal(bid(state, bidderB, auction.id, 110, 4_000).ok, true);
  assert.equal(createWarehouseUsage(state, state.players['2']).warehouseReservedQuantity, 0);
  assert.equal(createWarehouseUsage(state, state.players['3']).warehouseReservedQuantity, 4);

  processAssetAuctions(state, auction.endsAt + 1);
  assert.equal(auction.status, 'sold');
  assert.equal(state.players['1'].inventories.wheat.frozen, 0);
  assert.equal(state.players['3'].inventories.wheat.available, 4);
  assert.equal(state.players['1'].credits, 210);
  assert.equal(state.players['3'].frozenCredits, 0);
  assert.equal(state.markets.wheat.priceHistory.length, priceHistoryLength, '拍卖成交不得写入订单簿行情');
});

test('商品竞拍必须有足够仓库容量，取消无出价拍卖释放商品', () => {
  const state = world();
  state.players['1'].inventories.rice.available = 5;
  state.players['2'].inventoryCapacity = 500;
  state.players['2'].inventories.wheat.available = 500;
  const created = createAuction(state, seller, {
    assetKind: 'commodity', assetId: 'rice', quantity: 3, startingBid: 20, durationHours: 2,
  });
  assert.equal(created.ok, true);
  const auction = state.assetAuctions.at(-1);
  const failedBid = bid(state, bidderA, auction.id, 20, 3_000);
  assert.equal(failedBid.ok, false);
  assert.match(failedBid.message, /仓库/);

  const cancelled = applyAssetAuctionAction(state, seller, 'cancelAuction', { auctionId: auction.id }, 4_000);
  assert.equal(cancelled.ok, true);
  assert.deepEqual(state.players['1'].inventories.rice, { available: 5, frozen: 0 });
  assert.equal(auction.escrowStatus, 'released');
});

test('工厂拍卖冻结运行数量，成交后转移工厂且不写入工厂行情', () => {
  const state = world();
  state.players['1'].credits = 10_000;
  state.players['1'].facilityGroups = [{
    facilityTypeId: 'farm',
    count: 3,
    participatingCount: 3,
    pendingJoinCount: 0,
    enabled: true,
    status: 'running',
    cycleStartedAt: 1_000,
    lifetimeOutput: 0,
  }];
  migrateFacilityGroupWorld(state, 1_500);
  state.facilityMarkets.farm.lastTradePrice = 77;
  const historyLength = state.facilityMarkets.farm.priceHistory.length;

  const created = createAuction(state, seller, {
    assetKind: 'facility', assetId: 'farm', quantity: 2, startingBid: 200, durationHours: 1,
  });
  assert.equal(created.ok, true);
  const sellerGroup = state.players['1'].facilityGroups.find((group) => group.facilityTypeId === 'farm');
  assert.equal(sellerGroup.participatingCount, 1);
  const clientGroup = createFacilityGroupClientState(state, 1, 2_100).facilityGroups.find((group) => group.facilityTypeId === 'farm');
  assert.equal(clientGroup.auctionedCount, 2);
  assert.equal(clientGroup.availableCount, 1);

  const auction = state.assetAuctions.at(-1);
  assert.equal(bid(state, bidderA, auction.id, 220, 3_000).ok, true);
  processAssetAuctions(state, auction.endsAt + 1);
  assert.equal(auction.status, 'sold');
  assert.equal(state.players['1'].facilityGroups.find((group) => group.facilityTypeId === 'farm').count, 1);
  assert.equal(state.players['2'].facilityGroups.find((group) => group.facilityTypeId === 'farm').count, 2);
  assert.equal(state.facilityMarkets.farm.priceHistory.length, historyLength);
  assert.equal(state.facilityMarkets.farm.lastTradePrice, 77);
});

test('商品与工厂资产包整体冻结并原子成交', () => {
  const state = world();
  state.players['1'].inventories.wheat.available = 6;
  state.players['1'].inventories.rice.available = 3;
  state.players['1'].facilityGroups = [{
    facilityTypeId: 'farm', count: 2, participatingCount: 2, pendingJoinCount: 0,
    enabled: true, status: 'running', cycleStartedAt: 1_000, lifetimeOutput: 0,
  }];
  migrateFacilityGroupWorld(state, 1_500);

  const created = createAuction(state, seller, {
    items: [
      { assetKind: 'commodity', assetId: 'wheat', quantity: 2 },
      { assetKind: 'commodity', assetId: 'wheat', quantity: 1 },
      { assetKind: 'commodity', assetId: 'rice', quantity: 2 },
      { assetKind: 'facility', assetId: 'farm', quantity: 1 },
    ],
    startingBid: 100,
    durationHours: 1,
  });
  assert.equal(created.ok, true);
  const auction = state.assetAuctions.at(-1);
  assert.equal(auction.items.length, 3, '重复商品项目应合并');
  assert.equal(auction.items.find((item) => item.assetId === 'wheat').quantity, 3);
  assert.deepEqual(state.players['1'].inventories.wheat, { available: 3, frozen: 3 });
  assert.deepEqual(state.players['1'].inventories.rice, { available: 1, frozen: 2 });
  assert.equal(state.players['1'].facilityGroups[0].participatingCount, 1);

  assert.equal(bid(state, bidderA, auction.id, 120, 3_000).ok, true);
  assert.equal(createWarehouseUsage(state, state.players['2']).warehouseReservedQuantity, 5);
  processAssetAuctions(state, auction.endsAt + 1);

  assert.equal(auction.status, 'sold');
  assert.equal(auction.escrowStatus, 'transferred');
  assert.equal(state.players['2'].inventories.wheat.available, 3);
  assert.equal(state.players['2'].inventories.rice.available, 2);
  assert.equal(state.players['2'].facilityGroups.find((group) => group.facilityTypeId === 'farm').count, 1);
});

test('客户端只返回商品与工厂通用资产拍卖', () => {
  const state = world();
  state.players['1'].inventories.wheat.available = 2;
  createAuction(state, seller, {
    assetKind: 'commodity', assetId: 'wheat', quantity: 2, startingBid: 20, durationHours: 2,
  });
  const client = createAssetAuctionClientState(state, 1, 2_200);
  assert.equal(client.assetAuctions.length, 1);
  assert.equal(client.assetAuctions[0].assetKind, 'commodity');
  assert.equal(client.assetAuctions[0].quantity, 2);
  assert.equal(Object.hasOwn(client, 'collectibles'), false);
  assert.equal(Object.hasOwn(client, 'collectibleAuctions'), false);
});

test('世界 15 迁移保留纯资产拍卖并整包取消含藏品的开放拍卖', () => {
  const state = world();
  const sellerAccount = state.players['1'];
  const bidder = state.players['2'];
  sellerAccount.inventories.wheat.available = 6;
  sellerAccount.inventories.wheat.frozen = 4;
  sellerAccount.facilityGroups = [{
    facilityTypeId: 'farm', count: 2, participatingCount: 1, pendingJoinCount: 0,
    enabled: true, status: 'running', cycleStartedAt: 1_000, lifetimeOutput: 0,
  }];
  bidder.credits = 410;
  bidder.frozenCredits = 90;

  const pureAuction = {
    id: 'legacy-pure',
    items: [{ assetKind: 'commodity', assetId: 'rice', quantity: 2 }],
    sellerId: 1,
    sellerName: '卖家',
    startingBid: 20,
    highestBid: null,
    highestBidderId: null,
    highestBidderName: null,
    status: 'open',
    escrowStatus: 'held',
    createdAt: 1_000,
    endsAt: 99_000,
    bids: [],
  };
  const mixedAuction = {
    id: 'legacy-mixed',
    items: [
      { assetKind: 'collectible', assetId: 'collectible-1', quantity: 1 },
      { assetKind: 'commodity', assetId: 'wheat', quantity: 4 },
      { assetKind: 'facility', assetId: 'farm', quantity: 1 },
    ],
    sellerId: 1,
    sellerName: '卖家',
    startingBid: 80,
    highestBid: 90,
    highestBidderId: 2,
    highestBidderName: '买家甲',
    status: 'open',
    escrowStatus: 'held',
    createdAt: 1_000,
    endsAt: 99_000,
    bids: [],
  };
  state.version = 14;
  state.collectibles = [{ id: 'collectible-1', currentOwnerId: 1 }];
  state.collectibleOwnershipHistory = [{ id: 'ownership-1' }];
  state.collectibleAuctions = [pureAuction, mixedAuction];
  delete state.assetAuctions;

  migrateAssetAuctionWorld(state, 5_000);

  assert.equal(state.version, 15);
  assert.deepEqual(state.assetAuctions.map((auction) => auction.id), ['legacy-pure']);
  assert.equal(bidder.credits, 500);
  assert.equal(bidder.frozenCredits, 0);
  assert.deepEqual(sellerAccount.inventories.wheat, { available: 10, frozen: 0 });
  assert.equal(sellerAccount.facilityGroups[0].pendingJoinCount, 1);
  assert.equal(Object.hasOwn(state, 'collectibles'), false);
  assert.equal(Object.hasOwn(state, 'collectibleOwnershipHistory'), false);
  assert.equal(Object.hasOwn(state, 'collectibleAuctions'), false);

  const once = structuredClone(state);
  migrateAssetAuctionWorld(state, 6_000);
  assert.deepEqual(state, once, '迁移重复执行不得再次退款或改变拍卖');
});

test('世界 15 迁移按稳定 ID 去重并优先保留 assetAuctions 记录', () => {
  const state = world();
  const legacy = {
    id: 'same-id', assetKind: 'commodity', assetId: 'wheat', quantity: 1,
    sellerId: 1, sellerName: '旧记录', startingBid: 10, status: 'ended', createdAt: 1, endsAt: 2,
  };
  const current = {
    ...legacy,
    items: [{ assetKind: 'facility', assetId: 'farm', quantity: 1 }],
    sellerName: '新记录',
  };
  state.collectibleAuctions = [legacy];
  state.assetAuctions = [current];
  migrateAssetAuctionWorld(state, 5_000);
  assert.equal(state.assetAuctions.length, 1);
  assert.equal(state.assetAuctions[0].sellerName, '新记录');
  assert.equal(state.assetAuctions[0].assetKind, 'facility');
});
