import { createHmac } from 'node:crypto';

export const INVITATION_REWARD_GEMS = 10;
export const INVITATION_CLAIM_WINDOW_MS = 24 * 60 * 60 * 1000;
const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function httpError(message, statusCode, extra = {}) {
  return Object.assign(new Error(message), { statusCode, ...extra });
}

export function normalizeInviteCode(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
}

export function deriveInviteCode(secret, userId, attempt = 0) {
  const digest = createHmac('sha256', secret)
    .update(`economy-invite-code\n${Number(userId)}\n${Number(attempt)}`)
    .digest();
  let code = '';
  for (let index = 0; index < 8; index += 1) {
    code += INVITE_ALPHABET[digest[index] % INVITE_ALPHABET.length];
  }
  return code;
}

export function ensureGemState(player) {
  const gems = Number(player?.gems);
  player.gems = Number.isSafeInteger(gems) && gems >= 0 ? gems : 0;
  player.stats ||= {};
  const issued = Number(player.stats.invitationGemsIssued);
  player.stats.invitationGemsIssued = Number.isSafeInteger(issued) && issued >= 0 ? issued : 0;
  return player;
}

export class EconomyInvitationStore {
  constructor(economyStore, { secret, ensurePlayer }) {
    this.store = economyStore;
    this.database = economyStore.database;
    this.secret = secret;
    this.ensurePlayer = ensurePlayer;
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS economy_invite_codes (
        user_id INTEGER PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
        created_at INTEGER NOT NULL,
        disabled_at INTEGER,
        disabled_by INTEGER,
        disabled_reason TEXT
      ) STRICT;
      CREATE TABLE IF NOT EXISTS economy_invitation_relations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invitee_user_id INTEGER NOT NULL UNIQUE,
        inviter_user_id INTEGER NOT NULL,
        invite_code TEXT NOT NULL,
        source TEXT NOT NULL CHECK (source IN ('share_link', 'manual_code')),
        status TEXT NOT NULL CHECK (status IN ('rewarded', 'blocked_same_ip', 'blocked_banned_account', 'revoked')),
        reward_gems INTEGER NOT NULL DEFAULT 0 CHECK (reward_gems >= 0),
        claimed_at INTEGER NOT NULL,
        rewarded_at INTEGER,
        request_key TEXT NOT NULL UNIQUE,
        CHECK (invitee_user_id <> inviter_user_id),
        FOREIGN KEY (invite_code) REFERENCES economy_invite_codes(code)
      ) STRICT;
      CREATE INDEX IF NOT EXISTS idx_economy_invitation_relations_inviter
        ON economy_invitation_relations(inviter_user_id, claimed_at DESC);
      CREATE TABLE IF NOT EXISTS economy_gem_ledger (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        amount INTEGER NOT NULL,
        balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
        category TEXT NOT NULL CHECK (category IN ('share_link_reward', 'invite_code_reward', 'admin_adjustment')),
        invitation_id INTEGER,
        description TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (invitation_id) REFERENCES economy_invitation_relations(id)
      ) STRICT;
      CREATE INDEX IF NOT EXISTS idx_economy_gem_ledger_user
        ON economy_gem_ledger(user_id, created_at DESC);
      CREATE TABLE IF NOT EXISTS economy_ip_ban_incidents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ip_fingerprint TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('active', 'reviewed', 'closed')),
        detected_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        detected_user_count INTEGER NOT NULL CHECK (detected_user_count >= 2),
        created_reason TEXT NOT NULL
      ) STRICT;
      CREATE INDEX IF NOT EXISTS idx_economy_ip_ban_incidents_fingerprint
        ON economy_ip_ban_incidents(ip_fingerprint, status, updated_at DESC);
      CREATE TABLE IF NOT EXISTS economy_ip_ban_members (
        incident_id INTEGER NOT NULL REFERENCES economy_ip_ban_incidents(id),
        user_id INTEGER NOT NULL,
        registered_at INTEGER NOT NULL,
        registration_source TEXT NOT NULL,
        PRIMARY KEY (incident_id, user_id)
      ) STRICT;
      CREATE TABLE IF NOT EXISTS economy_account_bans (
        user_id INTEGER PRIMARY KEY,
        status TEXT NOT NULL CHECK (status IN ('active', 'lifted')),
        reason TEXT NOT NULL CHECK (reason IN ('duplicate_registration_ip', 'admin')),
        incident_id INTEGER REFERENCES economy_ip_ban_incidents(id),
        banned_at INTEGER NOT NULL,
        banned_by INTEGER,
        unbanned_at INTEGER,
        unbanned_by INTEGER,
        admin_note TEXT NOT NULL DEFAULT ''
      ) STRICT;
      CREATE INDEX IF NOT EXISTS idx_economy_account_bans_status
        ON economy_account_bans(status, banned_at DESC);
      CREATE TABLE IF NOT EXISTS economy_ban_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        incident_id INTEGER,
        action TEXT NOT NULL CHECK (action IN ('ban', 'unban', 'reban')),
        actor_user_id INTEGER,
        note TEXT NOT NULL DEFAULT '',
        request_key TEXT UNIQUE,
        created_at INTEGER NOT NULL
      ) STRICT;
    `);

    this.selectInviteCodeByUser = this.database.prepare(`
      SELECT * FROM economy_invite_codes WHERE user_id = ?
    `);
    this.selectInviteCodeByCode = this.database.prepare(`
      SELECT * FROM economy_invite_codes WHERE code = ?
    `);
    this.insertInviteCode = this.database.prepare(`
      INSERT OR IGNORE INTO economy_invite_codes (user_id, code, enabled, created_at)
      VALUES (?, ?, 1, ?)
    `);
    this.selectInvitationByInvitee = this.database.prepare(`
      SELECT * FROM economy_invitation_relations WHERE invitee_user_id = ?
    `);
    this.selectInvitationByRequestKey = this.database.prepare(`
      SELECT * FROM economy_invitation_relations WHERE request_key = ?
    `);
    this.insertInvitation = this.database.prepare(`
      INSERT INTO economy_invitation_relations (
        invitee_user_id, inviter_user_id, invite_code, source, status,
        reward_gems, claimed_at, rewarded_at, request_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.insertGemLedger = this.database.prepare(`
      INSERT INTO economy_gem_ledger (
        user_id, amount, balance_after, category, invitation_id, description, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    this.selectRegistrationByUser = this.database.prepare(`
      SELECT * FROM economy_registrations WHERE user_id = ?
    `);
    this.selectRegistrationsByIp = this.database.prepare(`
      SELECT user_id, email, registration_ip_fingerprint, registered_at, source
      FROM economy_registrations WHERE registration_ip_fingerprint = ?
      ORDER BY registered_at, user_id
    `);
    this.selectDuplicateRegistrationIps = this.database.prepare(`
      SELECT registration_ip_fingerprint, COUNT(*) AS user_count
      FROM economy_registrations
      GROUP BY registration_ip_fingerprint
      HAVING COUNT(*) > 1
    `);
    this.selectLatestIncidentByIp = this.database.prepare(`
      SELECT * FROM economy_ip_ban_incidents
      WHERE ip_fingerprint = ?
      ORDER BY id DESC LIMIT 1
    `);
    this.insertIncident = this.database.prepare(`
      INSERT INTO economy_ip_ban_incidents (
        ip_fingerprint, status, detected_at, updated_at, detected_user_count, created_reason
      ) VALUES (?, 'active', ?, ?, ?, ?)
    `);
    this.updateIncident = this.database.prepare(`
      UPDATE economy_ip_ban_incidents
      SET status = 'active', updated_at = ?, detected_user_count = ?
      WHERE id = ?
    `);
    this.insertIncidentMember = this.database.prepare(`
      INSERT OR IGNORE INTO economy_ip_ban_members (
        incident_id, user_id, registered_at, registration_source
      ) VALUES (?, ?, ?, ?)
    `);
    this.upsertActiveBan = this.database.prepare(`
      INSERT INTO economy_account_bans (
        user_id, status, reason, incident_id, banned_at, banned_by,
        unbanned_at, unbanned_by, admin_note
      ) VALUES (?, 'active', 'duplicate_registration_ip', ?, ?, NULL, NULL, NULL, '')
      ON CONFLICT(user_id) DO UPDATE SET
        status = 'active',
        reason = 'duplicate_registration_ip',
        incident_id = excluded.incident_id,
        banned_at = excluded.banned_at,
        banned_by = NULL,
        unbanned_at = NULL,
        unbanned_by = NULL,
        admin_note = ''
    `);
    this.selectActiveBan = this.database.prepare(`
      SELECT * FROM economy_account_bans WHERE user_id = ? AND status = 'active'
    `);
    this.selectBanByUser = this.database.prepare(`
      SELECT * FROM economy_account_bans WHERE user_id = ?
    `);
    this.insertBanAudit = this.database.prepare(`
      INSERT INTO economy_ban_audit (
        user_id, incident_id, action, actor_user_id, note, request_key, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    this.selectBanAuditByRequestKey = this.database.prepare(`
      SELECT * FROM economy_ban_audit WHERE request_key = ?
    `);
    this.updateBanLifted = this.database.prepare(`
      UPDATE economy_account_bans
      SET status = 'lifted', unbanned_at = ?, unbanned_by = ?, admin_note = ?
      WHERE user_id = ? AND status = 'active'
    `);
    this.updateBanActive = this.database.prepare(`
      UPDATE economy_account_bans
      SET status = 'active', reason = 'admin', banned_at = ?, banned_by = ?,
          unbanned_at = NULL, unbanned_by = NULL, admin_note = ?
      WHERE user_id = ?
    `);
    this.selectIncidentMembers = this.database.prepare(`
      SELECT user_id FROM economy_ip_ban_members WHERE incident_id = ? ORDER BY user_id
    `);
    this.selectInvitationCounts = this.database.prepare(`
      SELECT
        COUNT(*) AS total_count,
        SUM(CASE WHEN source = 'share_link' AND status = 'rewarded' THEN 1 ELSE 0 END) AS share_count,
        SUM(CASE WHEN source = 'manual_code' AND status = 'rewarded' THEN 1 ELSE 0 END) AS manual_count,
        SUM(CASE WHEN status = 'rewarded' THEN reward_gems ELSE 0 END) AS gems_earned
      FROM economy_invitation_relations WHERE inviter_user_id = ?
    `);
    this.selectRecentInvitations = this.database.prepare(`
      SELECT invitee_user_id, source, status, reward_gems, claimed_at, rewarded_at
      FROM economy_invitation_relations
      WHERE inviter_user_id = ?
      ORDER BY claimed_at DESC LIMIT 10
    `);
    this.listBanIncidentsStatement = this.database.prepare(`
      SELECT i.id, i.status, i.detected_at, i.updated_at, i.detected_user_count,
             substr(i.ip_fingerprint, 1, 12) AS fingerprint_preview,
             SUM(CASE WHEN b.status = 'active' THEN 1 ELSE 0 END) AS active_ban_count
      FROM economy_ip_ban_incidents i
      LEFT JOIN economy_ip_ban_members m ON m.incident_id = i.id
      LEFT JOIN economy_account_bans b ON b.user_id = m.user_id
      GROUP BY i.id
      ORDER BY i.updated_at DESC LIMIT 200
    `);
    this.selectBanIncidentStatement = this.database.prepare(`
      SELECT * FROM economy_ip_ban_incidents WHERE id = ?
    `);
    this.selectBanIncidentMembersStatement = this.database.prepare(`
      SELECT m.user_id, m.registered_at, m.registration_source,
             r.email, b.status AS ban_status, b.banned_at, b.unbanned_at, b.admin_note
      FROM economy_ip_ban_members m
      LEFT JOIN economy_registrations r ON r.user_id = m.user_id
      LEFT JOIN economy_account_bans b ON b.user_id = m.user_id
      WHERE m.incident_id = ?
      ORDER BY m.registered_at, m.user_id
    `);

    this.reconcileDuplicateRegistrationIps();
  }

  ensureInviteCodeInTransaction(userId, now = Date.now()) {
    const normalizedUserId = Number(userId);
    const existing = this.selectInviteCodeByUser.get(normalizedUserId);
    if (existing) return existing;
    for (let attempt = 0; attempt < 64; attempt += 1) {
      const code = deriveInviteCode(this.secret, normalizedUserId, attempt);
      this.insertInviteCode.run(normalizedUserId, code, now);
      const inserted = this.selectInviteCodeByUser.get(normalizedUserId);
      if (inserted) return inserted;
    }
    throw new Error('无法生成唯一邀请码');
  }

  ensureInviteCode(userId, now = Date.now()) {
    return this.store.transaction(() => this.ensureInviteCodeInTransaction(userId, now));
  }

  activeBan(userId) {
    return this.selectActiveBan.get(Number(userId));
  }

  assertActive(userId) {
    const ban = this.activeBan(userId);
    if (!ban) return;
    throw httpError('检测到同一注册网络存在多个 Economy 账号，相关账号已被封禁', 423, {
      code: 'ECONOMY_ACCOUNT_BANNED',
      incidentId: Number(ban.incident_id),
    });
  }

  activateDuplicateIpBanInTransaction(ipFingerprint, now = Date.now(), { force = false } = {}) {
    const registrations = this.selectRegistrationsByIp.all(ipFingerprint);
    if (registrations.length < 2) return null;
    const incident = this.selectLatestIncidentByIp.get(ipFingerprint);
    const knownMembers = incident ? this.selectIncidentMembers.all(Number(incident.id)) : [];
    const knownUserIds = new Set(knownMembers.map((member) => Number(member.user_id)));
    const hasNewRegistration = registrations.some((registration) => !knownUserIds.has(Number(registration.user_id)));
    if (incident && !force && !hasNewRegistration) {
      return { incidentId: Number(incident.id), registrations, enforced: false };
    }
    let incidentId;
    if (incident) {
      incidentId = Number(incident.id);
      this.updateIncident.run(now, registrations.length, incidentId);
    } else {
      const inserted = this.insertIncident.run(
        ipFingerprint,
        now,
        now,
        registrations.length,
        '同一注册网络存在多个 Economy 账号',
      );
      incidentId = Number(inserted.lastInsertRowid);
    }
    for (const registration of registrations) {
      const userId = Number(registration.user_id);
      this.insertIncidentMember.run(
        incidentId,
        userId,
        Number(registration.registered_at),
        String(registration.source),
      );
      const previousBan = this.selectBanByUser.get(userId);
      this.upsertActiveBan.run(userId, incidentId, now);
      if (!previousBan || previousBan.status !== 'active' || Number(previousBan.incident_id) !== incidentId) {
        this.insertBanAudit.run(
          userId,
          incidentId,
          'ban',
          null,
          '系统检测到同一注册网络存在多个账号',
          null,
          now,
        );
      }
    }
    return { incidentId, registrations, enforced: true };
  }

  reconcileDuplicateRegistrationIps(now = Date.now()) {
    return this.store.transaction(() => {
      const incidents = [];
      for (const row of this.selectDuplicateRegistrationIps.all()) {
        const incident = this.activateDuplicateIpBanInTransaction(row.registration_ip_fingerprint, now);
        if (incident) incidents.push(incident);
      }
      return incidents;
    });
  }

  invitationByInvitee(userId) {
    return this.selectInvitationByInvitee.get(Number(userId));
  }

  resolveInviteCode(value) {
    const code = normalizeInviteCode(value);
    if (!/^[A-HJ-NP-Z2-9]{8}$/.test(code)) return null;
    const row = this.selectInviteCodeByCode.get(code);
    return row && Number(row.enabled) === 1 ? row : null;
  }

  createInvitationInTransaction({ world, user, inviteCode, source, requestKey, now, blockedReason = null }) {
    const inviteeUserId = Number(user.id);
    const repeated = this.selectInvitationByRequestKey.get(requestKey);
    if (repeated) {
      if (Number(repeated.invitee_user_id) !== inviteeUserId) {
        throw httpError('幂等键已被其他邀请领取使用', 409);
      }
      return { relation: repeated, worldChanged: false, repeated: true };
    }
    const existing = this.selectInvitationByInvitee.get(inviteeUserId);
    if (existing) return { relation: existing, worldChanged: false, repeated: true };
    const codeRow = this.resolveInviteCode(inviteCode);
    if (!codeRow) return { relation: null, worldChanged: false, invalid: true };
    const inviterUserId = Number(codeRow.user_id);
    if (inviterUserId === inviteeUserId) {
      throw httpError('不能填写自己的邀请码', 409);
    }
    const inviterBan = this.activeBan(inviterUserId);
    const inviteeBan = this.activeBan(inviteeUserId);
    let status = blockedReason;
    if (!status && (inviterBan || inviteeBan)) status = 'blocked_banned_account';
    let rewardGems = 0;
    let rewardedAt = null;
    let worldChanged = false;
    if (!status) {
      const inviter = world.players?.[String(inviterUserId)];
      if (!inviter) return { relation: null, worldChanged: false, invalid: true };
      ensureGemState(inviter);
      inviter.gems += INVITATION_REWARD_GEMS;
      inviter.stats.invitationGemsIssued += INVITATION_REWARD_GEMS;
      rewardGems = INVITATION_REWARD_GEMS;
      rewardedAt = now;
      status = 'rewarded';
      worldChanged = true;
    }
    const inserted = this.insertInvitation.run(
      inviteeUserId,
      inviterUserId,
      String(codeRow.code),
      source,
      status,
      rewardGems,
      now,
      rewardedAt,
      requestKey,
    );
    const relationId = Number(inserted.lastInsertRowid);
    if (rewardGems > 0) {
      const inviter = world.players[String(inviterUserId)];
      this.insertGemLedger.run(
        inviterUserId,
        rewardGems,
        inviter.gems,
        source === 'share_link' ? 'share_link_reward' : 'invite_code_reward',
        relationId,
        source === 'share_link'
          ? `好友通过分享链接完成注册，获得 ${rewardGems} 宝石`
          : `好友填写你的邀请码，获得 ${rewardGems} 宝石`,
        now,
      );
    }
    return {
      relation: this.selectInvitationByInvitee.get(inviteeUserId),
      worldChanged,
      repeated: false,
    };
  }

  processNewRegistrationInTransaction({ world, user, ipFingerprint, inviteCode, requestKey, now }) {
    ensureGemState(this.ensurePlayer(world, user, now));
    this.ensureInviteCodeInTransaction(user.id, now);
    const duplicate = this.activateDuplicateIpBanInTransaction(ipFingerprint, now, { force: true });
    if (!inviteCode) return { worldChanged: false, ban: this.activeBan(user.id) || null };
    const codeRow = this.resolveInviteCode(inviteCode);
    const inviterRegistration = codeRow
      ? this.selectRegistrationByUser.get(Number(codeRow.user_id))
      : null;
    const blockedReason = duplicate
      ? inviterRegistration?.registration_ip_fingerprint === ipFingerprint
        ? 'blocked_same_ip'
        : 'blocked_banned_account'
      : null;
    const invitation = this.createInvitationInTransaction({
      world,
      user,
      inviteCode,
      source: 'share_link',
      requestKey: `share:${requestKey}`,
      now,
      blockedReason,
    });
    return {
      worldChanged: invitation.worldChanged,
      relation: invitation.relation,
      invalidInvite: invitation.invalid,
      ban: this.activeBan(user.id) || null,
    };
  }

  claimManualInvitation({ user, inviteCode, requestKey, now = Date.now() }) {
    return this.store.transaction(() => {
      this.assertActive(user.id);
      const registration = this.selectRegistrationByUser.get(Number(user.id));
      if (!registration) throw httpError('当前账号尚未创建 Economy 玩家档案', 409);
      if (now > Number(registration.registered_at) + INVITATION_CLAIM_WINDOW_MS) {
        throw httpError('邀请码填写期限已结束', 409);
      }
      const existing = this.selectInvitationByInvitee.get(Number(user.id));
      if (existing) {
        if (existing.request_key === requestKey) return { repeated: true, relation: existing };
        throw httpError('当前账号已经绑定邀请关系', 409);
      }
      const codeRow = this.resolveInviteCode(inviteCode);
      if (!codeRow) throw httpError('邀请码不存在或已停用', 404);
      if (Number(codeRow.user_id) === Number(user.id)) throw httpError('不能填写自己的邀请码', 409);
      this.assertActive(codeRow.user_id);
      const inviterRegistration = this.selectRegistrationByUser.get(Number(codeRow.user_id));
      const sameIp = inviterRegistration
        && inviterRegistration.registration_ip_fingerprint === registration.registration_ip_fingerprint;
      const { revision, world } = this.store.loadWorld(now);
      const invitation = this.createInvitationInTransaction({
        world,
        user,
        inviteCode: codeRow.code,
        source: 'manual_code',
        requestKey,
        now,
        blockedReason: sameIp ? 'blocked_same_ip' : null,
      });
      if (invitation.worldChanged) this.store.saveWorld(revision, world, now);
      if (invitation.relation?.status === 'blocked_same_ip') {
        return {
          repeated: invitation.repeated,
          relation: invitation.relation,
          message: '邀请关系已记录，但双方注册网络相同，不发放邀请宝石',
        };
      }
      return {
        repeated: invitation.repeated,
        relation: invitation.relation,
        message: `邀请码绑定成功，邀请人已获得 ${INVITATION_REWARD_GEMS} 宝石`,
      };
    });
  }

  getInvitationSummary(userId, now = Date.now(), publicOrigin = 'https://game.riversoft.top') {
    return this.store.transaction(() => {
      const normalizedUserId = Number(userId);
      const codeRow = this.ensureInviteCodeInTransaction(normalizedUserId, now);
      const registration = this.selectRegistrationByUser.get(normalizedUserId);
      const relation = this.selectInvitationByInvitee.get(normalizedUserId);
      const counts = this.selectInvitationCounts.get(normalizedUserId);
      const { world } = this.store.loadWorld(now);
      const player = world.players?.[String(normalizedUserId)];
      if (player) ensureGemState(player);
      const recentInvitations = this.selectRecentInvitations.all(normalizedUserId).map((row) => ({
        playerName: world.players?.[String(row.invitee_user_id)]?.playerName || `玩家 ${row.invitee_user_id}`,
        source: row.source,
        status: row.status,
        rewardGems: Number(row.reward_gems),
        claimedAt: Number(row.claimed_at),
        rewardedAt: row.rewarded_at === null ? undefined : Number(row.rewarded_at),
      }));
      return {
        gems: Number(player?.gems || 0),
        inviteCode: String(codeRow.code),
        shareUrl: `${String(publicOrigin).replace(/\/$/, '')}/economy/?invite=${encodeURIComponent(codeRow.code)}`,
        rewardGems: INVITATION_REWARD_GEMS,
        successfulInvitations: Number(counts?.share_count || 0) + Number(counts?.manual_count || 0),
        shareLinkInvitations: Number(counts?.share_count || 0),
        manualCodeInvitations: Number(counts?.manual_count || 0),
        invitationGemsEarned: Number(counts?.gems_earned || 0),
        claimExpiresAt: relation || !registration
          ? undefined
          : Number(registration.registered_at) + INVITATION_CLAIM_WINDOW_MS,
        claimedInvitation: relation ? {
          inviterName: world.players?.[String(relation.inviter_user_id)]?.playerName || `玩家 ${relation.inviter_user_id}`,
          source: relation.source,
          status: relation.status,
          claimedAt: Number(relation.claimed_at),
        } : undefined,
        recentInvitations,
      };
    }, { immediate: false });
  }

  listBanIncidents() {
    return this.listBanIncidentsStatement.all().map((row) => ({
      ...row,
      id: Number(row.id),
      detected_at: Number(row.detected_at),
      updated_at: Number(row.updated_at),
      detected_user_count: Number(row.detected_user_count),
      active_ban_count: Number(row.active_ban_count || 0),
    }));
  }

  getBanIncident(incidentId) {
    const incident = this.selectBanIncidentStatement.get(Number(incidentId));
    if (!incident) throw httpError('封禁事件不存在', 404);
    const { ip_fingerprint: ipFingerprint, ...publicIncident } = incident;
    return {
      incident: {
        ...publicIncident,
        fingerprint_preview: String(ipFingerprint).slice(0, 12),
      },
      members: this.selectBanIncidentMembersStatement.all(Number(incidentId)),
    };
  }

  unbanUser({ userId, adminUserId, note, requestKey, now = Date.now() }) {
    return this.store.transaction(() => {
      const repeated = this.selectBanAuditByRequestKey.get(requestKey);
      if (repeated) return { ok: true, repeated: true, message: '账号已经按该请求处理' };
      const ban = this.selectBanByUser.get(Number(userId));
      if (!ban || ban.status !== 'active') throw httpError('账号当前未被封禁', 409);
      const changed = this.updateBanLifted.run(now, Number(adminUserId), String(note || ''), Number(userId));
      if (Number(changed.changes || 0) !== 1) throw httpError('账号解禁状态已经变化', 409);
      this.insertBanAudit.run(
        Number(userId), Number(ban.incident_id), 'unban', Number(adminUserId), String(note || ''), requestKey, now,
      );
      return { ok: true, repeated: false, message: '账号已解禁' };
    });
  }

  unbanIncident({ incidentId, adminUserId, note, requestKey, now = Date.now() }) {
    return this.store.transaction(() => {
      const repeated = this.selectBanAuditByRequestKey.get(requestKey);
      if (repeated) return { ok: true, repeated: true, message: '封禁事件已经按该请求处理' };
      const members = this.selectIncidentMembers.all(Number(incidentId));
      if (members.length === 0) throw httpError('封禁事件不存在或没有成员', 404);
      let changedCount = 0;
      for (const member of members) {
        const userId = Number(member.user_id);
        const changed = this.updateBanLifted.run(now, Number(adminUserId), String(note || ''), userId);
        if (Number(changed.changes || 0) === 1) {
          changedCount += 1;
          this.insertBanAudit.run(
            userId,
            Number(incidentId),
            'unban',
            Number(adminUserId),
            String(note || ''),
            changedCount === 1 ? requestKey : null,
            now,
          );
        }
      }
      this.database.prepare(`
        UPDATE economy_ip_ban_incidents SET status = 'reviewed', updated_at = ? WHERE id = ?
      `).run(now, Number(incidentId));
      return { ok: true, repeated: false, changedCount, message: `已解禁 ${changedCount} 个账号` };
    });
  }

  rebanUser({ userId, adminUserId, note, requestKey, now = Date.now() }) {
    return this.store.transaction(() => {
      const repeated = this.selectBanAuditByRequestKey.get(requestKey);
      if (repeated) return { ok: true, repeated: true, message: '账号已经按该请求处理' };
      const ban = this.selectBanByUser.get(Number(userId));
      if (!ban) throw httpError('账号没有封禁记录', 404);
      this.updateBanActive.run(now, Number(adminUserId), String(note || ''), Number(userId));
      this.insertBanAudit.run(
        Number(userId), Number(ban.incident_id), 'reban', Number(adminUserId), String(note || ''), requestKey, now,
      );
      return { ok: true, repeated: false, message: '账号已重新封禁' };
    });
  }
}
