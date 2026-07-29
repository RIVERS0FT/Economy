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
      invitationSource: 'share_link',
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

test('registration form invite code rewards inviter once inside first-profile transaction', () => {
  const context = setup();
  try {
    const now = 1_700_000_000_000;
    context.registrationStore.ensureLoggedInPlayer({ user: user(1), ipFingerprint: 'ip-one', now });
    const inviteCode = context.registrationStore.invitations.ensureInviteCode(1, now).code;

    const result = context.store.transaction(() => context.registrationStore.ensurePlayerRegistrationInTransaction({
      user: user(2),
      ipFingerprint: 'ip-two',
      source: 'email_verification',
      inviteCode,
      invitationSource: 'manual_code',
      invitationRequestKey: 'manual-registration-0001',
      now: now + 1,
    }));

    assert.equal(result.relation.status, 'rewarded');
    assert.equal(result.relation.source, 'manual_code');
    assert.equal(context.store.loadWorld(now + 2).world.players['1'].gems, INVITATION_REWARD_GEMS);
    assert.equal(context.store.database.prepare('SELECT COUNT(*) AS count FROM economy_gem_ledger').get().count, 1);
  } finally {
    context.store.close();
  }
});

test('existing Economy profile ignores invite parameters and can never be backfilled', () => {
  const context = setup();
  try {
    const now = 1_700_000_000_000;
    context.registrationStore.ensureLoggedInPlayer({ user: user(1), ipFingerprint: 'ip-one', now });
    context.registrationStore.ensureLoggedInPlayer({ user: user(2), ipFingerprint: 'ip-two', now: now + 1 });
    const inviteCode = context.registrationStore.invitations.ensureInviteCode(1, now).code;
    const before = context.store.loadWorld(now + 2);

    const result = context.registrationStore.initializeSession({
      user: user(2),
      ipFingerprint: 'ip-two',
      inviteCode,
      requestKey: 'existing-session-invite-0001',
      now: now + 3,
    });

    assert.equal(result.playerCreated, false);
    assert.equal(result.invitationBound, false);
    assert.equal(result.invalidInvite, true);
    assert.equal(context.registrationStore.invitations.invitationByInvitee(2), undefined);
    const after = context.store.loadWorld(now + 4);
    assert.equal(after.revision, before.revision);
    assert.equal(after.world.players['1'].gems, 0);
    const summary = context.registrationStore.getInvitationSummary(2, now + 5);
    assert.equal('claimExpiresAt' in summary, false);
    assert.equal('claimedInvitation' in summary, false);
  } finally {
    context.store.close();
  }
});

test('a second registration on the same IP creates an anomaly report without banning accounts', () => {
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
      invitationSource: 'share_link',
      invitationRequestKey: 'same-ip-share-0001',
      now: now + 1,
    }));

    assert.equal(result.anomalyIncidentId > 0, true);
    assert.doesNotThrow(() => context.registrationStore.assertPlayerActive(1));
    assert.doesNotThrow(() => context.registrationStore.assertPlayerActive(2));
    const incidents = context.registrationStore.listBanIncidents();
    assert.equal(incidents.length, 1);
    assert.equal(incidents[0].active_ban_count, 0);
    const world = context.store.loadWorld(now + 2).world;
    assert.equal(world.players['1'].gems, 0);
    assert.equal(context.store.database.prepare('SELECT COUNT(*) AS count FROM economy_gem_ledger').get().count, 0);
    const relation = context.registrationStore.invitations.invitationByInvitee(2);
    assert.equal(relation.status, 'blocked_same_ip');
  } finally {
    context.store.close();
  }
});

test('administrator manually controls single-account and whole-incident bans', () => {
  const context = setup();
  try {
    const now = 1_700_000_000_000;
    context.registrationStore.ensureLoggedInPlayer({ user: user(1), ipFingerprint: 'shared-ip', now });
    context.registrationStore.ensureLoggedInPlayer({ user: user(2), ipFingerprint: 'shared-ip', now: now + 1 });
    const incidentId = context.registrationStore.listBanIncidents()[0].id;

    const one = context.registrationStore.banUser({
      userId: 1,
      incidentId,
      adminUserId: 99,
      note: '人工确认违规',
      requestKey: 'admin-ban-one-0001',
      now: now + 2,
    });
    assert.equal(one.ok, true);
    assert.throws(() => context.registrationStore.assertPlayerActive(1), { statusCode: 423 });
    assert.doesNotThrow(() => context.registrationStore.assertPlayerActive(2));

    context.registrationStore.unbanUser({
      userId: 1,
      adminUserId: 99,
      note: '复核后解禁',
      requestKey: 'admin-unban-one-0001',
      now: now + 3,
    });
    assert.doesNotThrow(() => context.registrationStore.assertPlayerActive(1));

    const all = context.registrationStore.banIncident({
      incidentId,
      adminUserId: 99,
      note: '人工确认整个事件违规',
      requestKey: 'admin-ban-all-0001',
      now: now + 4,
    });
    assert.equal(all.changedCount, 2);
    assert.throws(() => context.registrationStore.assertPlayerActive(1), { statusCode: 423 });
    assert.throws(() => context.registrationStore.assertPlayerActive(2), { statusCode: 423 });

    const lifted = context.registrationStore.unbanIncident({
      incidentId,
      adminUserId: 99,
      note: '批量解禁',
      requestKey: 'admin-unban-all-0001',
      now: now + 5,
    });
    assert.equal(lifted.changedCount, 2);
    assert.doesNotThrow(() => context.registrationStore.assertPlayerActive(1));
    assert.doesNotThrow(() => context.registrationStore.assertPlayerActive(2));
  } finally {
    context.store.close();
  }
});

test('review survives restart and a new same-IP account only reopens the report', () => {
  const context = setup();
  try {
    const now = 1_700_000_000_000;
    context.registrationStore.ensureLoggedInPlayer({ user: user(1), ipFingerprint: 'shared-ip', now });
    context.registrationStore.ensureLoggedInPlayer({ user: user(2), ipFingerprint: 'shared-ip', now: now + 1 });
    const incidentId = context.registrationStore.listBanIncidents()[0].id;
    context.registrationStore.reviewIncident({
      incidentId,
      adminUserId: 99,
      note: '家庭共享网络',
      requestKey: 'review-shared-network-0001',
      now: now + 2,
    });

    const restarted = new EconomyRegistrationStore(context.store, {
      secret: 'invite-test-secret'.repeat(4), ensurePlayer, publicOrigin: 'https://game.riversoft.top',
    });
    assert.equal(restarted.listBanIncidents()[0].status, 'reviewed');
    assert.doesNotThrow(() => restarted.assertPlayerActive(1));
    assert.doesNotThrow(() => restarted.assertPlayerActive(2));

    restarted.ensureLoggedInPlayer({ user: user(3), ipFingerprint: 'shared-ip', now: now + 3 });
    assert.equal(restarted.listBanIncidents()[0].status, 'active');
    assert.doesNotThrow(() => restarted.assertPlayerActive(1));
    assert.doesNotThrow(() => restarted.assertPlayerActive(2));
    assert.doesNotThrow(() => restarted.assertPlayerActive(3));
  } finally {
    context.store.close();
  }
});

test('same-IP registration form code is recorded without a gem reward', () => {
  const context = setup();
  try {
    const now = 1_700_000_000_000;
    context.registrationStore.ensureLoggedInPlayer({ user: user(1), ipFingerprint: 'shared-ip', now });
    const inviteCode = context.registrationStore.invitations.ensureInviteCode(1, now).code;

    const result = context.store.transaction(() => context.registrationStore.ensurePlayerRegistrationInTransaction({
      user: user(2),
      ipFingerprint: 'shared-ip',
      source: 'email_verification',
      inviteCode,
      invitationSource: 'manual_code',
      invitationRequestKey: 'same-ip-manual-registration-1',
      now: now + 1,
    }));

    assert.equal(result.relation.source, 'manual_code');
    assert.equal(result.relation.status, 'blocked_same_ip');
    assert.equal(context.store.loadWorld(now + 2).world.players['1'].gems, 0);
    assert.equal(context.store.database.prepare('SELECT COUNT(*) AS count FROM economy_gem_ledger').get().count, 0);
  } finally {
    context.store.close();
  }
});


test('legacy automatic-ban migration remains idempotent after an audit-only partial attempt', () => {
  const context = setup();
  try {
    const now = 1_700_000_000_000;
    context.registrationStore.ensureLoggedInPlayer({ user: user(1), ipFingerprint: 'shared-ip', now });
    context.registrationStore.ensureLoggedInPlayer({ user: user(2), ipFingerprint: 'shared-ip', now: now + 1 });
    const incidentId = context.registrationStore.listBanIncidents()[0].id;
    context.store.database.prepare(`
      INSERT INTO economy_account_bans (
        user_id, status, reason, incident_id, banned_at, banned_by,
        unbanned_at, unbanned_by, admin_note
      ) VALUES (?, 'active', 'duplicate_registration_ip', ?, ?, NULL, NULL, NULL, '')
    `).run(1, incidentId, now + 2);
    context.store.database.prepare(`
      INSERT INTO economy_ban_audit (
        user_id, incident_id, action, actor_user_id, note, request_key, created_at
      ) VALUES (?, ?, 'unban', NULL, ?, ?, ?)
    `).run(
      1,
      incidentId,
      '规则迁移：自动封禁改为异常上报',
      'migration:auto-ban-report-only:1',
      now + 3,
    );
    context.registrationStore.banUser({
      userId: 2,
      incidentId,
      adminUserId: 99,
      note: '管理员确认违规',
      requestKey: 'preserve-admin-ban-0001',
      now: now + 4,
    });

    const restarted = new EconomyRegistrationStore(context.store, {
      secret: 'invite-test-secret'.repeat(4), ensurePlayer, publicOrigin: 'https://game.riversoft.top',
    });
    assert.doesNotThrow(() => restarted.assertPlayerActive(1));
    assert.throws(() => restarted.assertPlayerActive(2), { statusCode: 423 });
    const migrated = context.store.database.prepare(
      'SELECT status, admin_note FROM economy_account_bans WHERE user_id = 1',
    ).get();
    assert.equal(migrated.status, 'lifted');
    assert.equal(migrated.admin_note, '规则迁移：自动封禁改为异常上报');

    const restartedAgain = new EconomyRegistrationStore(context.store, {
      secret: 'invite-test-secret'.repeat(4), ensurePlayer, publicOrigin: 'https://game.riversoft.top',
    });
    assert.doesNotThrow(() => restartedAgain.assertPlayerActive(1));
    assert.throws(() => restartedAgain.assertPlayerActive(2), { statusCode: 423 });
    assert.equal(
      context.store.database.prepare(
        "SELECT COUNT(*) AS count FROM economy_ban_audit WHERE request_key = 'migration:auto-ban-report-only:1'",
      ).get().count,
      1,
    );
  } finally {
    context.store.close();
  }
});
