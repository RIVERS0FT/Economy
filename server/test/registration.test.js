import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { EconomyRegistrationStore } from '../src/registration-store.js';
import { createRegistrationService } from '../src/registration.js';

class FakeEconomyStore {
  constructor() {
    this.database = new DatabaseSync(':memory:');
    this.database.exec(`CREATE TABLE economy_world (id INTEGER PRIMARY KEY, revision INTEGER, state_json TEXT, updated_at INTEGER) STRICT;`);
  }
  transaction(callback) {
    this.database.exec('BEGIN IMMEDIATE');
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
    if (row) return { revision: row.revision, world: JSON.parse(row.state_json) };
    const world = { players: {} };
    this.database.prepare('INSERT INTO economy_world VALUES (1, 1, ?, ?)').run(JSON.stringify(world), now);
    return { revision: 1, world };
  }
  saveWorld(revision, world, now) {
    this.database.prepare('UPDATE economy_world SET revision = ?, state_json = ?, updated_at = ? WHERE id = 1')
      .run(revision + 1, JSON.stringify(world), now);
    return revision + 1;
  }
  close() { this.database.close(); }
}

function ensurePlayer(world, user, now) {
  world.players[String(user.id)] ||= { id: Number(user.id), email: user.email, registeredAt: now };
  return world.players[String(user.id)];
}

function setup() {
  const store = new FakeEconomyStore();
  const registrationStore = new EconomyRegistrationStore(store, { secret: 'x'.repeat(64), ensurePlayer });
  const deliveries = [];
  const service = createRegistrationService({
    registrationStore,
    emailSender: async (message) => { deliveries.push(message); return { id: `mail-${deliveries.length}` }; },
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

test('logged-in homepage accounts may auto-create a player while multi-account checks remain enforced', () => {
  const context = setup();
  try {
    const first = context.registrationStore.ensureLoggedInPlayer({
      user: { id: 1, email: 'one@example.com' }, ipFingerprint: 'shared-ip', now: 100,
    });
    assert.equal(first.playerCreated, true);
    assert.equal(context.registrationStore.ensureLoggedInPlayer({
      user: { id: 1, email: 'one@example.com' }, ipFingerprint: 'shared-ip', now: 101,
    }).playerCreated, false);
    assert.throws(() => context.registrationStore.ensureLoggedInPlayer({
      user: { id: 2, email: 'two@example.com' }, ipFingerprint: 'shared-ip', now: 102,
    }), /已经注册其他/);
  } finally { context.store.close(); }
});
