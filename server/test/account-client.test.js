import assert from 'node:assert/strict';
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
  process.env.ACCOUNT_SERVICE_URL = 'http://127.0.0.1:' + server.address().port;
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
