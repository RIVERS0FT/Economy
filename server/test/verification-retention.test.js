import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import {
  cleanupEmailVerificationRecords,
  EMAIL_VERIFICATION_RETENTION_MS,
} from '../src/verification-retention.js';

function createDatabase() {
  const database = new DatabaseSync(':memory:');
  database.exec(`
    CREATE TABLE economy_email_verifications (
      id TEXT PRIMARY KEY,
      request_key TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL,
      code_hmac TEXT NOT NULL,
      ip_fingerprint TEXT NOT NULL,
      status TEXT NOT NULL,
      error_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      sent_at INTEGER,
      used_at INTEGER,
      provider_message_id TEXT,
      completion_request_key TEXT,
      completed_user_id INTEGER
    ) STRICT;
  `);
  return database;
}

function insertVerification(database, { id, status, createdAt, expiresAt }) {
  database.prepare(`
    INSERT INTO economy_email_verifications (
      id, request_key, email, code_hmac, ip_fingerprint, status,
      error_count, created_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
  `).run(id, `request-${id}`, `${id}@example.com`, 'hmac', 'ip', status, createdAt, expiresAt);
}

test('email verification cleanup expires active rows and deletes only old terminal records', () => {
  const database = createDatabase();
  const now = 2_000_000_000_000;
  const old = now - EMAIL_VERIFICATION_RETENTION_MS - 1;
  try {
    insertVerification(database, { id: 'old-used', status: 'used', createdAt: old, expiresAt: old });
    insertVerification(database, { id: 'old-sent', status: 'sent', createdAt: old, expiresAt: old });
    insertVerification(database, { id: 'recent-failed', status: 'failed', createdAt: now - 1_000, expiresAt: now - 500 });
    insertVerification(database, { id: 'active-sent', status: 'sent', createdAt: now - 1_000, expiresAt: now + 60_000 });

    assert.equal(cleanupEmailVerificationRecords(database, now, { force: true }), 2);
    const rows = database.prepare('SELECT id, status FROM economy_email_verifications ORDER BY id').all()
      .map((row) => ({ ...row }));
    assert.deepEqual(rows, [
      { id: 'active-sent', status: 'sent' },
      { id: 'recent-failed', status: 'failed' },
    ]);
  } finally {
    database.close();
  }
});
