import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { arch, cpus, platform, totalmem } from 'node:os';
import { loadStressAccounts } from './loadAccounts.mjs';
import { startLocalStressHarness } from './localHarness.mjs';
import { evaluateStressBudget, StressMetrics } from './metrics.mjs';
import { STRESS_PROFILES, validateStressSafety } from './safety.mjs';

const STATE_PARTITIONS = Object.freeze(['catalog', 'player', 'market', 'auction', 'contract', 'leaderboard']);
const budgetsUrl = new URL('./budgets.json', import.meta.url);

function integerOption(value, fallback, label) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new Error(`${label} 必须是整数`);
  return parsed;
}

function sleep(milliseconds) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, Math.max(0, milliseconds)));
}

function cookieFromResponse(response) {
  const values = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean);
  return values.map((value) => String(value).split(';', 1)[0]).filter(Boolean).join('; ');
}

async function requestJson(metrics, {
  url,
  method = 'GET',
  route,
  cookie,
  body,
  idempotencyKey,
  timeoutMs,
  expectedStatuses = [200],
}) {
  const startedAt = performance.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs ?? (method === 'GET' ? 8_000 : 12_000));
  let response;
  let text = '';
  try {
    const headers = new Headers();
    if (cookie) headers.set('Cookie', cookie);
    if (body !== undefined) headers.set('Content-Type', 'application/json');
    if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    text = await response.text();
    const expected = expectedStatuses.includes(response.status);
    metrics.record({
      method,
      route,
      statusCode: response.status,
      durationMs: performance.now() - startedAt,
      responseBytes: Buffer.byteLength(text),
      expected,
    });
    if (!expected) throw new Error(`${method} ${route} 返回非预期状态 ${response.status}`);
    let payload;
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`${method} ${route} 返回无效 JSON`);
    }
    return { payload, response };
  } catch (error) {
    if (!response) {
      metrics.record({
        method,
        route,
        statusCode: 0,
        durationMs: performance.now() - startedAt,
        responseBytes: 0,
        expected: false,
        timeout: error?.name === 'AbortError',
      });
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function remoteEndpoints(targetMode, env) {
  const base = targetMode === 'production-readonly'
    ? 'https://game.riversoft.top'
    : String(env.ECONOMY_STRESS_BASE_URL || '').replace(/\/+$/, '');
  if (!base) throw new Error('远程压力测试缺少 ECONOMY_STRESS_BASE_URL');
  return {
    authUrl: `${base}/economy-api/login`,
    gameBaseUrl: `${base}/economy-api/game`,
    healthUrl: `${base}/economy-api/health`,
  };
}

function stateUrl(client, gameBaseUrl) {
  const params = new URLSearchParams();
  if (Number.isInteger(client.revision)) params.set('revision', String(client.revision));
  for (const [name, value] of Object.entries(client.partitionRevisions)) {
    if (value) params.set(name, value);
  }
  const query = params.toString();
  return `${gameBaseUrl}/state${query ? `?${query}` : ''}`;
}

async function fetchState(metrics, client, endpoints, invariants) {
  const { payload } = await requestJson(metrics, {
    url: stateUrl(client, endpoints.gameBaseUrl),
    route: '/api/game/state',
    cookie: client.cookie,
  });
  assert.ok(Number.isInteger(payload.revision) && payload.revision >= 0, '状态响应缺少有效修订号');
  assert.ok(Number.isFinite(payload.serverNow) && payload.serverNow >= 0, '状态响应缺少 serverNow');
  if (client.revision !== null) assert.ok(payload.revision >= client.revision, '状态修订号发生倒退');
  if (client.serverNow !== null) assert.ok(payload.serverNow >= client.serverNow, 'serverNow 发生倒退');
  if (client.revision === null) {
    assert.equal(payload.unchanged, false, '初次状态不得为 unchanged');
    assert.ok(payload.patches && typeof payload.patches === 'object', '初次状态缺少分区正文');
    for (const name of STATE_PARTITIONS) assert.ok(name in payload.patches, `初次状态缺少 ${name} 分区`);
    invariants.fullStateResponses += 1;
  } else if (payload.unchanged) {
    invariants.unchangedStateResponses += 1;
  } else {
    assert.ok(payload.patches && typeof payload.patches === 'object', '变化状态缺少分区正文');
    invariants.incrementalStateResponses += 1;
  }
  if (payload.partitionRevisions && typeof payload.partitionRevisions === 'object') {
    for (const name of STATE_PARTITIONS) {
      const revision = payload.partitionRevisions[name];
      if (revision) client.partitionRevisions[name] = revision;
    }
  }
  client.revision = payload.revision;
  client.serverNow = payload.serverNow;
  invariants.stateResponses += 1;
  return payload;
}

async function postAction(metrics, client, endpoints, path, route, body, idempotencyKey) {
  const { payload } = await requestJson(metrics, {
    url: `${endpoints.gameBaseUrl}${path}`,
    method: 'POST',
    route,
    cookie: client.cookie,
    body,
    idempotencyKey,
  });
  assert.ok(Number.isInteger(payload.revision), `${route} 确认缺少修订号`);
  assert.equal(payload.result?.ok, true, `${route} 业务结果失败`);
  assert.equal(typeof payload.result?.message, 'string', `${route} 确认缺少消息`);
  return payload;
}

async function loginAccount(metrics, account, endpoints) {
  const { payload, response } = await requestJson(metrics, {
    url: endpoints.authUrl,
    method: 'POST',
    route: '/api/login',
    body: { email: account.email, password: account.password },
  });
  assert.equal(String(payload.user?.email || '').toLowerCase(), account.email.toLowerCase(), '登录账号与槽位不一致');
  assert.notEqual(payload.user?.role, 'admin', '压力测试账号不得为管理员');
  const cookie = cookieFromResponse(response);
  assert.ok(cookie, '登录响应缺少会话 Cookie');
  return {
    slot: account.slot,
    id: account.id,
    cookie,
    revision: null,
    serverNow: null,
    partitionRevisions: {},
    nextWorkAt: Number.POSITIVE_INFINITY,
  };
}

async function initializeClient(metrics, client, endpoints, runId) {
  const { payload } = await requestJson(metrics, {
    url: `${endpoints.gameBaseUrl}/session`,
    method: 'POST',
    route: '/api/game/session',
    cookie: client.cookie,
    body: {},
    idempotencyKey: `stress:${runId}:session:${client.slot}`,
  });
  assert.equal(payload.banned, false, `压力测试槽位 ${client.slot} 已被封禁`);
}

async function verifyIdempotency(metrics, client, endpoints, runId, invariants) {
  const requestKey = `stress:${runId}:work-idempotency:${client.slot}`;
  const first = await postAction(metrics, client, endpoints, '/work', '/api/game/work', {}, requestKey);
  const repeated = await postAction(metrics, client, endpoints, '/work', '/api/game/work', {}, requestKey);
  assert.deepEqual(repeated, first, '相同幂等键返回了不同动作确认');
  invariants.actionConfirmations += 2;
  invariants.idempotencyChecks += 1;
  client.nextWorkAt = performance.now() + 3_200;
  await fetchState(metrics, client, endpoints, invariants);
}

async function runClientLoop(metrics, client, endpoints, definition, config, runId, invariants, deadline) {
  let nextPollAt = performance.now();
  if (config.profile !== 'burst') nextPollAt += (client.slot % 8) * Math.min(50, config.pollIntervalMs / 8);
  while (performance.now() < deadline) {
    const now = performance.now();
    if (definition.writes && now >= client.nextWorkAt) {
      await postAction(
        metrics,
        client,
        endpoints,
        '/work',
        '/api/game/work',
        {},
        `stress:${runId}:work:${client.slot}:${randomUUID()}`,
      );
      invariants.actionConfirmations += 1;
      client.nextWorkAt = performance.now() + 3_200;
      await fetchState(metrics, client, endpoints, invariants);
    } else {
      await fetchState(metrics, client, endpoints, invariants);
    }
    nextPollAt += config.pollIntervalMs;
    await sleep(Math.min(Math.max(0, nextPollAt - performance.now()), Math.max(0, deadline - performance.now())));
  }
}

function parseCli(argumentsList) {
  const options = {};
  for (let index = 0; index < argumentsList.length; index += 1) {
    const key = argumentsList[index];
    if (!key.startsWith('--')) throw new Error(`未知参数 ${key}`);
    const value = argumentsList[index + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`${key} 缺少值`);
    options[key.slice(2)] = value;
    index += 1;
  }
  return options;
}

function reportMarkdown(report) {
  const routeRows = Object.entries(report.metrics.routes).map(([route, value]) => (
    `| ${route} | ${value.requests} | ${value.p95Ms} | ${value.p99Ms} | ${value.maxMs} | ${value.unexpectedStatusCount} |`
  ));
  return [
    '# Economy 压力测试报告',
    '',
    `- 结果：${report.passed ? '通过' : '失败'}`,
    `- 场景：${report.profile}`,
    `- 目标：${report.targetMode}`,
    `- 用户：${report.users}`,
    `- 持续时间：${Math.round(report.metrics.durationMs)}ms`,
    `- 请求：${report.metrics.requests}，平均 ${report.metrics.requestsPerSecond} RPS`,
    `- 总体 p95／p99：${report.metrics.p95Ms}ms／${report.metrics.p99Ms}ms`,
    '',
    '| 路由 | 请求数 | p95(ms) | p99(ms) | 最大(ms) | 非预期 |',
    '|---|---:|---:|---:|---:|---:|',
    ...routeRows,
    '',
    ...(report.failures.length > 0 ? ['## 失败原因', '', ...report.failures.map((failure) => `- ${failure}`), ''] : []),
  ].join('\n');
}

async function writeReport(report, outputPath) {
  const jsonPath = resolve(outputPath);
  const markdownPath = jsonPath.replace(/\.json$/i, '.md');
  await mkdir(dirname(jsonPath), { recursive: true });
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(markdownPath, `${reportMarkdown(report)}\n`, 'utf8');
  return { jsonPath, markdownPath };
}

export async function runStressTest(options = {}) {
  const profile = options.profile || 'smoke';
  const definition = STRESS_PROFILES[profile];
  if (!definition) throw new Error(`未知压力测试场景 ${profile}`);
  const targetMode = options.targetMode || 'local';
  const users = integerOption(options.users, definition.defaultUsers, 'users');
  const durationSeconds = integerOption(options.durationSeconds, definition.defaultDurationSeconds, 'durationSeconds');
  const pollIntervalMs = integerOption(options.pollIntervalMs, definition.defaultPollIntervalMs, 'pollIntervalMs');
  const offset = integerOption(options.offset, 0, 'offset');
  const runId = randomUUID();
  const metrics = new StressMetrics();
  const failures = [];
  const invariants = {
    stateResponses: 0,
    fullStateResponses: 0,
    incrementalStateResponses: 0,
    unchangedStateResponses: 0,
    actionConfirmations: 0,
    idempotencyChecks: 0,
  };
  let harness = null;
  let storageBefore = null;
  let storageAfter = null;
  let diagnostics = null;
  const env = { ...process.env, ...(options.env || {}) };
  const startedAt = Date.now();
  let measuredStartedAt = performance.now();

  try {
    if (targetMode === 'local') {
      harness = await startLocalStressHarness();
      Object.assign(env, harness.env);
      storageBefore = await harness.storageSnapshot();
    }
    const endpoints = options.endpoints || harness?.endpoints || remoteEndpoints(targetMode, env);
    validateStressSafety({
      targetMode,
      profile,
      users,
      durationSeconds,
      pollIntervalMs,
      authUrl: endpoints.authUrl,
      gameBaseUrl: endpoints.gameBaseUrl,
      confirmation: options.confirmation || '',
    });
    const accounts = await loadStressAccounts({ env, offset, limit: users });

    await requestJson(metrics, { url: endpoints.healthUrl, route: '/health' });
    const clients = await Promise.all(accounts.map((account) => loginAccount(metrics, account, endpoints)));
    if (targetMode !== 'production-readonly') {
      await Promise.all(clients.map((client) => initializeClient(metrics, client, endpoints, runId)));
    }
    await Promise.all(clients.map((client) => fetchState(metrics, client, endpoints, invariants)));
    if (definition.writes) {
      await Promise.all(clients.map((client) => verifyIdempotency(metrics, client, endpoints, runId, invariants)));
    }

    measuredStartedAt = performance.now();
    const deadline = measuredStartedAt + durationSeconds * 1_000;
    const settled = await Promise.allSettled(clients.map((client) => (
      runClientLoop(metrics, client, endpoints, definition, {
        profile,
        pollIntervalMs,
      }, runId, invariants, deadline)
    )));
    for (const result of settled) {
      if (result.status === 'rejected') failures.push(String(result.reason?.message || result.reason || '未知执行错误'));
    }
    if (harness) {
      storageAfter = await harness.storageSnapshot();
      diagnostics = harness.diagnostics();
    }
  } catch (error) {
    failures.push(String(error?.message || error || '未知压力测试错误'));
  }

  const measuredDurationMs = Math.max(0, performance.now() - measuredStartedAt);
  const summary = metrics.summarize(measuredDurationMs);
  const budgets = JSON.parse(await readFile(budgetsUrl, 'utf8'));
  assert.equal(budgets.version, 1, '不支持的压力测试预算版本');
  const profileBudget = budgets.profiles[profile];
  const enforcedBudget = options.enforcePerformanceBudget === false
    ? {
        ...profileBudget,
        maxP95Ms: Number.MAX_SAFE_INTEGER,
        maxP99Ms: Number.MAX_SAFE_INTEGER,
        routes: {},
      }
    : profileBudget;
  const budgetResult = evaluateStressBudget(summary, enforcedBudget);
  failures.push(...budgetResult.failures);
  if (diagnostics?.serverErrorLogCount > 0) failures.push(`隔离服务器记录了 ${diagnostics.serverErrorLogCount} 条错误日志`);
  if (options.enforcePerformanceBudget !== false && storageAfter) {
    if (storageAfter.databaseBytes > Number(profileBudget.maxLocalDatabaseBytes)) {
      failures.push(`隔离数据库 ${storageAfter.databaseBytes} 字节超过预算 ${profileBudget.maxLocalDatabaseBytes} 字节`);
    }
    if (storageAfter.walBytes > Number(profileBudget.maxLocalWalBytes)) {
      failures.push(`隔离 WAL ${storageAfter.walBytes} 字节超过预算 ${profileBudget.maxLocalWalBytes} 字节`);
    }
  }

  const report = {
    schemaVersion: 1,
    runId,
    startedAt: new Date(startedAt).toISOString(),
    endedAt: new Date().toISOString(),
    targetMode,
    profile,
    users,
    accountSlots: { offset, limit: users },
    configuration: { durationSeconds, pollIntervalMs, writes: definition.writes },
    runtime: {
      node: process.versions.node,
      platform: platform(),
      arch: arch(),
      logicalCpuCount: cpus().length,
      totalMemoryBytes: totalmem(),
      sourceRevision: env.GITHUB_SHA || null,
    },
    passed: failures.length === 0,
    failures: [...new Set(failures)],
    invariants,
    metrics: summary,
    budgetMode: options.enforcePerformanceBudget === false ? 'correctness-only' : 'enforced',
    budget: profileBudget,
    storage: harness ? { before: storageBefore, after: storageAfter } : undefined,
    diagnostics: diagnostics || undefined,
  };
  try {
    if (options.outputPath) report.output = await writeReport(report, options.outputPath);
  } finally {
    if (harness) await harness.close();
  }
  return report;
}

async function main() {
  const cli = parseCli(process.argv.slice(2));
  const profile = cli.profile || 'smoke';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const report = await runStressTest({
    targetMode: cli.target || 'local',
    profile,
    users: cli.users,
    durationSeconds: cli['duration-seconds'],
    pollIntervalMs: cli['poll-interval-ms'],
    offset: cli.offset,
    confirmation: cli.confirmation,
    outputPath: cli.output || `test-results/stress/${profile}-${timestamp}.json`,
  });
  console.log(reportMarkdown(report));
  if (report.output) console.log(`JSON: ${report.output.jsonPath}\nMarkdown: ${report.output.markdownPath}`);
  if (!report.passed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(`压力测试启动失败：${error.message}`);
    process.exitCode = 1;
  });
}
