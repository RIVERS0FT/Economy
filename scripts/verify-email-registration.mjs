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
  'server/test/email.test.js',
  'server/test/registration.test.js',
  'src/api/auth.ts',
  'src/app/LoginPage.tsx',
  'src/pages/SettingsPage.tsx',
  'src/styles/registration-auth.css',
  'scripts/configure-economy-registration-nginx.py',
  'scripts/test_configure_economy_registration_nginx.py',
  '.github/workflows/configure-registration-email.yml',
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
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
  'ensureLoggedInPlayer',
  "source !== 'homepage_session'",
]) requireText('server/src/registration-store.js', text);
for (const text of ['code TEXT', 'verification_code TEXT', 'plain_code']) {
  forbidText('server/src/registration-store.js', text);
}

for (const text of [
  "const RESEND_ENDPOINT = 'https://api.resend.com/emails'",
  'const EMAIL_TIMEOUT_MS = 8_000',
  "'Idempotency-Key': idempotencyKey",
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'getRegistrationEmailConfiguration',
  'statusCode: 424',
  'EMAIL_SERVICE_NOT_CONFIGURED',
  '邮箱验证码服务未配置，请联系管理员',
]) requireText('server/src/email.js', text);
forbidText('server/src/email.js', 'console.');

for (const text of [
  "path === '/api/registration/email-code'",
  "path === '/api/registration/complete'",
  'registrationStore.ensureLoggedInPlayer',
  "'Set-Cookie': account.setCookie",
]) requireText('server/src/app.js', text);

for (const text of [
  "requestAccount('/api/register'",
  "requestAccount('/api/login'",
  'registration.status === 409',
]) requireText('server/src/account-client.js', text);

for (const text of [
  'sendRegistrationEmailCode',
  'completeRegistration',
  "'/registration/email-code'",
  "'/registration/complete'",
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
]) requireText('src/app/LoginPage.tsx', text);
forbidText('src/app/LoginPage.tsx', '登录或注册');

for (const text of [
  '邀请好友',
  'shareInvite',
  '分享或复制邀请链接',
  '第一阶段不生成邀请码、邀请奖励或归因记录',
]) requireText('src/pages/SettingsPage.tsx', text);

for (const text of [
  'location ^~ /economy-api/registration/',
  'proxy_pass http://127.0.0.1:3002/api/registration/;',
  'client_max_body_size 16k;',
]) requireText('scripts/configure-economy-registration-nginx.py', text);

for (const text of [
  '某个统一账号第一次创建 Economy 玩家档案',
  '任何已登录主页账号首次进入 Economy 时仍允许自动创建玩家档案',
  '主页已经完成账号信任与邮箱验证',
  '多账号限制只对 Economy 自身邮箱验证码入口执行',
  '`economy_email_verifications`',
  '`economy_registrations`',
  '10 分钟',
  '60 秒',
  '错误 5 次',
  '发送 IP 和提交 IP',
  '`/economy-api/registration/email-code`',
  '`/economy-api/registration/complete`',
  '`RESEND_API_KEY` 与 `RESEND_FROM_EMAIL`',
  '邮箱验证码服务未配置，请联系管理员',
  '`deploy/economy-email`',
]) requireText('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', text);

for (const text of [
  '| 设置 | `settings` | `SettingsPage` | 资料、偏好、邀请、礼品、退出和重置 |',
  '设置页只允许玩家资料与四项统计、客户端偏好、邀请入口、礼品兑换、管理员入口、退出登录和重置经济状态',
  '第一阶段邀请功能只分享或复制 Economy 正式入口',
]) requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', text);

for (const text of [
  'ECONOMY_REGISTRATION_SECRET_FILE',
  'EnvironmentFile=-',
  'registration-secret',
]) requireText('scripts/install-economy-api.py', text);
for (const text of [
  'configure-economy-registration-nginx.py',
  'ECONOMY_REGISTRATION_PROXY_UNAVAILABLE',
]) requireText('.github/workflows/deploy.yml', text);
for (const text of [
  'RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}',
  'RESEND_FROM_EMAIL: ${{ secrets.RESEND_FROM_EMAIL }}',
  '/etc/riversoft-economy-api.env',
  'systemctl restart riversoft-economy-api.service',
  "'RESEND_API_KEY', 'RESEND_FROM_EMAIL'",
  "'context': 'deploy/economy-email'",
]) requireText('.github/workflows/configure-registration-email.yml', text);

for (const text of [
  'trusted homepage accounts may share a network',
  "source: 'email_verification'",
]) requireText('server/test/registration.test.js', text);

if (failures.length) {
  console.error(`邮箱验证码注册验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('邮箱验证码注册验证通过：首次建档定义、主页账号信任、验证码安全、Resend 配置、明确错误、双模式页面、邀请与 Nginx 路由均已锁定。');
