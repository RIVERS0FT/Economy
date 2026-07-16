import { readFileSync, writeFileSync } from 'node:fs';

function replaceOnce(path, search, replacement) {
  const source = readFileSync(path, 'utf8');
  if (!source.includes(search)) throw new Error(`${path} missing expected text: ${search}`);
  writeFileSync(path, source.replace(search, replacement));
}

replaceOnce(
  'server/src/account-client.js',
  'export async function createOrLoginUnifiedAccount({ email, password }) {',
  `export async function assertUnifiedAccountEmailAvailable({ email }) {
  let upstream;
  try {
    upstream = await requestAccount('/api/internal/account-email-exists', { email });
  } catch {
    throw accountError('统一账号服务暂时不可用', 503);
  }

  if (upstream.status < 200 || upstream.status >= 300) {
    throw accountError('统一账号服务暂时不可用', 503);
  }

  let payload;
  try {
    payload = JSON.parse(upstream.body);
  } catch {
    throw accountError('统一账号服务返回了无效数据', 502);
  }
  if (typeof payload?.exists !== 'boolean') {
    throw accountError('统一账号服务返回了无效数据', 502);
  }
  if (payload.exists) throw accountError('该邮箱已注册，请直接登录', 409);
}

export async function createOrLoginUnifiedAccount({ email, password }) {`,
);

replaceOnce(
  'server/src/registration.js',
  "import { createOrLoginUnifiedAccount } from './account-client.js';",
  "import { assertUnifiedAccountEmailAvailable, createOrLoginUnifiedAccount } from './account-client.js';",
);
replaceOnce(
  'server/src/registration.js',
  '  accountClient = createOrLoginUnifiedAccount,\n}) {',
  '  accountClient = createOrLoginUnifiedAccount,\n  accountAvailabilityChecker = assertUnifiedAccountEmailAvailable,\n}) {',
);
replaceOnce(
  'server/src/registration.js',
  '      const normalizedEmail = validateRegistrationInput(email);\n      const verification = registrationStore.beginEmailVerification({',
  '      const normalizedEmail = validateRegistrationInput(email);\n      await accountAvailabilityChecker({ email: normalizedEmail });\n      const verification = registrationStore.beginEmailVerification({',
);

replaceOnce(
  'server/test/registration.test.js',
  'function setup() {',
  'function setup({ accountAvailabilityChecker = async () => {} } = {}) {',
);
replaceOnce(
  'server/test/registration.test.js',
  "    emailSender: async (message) => { deliveries.push(message); return { id: `mail-${deliveries.length}` }; },\n    accountClient:",
  "    emailSender: async (message) => { deliveries.push(message); return { id: `mail-${deliveries.length}` }; },\n    accountAvailabilityChecker,\n    accountClient:",
);
replaceOnce(
  'server/test/registration.test.js',
  "test('sends and completes a verification without storing plaintext code', async () => {",
  `test('rejects an existing unified account before creating or sending a verification', async () => {
  let checks = 0;
  const context = setup({
    accountAvailabilityChecker: async ({ email }) => {
      checks += 1;
      assert.equal(email, 'alice@example.com');
      throw Object.assign(new Error('该邮箱已注册，请直接登录'), { statusCode: 409 });
    },
  });
  try {
    await assert.rejects(() => context.service.requestEmailCode({
      email: 'Alice@Example.com', ipFingerprint: 'ip-a', requestKey: 'send-existing-001', now: 100,
    }), (error) => error.statusCode === 409 && /已注册/.test(error.message));
    assert.equal(checks, 1);
    assert.equal(context.deliveries.length, 0);
    const row = context.store.database.prepare('SELECT COUNT(*) AS count FROM economy_email_verifications').get();
    assert.equal(row.count, 0);
  } finally { context.store.close(); }
});

test('sends and completes a verification without storing plaintext code', async () => {`,
);

writeFileSync('server/test/account-client.test.js', `import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { assertUnifiedAccountEmailAvailable } from '../src/account-client.js';

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

test('checks the homepage loopback endpoint and rejects registered emails', async (t) => {
  const requests = [];
  const server = createServer(async (request, response) => {
    requests.push({
      path: request.url,
      headers: request.headers,
      body: await readBody(request),
    });
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ exists: requests.at(-1).body.email === 'registered@example.com' }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const previousUrl = process.env.ACCOUNT_SERVICE_URL;
  const previousHost = process.env.ACCOUNT_SERVICE_HOST;
  process.env.ACCOUNT_SERVICE_URL = `http://127.0.0.1:${server.address().port}`;
  process.env.ACCOUNT_SERVICE_HOST = 'riversoft.top';
  t.after(() => {
    if (previousUrl === undefined) delete process.env.ACCOUNT_SERVICE_URL;
    else process.env.ACCOUNT_SERVICE_URL = previousUrl;
    if (previousHost === undefined) delete process.env.ACCOUNT_SERVICE_HOST;
    else process.env.ACCOUNT_SERVICE_HOST = previousHost;
  });

  await assert.doesNotReject(() => assertUnifiedAccountEmailAvailable({ email: 'new@example.com' }));
  await assert.rejects(
    () => assertUnifiedAccountEmailAvailable({ email: 'registered@example.com' }),
    (error) => error.statusCode === 409 && error.message === '该邮箱已注册，请直接登录',
  );

  assert.deepEqual(requests.map((item) => item.path), [
    '/api/internal/account-email-exists',
    '/api/internal/account-email-exists',
  ]);
  assert.equal(requests[0].headers.origin, undefined);
  assert.equal(requests[0].headers['x-forwarded-for'], undefined);
  assert.equal(requests[0].headers['x-forwarded-host'], 'riversoft.top');
});
`);

replaceOnce(
  'README.md',
  '- 邮箱验证码只保存 HMAC，10 分钟过期、60 秒禁止重发、错误 5 次作废、不可重复使用，且发送与提交 IP 指纹必须一致。',
  '- 邮箱验证码只保存 HMAC，10 分钟过期、60 秒禁止重发、错误 5 次作废、不可重复使用，且发送与提交 IP 指纹必须一致。\n- 发送验证码前必须先通过主页账号服务仅限回环的邮箱存在性接口查重；已注册邮箱返回 409 并引导登录，不创建验证码记录，也不调用 Resend。',
);
replaceOnce(
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  '- 验证码固定为 6 位数字，有效期 10 分钟；同一邮箱或同一 IP 指纹 60 秒内禁止再次发送。',
  '- 生成验证码记录和调用 Resend 前，Economy 必须通过主页账号服务仅限同机回环的 `POST /api/internal/account-email-exists` 查询邮箱是否已经注册。已注册邮箱返回 `409` 和“该邮箱已注册，请直接登录”，不得创建 `economy_email_verifications` 记录，也不得发送邮件；查询失败时返回统一账号服务不可用，不得绕过查重继续投递。\n- 验证码固定为 6 位数字，有效期 10 分钟；同一邮箱或同一 IP 指纹 60 秒内禁止再次发送。',
);
replaceOnce(
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  '未登录外壳必须明确拆分“登录”和“注册”两个模式。登录模式只调用现有统一账号登录，不得在 401 后自动注册。注册模式包含账号邮箱、密码、发送验证码、60s 倒计时和 6 位验证码输入；验证码完成后由 Economy 服务创建或登录统一账号并首次创建 Economy 玩家档案。账号和密码继续使用原生未受控表单与 `FormData`，避免浏览器自动填充被 React 空值覆盖。',
  '未登录外壳必须明确拆分“登录”和“注册”两个模式。登录模式只调用现有统一账号登录，不得在 401 后自动注册。注册模式包含账号邮箱、密码、发送验证码、60s 倒计时和 6 位验证码输入；点击发送验证码后，服务器必须先查询统一账号邮箱是否已存在，已注册时直接提示登录且不启动倒计时、不创建验证码记录、不发送邮件。验证码完成后由 Economy 服务创建或登录统一账号并首次创建 Economy 玩家档案。账号和密码继续使用原生未受控表单与 `FormData`，避免浏览器自动填充被 React 空值覆盖。',
);

replaceOnce(
  'scripts/verify-email-registration.mjs',
  "  'server/test/email.test.js',\n  'server/test/registration.test.js',",
  "  'server/test/email.test.js',\n  'server/test/account-client.test.js',\n  'server/test/registration.test.js',",
);
replaceOnce(
  'scripts/verify-email-registration.mjs',
  "  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',\n  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',",
  "  'README.md',\n  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',\n  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',",
);
replaceOnce(
  'scripts/verify-email-registration.mjs',
  "  \"requestAccount('/api/register'\",\n  \"requestAccount('/api/login'\",\n  'registration.status === 409',",
  "  \"requestAccount('/api/internal/account-email-exists'\",\n  'assertUnifiedAccountEmailAvailable',\n  '该邮箱已注册，请直接登录',\n  \"requestAccount('/api/register'\",\n  \"requestAccount('/api/login'\",\n  'registration.status === 409',",
);
replaceOnce(
  'scripts/verify-email-registration.mjs',
  "for (const text of [\n  'sendRegistrationEmailCode',",
  "for (const text of [\n  'accountAvailabilityChecker',\n  'await accountAvailabilityChecker({ email: normalizedEmail })',\n]) requireText('server/src/registration.js', text);\n\nfor (const text of [\n  'sendRegistrationEmailCode',",
);
replaceOnce(
  'scripts/verify-email-registration.mjs',
  "  '`deploy/economy-email`',\n]) requireText('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', text);",
  "  '`deploy/economy-email`',\n  '`POST /api/internal/account-email-exists`',\n  '不得创建 `economy_email_verifications` 记录',\n  '不得发送邮件',\n]) requireText('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', text);",
);
replaceOnce(
  'scripts/verify-email-registration.mjs',
  "  '第一阶段邀请功能只分享或复制 Economy 正式入口',\n]) requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', text);",
  "  '第一阶段邀请功能只分享或复制 Economy 正式入口',\n  '已注册时直接提示登录且不启动倒计时、不创建验证码记录、不发送邮件',\n]) requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', text);",
);
replaceOnce(
  'scripts/verify-email-registration.mjs',
  "for (const text of [\n  'ECONOMY_REGISTRATION_SECRET_FILE',",
  "for (const text of [\n  '发送验证码前必须先通过主页账号服务仅限回环的邮箱存在性接口查重',\n  '不创建验证码记录，也不调用 Resend',\n]) requireText('README.md', text);\n\nfor (const text of [\n  'ECONOMY_REGISTRATION_SECRET_FILE',",
);
replaceOnce(
  'scripts/verify-email-registration.mjs',
  "  'trusted homepage accounts may share a network',\n  \"source: 'email_verification'\",",
  "  'rejects an existing unified account before creating or sending a verification',\n  'trusted homepage accounts may share a network',\n  \"source: 'email_verification'\",",
);
replaceOnce(
  'scripts/verify-email-registration.mjs',
  "console.log('邮箱验证码注册验证通过：首次建档定义、主页账号信任、验证码安全、共享服务器 Resend 配置、EMAIL_FROM、运行进程验证、明确错误、双模式页面、邀请与 Nginx 路由均已锁定。');",
  "console.log('邮箱验证码注册验证通过：发送前统一账号邮箱查重、首次建档定义、主页账号信任、验证码安全、共享服务器 Resend 配置、EMAIL_FROM、运行进程验证、明确错误、双模式页面、邀请与 Nginx 路由均已锁定。');",
);
