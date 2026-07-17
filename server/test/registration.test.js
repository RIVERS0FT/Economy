import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { EconomyRegistrationStore } from '../src/registration-store.js';
import { createRegistrationService, requestIpAddress } from '../src/registration.js';

class FakeEconomyStore {
  constructor() {
    this.database = new DatabaseSync(':memory:');
    this.database.exec(`CREATE TABLE economy_world (id INTEGER PRIMARY KEY, revision INTEGER, state_json TEXT, updated_at INTEGER) STRICT;`);
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
      return { revision: row.revision, stateJson, world: JSON.parse(stateJson) };
    }
    const world = { version: 11, players: {} };
    const stateJson = JSON.stringify(world);
    this.database.prepare('INSERT INTO economy_world VALUES (1, 1, ?, ?)').run(stateJson, now);
    return { revision: 1, stateJson, world };
  }
  saveWorld(revision, world, now) {
    this.database.prepare('UPDATE economy_world SET revision = ?, state_json = ?, updated_at = ? WHERE id = 1')
      .run(revision + 1, JSON.stringify(world), now);
    return revision + 1;
  }
  close() { this.database.close(); }
}

function ensurePlayer(world, user, now) {
  world.players[String(user.id)] ||= {
    userId: Number(user.id),
    email: user.email,
    playerName: user.name || `玩家 ${user.id}`,
    registeredAt: now,
    gems: 0,
    stats: { invitationGemsIssued: 0 },
  };
  return world.players[String(user.id)];
}

function setup({ accountAvailabilityChecker = async () => {} } = {}) {
  const store = new FakeEconomyStore();
  const registrationStore = new EconomyRegistrationStore(store, { secret: 'x'.repeat(64), ensurePlayer });
  const deliveries = [];
  const service = createRegistrationService({
    registrationStore,
    emailSender: async (message) => { deliveries.push(message); return { id: `mail-${deliveries.length}` }; },
    accountAvailabilityChecker,
    accountClient: async ({ email }) => ({ user: { id: 7, email, role: 'user' }, setCookie: ['sid=test'] }),
  });
  return { store, registrationStore, deliveries, service };
}

async function send(setupResult, now = 1_700_000_000_000, requestKey = 'send-key-0001') {
  await setupResult.service.requestEmailCode({
    email: 'alice@example.com', ipFingerprint: 'ip-a', requestKey, now,
  });
  return setupResult.deliveries.at(-1).code;
}


test('registration IP prefers trusted reverse-proxy real IP over a client-supplied forwarded chain', () => {
  assert.equal(requestIpAddress({
    headers: {
      'x-real-ip': '203.0.113.8',
      'x-forwarded-for': '198.51.100.9, 127.0.0.1',
    },
    socket: { remoteAddress: '127.0.0.1' },
  }), '203.0.113.8');
  assert.equal(requestIpAddress({
    headers: { 'x-forwarded-for': '198.51.100.9, 203.0.113.8' },
    socket: { remoteAddress: '127.0.0.1' },
  }), '203.0.113.8');
});

test('rejects an existing unified account before creating or sending a verification', async () => {
  let checks = 0;
  const context = setup({
    accountAvailabilityChecker: async ({ email }) => {
      checks += 1;
      assert.equal(email, 'alice@example.com');
      throw Object.assign(new Error('该邮箱已注册，请直接登录'), { statusCode: 409 });
    },
  });
  try {
    await assert.rejects(() => context.service.requestEmailCode({
      email: 'Alice@Example.com', ipFingerprint: 'ip-a', requestKey: 'send-existing-001', now: 100,
    }), (error) => error.statusCode === 409 && /已注册/.test(error.message));
    assert.equal(checks, 1);
    assert.equal(context.deliveries.length, 0);
    const row = context.store.database.prepare('SELECT COUNT(*) AS count FROM economy_email_verifications').get();
    assert.equal(row.count, 0);
  } finally { context.store.close(); }
});

test('sends and completes a verification without storing plaintext code', async () => {
  const context = setup();
  try {
    const now = 1_700_000_000_000;
    const code = await send(context, now);
    const result = await context.service.complete({
      email: 'alice@example.com', password: 'password123', code,
      ipFingerprint: 'ip-a', requestKey: 'complete-key-1', now: now + 1_000,
    });
    assert.equal(result.user.id, 7);
    const verification = context.registrationStore.getVerification(
      context.store.database.prepare('SELECT id FROM economy_email_verifications').get().id,
    );
    assert.equal(verification.status, 'used');
    assert.equal(JSON.stringify(verification).includes(code), false);
    assert.equal(context.registrationStore.getRegistration(7).registration_ip_fingerprint, 'ip-a');
  } finally { context.store.close(); }
});

test('sends share-link invite code through email registration and immediately rewards inviter', async () => {
  const context = setup();
  try {
    const now = 1_700_000_000_000;
    context.registrationStore.ensureLoggedInPlayer({
      user: { id: 1, email: 'inviter@example.com', name: '邀请人' }, ipFingerprint: 'ip-inviter', now,
    });
    const inviteCode = context.registrationStore.invitations.ensureInviteCode(1, now).code;
    const code = await send(context, now + 1);
    await context.service.complete({
      email: 'alice@example.com', password: 'password123', code,
      inviteCode, ipFingerprint: 'ip-a', requestKey: 'complete-share-1', now: now + 2,
    });
    const world = context.store.loadWorld(now + 3).world;
    assert.equal(world.players['1'].gems, 10);
    assert.equal(world.players['7'].gems, 0);
    const relation = context.registrationStore.invitations.invitationByInvitee(7);
    assert.equal(relation.source, 'share_link');
    assert.equal(relation.status, 'rewarded');
  } finally { context.store.close(); }
});

test('enforces ten-minute expiry and sixty-second resend cooldown', async () => {
  const context = setup();
  try {
    const now = 1_700_000_000_000;
    const code = await send(context, now);
    await assert.rejects(() => send(context, now + 30_000, 'send-key-0002'), /秒后重新发送/);
    await assert.rejects(() => context.service.complete({
      email: 'alice@example.com', password: 'password123', code,
      ipFingerprint: 'ip-a', requestKey: 'complete-key-2', now: now + 10 * 60 * 1000,
    }), /已过期/);
    await assert.rejects(() => context.service.requestEmailCode({
      email: 'alice@example.com', ipFingerprint: 'ip-a', requestKey: 'send-key-0001',
      now: now + 10 * 60 * 1000,
    }), /已经过期/);
  } finally { context.store.close(); }
});

test('invalidates after five wrong attempts and rejects IP changes', async () => {
  const context = setup();
  try {
    const now = 1_700_000_000_000;
    await send(context, now);
    await assert.rejects(() => context.service.complete({
      email: 'alice@example.com', password: 'password123', code: '000000',
      ipFingerprint: 'ip-b', requestKey: 'wrong-ip', now: now + 1,
    }), /网络不一致/);
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await assert.rejects(() => context.service.complete({
        email: 'alice@example.com', password: 'password123', code: '000000',
        ipFingerprint: 'ip-a', requestKey: `wrong-${attempt}`, now: now + attempt,
      }), attempt === 5 ? /错误次数过多/ : /还可尝试/);
    }
    const row = context.store.database.prepare('SELECT status, error_count FROM economy_email_verifications').get();
    assert.equal(row.status, 'invalid');
    assert.equal(row.error_count, 5);
  } finally { context.store.close(); }
});

test('used code cannot be reused but the same completion request is idempotent', async () => {
  const context = setup();
  try {
    const now = 1_700_000_000_000;
    const code = await send(context, now);
    const payload = {
      email: 'alice@example.com', password: 'password123', code,
      ipFingerprint: 'ip-a', requestKey: 'complete-same', now: now + 1,
    };
    await context.service.complete(payload);
    await context.service.complete(payload);
    assert.equal(Object.keys(context.store.loadWorld(now).world.players).length, 1);
    await assert.rejects(() => context.service.complete({ ...payload, requestKey: 'complete-other' }), /已经使用/);
  } finally { context.store.close(); }
});

test('homepage and direct Economy registrations both participate in duplicate-IP group bans', () => {
  const context = setup();
  try {
    context.registrationStore.ensureLoggedInPlayer({
      user: { id: 1, email: 'one@example.com' }, ipFingerprint: 'shared-ip', now: 100,
    });
    context.registrationStore.ensureLoggedInPlayer({
      user: { id: 2, email: 'two@example.com' }, ipFingerprint: 'shared-ip', now: 102,
    });
    assert.equal(context.registrationStore.getRegistration(2).source, 'homepage_session');
    assert.throws(() => context.registrationStore.assertPlayerActive(1), { statusCode: 423 });
    assert.throws(() => context.registrationStore.assertPlayerActive(2), { statusCode: 423 });
  } finally { context.store.close(); }
});
