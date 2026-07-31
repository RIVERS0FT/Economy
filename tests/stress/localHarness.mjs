import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { loadStressAccountRegistry } from './loadAccounts.mjs';

const MAX_CAPTURED_LOG_BYTES = 512 * 1024;

async function listen(server) {
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolveListen();
    });
  });
  return Number(server.address().port);
}

async function reservePort() {
  const server = createServer();
  const port = await listen(server);
  await new Promise((resolveClose) => server.close(resolveClose));
  return port;
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function sendJson(response, statusCode, payload, headers = {}) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    ...headers,
  });
  response.end(body);
}

async function startFakeAccountService(password) {
  const registry = await loadStressAccountRegistry();
  const usersByEmail = new Map(registry.accounts.map((account) => [account.email, {
    id: 910_000 + account.slot,
    email: account.email,
    nickname: account.id,
    role: 'player',
  }]));
  const usersBySession = new Map([...usersByEmail.values()].map((user) => [`stress-${user.id}`, user]));

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://127.0.0.1');
      if (request.method === 'POST' && url.pathname === '/api/login') {
        const body = await readJson(request);
        const user = usersByEmail.get(String(body.email || '').trim().toLowerCase());
        if (!user || body.password !== password) {
          sendJson(response, 401, { message: '邮箱或密码错误' });
          return;
        }
        const session = `stress-${user.id}`;
        sendJson(response, 200, { user }, {
          'Set-Cookie': `session=${session}; Path=/; HttpOnly; SameSite=Lax`,
        });
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/me') {
        const cookie = String(request.headers.cookie || '');
        const session = /(?:^|;\s*)session=([^;]+)/.exec(cookie)?.[1];
        const user = usersBySession.get(session);
        if (!user) {
          sendJson(response, 401, { message: '请先登录' });
          return;
        }
        sendJson(response, 200, { user });
        return;
      }
      sendJson(response, 404, { message: '接口不存在' });
    } catch {
      sendJson(response, 400, { message: '请求无效' });
    }
  });
  const port = await listen(server);
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolveClose) => server.close(resolveClose)),
  };
}

async function waitForHealth(url, child, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`隔离 Economy API 提前退出，状态 ${child.exitCode}`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return;
    } catch {
      // The child may still be starting.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error('隔离 Economy API 启动超时');
}

function captureLog(current, chunk) {
  const next = current + chunk.toString('utf8');
  return next.length <= MAX_CAPTURED_LOG_BYTES ? next : next.slice(-MAX_CAPTURED_LOG_BYTES);
}

async function fileSize(path) {
  try {
    return Number((await stat(path)).size);
  } catch (error) {
    if (error?.code === 'ENOENT') return 0;
    throw error;
  }
}

export async function startLocalStressHarness() {
  const password = `local-stress-${randomUUID()}`;
  const accountService = await startFakeAccountService(password);
  const directory = await mkdtemp(join(tmpdir(), 'economy-stress-'));
  const databasePath = join(directory, 'economy.sqlite');
  const port = await reservePort();
  let stdout = '';
  let stderr = '';
  const child = spawn(process.execPath, [resolve('server/src/index.js')], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
      ECONOMY_DB_PATH: databasePath,
      ECONOMY_REGISTRATION_SECRET: 'local-stress-registration-secret-at-least-32-bytes',
      ACCOUNT_SERVICE_URL: accountService.url,
      ACCOUNT_SERVICE_HOST: 'stress.local',
      PUBLIC_ORIGIN: `http://127.0.0.1:${port}`,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => { stdout = captureLog(stdout, chunk); });
  child.stderr.on('data', (chunk) => { stderr = captureLog(stderr, chunk); });

  try {
    await waitForHealth(`http://127.0.0.1:${port}/health`, child);
  } catch (error) {
    child.kill();
    await accountService.close();
    await rm(directory, { recursive: true, force: true });
    throw new Error(`${error.message}\n${stderr || stdout}`);
  }

  let closed = false;
  return {
    env: { ECONOMY_STRESS_TEST_PASSWORD: password },
    endpoints: {
      authUrl: `${accountService.url}/api/login`,
      gameBaseUrl: `http://127.0.0.1:${port}/api/game`,
      healthUrl: `http://127.0.0.1:${port}/health`,
    },
    async storageSnapshot() {
      return {
        databaseBytes: await fileSize(databasePath),
        walBytes: await fileSize(`${databasePath}-wal`),
        shmBytes: await fileSize(`${databasePath}-shm`),
      };
    },
    diagnostics() {
      return {
        serverOutlierCount: (stdout.match(/Economy request outlier/g) || []).length
          + (stderr.match(/Economy request outlier/g) || []).length,
        serverErrorLogCount: (stderr.match(/Error:/g) || []).length,
      };
    },
    async close() {
      if (closed) return;
      closed = true;
      const exited = new Promise((resolveExit) => child.once('exit', resolveExit));
      if (child.exitCode === null) child.kill('SIGTERM');
      await Promise.race([exited, new Promise((resolveWait) => setTimeout(resolveWait, 5_000))]);
      if (child.exitCode === null) child.kill('SIGKILL');
      await accountService.close();
      await rm(directory, { recursive: true, force: true });
    },
  };
}
