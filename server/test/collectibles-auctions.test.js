import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyCollectibleAction,
  createCollectibleClientState,
  importCollectibles,
  migrateCollectibleWorld,
  processCollectibleAuctions,
} from '../src/collectibles.js';
import { createWorld, ensurePlayer } from '../src/domain.js';
import {
  createFacilityGroupClientState,
  migrateFacilityGroupWorld,
} from '../src/facility-groups.js';
import { createWarehouseUsage, ensureWarehouse } from '../src/warehouse.js';

const admin = { id: 1, role: 'admin' };
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
  migrateFacilityGroupWorld(state, now);
  migrateCollectibleWorld(state, now);
  return state;
}

function importOne(state, now = 1_000) {
  return importCollectibles(state, admin, {
    items: [{
      sourceArtworkId: 28560,
      title: 'The Bedroom',
      artist: 'Vincent van Gogh',
      imageId: 'f92c2f24-80da-4c1f-e3c5-3a20f889a270',
      isPublicDomain: true,
      initialOwnerId: 1,
    }],
  }, now);
}

function createAuction(state, user, payload, now = 2_000) {
  return applyCollectibleAction(state, user, 'createAuction', payload, now);
}

function bid(state, user, auctionId, amount, now) {
  return applyCollectibleAction(state, user, 'placeAuctionBid', { auctionId, amount }, now);
}

test('管理员导入芝加哥艺术博物馆公版藏品并记录初始归属', () => {
  const state = world();
  const imported = importOne(state);
  assert.equal(imported.importedCount, 1);
  assert.equal(state.collectibles[0].currentOwnerId, 1);
  assert.equal(state.collectibleOwnershipHistory.length, 1);
  assert.equal(state.collectibleOwnershipHistory[0].reason, 'assigned');
  assert.match(imported.collectibles[0].imageUrl, /^https:\/\/www\.artic\.edu\/iiif\/2\//);
});

test('旧藏品拍卖动作兼容冻结、超价退款与归属转移', () => {
  const state = world();
  importOne(state, 1_000);
  const collectibleId = state.collectibles[0].id;

  let response = applyCollectibleAction(state, seller, 'createCollectibleAuction', {
    collectibleId,
    startingBid: 100,
    durationHours: 1,
  }, 2_000);
  assert.equal(response.ok, true);
  const auctionId = state.collectibleAuctions[0].id;
  assert.equal(state.collectibleAuctions[0].assetKind, 'collectible');

  response = applyCollectibleAction(state, bidderA, 'placeCollectibleBid', { auctionId, amount: 120 }, 3_000);
  assert.equal(response.ok, true);
  assert.equal(state.players['2'].credits, 380);
  assert.equal(state.players['2'].frozenCredits, 120);

  response = applyCollectibleAction(state, bidderB, 'placeCollectibleBid', { auctionId, amount: 150 }, 4_000);
  assert.equal(response.ok, true);
  assert.equal(state.players['2'].credits, 500);
  assert.equal(state.players['2'].frozenCredits, 0);
  assert.equal(state.players['3'].credits, 350);
  assert.equal(state.players['3'].frozenCredits, 150);

  processCollectibleAuctions(state, 2_000 + 60 * 60 * 1_000 + 1);
  assert.equal(state.collectibleAuctions[0].status, 'sold');
  assert.equal(state.collectibleAuctions[0].escrowStatus, 'transferred');
  assert.equal(state.collectibles[0].currentOwnerId, 3);
  assert.equal(state.players['1'].credits, 250);
  assert.equal(state.players['3'].frozenCredits, 0);
  assert.equal(state.collectibleOwnershipHistory.at(-1).reason, 'auction');
  assert.equal(state.collectibleOwnershipHistory.at(-1).price, 150);
});

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
  const auction = state.collectibleAuctions.at(-1);

  assert.equal(bid(state, bidderA, auction.id, 90, 3_000).ok, true);
  assert.equal(createWarehouseUsage(state, state.players['2']).warehouseReservedQuantity, 4);
  assert.equal(bid(state, bidderB, auction.id, 110, 4_000).ok, true);
  assert.equal(createWarehouseUsage(state, state.players['2']).warehouseReservedQuantity, 0);
  assert.equal(createWarehouseUsage(state, state.players['3']).warehouseReservedQuantity, 4);

  processCollectibleAuctions(state, auction.endsAt + 1);
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
  const auction = state.collectibleAuctions.at(-1);
  assert.equal(bid(state, bidderA, auction.id, 20, 3_000).ok, false);
  assert.match(bid(state, bidderA, auction.id, 20, 3_000).message, /仓库/);

  const cancelled = applyCollectibleAction(state, seller, 'cancelAuction', { auctionId: auction.id }, 4_000);
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
  const historyLength = state.facilityMarkets.farm.priceHistory.length;

  const created = createAuction(state, seller, {
    assetKind: 'facility', assetId: 'farm', quantity: 2, startingBid: 200, durationHours: 1,
  });
  assert.equal(created.ok, true);
  const sellerGroup = state.players['1'].facilityGroups.find((group) => group.facilityTypeId === 'farm');
  assert.equal(sellerGroup.participatingCount, 1);
  const clientGroup = createFacilityGroupClientState(state, 1, 2_100).facilityGroups.find((group) => group.facilityTypeId === 'farm');
  assert.equal(clientGroup.auctionedCount, 2);
  assert.equal(clientGroup.frozenCount, 2);
  assert.equal(clientGroup.availableCount, 1);

  const auction = state.collectibleAuctions.at(-1);
  assert.equal(bid(state, bidderA, auction.id, 220, 3_000).ok, true);
  processCollectibleAuctions(state, auction.endsAt + 1);
  assert.equal(auction.status, 'sold');
  assert.equal(state.players['1'].facilityGroups.find((group) => group.facilityTypeId === 'farm').count, 1);
  assert.equal(state.players['2'].facilityGroups.find((group) => group.facilityTypeId === 'farm').count, 2);
  assert.equal(state.facilityMarkets.farm.priceHistory.length, historyLength, '拍卖成交不得写入订单簿行情');
});

test('客户端状态同时提供通用拍卖与藏品兼容别名', () => {
  const state = world();
  importOne(state, 1_000);
  state.players['1'].inventories.wheat.available = 2;
  createAuction(state, seller, {
    assetKind: 'collectible', assetId: state.collectibles[0].id, quantity: 1, startingBid: 88, durationHours: 2,
  });
  createAuction(state, seller, {
    assetKind: 'commodity', assetId: 'wheat', quantity: 2, startingBid: 20, durationHours: 2,
  }, 2_100);
  const client = createCollectibleClientState(state, 1, 2_200);
  assert.equal(client.assetAuctions.length, 2);
  assert.equal(client.collectibleAuctions.length, 1);
  assert.equal(client.collectibleAuctions[0].collectible.currentOwnerName, '卖家');
  assert.equal(client.assetAuctions.find((auction) => auction.assetKind === 'commodity').quantity, 2);
});
