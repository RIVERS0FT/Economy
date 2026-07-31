import assert from 'node:assert/strict';
import test from 'node:test';
import { ensurePlayer } from '../src/domain.js';
import { EconomyStore } from '../src/storage.js';

const seller = { id: 101, name: '卖家' };
const bidderA = { id: 102, name: '甲' };
const bidderB = { id: 103, name: '乙' };

function prepare(store, now = 1_000) {
  store.transaction(() => {
    const { revision, world } = store.loadWorld(now);
    const sellerAccount = ensurePlayer(world, seller, now);
    const accountA = ensurePlayer(world, bidderA, now);
    const accountB = ensurePlayer(world, bidderB, now);
    sellerAccount.credits = 1_000;
    sellerAccount.inventories.wheat.available = 5;
    accountA.credits = 10_000;
    accountB.credits = 10_000;
    store.saveWorld(revision, world, now);
  });
}

function apply(store, user, action, payload, requestKey, now) {
  return store.apply(user, {
    action,
    payload,
    requestKey,
    method: 'POST',
    path: action === 'createAuction' ? '/api/game/auctions' : '/api/game/auctions/test/bids',
  }, now);
}

test('发布费、出价和匿名最近十条在同一 SQLite 事务中审计', () => {
  const store = new EconomyStore(':memory:', { scheduledProcessing: false });
  try {
    prepare(store);
    const created = apply(store, seller, 'createAuction', {
      items: [{ assetKind: 'commodity', assetId: 'wheat', quantity: 2 }],
      startingBid: 100,
      reservePrice: 120,
      durationHours: 1,
    }, 'create-auction-audit-001', 2_000);
    assert.equal(created.result.ok, true);

    const snapshot = store.getState(seller, 2_100);
    const auction = snapshot.assetAuctions[0];
    assert.equal(auction.listingFee, 0.5);
    assert.equal('sellerId' in auction, false);
    assert.equal('bids' in auction, false);

    for (let index = 0; index < 12; index += 1) {
      const user = index % 2 === 0 ? bidderA : bidderB;
      const amount = 100 + index * 2;
      const response = apply(
        store,
        user,
        'placeAuctionBid',
        { auctionId: auction.id, amount },
        `auction-bid-audit-${String(index).padStart(3, '0')}`,
        3_000 + index,
      );
      assert.equal(response.result.ok, true);
    }

    const history = store.getAuctionBidHistory(bidderA, auction.id, 4_000);
    assert.equal(history.bidCount, 12);
    assert.equal(history.bids.length, 10);
    assert.equal(history.bids[0].amount, 122);
    assert.equal(history.bids[9].amount, 104);
    assert.equal(history.bids[0].bidderLabel, '竞买人 A02');
    assert.equal(history.bids[1].isMine, true);
    assert.equal('actorUserId' in history.bids[0], false);

    const auditCount = Number(store.database.prepare(`
      SELECT COUNT(*) AS count
      FROM economy_asset_auction_events
      WHERE auction_id = ? AND event_type = 'bid_placed'
    `).get(auction.id).count);
    assert.equal(auditCount, 12);
  } finally {
    store.close();
  }
});

test('发布幂等重试不会重复扣费或重复冻结资产', () => {
  const store = new EconomyStore(':memory:', { scheduledProcessing: false });
  try {
    prepare(store);
    const request = {
      action: 'createAuction',
      payload: {
        items: [{ assetKind: 'commodity', assetId: 'wheat', quantity: 2 }],
        startingBid: 100,
        durationHours: 1,
      },
      requestKey: 'create-auction-idempotent-001',
      method: 'POST',
      path: '/api/game/auctions',
    };
    const first = store.apply(seller, request, 2_000);
    const second = store.apply(seller, request, 2_001);
    assert.deepEqual(second, first);
    const { world } = store.loadWorld(2_002);
    assert.equal(world.assetAuctions.length, 1);
    assert.equal(world.auctionFeeEscrowCredits, 0.5);
    assert.equal(world.players[String(seller.id)].credits, 999.5);
    assert.equal(world.players[String(seller.id)].inventories.wheat.frozen, 2);
  } finally {
    store.close();
  }
});

test('拍卖审计事件禁止更新和删除', () => {
  const store = new EconomyStore(':memory:', { scheduledProcessing: false });
  try {
    prepare(store);
    apply(store, seller, 'createAuction', {
      items: [{ assetKind: 'commodity', assetId: 'wheat', quantity: 1 }],
      startingBid: 100,
      durationHours: 1,
    }, 'create-auction-append-only-001', 2_000);

    assert.throws(
      () => store.database.exec("UPDATE economy_asset_auction_events SET event_type = 'changed'"),
      /append-only/,
    );
    assert.throws(
      () => store.database.exec('DELETE FROM economy_asset_auction_events'),
      /append-only/,
    );
  } finally {
    store.close();
  }
});
