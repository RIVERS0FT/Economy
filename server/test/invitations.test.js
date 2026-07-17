import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { EconomyRegistrationStore } from '../src/registration-store.js';
import { INVITATION_REWARD_GEMS } from '../src/invitations.js';

class FakeEconomyStore {
  constructor() {
    this.database = new DatabaseSync(':memory:');
    this.database.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE economy_world (
        id INTEGER PRIMARY KEY,
        revision INTEGER NOT NULL,
        state_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      ) STRICT;
    `);
  }

  transaction(callback, { immediate = true } = {}) {
    this.database.exec(immediate ? 'BEGIN IMMEDIATE' : 'BEGIN');
    try {
      const result = callback();
      this.database.exec('COMMIT');
      return result;
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  loadWorld(now) {
    const row = this.database.prepare('SELECT revision, state_json FROM economy_world WHERE id = 1').get();
    if (row) {
      const stateJson = String(row.state_json);
      return { revision: Number(row.revision), stateJson, world: JSON.parse(stateJson) };
    }
    const world = { version: 12, players: {}, orders: [], lastProcessedAt: now };
    const stateJson = JSON.stringify(world);
    this.database.prepare('INSERT INTO economy_world VALUES (1, 1, ?, ?)').run(stateJson, now);
    return { revision: 1, stateJson, world };
  }

  saveWorld(revision, world, now) {
    world.lastProcessedAt = now;
    this.database.prepare('UPDATE economy_world SET revision = ?, state_json = ?, updated_at = ? WHERE id = 1')
      .run(revision + 1, JSON.stringify(world), now);
    return revision + 1;
  }

  close() {
    this.database.close();
  }
}

function ensurePlayer(world, user, now) {
  const userId = Number(user.id);
  world.players[String(userId)] ||= {
    userId,
    playerName: user.name || `玩家 ${userId}`,
    registeredAt: now,
    credits: 100,
    frozenCredits: 0,
    gems: 0,
    stats: {
      workIssued: 0,
      populationIssued: 0,
      systemSinks: 0,
      commodityVolume: 0,
      facilityVolume: 0,
      workClicks: 0,
      producedGoods: 0,
      boughtGoods: 0,
      soldGoods: 0,
      giftIssued: 0,
      invitationGemsIssued: 0,
    },
  };
  return world.players[String(userId)];
}

function setup() {
  const store = new FakeEconomyStore();
  const registrationStore = new EconomyRegistrationStore(store, {
    secret: 'invite-test-secret'.repeat(4),
    ensurePlayer,
    publicOrigin: 'https://game.riversoft.top',
  });
  return { store, registrationStore };
}

function user(id) {
  return { id, email: `user-${id}@example.com`, name: `玩家 ${id}`, role: 'user' };
}

test('share link registration immediately rewards only the inviter with gems', () => {
  const context = setup();
  try {
    const now = 1_700_000_000_000;
    context.registrationStore.ensureLoggedInPlayer({ user: user(1), ipFingerprint: 'ip-one', now });
    const inviteCode = context.registrationStore.invitations.ensureInviteCode(1, now).code;

    const result = context.store.transaction(() => context.registrationStore.ensurePlayerRegistrationInTransaction({
      user: user(2),
      ipFingerprint: 'ip-two',
      source: 'homepage_session',
      inviteCode,
      invitationRequestKey: 'share-registration-0001',
      now: now + 1,
    }));

    assert.equal(result.relation.status, 'rewarded');
    assert.equal(result.relation.source, 'share_link');
    const world = context.store.loadWorld(now + 2).world;
    assert.equal(world.players['1'].gems, INVITATION_REWARD_GEMS);
    assert.equal(world.players['1'].stats.invitationGemsIssued, INVITATION_REWARD_GEMS);
    assert.equal(world.players['2'].gems, 0);
    const ledger = context.store.database.prepare('SELECT * FROM economy_gem_ledger').all();
    assert.equal(ledger.length, 1);
    assert.equal(ledger[0].user_id, 1);
    assert.equal(ledger[0].category, 'share_link_reward');
  } finally {
    context.store.close();
  }
});

test('manual code claim rewards inviter once and remains mutually exclusive with link attribution', () => {
  const context = setup();
  try {
    const now = 1_700_000_000_000;
    context.registrationStore.ensureLoggedInPlayer({ user: user(1), ipFingerprint: 'ip-one', now });
    context.registrationStore.ensureLoggedInPlayer({ user: user(2), ipFingerprint: 'ip-two', now: now + 1 });
    const inviteCode = context.registrationStore.invitations.ensureInviteCode(1, now).code;

    const result = context.registrationStore.claimManualInvitation({
      user: user(2), inviteCode, requestKey: 'manual-claim-0001', now: now + 2,
    });
    assert.match(result.message, /邀请人已获得 10 宝石/);
    assert.equal(result.relation.source, 'manual_code');
    assert.equal(context.store.loadWorld(now + 3).world.players['1'].gems, 10);

    assert.throws(() => context.registrationStore.claimManualInvitation({
      user: user(2), inviteCode, requestKey: 'manual-claim-0002', now: now + 3,
    }), /已经绑定邀请关系/);
    assert.equal(context.store.database.prepare('SELECT COUNT(*) AS count FROM economy_gem_ledger').get().count, 1);
  } finally {
    context.store.close();
  }
});

test('manual invitation claim expires after twenty four hours', () => {
  const context = setup();
  try {
    const now = 1_700_000_000_000;
    context.registrationStore.ensureLoggedInPlayer({ user: user(1), ipFingerprint: 'ip-one', now });
    context.registrationStore.ensureLoggedInPlayer({ user: user(2), ipFingerprint: 'ip-two', now });
    const inviteCode = context.registrationStore.invitations.ensureInviteCode(1, now).code;
    assert.throws(() => context.registrationStore.claimManualInvitation({
      user: user(2),
      inviteCode,
      requestKey: 'manual-expired-0001',
      now: now + 24 * 60 * 60 * 1000 + 1,
    }), /填写期限已结束/);
  } finally {
    context.store.close();
  }
});

test('a second registration on the same IP bans the whole account group before invitation reward', () => {
  const context = setup();
  try {
    const now = 1_700_000_000_000;
    context.registrationStore.ensureLoggedInPlayer({ user: user(1), ipFingerprint: 'shared-ip', now });
    const inviteCode = context.registrationStore.invitations.ensureInviteCode(1, now).code;
    const result = context.store.transaction(() => context.registrationStore.ensurePlayerRegistrationInTransaction({
      user: user(2),
      ipFingerprint: 'shared-ip',
      source: 'homepage_session',
      inviteCode,
      invitationRequestKey: 'same-ip-share-0001',
      now: now + 1,
    }));

    assert.equal(result.ban.incident_id > 0, true);
    assert.throws(() => context.registrationStore.assertPlayerActive(1), (error) => (
      error.statusCode === 423 && error.code === 'ECONOMY_ACCOUNT_BANNED'
    ));
    assert.throws(() => context.registrationStore.assertPlayerActive(2), { statusCode: 423 });
    const world = context.store.loadWorld(now + 2).world;
    assert.equal(world.players['1'].gems, 0);
    assert.equal(context.store.database.prepare('SELECT COUNT(*) AS count FROM economy_gem_ledger').get().count, 0);
    const relation = context.registrationStore.invitations.invitationByInvitee(2);
    assert.equal(relation.status, 'blocked_same_ip');
  } finally {
    context.store.close();
  }
});

test('administrator can unban one account or an entire duplicate-IP incident', () => {
  const context = setup();
  try {
    const now = 1_700_000_000_000;
    context.registrationStore.ensureLoggedInPlayer({ user: user(1), ipFingerprint: 'shared-ip', now });
    context.registrationStore.ensureLoggedInPlayer({ user: user(2), ipFingerprint: 'shared-ip', now: now + 1 });
    const incidents = context.registrationStore.listBanIncidents();
    assert.equal(incidents.length, 1);
    const incidentId = incidents[0].id;

    const one = context.registrationStore.unbanUser({
      userId: 1, adminUserId: 99, note: '人工核验', requestKey: 'admin-unban-one-0001', now: now + 2,
    });
    assert.equal(one.ok, true);
    assert.doesNotThrow(() => context.registrationStore.assertPlayerActive(1));
    assert.throws(() => context.registrationStore.assertPlayerActive(2), { statusCode: 423 });

    const all = context.registrationStore.unbanIncident({
      incidentId, adminUserId: 99, note: '家庭共享网络', requestKey: 'admin-unban-all-0001', now: now + 3,
    });
    assert.equal(all.changedCount, 1);
    assert.doesNotThrow(() => context.registrationStore.assertPlayerActive(2));

    context.registrationStore.rebanUser({
      userId: 1, adminUserId: 99, note: '重新封禁', requestKey: 'admin-reban-one-0001', now: now + 4,
    });
    assert.throws(() => context.registrationStore.assertPlayerActive(1), { statusCode: 423 });
  } finally {
    context.store.close();
  }
});

test('manual unban survives restart reconciliation until a new same-IP registration appears', () => {
  const context = setup();
  try {
    const now = 1_700_000_000_000;
    context.registrationStore.ensureLoggedInPlayer({ user: user(1), ipFingerprint: 'shared-ip', now });
    context.registrationStore.ensureLoggedInPlayer({ user: user(2), ipFingerprint: 'shared-ip', now: now + 1 });
    const incidentId = context.registrationStore.listBanIncidents()[0].id;
    context.registrationStore.unbanIncident({
      incidentId, adminUserId: 99, note: '共享家庭网络', requestKey: 'restart-unban-all-0001', now: now + 2,
    });

    const restarted = new EconomyRegistrationStore(context.store, {
      secret: 'invite-test-secret'.repeat(4), ensurePlayer, publicOrigin: 'https://game.riversoft.top',
    });
    assert.doesNotThrow(() => restarted.assertPlayerActive(1));
    assert.doesNotThrow(() => restarted.assertPlayerActive(2));

    restarted.ensureLoggedInPlayer({ user: user(3), ipFingerprint: 'shared-ip', now: now + 3 });
    assert.throws(() => restarted.assertPlayerActive(1), { statusCode: 423 });
    assert.throws(() => restarted.assertPlayerActive(2), { statusCode: 423 });
    assert.throws(() => restarted.assertPlayerActive(3), { statusCode: 423 });
  } finally {
    context.store.close();
  }
});

test('manual same-IP code is consumed without a gem reward after administrator review', () => {
  const context = setup();
  try {
    const now = 1_700_000_000_000;
    context.registrationStore.ensureLoggedInPlayer({ user: user(1), ipFingerprint: 'shared-ip', now });
    context.registrationStore.ensureLoggedInPlayer({ user: user(2), ipFingerprint: 'shared-ip', now: now + 1 });
    const incidentId = context.registrationStore.listBanIncidents()[0].id;
    context.registrationStore.unbanIncident({
      incidentId, adminUserId: 99, note: '允许继续使用', requestKey: 'same-ip-manual-unban-1', now: now + 2,
    });
    const inviteCode = context.registrationStore.invitations.ensureInviteCode(1, now).code;
    const result = context.registrationStore.claimManualInvitation({
      user: user(2), inviteCode, requestKey: 'same-ip-manual-claim-1', now: now + 3,
    });
    assert.match(result.message, /不发放邀请宝石/);
    assert.equal(result.relation.status, 'blocked_same_ip');
    assert.equal(context.store.loadWorld(now + 4).world.players['1'].gems, 0);
    assert.throws(() => context.registrationStore.claimManualInvitation({
      user: user(2), inviteCode, requestKey: 'same-ip-manual-claim-2', now: now + 4,
    }), /已经绑定邀请关系/);
  } finally {
    context.store.close();
  }
});
