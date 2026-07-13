import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyCollectibleAction,
  createCollectibleClientState,
  importCollectibles,
  migrateCollectibleWorld,
  processCollectibleAuctions,
} from '../src/collectibles.js';

function world() {
  return {
    players: {
      '1': { userId: 1, playerName: '卖家', credits: 100, frozenCredits: 0 },
      '2': { userId: 2, playerName: '买家甲', credits: 500, frozenCredits: 0 },
      '3': { userId: 3, playerName: '买家乙', credits: 500, frozenCredits: 0 },
    },
  };
}

const admin = { id: 1, role: 'admin' };
const seller = { id: 1 };
const bidderA = { id: 2 };
const bidderB = { id: 3 };

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

test('管理员导入芝加哥艺术博物馆公版藏品并记录初始归属', () => {
  const state = world();
  migrateCollectibleWorld(state, 1_000);
  const imported = importOne(state);
  assert.equal(imported.importedCount, 1);
  assert.equal(state.collectibles[0].currentOwnerId, 1);
  assert.equal(state.collectibleOwnershipHistory.length, 1);
  assert.equal(state.collectibleOwnershipHistory[0].reason, 'assigned');
  assert.match(imported.collectibles[0].imageUrl, /^https:\/\/www\.artic\.edu\/iiif\/2\//);
});

test('竞拍冻结资金、释放被超价玩家资金并在结束后转移归属', () => {
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
  assert.equal(state.collectibles[0].currentOwnerId, 3);
  assert.equal(state.players['1'].credits, 250);
  assert.equal(state.players['3'].frozenCredits, 0);
  assert.equal(state.collectibleOwnershipHistory.at(-1).reason, 'auction');
  assert.equal(state.collectibleOwnershipHistory.at(-1).price, 150);
});

test('客户端状态包含藏品图片、当前归属和拍卖最低出价', () => {
  const state = world();
  importOne(state, 1_000);
  const collectibleId = state.collectibles[0].id;
  applyCollectibleAction(state, seller, 'createCollectibleAuction', {
    collectibleId,
    startingBid: 88,
    durationHours: 2,
  }, 2_000);
  const client = createCollectibleClientState(state, 1, 2_100);
  assert.equal(client.collectibles[0].currentOwnerName, '卖家');
  assert.equal(client.collectibleAuctions[0].minimumBid, 88);
  assert.equal(client.collectibleAuctions[0].isSeller, true);
});
