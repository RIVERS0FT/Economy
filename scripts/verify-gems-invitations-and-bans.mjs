import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const failures = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const requireFile = (path) => { if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`); };
const requireText = (path, text) => { if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`); };
const forbidText = (path, text) => { if (read(path).includes(text)) failures.push(`${path} 不应包含: ${text}`); };

const files = [
  'server/src/invitations.js',
  'server/src/registration-store.js',
  'server/src/registration.js',
  'server/src/app.js',
  'server/src/storage.js',
  'server/test/invitations.test.js',
  'src/api/invitations.ts',
  'src/components/InvitationSettings.tsx',
  'src/components/AdminBanPanel.tsx',
  'src/app/AdminApp.tsx',
  'src/components/icons/GemIcon.tsx',
  'src/pages/GemShopPage.tsx',
  'src/pages/SettingsPage.tsx',
  'src/app/App.tsx',
  'src/app/LoginPage.tsx',
  'src/app/GameApp.tsx',
  'src/types.ts',
  'tests/browser/gem-shop-layout.spec.ts',
  'tests/browser/settings-layout.spec.ts',
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  'docs/GIFT_CODE_AND_ADMIN_DESIGN.md',
  'docs/REGISTRATION_INVITE_FLOW_DESIGN.md',
];
files.forEach(requireFile);

for (const text of [
  'INVITATION_REWARD_GEMS = 10',
  'CREATE TABLE IF NOT EXISTS economy_invite_codes',
  'CREATE TABLE IF NOT EXISTS economy_invitation_relations',
  'invitee_user_id INTEGER NOT NULL UNIQUE',
  "source IN ('share_link', 'manual_code')",
  'CREATE TABLE IF NOT EXISTS economy_gem_ledger',
  'CREATE TABLE IF NOT EXISTS economy_ip_ban_incidents',
  'CREATE TABLE IF NOT EXISTS economy_account_bans',
  'ECONOMY_ACCOUNT_BANNED',
  'activateDuplicateIpBanInTransaction',
  'processNewRegistrationInTransaction',
  'inviter.gems += INVITATION_REWARD_GEMS',
]) requireText('server/src/invitations.js', text);
for (const text of ['INVITATION_CLAIM_WINDOW_MS', 'claimManualInvitation(', 'claimExpiresAt:', 'claimedInvitation:']) {
  forbidText('server/src/invitations.js', text);
}
forbidText('server/src/registration-store.js', 'claimManualInvitation(');

for (const text of [
  "path === '/api/game/session'",
  "path === '/api/game/invitations'",
  "path === '/api/game/invitations/claim'",
  "sendError(response, 410, '邀请码只能在首次创建 Economy 玩家档案时填写，注册完成后不能补填')",
  "path === '/api/game/admin/bans'",
  '/unban$/',
  '/reban$/',
  '/unban-all$/',
  'registrationStore.assertPlayerActive',
  'inviteCode: body.inviteCode',
]) requireText('server/src/app.js', text);
const app = read('server/src/app.js');
if (app.indexOf("path === '/api/game/invitations/claim'") > app.indexOf('registrationStore.ensureLoggedInPlayer({')) {
  failures.push('退役邀请补填接口必须在普通玩家自动建档之前返回 410');
}

for (const text of [
  '邀请好友',
  '分享链接',
  '永久邀请码',
  '注册填写',
  '注册完成后不能补填或更换',
  '累计宝石',
]) requireText('src/components/InvitationSettings.tsx', text);
for (const text of ['填写好友邀请码', '确认填写', 'claimInvitation', 'claimExpiresAt', 'claimedInvitation']) {
  forbidText('src/components/InvitationSettings.tsx', text);
}
for (const text of ['claimInvitation', 'claimExpiresAt', 'claimedInvitation', '/claim']) {
  forbidText('src/api/invitations.ts', text);
}
for (const text of ["import { InvitationSettings }", '<InvitationSettings />', '邀请好友获得宝石']) {
  requireText('src/pages/GemShopPage.tsx', text);
}
forbidText('src/pages/SettingsPage.tsx', 'InvitationSettings');

for (const text of ['邀请码（可选）', 'name="inviteCode"', "defaultValue={inviteCode ?? ''}", '邀请码已自动填写']) {
  requireText('src/app/LoginPage.tsx', text);
}
for (const text of ['注册表单固定提供', '注册完成后不能补填', '`410 Gone`', '不得根据玩家档案创建时间重新开放 24 小时']) {
  requireText('docs/REGISTRATION_INVITE_FLOW_DESIGN.md', text);
}

for (const text of [
  '同 IP 账号封禁',
  'unbanIncident',
  'unbanUser',
  'rebanUser',
]) requireText('src/components/AdminBanPanel.tsx', text);
for (const text of ["activeSection === 'bans'", '<AdminBanPanel']) requireText('src/app/AdminApp.tsx', text);
forbidText('src/app/App.tsx', "path === '/economy/admin/bans'");
forbidText('src/pages/SettingsPage.tsx', '/economy/admin/bans');
if (existsSync(resolve(root, 'src/app/AdminBanApp.tsx'))) failures.push('独立封禁页面 AdminBanApp 不得恢复');

for (const text of [
  'gems: number;',
  'invitationGemsIssued: number;',
  'gemExchangeCredits: number;',
  'version: 17;',
]) requireText('src/types.ts', text);

for (const text of [
  '宝石不参与商品或工厂订单',
  '注册事务邀请归因',
  '注册完成后不能补填',
  '商店兑换普通货币继续直接发行新货币',
]) requireText('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', text);
for (const text of ['专属分享链接', '永久邀请码', '邀请卡唯一归属商店', '注册完成后不允许补填']) {
  requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', text);
}
for (const text of ['同一注册 IP', '423 Locked', 'ECONOMY_ACCOUNT_BANNED', '固定返回 `410 Gone`']) {
  requireText('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', text);
}
for (const text of ['账号封禁', '手动解禁', '解禁不得自动补发']) requireText('docs/GIFT_CODE_AND_ADMIN_DESIGN.md', text);

for (const text of [
  'registration form invite code rewards inviter once inside first-profile transaction',
  'existing Economy profile ignores invite parameters and can never be backfilled',
  'same-IP registration form code is recorded without a gem reward',
  "assert.equal('claimExpiresAt' in summary, false)",
]) requireText('server/test/invitations.test.js', text);

if (failures.length) {
  console.error(`宝石、注册期邀请与封禁验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('宝石、邀请与封禁验证通过：邀请只在首次建档事务中归因，商店承载邀请卡，旧补填接口 410，同 IP 封禁与管理员解禁规则均已锁定。');
