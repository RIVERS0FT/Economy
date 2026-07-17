import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { EconomyInvitationStore, ensureGemState } from './invitations.js';

export const EMAIL_CODE_TTL_MS = 10 * 60 * 1000;
export const EMAIL_CODE_RESEND_MS = 60 * 1000;
export const EMAIL_CODE_MAX_ERRORS = 5;

function httpError(message, statusCode, extra = {}) {
  return Object.assign(new Error(message), { statusCode, ...extra });
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function deriveEmailCode(secret, verificationId, email) {
  const digest = createHmac('sha256', secret)
    .update(`economy-email-code\n${verificationId}\n${normalizeEmail(email)}`)
    .digest();
  const number = digest.readUInt32BE(0) % 1_000_000;
  return String(number).padStart(6, '0');
}

export function hashEmailCode(secret, verificationId, email, code) {
  return createHmac('sha256', secret)
    .update(`economy-email-code-hmac\n${verificationId}\n${normalizeEmail(email)}\n${String(code)}`)
    .digest('hex');
}

export class EconomyRegistrationStore {
  constructor(economyStore, { secret, ensurePlayer, publicOrigin = 'https://game.riversoft.top' }) {
    this.store = economyStore;
    this.database = economyStore.database;
    this.secret = secret;
    this.ensurePlayer = ensurePlayer;
    this.publicOrigin = publicOrigin;
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS economy_email_verifications (
        id TEXT PRIMARY KEY,
        request_key TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL,
        code_hmac TEXT NOT NULL,
        ip_fingerprint TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'expired', 'invalid', 'used')),
        error_count INTEGER NOT NULL DEFAULT 0 CHECK (error_count >= 0),
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        sent_at INTEGER,
        used_at INTEGER,
        provider_message_id TEXT,
        completion_request_key TEXT,
        completed_user_id INTEGER
      ) STRICT;
      CREATE INDEX IF NOT EXISTS idx_economy_email_verifications_email_created
        ON economy_email_verifications(email, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_economy_email_verifications_ip_created
        ON economy_email_verifications(ip_fingerprint, created_at DESC);
      CREATE TABLE IF NOT EXISTS economy_registrations (
        user_id INTEGER PRIMARY KEY,
        email TEXT NOT NULL,
        registration_ip_fingerprint TEXT NOT NULL,
        registered_at INTEGER NOT NULL,
        source TEXT NOT NULL CHECK (source IN ('email_verification', 'homepage_session'))
      ) STRICT;
      CREATE INDEX IF NOT EXISTS idx_economy_registrations_ip
        ON economy_registrations(registration_ip_fingerprint, registered_at);
    `);
    this.selectVerificationByRequestKey = this.database.prepare(`
      SELECT * FROM economy_email_verifications WHERE request_key = ?
    `);
    this.selectRecentVerification = this.database.prepare(`
      SELECT * FROM economy_email_verifications
      WHERE (email = ? OR ip_fingerprint = ?)
        AND status IN ('pending', 'sent', 'failed')
        AND created_at > ?
      ORDER BY created_at DESC LIMIT 1
    `);
    this.insertVerification = this.database.prepare(`
      INSERT INTO economy_email_verifications (
        id, request_key, email, code_hmac, ip_fingerprint, status,
        error_count, created_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, 'pending', 0, ?, ?)
    `);
    this.selectLatestVerificationForEmail = this.database.prepare(`
      SELECT * FROM economy_email_verifications
      WHERE email = ?
      ORDER BY created_at DESC LIMIT 1
    `);
    this.selectVerificationById = this.database.prepare(`
      SELECT * FROM economy_email_verifications WHERE id = ?
    `);
    this.selectRegistrationByUser = this.database.prepare(`
      SELECT * FROM economy_registrations WHERE user_id = ?
    `);
    this.insertRegistration = this.database.prepare(`
      INSERT INTO economy_registrations (
        user_id, email, registration_ip_fingerprint, registered_at, source
      ) VALUES (?, ?, ?, ?, ?)
    `);
    this.invitations = new EconomyInvitationStore(economyStore, { secret, ensurePlayer });
  }

  beginEmailVerification({ email, ipFingerprint, requestKey, now = Date.now() }) {
    return this.store.transaction(() => {
      const normalizedEmail = normalizeEmail(email);
      const existing = this.selectVerificationByRequestKey.get(requestKey);
      if (existing) {
        if (existing.email !== normalizedEmail || existing.ip_fingerprint !== ipFingerprint) {
          throw httpError('幂等键已被其他验证码请求使用', 409);
        }
        if (Number(existing.expires_at) <= now) {
          throw httpError('该验证码请求已经过期，请重新发送', 409);
        }
        if (['used', 'invalid', 'expired'].includes(existing.status)) {
          throw httpError('该验证码请求已经结束，请重新发送', 409);
        }
        return {
          ...existing,
          code: deriveEmailCode(this.secret, existing.id, existing.email),
          repeated: true,
        };
      }

      this.database.prepare(`
        UPDATE economy_email_verifications SET status = 'expired'
        WHERE status IN ('pending', 'sent') AND expires_at <= ?
      `).run(now);
      const recent = this.selectRecentVerification.get(
        normalizedEmail,
        ipFingerprint,
        now - EMAIL_CODE_RESEND_MS,
      );
      if (recent) {
        const retryAfterSeconds = Math.max(1, Math.ceil((recent.created_at + EMAIL_CODE_RESEND_MS - now) / 1000));
        throw httpError(`请在 ${retryAfterSeconds} 秒后重新发送`, 429, { retryAfterSeconds });
      }

      const id = randomUUID();
      const code = deriveEmailCode(this.secret, id, normalizedEmail);
      const expiresAt = now + EMAIL_CODE_TTL_MS;
      this.insertVerification.run(
        id,
        requestKey,
        normalizedEmail,
        hashEmailCode(this.secret, id, normalizedEmail, code),
        ipFingerprint,
        now,
        expiresAt,
      );
      return {
        id,
        request_key: requestKey,
        email: normalizedEmail,
        ip_fingerprint: ipFingerprint,
        status: 'pending',
        created_at: now,
        expires_at: expiresAt,
        code,
        repeated: false,
      };
    });
  }

  markEmailSent(verificationId, providerMessageId, now = Date.now()) {
    this.database.prepare(`
      UPDATE economy_email_verifications
      SET status = 'sent', sent_at = ?, provider_message_id = ?
      WHERE id = ? AND status IN ('pending', 'failed', 'sent')
    `).run(now, String(providerMessageId || ''), verificationId);
  }

  markEmailFailed(verificationId) {
    this.database.prepare(`
      UPDATE economy_email_verifications SET status = 'failed'
      WHERE id = ? AND status = 'pending'
    `).run(verificationId);
  }

  prepareEmailCompletion({ email, code, ipFingerprint, requestKey, now = Date.now() }) {
    const outcome = this.store.transaction(() => {
      const normalizedEmail = normalizeEmail(email);
      const row = this.selectLatestVerificationForEmail.get(normalizedEmail);
      if (!row) return { error: httpError('请先发送邮箱验证码', 400) };
      if (row.status === 'used') {
        if (row.completion_request_key === requestKey) {
          return { verificationId: row.id, repeated: true, completedUserId: Number(row.completed_user_id) };
        }
        return { error: httpError('验证码已经使用', 409) };
      }
      if (row.status === 'invalid') return { error: httpError('验证码错误次数过多，请重新发送', 400) };
      if (row.status === 'expired') return { error: httpError('验证码已过期，请重新发送', 400) };
      if (row.status !== 'sent') return { error: httpError('验证码尚未成功发送，请重新发送', 400) };
      if (row.ip_fingerprint !== ipFingerprint) {
        return { error: httpError('发送验证码和提交注册的网络不一致', 403) };
      }
      if (Number(row.expires_at) <= now) {
        this.database.prepare(`UPDATE economy_email_verifications SET status = 'expired' WHERE id = ?`).run(row.id);
        return { error: httpError('验证码已过期，请重新发送', 400) };
      }

      const expected = hashEmailCode(this.secret, row.id, row.email, code);
      if (!safeEqual(expected, row.code_hmac)) {
        const nextErrors = Number(row.error_count) + 1;
        const nextStatus = nextErrors >= EMAIL_CODE_MAX_ERRORS ? 'invalid' : 'sent';
        this.database.prepare(`
          UPDATE economy_email_verifications SET error_count = ?, status = ? WHERE id = ?
        `).run(nextErrors, nextStatus, row.id);
        return {
          error: nextStatus === 'invalid'
            ? httpError('验证码错误次数过多，请重新发送', 400)
            : httpError(`验证码错误，还可尝试 ${EMAIL_CODE_MAX_ERRORS - nextErrors} 次`, 400),
        };
      }
      return { verificationId: row.id, repeated: false };
    });
    if (outcome.error) throw outcome.error;
    return outcome;
  }

  completeEmailRegistration({ verificationId, requestKey, user, ipFingerprint, inviteCode, invitationSource, now = Date.now() }) {
    return this.store.transaction(() => {
      const row = this.selectVerificationById.get(verificationId);
      if (!row) throw httpError('验证码记录不存在', 400);
      if (row.status === 'used') {
        if (row.completion_request_key === requestKey && Number(row.completed_user_id) === Number(user.id)) {
          return { playerCreated: false, repeated: true, ban: this.invitations.activeBan(user.id) || null };
        }
        throw httpError('验证码已经使用', 409);
      }
      if (row.status !== 'sent') throw httpError('验证码不可用，请重新发送', 400);
      if (row.ip_fingerprint !== ipFingerprint) throw httpError('发送验证码和提交注册的网络不一致', 403);
      if (normalizeEmail(user.email) !== row.email) throw httpError('统一账号邮箱与验证码邮箱不一致', 409);

      const result = this.ensurePlayerRegistrationInTransaction({
        user,
        ipFingerprint,
        source: 'email_verification',
        inviteCode,
        invitationSource,
        invitationRequestKey: requestKey,
        now,
      });
      this.database.prepare(`
        UPDATE economy_email_verifications
        SET status = 'used', used_at = ?, completion_request_key = ?, completed_user_id = ?
        WHERE id = ? AND status = 'sent'
      `).run(now, requestKey, Number(user.id), verificationId);
      return { ...result, repeated: false };
    });
  }

  initializeSession({ user, ipFingerprint, inviteCode, requestKey, now = Date.now() }) {
    const existing = this.selectRegistrationByUser.get(Number(user.id));
    let result;
    if (existing) {
      this.invitations.ensureInviteCode(user.id, now);
      result = { playerCreated: false, repeated: true, invalidInvite: Boolean(inviteCode) };
    } else {
      result = this.store.transaction(() => this.ensurePlayerRegistrationInTransaction({
        user,
        ipFingerprint,
        source: 'homepage_session',
        inviteCode,
        invitationSource: 'share_link',
        invitationRequestKey: requestKey,
        now,
      }));
    }
    const ban = this.invitations.activeBan(user.id);
    return {
      playerCreated: Boolean(result.playerCreated),
      banned: Boolean(ban),
      incidentId: ban ? Number(ban.incident_id) : undefined,
      invitationBound: Boolean(result.relation),
      invalidInvite: Boolean(result.invalidInvite),
    };
  }

  ensureLoggedInPlayer({ user, ipFingerprint, now = Date.now() }) {
    const existing = this.selectRegistrationByUser.get(Number(user.id));
    if (existing) return { playerCreated: false, repeated: true, ban: this.invitations.activeBan(user.id) || null };
    return this.store.transaction(() => this.ensurePlayerRegistrationInTransaction({
      user,
      ipFingerprint,
      source: 'homepage_session',
      inviteCode: undefined,
      invitationRequestKey: `automatic:${Number(user.id)}:${now}`,
      now,
    }));
  }

  ensurePlayerRegistrationInTransaction({
    user,
    ipFingerprint,
    source,
    inviteCode,
    invitationSource,
    invitationRequestKey,
    now,
  }) {
    const { revision, world } = this.store.loadWorld(now);
    const userId = Number(user.id);
    const playerExisted = Boolean(world.players?.[String(userId)]);
    const registration = this.selectRegistrationByUser.get(userId);
    const registrationCreated = !registration;

    const player = this.ensurePlayer(world, user, now);
    const gemsBefore = player.gems;
    const invitationIssuedBefore = player.stats?.invitationGemsIssued;
    ensureGemState(player);
    let worldChanged = !playerExisted
      || gemsBefore !== player.gems
      || invitationIssuedBefore !== player.stats.invitationGemsIssued;

    if (registrationCreated) {
      this.insertRegistration.run(userId, normalizeEmail(user.email), ipFingerprint, now, source);
    }

    let invitationResult = {};
    if (registrationCreated) {
      invitationResult = this.invitations.processNewRegistrationInTransaction({
        world,
        user,
        ipFingerprint,
        inviteCode: playerExisted ? undefined : inviteCode,
        invitationSource,
        requestKey: invitationRequestKey || `registration:${userId}:${now}`,
        now,
      });
      worldChanged ||= Boolean(invitationResult.worldChanged);
    } else {
      this.invitations.ensureInviteCodeInTransaction(userId, now);
    }

    if (worldChanged) this.store.saveWorld(revision, world, now);
    return {
      playerCreated: !playerExisted,
      repeated: false,
      relation: invitationResult.relation,
      invalidInvite: invitationResult.invalidInvite,
      ban: invitationResult.ban || this.invitations.activeBan(userId) || null,
    };
  }

  assertPlayerActive(userId) {
    this.invitations.assertActive(userId);
  }

  getInvitationSummary(userId, now = Date.now()) {
    return this.invitations.getInvitationSummary(userId, now, this.publicOrigin);
  }

  claimManualInvitation(input) {
    return this.invitations.claimManualInvitation(input);
  }

  listBanIncidents() {
    return this.invitations.listBanIncidents();
  }

  getBanIncident(incidentId) {
    return this.invitations.getBanIncident(incidentId);
  }

  unbanUser(input) {
    return this.invitations.unbanUser(input);
  }

  unbanIncident(input) {
    return this.invitations.unbanIncident(input);
  }

  rebanUser(input) {
    return this.invitations.rebanUser(input);
  }

  getVerification(id) {
    return this.selectVerificationById.get(id);
  }

  getRegistration(userId) {
    return this.selectRegistrationByUser.get(Number(userId));
  }
}
