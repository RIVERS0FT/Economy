export const EMAIL_VERIFICATION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const EMAIL_VERIFICATION_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

const nextCleanupByDatabase = new WeakMap();

export function cleanupEmailVerificationRecords(database, now = Date.now(), { force = false } = {}) {
  const nextCleanupAt = nextCleanupByDatabase.get(database) || 0;
  if (!force && now < nextCleanupAt) return 0;

  database.prepare(`
    UPDATE economy_email_verifications
    SET status = 'expired'
    WHERE status IN ('pending', 'sent') AND expires_at <= ?
  `).run(now);

  const result = database.prepare(`
    DELETE FROM economy_email_verifications
    WHERE created_at < ?
      AND status IN ('failed', 'expired', 'invalid', 'used')
  `).run(now - EMAIL_VERIFICATION_RETENTION_MS);

  nextCleanupByDatabase.set(database, now + EMAIL_VERIFICATION_CLEANUP_INTERVAL_MS);
  return Number(result.changes || 0);
}
