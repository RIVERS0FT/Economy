import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const failures = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const requireFile = (path) => { if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`); };
const requireText = (path, text) => { if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`); };
const forbidText = (path, text) => { if (read(path).includes(text)) failures.push(`${path} 不应包含: ${text}`); };

const files = [
  'server/src/app.js',
  'server/src/account-client.js',
  'server/src/email.js',
  'server/src/registration.js',
  'server/src/registration-store.js',
  'server/src/invitations.js',
  'server/test/email.test.js',
  'server/test/account-client.test.js',
  'server/test/registration.test.js',
  'server/test/invitations.test.js',
  'src/api/auth.ts',
  'src/api/invitations.ts',
  'src/app/LoginPage.tsx',
  'src/app/App.tsx',
  'src/pages/SettingsPage.tsx',
  'src/pages/GemShopPage.tsx',
  'src/components/InvitationSettings.tsx',
  'scripts/configure-economy-registration-nginx.py',
  'scripts/verify-production-deployment.sh',
  'scripts/test_configure_economy_registration_nginx.py',
  '.github/workflows/configure-registration-email.yml',
  'docs/README.md',
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/GIFT_CODE_AND_ADMIN_DESIGN.md',
  'docs/REGISTRATION_INVITE_FLOW_DESIGN.md',
];
files.forEach(requireFile);

for (const text of [
  'CREATE TABLE IF NOT EXISTS economy_email_verifications',
  'code_hmac TEXT NOT NULL',
  'ip_fingerprint TEXT NOT NULL',
  "status IN ('pending', 'sent', 'failed', 'expired', 'invalid', 'used')",
  'EMAIL_CODE_TTL_MS = 10 * 60 * 1000',
  'EMAIL_CODE_RESEND_MS = 60 * 1000',
  'EMAIL_CODE_MAX_ERRORS = 5',
  'completion_request_key TEXT',
  'CREATE TABLE IF NOT EXISTS economy_registrations',
  "source IN ('email_verification', 'homepage_session')",
  'initializeSession',
  'assertPlayerActive',
  'processNewRegistrationInTransaction',
]) requireText('server/src/registration-store.js', text);
for (const text of ['code TEXT', 'verification_code TEXT', 'plain_code']) forbidText('server/src/registration-store.js', text);
forbidText('server/src/registration-store.js', "source !== 'homepage_session'");
forbidText('server/src/registration-store.js', 'claimManualInvitation');

for (const text of [
  "const RESEND_ENDPOINT = 'https://api.resend.com/emails'",
  'const EMAIL_TIMEOUT_MS = 8_000',
  "'Idempotency-Key': idempotencyKey",
  'RESEND_API_KEY',
  'EMAIL_FROM',
  'getRegistrationEmailConfiguration',
  'statusCode: 424',
  'EMAIL_SERVICE_NOT_CONFIGURED',
  '邮箱验证码服务未配置，请联系管理员',
]) requireText('server/src/email.js', text);
forbidText('server/src/email.js', 'RESEND_FROM_EMAIL');
forbidText('server/src/email.js', 'console.');

for (const text of [
  "path === '/api/registration/email-code'",
  "path === '/api/registration/complete'",
  "path === '/api/game/session'",
  "path === '/api/game/invitations/claim'",
  'registrationStore.ensureLoggedInPlayer',
  'registrationStore.assertPlayerActive',
  'registrationStore.sessionBootstrapMode',
  'registrationStore.readExistingSession',
  'sessionMetadataWriteOptions(user)',
  "userWriteOptions(user, 'session-profile-creation')",
  'const registrationActor = `system:registration-retention:',
  "'Set-Cookie': account.setCookie",
  'inviteCode: body.inviteCode',
  "sendError(response, 410, '邀请码只能在首次创建 Economy 玩家档案时填写，注册完成后不能补填')",
]) requireText('server/src/app.js', text);

for (const text of [
  "requestAccount('/api/internal/account-email-exists'",
  'assertUnifiedAccountEmailAvailable',
  '该邮箱已注册，请直接登录',
  "requestAccount('/api/register'",
  "requestAccount('/api/login'",
  'registration.status === 409',
]) requireText('server/src/account-client.js', text);

for (const text of [
  'accountAvailabilityChecker',
  'await accountAvailabilityChecker({ email: normalizedEmail })',
  'actor: `system:registration:',
  'actor: `user:${Number(account.user.id)}`',
  'inviteCode',
  "request.headers['x-real-ip']",
  '.at(-1)',
]) requireText('server/src/registration.js', text);

for (const text of [
  'sendRegistrationEmailCode',
  'completeRegistration',
  'sendPasswordResetEmailCode',
  'resetPassword',
  'initializeEconomySession',
  "'/registration/email-code'",
  "'/registration/complete'",
  "'/password-reset/email-code'",
  "'/password-reset/complete'",
  "'/game/session'",
]) requireText('src/api/auth.ts', text);
for (const text of ['HOMEPAGE_ACCOUNT_API_BASE', 'registerAtHomepage', "'/register'"]) forbidText('src/api/auth.ts', text);

for (const text of [
  "type AuthMode = 'login' | 'register' | 'forgot-password'",
  '忘记密码',
  '注册账号',
  'auth-entry-links',
  'auth-panel-back',
  '返回',
  '发送验证码',
  'resendSeconds',
  'autoComplete="one-time-code"',
  'sendPasswordResetEmailCode',
  'resetPassword',
  'await logout()',
  '注册完成，请使用新账号登录',
  '密码已重置，请使用新密码登录',
  '完成注册',
  '重置密码',
  '已识别好友分享链接',
  '邀请码（可选）',
]) requireText('src/app/LoginPage.tsx', text);
for (const text of ['登录或注册', 'auth-mode-switch', 'role="tablist"']) forbidText('src/app/LoginPage.tsx', text);
requireText('src/app/App.tsx', 'onRegistrationCompleted={clearInvitationCodeFromLocation}');

for (const text of ['邀请好友', '分享链接', '永久邀请码', '注册完成后不能补填或更换']) {
  requireText('src/components/InvitationSettings.tsx', text);
}
for (const text of ['填写好友邀请码', 'claimInvitation']) forbidText('src/components/InvitationSettings.tsx', text);
requireText('src/pages/GemShopPage.tsx', '<InvitationSettings notify={model.notify} />');
forbidText('src/pages/SettingsPage.tsx', 'InvitationSettings');

for (const text of [
  'location ^~ /economy-api/registration/',
  'proxy_pass http://127.0.0.1:3002/api/registration/;',
  'location ^~ /economy-api/password-reset/',
  'proxy_pass http://127.0.0.1:3001/api/password-reset/;',
  'proxy_set_header Origin "";',
  'client_max_body_size 16k;',
]) requireText('scripts/configure-economy-registration-nginx.py', text);

for (const text of [
  '某个统一账号第一次创建 Economy 玩家档案',
  '任何已登录主页账号首次进入 Economy 时仍允许自动创建玩家档案',
  '主页已经完成账号信任与邮箱验证',
  '`economy_email_verifications`',
  '`economy_registrations`',
  '10 分钟',
  '60 秒',
  '错误 5 次',
  '发送 IP 和提交 IP',
  '`/economy-api/registration/email-code`',
  '`/economy-api/registration/complete`',
  '`/economy-api/password-reset/email-code`',
  '`/economy-api/password-reset/complete`',
  '`127.0.0.1:3001/api/password-reset/`',
  '`RESEND_API_KEY` 与 `EMAIL_FROM`',
  '`/etc/riversoft-email.env`',
  '`/etc/riversoft-economy-api.env`',
  '共享文件先加载，Economy 专用文件后加载',
  '邮件密钥只保存在服务器',
  '邮箱验证码服务未配置，请联系管理员',
  '`deploy/economy-email`',
  '`POST /api/internal/account-email-exists`',
  '不得创建 `economy_email_verifications` 记录',
  '不得发送邮件',
  '注册事务提交后',
  '验证码记录清理、验证码创建／状态更新和完成前校验只写注册专用 SQLite 表',
  '不得触发世界到期调度 barrier',
  '最终创建 Economy 玩家档案继续属于普通用户世界写入',
  '已有 `economy_registrations` 且永久邀请码元数据完整的 `/api/game/session`',
  '`system:session-metadata:*`',
  '`session-profile-creation`',
  '`410 Gone`',
]) requireText('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', text);
forbidText('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', 'RESEND_FROM_EMAIL');

for (const text of [
  '| 商店 | `gem-shop` | `GemShopPage` | 邀请获取宝石、礼品码兑换与每日终端动态报价兑换普通货币 |',
  '| 设置 | `settings` | `SettingsPage` | 资料、偏好、教程控制、存档管理和退出 |',
]) requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', text);
for (const text of [
  '已注册时直接提示登录且不启动倒计时、不创建验证码记录、不发送邮件',
  '未登录外壳固定以登录主面板作为默认入口',
  '注册子面板',
  '密码重置子面板',
  '“忘记密码”和“注册账号”必须位于密码输入框下方',
]) requireText('docs/REGISTRATION_INVITE_FLOW_DESIGN.md', text);
forbidText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', '资料、偏好、邀请、礼品、退出和重置');
forbidText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', '未登录外壳必须明确拆分“登录”和“注册”两个模式');

for (const text of [
  '登录主面板',
  '注册子面板',
  '密码重置子面板',
  '左上角返回',
  '不得恢复登录／注册模式切换器',
  '“忘记密码”和“注册账号”必须位于密码输入框下方',
]) requireText('docs/REGISTRATION_INVITE_FLOW_DESIGN.md', text);
requireText('docs/README.md', '`REGISTRATION_INVITE_FLOW_DESIGN.md`');
requireText('docs/README.md', '`PAGE_CONTENT_AND_NAVIGATION_DESIGN.md`');
requireText('docs/README.md', '`SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md`');

for (const text of [
  'ECONOMY_REGISTRATION_SECRET_FILE',
  'SHARED_EMAIL_ENVIRONMENT_FILE = Path("/etc/riversoft-email.env")',
  'ENVIRONMENT_FILE = Path("/etc/riversoft-economy-api.env")',
  'EnvironmentFile=-{SHARED_EMAIL_ENVIRONMENT_FILE}',
  'EnvironmentFile=-{ENVIRONMENT_FILE}',
  'registration-secret',
]) requireText('scripts/install-economy-api.py', text);
for (const text of ['configure-economy-registration-nginx.py', 'scripts/verify-production-deployment.sh']) {
  requireText('.github/workflows/deploy.yml', text);
}
for (const text of [
  'registration-api',
  '/economy-api/registration/email-code',
  'ECONOMY_REGISTRATION_PROXY_UNAVAILABLE',
  'password-reset-api',
  '/economy-api/password-reset/email-code',
  'ECONOMY_PASSWORD_RESET_PROXY_UNAVAILABLE',
]) requireText('scripts/verify-production-deployment.sh', text);
for (const text of [
  'Validate running Resend configuration',
  "['systemctl', 'show', service_name, '--property=MainPID', '--value']",
  "for required in ('RESEND_API_KEY', 'EMAIL_FROM')",
  "Path(f'/proc/{pid}/environ')",
  'ECONOMY_EMAIL_CONFIGURATION_LOADED',
  "'context': 'deploy/economy-email'",
]) requireText('.github/workflows/configure-registration-email.yml', text);
for (const text of [
  'secrets.RESEND_API_KEY',
  'secrets.EMAIL_FROM',
  'RESEND_FROM_EMAIL',
  'sudo -n',
  "Path('/etc/riversoft-economy-api.env')",
  "systemctl', 'restart'",
]) forbidText('.github/workflows/configure-registration-email.yml', text);

for (const text of [
  'rejects an existing unified account before creating or sending a verification',
  'homepage and direct Economy registrations both create duplicate-IP anomaly reports without automatic bans',
  'sends share-link invite code through email registration and immediately rewards inviter',
  'registration IP prefers trusted reverse-proxy real IP over a client-supplied forwarded chain',
]) requireText('server/test/registration.test.js', text);
for (const text of [
  'registration form invite code rewards inviter once inside first-profile transaction',
  'existing Economy profile ignores invite parameters and can never be backfilled',
  "sessionBootstrapMode(2), 'existing'",
  'assert.equal(context.store.loadWorldCalls, 0)',
]) requireText('server/test/invitations.test.js', text);

if (failures.length) {
  console.error(`邮箱验证码注册验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('邮箱认证验证通过：注册发送前查重、验证码安全、首次建档邀请码归因、注册后禁止补填、统一同 IP 异常上报、管理员封禁、登录主面板与独立注册／密码重置子面板、密码重置代理和 Nginx 路由均已锁定。');
