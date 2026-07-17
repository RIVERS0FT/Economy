import { readFileSync, writeFileSync } from 'node:fs';

function replaceOne(path, before, after) {
  const source = readFileSync(path, 'utf8');
  if (!source.includes(before)) throw new Error(`${path} 缺少预期片段`);
  writeFileSync(path, source.replace(before, after));
}

replaceOne(
  'server/src/app.js',
  `          inviteCode: body.inviteCode,\n          ipFingerprint,`,
  `          inviteCode: body.inviteCode,\n          invitationSource: body.invitationSource,\n          ipFingerprint,`,
);

replaceOne(
  'server/src/registration.js',
  `    async complete({ email, password, code, inviteCode, ipFingerprint, requestKey, now = Date.now() }) {`,
  `    async complete({ email, password, code, inviteCode, invitationSource, ipFingerprint, requestKey, now = Date.now() }) {`,
);
replaceOne(
  'server/src/registration.js',
  `        inviteCode,\n        now,`,
  `        inviteCode,\n        invitationSource,\n        now,`,
);

replaceOne(
  'server/src/registration-store.js',
  `  completeEmailRegistration({ verificationId, requestKey, user, ipFingerprint, inviteCode, now = Date.now() }) {`,
  `  completeEmailRegistration({ verificationId, requestKey, user, ipFingerprint, inviteCode, invitationSource, now = Date.now() }) {`,
);
replaceOne(
  'server/src/registration-store.js',
  `        inviteCode,\n        invitationRequestKey: requestKey,`,
  `        inviteCode,\n        invitationSource,\n        invitationRequestKey: requestKey,`,
);
replaceOne(
  'server/src/registration-store.js',
  `        inviteCode,\n        invitationRequestKey: requestKey,\n        now,`,
  `        inviteCode,\n        invitationSource: 'share_link',\n        invitationRequestKey: requestKey,\n        now,`,
);
replaceOne(
  'server/src/registration-store.js',
  `    inviteCode,\n    invitationRequestKey,`,
  `    inviteCode,\n    invitationSource,\n    invitationRequestKey,`,
);
replaceOne(
  'server/src/registration-store.js',
  `        inviteCode: playerExisted ? undefined : inviteCode,\n        requestKey: invitationRequestKey ||`,
  `        inviteCode: playerExisted ? undefined : inviteCode,\n        invitationSource,\n        requestKey: invitationRequestKey ||`,
);

replaceOne(
  'server/src/invitations.js',
  `  processNewRegistrationInTransaction({ world, user, ipFingerprint, inviteCode, requestKey, now }) {`,
  `  processNewRegistrationInTransaction({ world, user, ipFingerprint, inviteCode, invitationSource, requestKey, now }) {`,
);
replaceOne(
  'server/src/invitations.js',
  `    const invitation = this.createInvitationInTransaction({\n      world,`,
  `    const source = invitationSource === 'manual_code' ? 'manual_code' : 'share_link';\n    const invitation = this.createInvitationInTransaction({\n      world,`,
);
replaceOne(
  'server/src/invitations.js',
  `      source: 'share_link',\n      requestKey: \`share:\${requestKey}\`,`,
  `      source,\n      requestKey: \`registration:\${source}:\${requestKey}\`,`,
);
replaceOne(
  'server/src/invitations.js',
  `        claimedInvitation: relation ? {\n          inviterName:`,
  `        claimedInvitation: relation ? {\n          inviteCode: String(relation.invite_code),\n          inviterName:`,
);

replaceOne(
  'src/api/invitations.ts',
  `  claimedInvitation?: {\n    inviterName: string;`,
  `  claimedInvitation?: {\n    inviteCode: string;\n    inviterName: string;`,
);

replaceOne(
  'src/components/InvitationSettings.tsx',
  `          {summary.claimedInvitation ? (\n            <div className="invitation-bound-state">\n              <strong>邀请关系已绑定</strong>\n              <span>邀请人：{summary.claimedInvitation.inviterName}</span>\n              <span>来源：{sourceLabel(summary.claimedInvitation.source)}</span>\n              <span>状态：{statusLabel(summary.claimedInvitation.status)}</span>\n              <small>{formatDate(summary.claimedInvitation.claimedAt)}</small>\n            </div>\n          ) : (\n            <div className="manual-invite-claim">\n              <label>\n                填写好友邀请码\n                <input\n                  value={inviteCode}\n                  maxLength={8}\n                  autoComplete="off"\n                  placeholder="8 位邀请码"\n                  onChange={(event) => setInviteCode(event.target.value.toUpperCase())}\n                  onKeyDown={(event) => { if (event.key === 'Enter') void claim(); }}\n                />\n              </label>\n              <p>首次创建 Economy 玩家档案后的 24 小时内可以填写一次。填写成功后，邀请人立即获得宝石。</p>\n              <Button disabled={!inviteCode.trim() || claiming} onClick={() => void claim()}>\n                {claiming ? '正在绑定…' : '确认填写'}\n              </Button>\n            </div>\n          )}`,
  `          {summary.claimedInvitation ? (\n            <div className="manual-invite-claim invitation-bound-state">\n              <label>\n                已填写的邀请码\n                <input\n                  value={summary.claimedInvitation.inviteCode}\n                  disabled\n                  aria-label="已填写的邀请码"\n                />\n              </label>\n              <strong>邀请关系已绑定，邀请码不可修改</strong>\n              <span>邀请人：{summary.claimedInvitation.inviterName}</span>\n              <span>来源：{sourceLabel(summary.claimedInvitation.source)}</span>\n              <span>状态：{statusLabel(summary.claimedInvitation.status)}</span>\n              <small>{formatDate(summary.claimedInvitation.claimedAt)}</small>\n            </div>\n          ) : (\n            <div className="manual-invite-claim">\n              <label>\n                填写好友邀请码\n                <input\n                  value={inviteCode}\n                  maxLength={8}\n                  autoComplete="off"\n                  placeholder="8 位邀请码"\n                  onChange={(event) => setInviteCode(event.target.value.toUpperCase())}\n                  onKeyDown={(event) => { if (event.key === 'Enter') void claim(); }}\n                />\n              </label>\n              <p>注册时可以直接填写邀请码；未填写的账号仍可在首次创建 Economy 玩家档案后的 24 小时内填写一次。</p>\n              <Button disabled={!inviteCode.trim() || claiming} onClick={() => void claim()}>\n                {claiming ? '正在绑定…' : '确认填写'}\n              </Button>\n            </div>\n          )}`,
);

replaceOne(
  'src/styles/invitations.css',
  `.invitation-bound-state span,\n.invitation-bound-state small {\n  display: block;\n}`,
  `.invitation-bound-state span,\n.invitation-bound-state small {\n  display: block;\n}\n\n.invitation-bound-state input:disabled {\n  color: var(--text-muted, rgba(127, 127, 127, 0.9));\n  background: var(--surface-muted, rgba(127, 127, 127, 0.12));\n  cursor: not-allowed;\n  opacity: 1;\n}`,
);

replaceOne(
  'server/test/registration.test.js',
  `      inviteCode, ipFingerprint: 'ip-a', requestKey: 'complete-share-1', now: now + 2,`,
  `      inviteCode, invitationSource: 'share_link',\n      ipFingerprint: 'ip-a', requestKey: 'complete-share-1', now: now + 2,`,
);
replaceOne(
  'server/test/registration.test.js',
  `    assert.equal(relation.status, 'rewarded');\n  } finally { context.store.close(); }\n});\n\ntest('enforces ten-minute expiry`,
  `    assert.equal(relation.status, 'rewarded');\n    const summary = context.registrationStore.getInvitationSummary(7, now + 3);\n    assert.equal(summary.claimedInvitation.inviteCode, inviteCode);\n  } finally { context.store.close(); }\n});\n\ntest('accepts a manually entered invite code during registration and rewards immediately', async () => {\n  const context = setup();\n  try {\n    const now = 1_700_000_100_000;\n    context.registrationStore.ensureLoggedInPlayer({\n      user: { id: 1, email: 'inviter@example.com', name: '邀请人' }, ipFingerprint: 'ip-inviter', now,\n    });\n    const inviteCode = context.registrationStore.invitations.ensureInviteCode(1, now).code;\n    const code = await send(context, now + 1, 'send-manual-register');\n    await context.service.complete({\n      email: 'alice@example.com', password: 'password123', code,\n      inviteCode, invitationSource: 'manual_code',\n      ipFingerprint: 'ip-a', requestKey: 'complete-manual-register', now: now + 2,\n    });\n    const world = context.store.loadWorld(now + 3).world;\n    assert.equal(world.players['1'].gems, 10);\n    assert.equal(world.players['7'].gems, 0);\n    const relation = context.registrationStore.invitations.invitationByInvitee(7);\n    assert.equal(relation.source, 'manual_code');\n    assert.equal(relation.invite_code, inviteCode);\n    assert.equal(context.registrationStore.getInvitationSummary(7, now + 3).claimedInvitation.inviteCode, inviteCode);\n  } finally { context.store.close(); }\n});\n\ntest('enforces ten-minute expiry`,
);

writeFileSync('docs/REGISTRATION_INVITE_FLOW_DESIGN.md', `# Economy 注册邀请码流程设计\n\n> 状态：当前权威补充设计  \n> 更新时间：2026-07-17\n\n## 规则\n\n- 注册表单固定提供“邀请码（可选）”输入框。\n- 访问 \\`/economy/?invite=ABCDEFGH\\` 时，客户端自动切换到注册模式并把链接邀请码预填进该输入框。\n- 用户可以在提交注册前清空或修改邀请码；最终提交值由服务器规范化与校验。\n- 链接中预填且未被修改的邀请码记为 \\`share_link\\`；用户自行输入或修改后的邀请码记为 \\`manual_code\\`。\n- 有效邀请码与统一账号首次创建 Economy 玩家档案处于同一事务，注册完成后邀请人立即获得 10 宝石，被邀请人不获得宝石。\n- 无效邀请码不得阻止统一账号注册；只是不创建邀请关系或发放宝石。\n- 每个被邀请账号最多绑定一条邀请关系。注册成功后不得更换邀请码。\n- 设置页必须显示实际绑定的邀请码。该输入框使用 \\`disabled\\` 状态和灰色样式，不允许修改、再次提交或替换邀请人。\n- 注册时未填写邀请码的账号，仍可在首次创建 Economy 玩家档案后的 24 小时内通过设置页填写一次；成功后同样锁定显示。\n- 邀请码、邀请关系与奖励状态均以服务器和 SQLite 记录为准，不得只保存在 URL、本地存储或客户端状态。\n\n## 防回退\n\n不得移除注册邀请码输入框，不得让分享链接只在后台隐式归因而不预填输入框，不得在绑定成功后恢复可编辑状态，也不得将已绑定邀请码错误显示为玩家自己的邀请码。\n`);

replaceOne(
  'scripts/verify-gems-invitations-and-bans.mjs',
  `  'src/app/App.tsx',\n  'src/app/GameApp.tsx',`,
  `  'src/app/App.tsx',\n  'src/app/LoginPage.tsx',\n  'src/app/GameApp.tsx',`,
);
replaceOne(
  'scripts/verify-gems-invitations-and-bans.mjs',
  `  'docs/GIFT_CODE_AND_ADMIN_DESIGN.md',\n];`,
  `  'docs/GIFT_CODE_AND_ADMIN_DESIGN.md',\n  'docs/REGISTRATION_INVITE_FLOW_DESIGN.md',\n];`,
);
replaceOne(
  'scripts/verify-gems-invitations-and-bans.mjs',
  `  '填写好友邀请码',\n  '累计宝石',`,
  `  '填写好友邀请码',\n  '已填写的邀请码',\n  'disabled',\n  '累计宝石',`,
);
replaceOne(
  'scripts/verify-gems-invitations-and-bans.mjs',
  `]) requireText('src/components/InvitationSettings.tsx', text);\n\nfor (const text of [\n  '同 IP 账号封禁',`,
  `]) requireText('src/components/InvitationSettings.tsx', text);\nfor (const text of ['邀请码（可选）', 'name="inviteCode"', "defaultValue={inviteCode ?? ''}", '邀请码已自动填写']) {\n  requireText('src/app/LoginPage.tsx', text);\n}\nfor (const text of ['注册表单固定提供', '分享链接', 'disabled', '不得更换邀请码']) {\n  requireText('docs/REGISTRATION_INVITE_FLOW_DESIGN.md', text);\n}\n\nfor (const text of [\n  '同 IP 账号封禁',`,
);

console.log('注册邀请码流程修改完成');
