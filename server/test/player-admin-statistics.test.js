import assert from 'node:assert/strict';
import test from 'node:test';
import { EconomyStore } from '../src/runtime-store.js';

function createRegistrationTable(store) {
  store.database.exec(`
    CREATE TABLE IF NOT EXISTS economy_registrations (
      user_id INTEGER PRIMARY KEY,
      email TEXT NOT NULL,
      registration_ip_fingerprint TEXT NOT NULL,
      registered_at INTEGER NOT NULL,
      source TEXT NOT NULL
    ) STRICT;
  `);
}

test('player statistics record successful economic actions once and keep reads revision-stable', () => {
  const store = new EconomyStore(':memory:');
  const admin = { id: 1, email: 'admin@example.com', name: '管理员', role: 'admin' };
  const player = { id: 2, email: 'player@example.com', name: '玩家', role: 'user' };
  const now = Date.UTC(2026, 6, 24, 3, 0, 0);
  try {
    createRegistrationTable(store);
    store.database.prepare(`
      INSERT INTO economy_registrations (
        user_id, email, registration_ip_fingerprint, registered_at, source
      ) VALUES (?, ?, ?, ?, ?)
    `).run(player.id, player.email, 'test-fingerprint', now - 60_000, 'homepage_session');

    const request = {
      action: 'work',
      payload: {},
      requestKey: 'player-stats-work-1',
      method: 'POST',
      path: '/api/game/work',
    };
    const first = store.apply(player, request, now);
    const replay = store.apply(player, request, now + 1);
    assert.equal(first.result.ok, true);
    assert.deepEqual(replay, first);

    const activity = store.database.prepare(`
      SELECT successful_action_count, work_count, production_output_count, trade_quantity
      FROM economy_player_activity_daily WHERE user_id = ?
    `).get(player.id);
    assert.equal(activity.successful_action_count, 1);
    assert.equal(activity.work_count, 1);
    assert.equal(activity.production_output_count, 0);
    assert.equal(activity.trade_quantity, 0);

    store.transaction(() => {
      const { revision, world } = store.loadWorld(now + 2);
      world.players[String(player.id)].stats.commodityVolume += 4;
      world.assetAuctions.push({
        id: 'player-statistics-asset-auction',
        items: [{ assetKind: 'commodity', assetId: 'wheat', quantity: 1 }],
        assetKind: 'commodity',
        assetId: 'wheat',
        productId: 'wheat',
        quantity: 1,
        sellerId: player.id,
        sellerName: player.name,
        startingBid: 1,
        highestBid: null,
        highestBidderId: null,
        highestBidderName: null,
        status: 'open',
        escrowStatus: 'held',
        createdAt: now + 2,
        endsAt: now + 60_000,
        bids: [],
      });
      store.saveWorld(revision, world, now + 2);
    });

    const operational = store.database.prepare(`
      SELECT successful_action_count, trade_quantity
      FROM economy_player_activity_daily WHERE user_id = ?
    `).get(player.id);
    assert.equal(operational.successful_action_count, 1);
    assert.equal(operational.trade_quantity, 4);

    const statistics = store.getPlayerStatistics(admin, '30d', now + 3);
    assert.equal(statistics.snapshot.totalPlayers, 1);
    assert.equal(statistics.snapshot.active24h, 1);
    assert.equal(statistics.snapshot.registeredInRange, 1);
    assert.equal(statistics.activity.tradeParticipantsInRange, 1);
    assert.equal(statistics.participation.rows.find((row) => row.id === 'open-auction')?.count, 1);
    assert.equal(statistics.range.key, '30d');
    assert.equal(statistics.range.timeZone, 'Asia/Shanghai');
    assert.equal(JSON.stringify(statistics).includes(player.email), false);
    assert.equal(JSON.stringify(statistics).includes('test-fingerprint'), false);

    const second = store.getPlayerStatistics(admin, '30d', now + 3);
    assert.equal(second.revision, statistics.revision);
  } finally {
    store.close();
  }
});

test('player statistics reject non-admin callers', () => {
  const store = new EconomyStore(':memory:');
  try {
    assert.throws(
      () => store.getPlayerStatistics({ id: 2, role: 'user' }, '7d'),
      /需要管理员权限/,
    );
  } finally {
    store.close();
  }
});
