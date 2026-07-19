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
  'src/pages/SettingsPage.tsx',
  'src/app/App.tsx',
  'src/app/LoginPage.tsx',
  'src/app/GameApp.tsx',
  'src/types.ts',
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  'docs/GIFT_CODE_AND_ADMIN_DESIGN.md',
  'docs/REGISTRATION_INVITE_FLOW_DESIGN.md',
];
files.forEach(requireFile);

for (const text of [
  'INVITATION_REWARD_GEMS = 10',
  'INVITATION_CLAIM_WINDOW_MS = 24 * 60 * 60 * 1000',
  'CREATE TABLE IF NOT EXISTS economy_invite_codes',
  'CREATE TABLE IF NOT EXISTS economy_invitation_relations',
  'invitee_user_id INTEGER NOT NULL UNIQUE',
  "source IN ('share_link', 'manual_code')",
  'CREATE TABLE IF NOT EXISTS economy_gem_ledger',
  'CREATE TABLE IF NOT EXISTS economy_ip_ban_incidents',
  'CREATE TABLE IF NOT EXISTS economy_account_bans',
  'ECONOMY_ACCOUNT_BANNED',
  'activateDuplicateIpBanInTransaction',
  'claimManualInvitation',
  'inviter.gems += INVITATION_REWARD_GEMS',
]) requireText('server/src/invitations.js', text);

for (const text of [
  "path === '/api/game/session'",
  "path === '/api/game/invitations'",
  "path === '/api/game/invitations/claim'",
  "path === '/api/game/admin/bans'",
  '/unban$/',
  '/reban$/',
  '/unban-all$/',
  'registrationStore.assertPlayerActive',
  'inviteCode: body.inviteCode',
]) requireText('server/src/app.js', text);

for (const text of [
  '邀请好友',
  '分享链接',
  '我的邀请码',
  '填写好友邀请码',
  '已填写的邀请码',
  'disabled',
  '累计宝石',
]) requireText('src/components/InvitationSettings.tsx', text);
for (const text of ['邀请码（可选）', 'name="inviteCode"', "defaultValue={inviteCode ?? ''}", '邀请码已自动填写']) {
  requireText('src/app/LoginPage.tsx', text);
}
for (const text of ['注册表单固定提供', '分享链接', 'disabled', '不得更换邀请码']) {
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
  'version: 15;',
]) requireText('src/types.ts', text);

for (const text of [
  '宝石不参与商品或工厂订单',
  '分享链接注册',
  '手动邀请码',
]) requireText('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', text);
for (const text of ['专属分享链接', '永久邀请码', '24 小时内']) requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', text);
for (const text of ['同一注册 IP', '423 Locked', 'ECONOMY_ACCOUNT_BANNED']) requireText('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', text);
for (const text of ['账号封禁', '手动解禁', '解禁不得自动补发']) requireText('docs/GIFT_CODE_AND_ADMIN_DESIGN.md', text);

forbidText('src/pages/SettingsPage.tsx', '第一阶段不生成邀请码、邀请奖励或归因记录');
forbidText('src/pages/SettingsPage.tsx', "const inviteUrl = `${window.location.origin}/economy/`");
forbidText('server/src/registration-store.js', "source !== 'homepage_session'");

if (failures.length) {
  console.error(`宝石、邀请与封禁验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('宝石、邀请与封禁验证通过：服务器权威宝石、双邀请入口、立即奖励、同 IP 全组封禁、管理员解禁、版本与防回退规则均已锁定。');
