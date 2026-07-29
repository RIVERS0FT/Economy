from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected one exact match, found {count}: {old[:160]!r}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


path = 'server/src/invitations.js'
replace_once(path, """    const migrationNow = Date.now();
    const migratedAutoBans = this.database.prepare(`
      INSERT OR IGNORE INTO economy_ban_audit (
        user_id, incident_id, action, actor_user_id, note, request_key, created_at
      )
      SELECT
        user_id,
        incident_id,
        'unban',
        NULL,
        '规则迁移：自动封禁改为异常上报',
        'migration:auto-ban-report-only:' || user_id,
        ?
      FROM economy_account_bans
      WHERE status = 'active'
        AND reason = 'duplicate_registration_ip'
        AND banned_by IS NULL
    `).run(migrationNow);
    if (Number(migratedAutoBans.changes || 0) > 0) {
      this.database.prepare(`
        UPDATE economy_account_bans
        SET status = 'lifted',
            unbanned_at = ?,
            unbanned_by = NULL,
            admin_note = '规则迁移：自动封禁改为异常上报'
        WHERE status = 'active'
          AND reason = 'duplicate_registration_ip'
          AND banned_by IS NULL
      `).run(migrationNow);
      this.database.prepare(`
        UPDATE economy_ip_ban_incidents
        SET status = 'active', updated_at = ?
        WHERE id IN (
          SELECT DISTINCT incident_id
          FROM economy_account_bans
          WHERE reason = 'duplicate_registration_ip'
            AND admin_note = '规则迁移：自动封禁改为异常上报'
            AND incident_id IS NOT NULL
        )
      `).run(migrationNow);
    }
""", """    const migrationNow = Date.now();
    this.database.prepare(`
      INSERT OR IGNORE INTO economy_ban_audit (
        user_id, incident_id, action, actor_user_id, note, request_key, created_at
      )
      SELECT
        user_id,
        incident_id,
        'unban',
        NULL,
        '规则迁移：自动封禁改为异常上报',
        'migration:auto-ban-report-only:' || user_id,
        ?
      FROM economy_account_bans
      WHERE status = 'active'
        AND reason = 'duplicate_registration_ip'
        AND banned_by IS NULL
    `).run(migrationNow);
    this.database.prepare(`
      UPDATE economy_account_bans
      SET status = 'lifted',
          unbanned_at = COALESCE(unbanned_at, ?),
          unbanned_by = NULL,
          admin_note = '规则迁移：自动封禁改为异常上报'
      WHERE status = 'active'
        AND reason = 'duplicate_registration_ip'
        AND banned_by IS NULL
    `).run(migrationNow);
    this.database.prepare(`
      UPDATE economy_ip_ban_incidents
      SET status = 'active', updated_at = MAX(updated_at, ?)
      WHERE id IN (
        SELECT DISTINCT incident_id
        FROM economy_account_bans
        WHERE reason = 'duplicate_registration_ip'
          AND admin_note = '规则迁移：自动封禁改为异常上报'
          AND incident_id IS NOT NULL
      )
    `).run(migrationNow);
""")
replace_once(path, """    this.selectIncidentMembers = this.database.prepare(`
      SELECT user_id FROM economy_ip_ban_members WHERE incident_id = ? ORDER BY user_id
    `);
""", """    this.selectIncidentMembers = this.database.prepare(`
      SELECT user_id FROM economy_ip_ban_members WHERE incident_id = ? ORDER BY user_id
    `);
    this.selectIncidentMember = this.database.prepare(`
      SELECT 1 AS present
      FROM economy_ip_ban_members
      WHERE incident_id = ? AND user_id = ?
    `);
""")
replace_once(path, """  assertActive(userId) {
    const ban = this.activeBan(userId);
    if (!ban) return;
    throw httpError('该账号已被管理员封禁，请联系管理员复核', 423, {
      code: 'ECONOMY_ACCOUNT_BANNED',
      incidentId: Number(ban.incident_id),
    });
  }
""", """  assertActive(userId) {
    const ban = this.activeBan(userId);
    if (!ban) return;
    const incidentId = ban.incident_id === null ? undefined : Number(ban.incident_id);
    throw httpError('该账号已被管理员封禁，请联系管理员复核', 423, {
      code: 'ECONOMY_ACCOUNT_BANNED',
      ...(incidentId === undefined ? {} : { incidentId }),
    });
  }
""")
replace_once(path, """    if (!incident) throw httpError('封禁事件不存在', 404);
""", """    if (!incident) throw httpError('异常事件不存在', 404);
""")
replace_once(path, """      const normalizedIncidentId = incidentId === null || incidentId === undefined
        ? existing?.incident_id ?? null
        : Number(incidentId);
      this.upsertManualBan.run(
""", """      const normalizedIncidentId = incidentId === null || incidentId === undefined
        ? existing?.incident_id ?? null
        : Number(incidentId);
      if (normalizedIncidentId !== null) {
        if (!this.selectBanIncidentStatement.get(normalizedIncidentId)) {
          throw httpError('异常事件不存在', 404);
        }
        if (!this.selectIncidentMember.get(normalizedIncidentId, normalizedUserId)) {
          throw httpError('账号不属于该异常事件', 409);
        }
      }
      this.upsertManualBan.run(
""")

path = 'server/test/invitations.test.js'
p = Path(path)
text = p.read_text(encoding='utf-8')
test_name = 'legacy automatic-ban migration remains idempotent after an audit-only partial attempt'
if test_name not in text:
    text += """

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
"""
    p.write_text(text, encoding='utf-8')

path = 'scripts/verify-gems-invitations-and-bans.mjs'
replace_once(path, """  'review survives restart and a new same-IP account only reopens the report',
  'same-IP registration form code is recorded without a gem reward',
""", """  'review survives restart and a new same-IP account only reopens the report',
  'same-IP registration form code is recorded without a gem reward',
  'legacy automatic-ban migration remains idempotent after an audit-only partial attempt',
""")

path = 'docs/GIFT_CODE_AND_ADMIN_DESIGN.md'
replace_once(path, """普通游戏接口只根据活动中的管理员封禁返回 `423 Locked` 与 `ECONOMY_ACCOUNT_BANNED`；异常事件本身不得触发 423。历史 `reason = duplicate_registration_ip`、`banned_by IS NULL` 的活动自动封禁在部署迁移时一次性解除并重新进入待复核，管理员已有手动封禁保持不变。
""", """普通游戏接口只根据活动中的管理员封禁返回 `423 Locked` 与 `ECONOMY_ACCOUNT_BANNED`；异常事件本身不得触发 423。历史 `reason = duplicate_registration_ip`、`banned_by IS NULL` 的活动自动封禁在部署迁移时解除并重新进入待复核，管理员已有手动封禁保持不变。迁移必须可恢复且幂等：即使迁移审计已经写入而解禁步骤曾被中断，后续启动仍必须完成解禁，且不得重复写审计。
""")

path = 'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md'
replace_once(path, """邀请专项验收必须覆盖分享链接即时奖励、手动邀请码唯一绑定、同 IP 全组封禁、423 响应和管理员解禁。
""", """邀请与封禁专项验收必须覆盖分享链接即时奖励、手动邀请码唯一绑定、同 IP 异常上报不封禁、管理员手动封禁、423 响应、历史自动封禁幂等迁移和管理员解禁。
""")

path = 'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md'
replace_once(path, """相同注册 IP 的邀请关系记录为 `blocked_same_ip` 且不发放宝石，但双方账号不会因此被封禁；管理员后续处理不得自动补发奖励。已有 Economy 档案不得补绑、重复奖励或更换邀请人。
""", """相同注册 IP 的邀请关系记录为 `blocked_same_ip` 且不发放宝石，但双方账号不会因此被封禁；管理员后续处理不得自动补发奖励。注册事务提交后，已有 Economy 档案不得补绑、重复奖励或更换邀请人。
""")

for temporary_path in [
    '.agent-harden.py',
    '.agent-manual-ban-trigger',
    '.github/workflows/agent-harden-manual-bans.yml',
]:
    Path(temporary_path).unlink(missing_ok=True)

print('manual-ban hardening patch applied')
