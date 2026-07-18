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
  'src/components/InvitationSettings.tsx',
  'scripts/configure-economy-registration-nginx.py',
  'scripts/test_configure_economy_registration_nginx.py',
  '.github/workflows/configure-registration-email.yml',
  'README.md',
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/GIFT_CODE_AND_ADMIN_DESIGN.md',
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
for (const text of ['code TEXT', 'verification_code TEXT', 'plain_code']) {
  forbidText('server/src/registration-store.js', text);
}
forbidText('server/src/registration-store.js', "source !== 'homepage_session'");

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
  'registrationStore.ensureLoggedInPlayer',
  'registrationStore.assertPlayerActive',
  "'Set-Cookie': account.setCookie",
  'inviteCode: body.inviteCode',
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
  'inviteCode',
  "request.headers['x-real-ip']",
  '.at(-1)',
]) requireText('server/src/registration.js', text);

for (const text of [
  'sendRegistrationEmailCode',
  'completeRegistration',
  'initializeEconomySession',
  "'/registration/email-code'",
  "'/registration/complete'",
  "'/game/session'",
]) requireText('src/api/auth.ts', text);
for (const text of ['HOMEPAGE_ACCOUNT_API_BASE', 'registerAtHomepage', "'/register'"]) {
  forbidText('src/api/auth.ts', text);
}

for (const text of [
  "type AuthMode = 'login' | 'register'",
  '发送验证码',
  'resendSeconds',
  'autoComplete="one-time-code"',
  "mode === 'login'",
  '完成注册',
  '已识别好友分享链接',
]) requireText('src/app/LoginPage.tsx', text);
forbidText('src/app/LoginPage.tsx', '登录或注册');

for (const text of [
  '邀请好友',
  '分享链接',
  '我的邀请码',
  '填写好友邀请码',
  'claimInvitation',
]) requireText('src/components/InvitationSettings.tsx', text);
forbidText('src/pages/SettingsPage.tsx', '第一阶段不生成邀请码、邀请奖励或归因记录');

for (const text of [
  'location ^~ /economy-api/registration/',
  'proxy_pass http://127.0.0.1:3002/api/registration/;',
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
]) requireText('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', text);
forbidText('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', 'RESEND_FROM_EMAIL');

for (const text of [
  '| 设置 | `settings` | `SettingsPage` | 资料、偏好、邀请、礼品和退出 |',
  '设置页只允许玩家资料与四项统计、已经实现的客户端偏好、邀请入口、礼品兑换、管理员入口和退出登录',
  '已注册时直接提示登录且不启动倒计时、不创建验证码记录、不发送邮件',
]) requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', text);
forbidText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', '资料、偏好、邀请、礼品、退出和重置');

for (const text of [
  '发送验证码前必须先通过主页账号服务仅限回环的邮箱存在性接口查重',
  '不创建验证码记录，也不调用 Resend',
]) requireText('README.md', text);

for (const text of [
  'ECONOMY_REGISTRATION_SECRET_FILE',
  'SHARED_EMAIL_ENVIRONMENT_FILE = Path("/etc/riversoft-email.env")',
  'ENVIRONMENT_FILE = Path("/etc/riversoft-economy-api.env")',
  'EnvironmentFile=-{SHARED_EMAIL_ENVIRONMENT_FILE}',
  'EnvironmentFile=-{ENVIRONMENT_FILE}',
  'registration-secret',
]) requireText('scripts/install-economy-api.py', text);
for (const text of [
  'configure-economy-registration-nginx.py',
  'ECONOMY_REGISTRATION_PROXY_UNAVAILABLE',
]) requireText('.github/workflows/deploy.yml', text);
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
  'homepage and direct Economy registrations both participate in duplicate-IP group bans',
  'sends share-link invite code through email registration and immediately rewards inviter',
  'registration IP prefers trusted reverse-proxy real IP over a client-supplied forwarded chain',
]) requireText('server/test/registration.test.js', text);

if (failures.length) {
  console.error(`邮箱验证码注册验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('邮箱验证码注册验证通过：发送前查重、验证码安全、分享链接归因、统一同 IP 封禁、双模式页面与 Nginx 路由均已锁定。');
