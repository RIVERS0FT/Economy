import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { arch, cpus, platform, totalmem } from 'node:os';
import { RESEARCH_TECHNOLOGY_CATALOG } from '../../server/src/research-catalog.js';
import { loadStressAccounts } from './loadAccounts.mjs';
import { startLocalStressHarness } from './localHarness.mjs';
import { evaluateStressBudget, StressMetrics } from './metrics.mjs';
import { STRESS_PROFILES, validateStressSafety } from './safety.mjs';

const STATE_PARTITIONS = Object.freeze(['catalog', 'player', 'market', 'auction', 'contract', 'leaderboard']);
const TRANSACTION_MIX_WEIGHTS = Object.freeze({
  state: 60,
  order: 15,
  facilityToggle: 10,
  recipe: 5,
  build: 5,
  research: 5,
});
const TRANSACTION_MIX_TOTAL = Object.values(TRANSACTION_MIX_WEIGHTS).reduce((sum, value) => sum + value, 0);
const STRESS_FACILITY_TYPE_ID = 'farm';
const STRESS_PRODUCT_ID = 'wheat';
const STRESS_ORDER_PRICE = 0.01;
const STRESS_FARM_RECIPES = Object.freeze(['wheat-crop', 'rice-crop', 'cotton-crop', 'sugarcane-crop']);
const budgetsUrl = new URL('./budgets.json', import.meta.url);

assert.equal(TRANSACTION_MIX_TOTAL, 100, '事务混合比例必须合计 100%');

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
  headers: extraHeaders,
  timeoutMs,
  expectedStatuses = [200],
}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs ?? (method === 'GET' ? 30_000 : 12_000));
  let response;
  let text = '';
  try {
    const headers = new Headers(extraHeaders || {});
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
    const serverDurationMs = serverTimingDurationMs(response.headers.get('server-timing'));
    metrics.record({
      method,
      route,
      statusCode: response.status,
      serverDurationMs,
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

function serverTimingDurationMs(header) {
  const match = /(?:^|,)\s*app\s*;\s*dur=([0-9]+(?:\.[0-9]+)?)\s*(?:,|$)/i
    .exec(String(header || ''));
  if (!match) return undefined;
  const value = Number(match[1]);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
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

function rebuildClientState(client, payload) {
  if (payload.patches && typeof payload.patches === 'object') {
    for (const [name, patch] of Object.entries(payload.patches)) {
      if (STATE_PARTITIONS.includes(name) && patch && typeof patch === 'object') {
        client.partitions[name] = patch;
      }
    }
  }
  const state = {};
  for (const name of STATE_PARTITIONS) Object.assign(state, client.partitions[name] || {});
  client.state = state;
}

function acceptDelivery(client, payload, label) {
  assert.ok(Number.isInteger(payload.revision) && payload.revision >= 0, `${label} 缺少有效修订号`);
  assert.ok(Number.isFinite(payload.serverNow) && payload.serverNow >= 0, `${label} 缺少 serverNow`);
  if (client.revision !== null) assert.ok(payload.revision >= client.revision, `${label} 修订号发生倒退`);
  if (client.serverNow !== null) assert.ok(payload.serverNow >= client.serverNow, `${label} serverNow 发生倒退`);
  if (!payload.unchanged) {
    assert.ok(payload.patches && typeof payload.patches === 'object', `${label} 变化交付缺少分区正文`);
  }
  if (payload.partitionRevisions && typeof payload.partitionRevisions === 'object') {
    for (const name of STATE_PARTITIONS) {
      const revision = payload.partitionRevisions[name];
      if (revision) client.partitionRevisions[name] = revision;
    }
  }
  rebuildClientState(client, payload);
  client.revision = payload.revision;
  client.serverNow = payload.serverNow;
}

function acceptCompactActionConfirmation(client, payload, label) {
  assert.ok(Number.isInteger(payload.revision) && payload.revision >= 0, `${label} 缺少有效修订号`);
  assert.ok(Number.isFinite(payload.serverNow) && payload.serverNow >= 0, `${label} 缺少 serverNow`);
  if (client.revision !== null) assert.ok(payload.revision >= client.revision, `${label} 修订号发生倒退`);
  if (client.serverNow !== null) assert.ok(payload.serverNow >= client.serverNow, `${label} serverNow 发生倒退`);
  assert.equal(payload.unchanged, undefined, `${label} 不得伪装成状态交付`);
  assert.equal(payload.patches, undefined, `${label} 不得携带提交后全状态分区`);
  // Do not advance client.revision here. The client intentionally keeps its last
  // accepted state revision so the following GET /state returns changed partitions.
  client.serverNow = payload.serverNow;
}

async function fetchState(metrics, client, endpoints, invariants) {
  const { payload } = await requestJson(metrics, {
    url: stateUrl(client, endpoints.gameBaseUrl),
    route: '/api/game/state',
    cookie: client.cookie,
  });
  const initial = client.revision === null;
  if (initial) {
    assert.equal(payload.unchanged, false, '初次状态不得为 unchanged');
    assert.ok(payload.patches && typeof payload.patches === 'object', '初次状态缺少分区正文');
    for (const name of STATE_PARTITIONS) assert.ok(name in payload.patches, `初次状态缺少 ${name} 分区`);
    invariants.fullStateResponses += 1;
  } else if (payload.unchanged) {
    invariants.unchangedStateResponses += 1;
  } else {
    invariants.incrementalStateResponses += 1;
  }
  acceptDelivery(client, payload, '状态响应');
  invariants.stateResponses += 1;
  return payload;
}

function saveEpochHeader(client) {
  const epoch = Number(client.state?.saveEpoch);
  return Number.isSafeInteger(epoch) && epoch >= 0
    ? { 'X-Economy-Save-Epoch': String(epoch) }
    : {};
}

function actionHeaders(client) {
  const headers = {
    ...saveEpochHeader(client),
  };
  if (Object.keys(client.partitionRevisions).length > 0) {
    headers['X-Economy-State-Revisions'] = JSON.stringify(client.partitionRevisions);
  }
  return headers;
}

async function postAction(metrics, client, endpoints, path, route, body, idempotencyKey) {
  const { payload } = await requestJson(metrics, {
    url: `${endpoints.gameBaseUrl}${path}`,
    method: 'POST',
    route,
    cookie: client.cookie,
    body,
    idempotencyKey,
    headers: actionHeaders(client),
  });
  assert.ok(Number.isInteger(payload.commandRevision), `${route} 确认缺少命令修订号`);
  assert.equal(payload.result?.ok, true, `${route} 业务结果失败：${String(payload.result?.message || '')}`);
  assert.equal(typeof payload.result?.message, 'string', `${route} 确认缺少消息`);
  assert.ok(Number(payload.revision) >= Number(payload.commandRevision), `${route} 权威交付落后于命令提交`);
  const compactManualCommodityOrder = route === '/api/game/orders'
    && body?.assetKind === 'commodity'
    && !body?.execution;
  if (compactManualCommodityOrder) {
    assert.equal(payload.revision, payload.commandRevision, `${route} 精简确认修订号不一致`);
    acceptCompactActionConfirmation(client, payload, `${route} 精简动作确认`);
  } else {
    acceptDelivery(client, payload, `${route} 动作响应`);
  }
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
    partitions: {},
    state: null,
    operationIndex: 0,
    nextWriteAt: 0,
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
  const requestKey = `stress:${runId}:order-idempotency:${client.slot}`;
  const body = {
    assetKind: 'commodity',
    assetId: STRESS_PRODUCT_ID,
    productId: STRESS_PRODUCT_ID,
    side: 'buy',
    quantity: 1,
    price: STRESS_ORDER_PRICE,
  };
  const first = await postAction(metrics, client, endpoints, '/orders', '/api/game/orders', body, requestKey);
  const repeated = await postAction(metrics, client, endpoints, '/orders', '/api/game/orders', body, requestKey);
  assert.deepEqual(
    { result: repeated.result, commandRevision: repeated.commandRevision },
    { result: first.result, commandRevision: first.commandRevision },
    '相同幂等键返回了不同命令结果',
  );
  invariants.actionConfirmations += 2;
  invariants.idempotencyChecks += 1;
  client.nextWriteAt = performance.now() + 3_200;
  await fetchState(metrics, client, endpoints, invariants);
}

function transactionMixCategory(client) {
  const slot = (client.operationIndex * 37 + client.slot * 11) % TRANSACTION_MIX_TOTAL;
  client.operationIndex += 1;
  let threshold = TRANSACTION_MIX_WEIGHTS.state;
  if (slot < threshold) return 'state';
  threshold += TRANSACTION_MIX_WEIGHTS.order;
  if (slot < threshold) return 'order';
  threshold += TRANSACTION_MIX_WEIGHTS.facilityToggle;
  if (slot < threshold) return 'facilityToggle';
  threshold += TRANSACTION_MIX_WEIGHTS.recipe;
  if (slot < threshold) return 'recipe';
  threshold += TRANSACTION_MIX_WEIGHTS.build;
  if (slot < threshold) return 'build';
  return 'research';
}

function stressOpenOrder(client) {
  return (client.state?.orders || []).find((order) => (
    order?.isOwn
    && order?.side === 'buy'
    && String(order?.assetId || order?.productId || '') === STRESS_PRODUCT_ID
    && Number(order?.price) === STRESS_ORDER_PRICE
    && Number(order?.remaining || 0) > 0
    && (order?.status === 'open' || order?.status === 'partial')
  ));
}

function stressFarmGroup(client) {
  return (client.state?.facilityGroups || []).find(
    (group) => String(group?.facilityTypeId || '') === STRESS_FACILITY_TYPE_ID,
  ) || null;
}

function nextResearchTechnology(client) {
  const completed = new Set(client.state?.research?.completedTechnologyIds || []);
  return RESEARCH_TECHNOLOGY_CATALOG.find((technology) => (
    !technology.initial
    && !completed.has(technology.id)
    && technology.prerequisiteTechnologyIds.every((technologyId) => completed.has(technologyId))
  )) || null;
}

async function confirmAction(metrics, client, endpoints, path, route, body, runId, invariants, suffix) {
  await postAction(
    metrics,
    client,
    endpoints,
    path,
    route,
    body,
    `stress:${runId}:${suffix}:${client.slot}:${randomUUID()}`,
  );
  invariants.actionConfirmations += 1;
  await fetchState(metrics, client, endpoints, invariants);
}

async function runTransactionMixOperation(metrics, client, endpoints, runId, invariants) {
  const category = transactionMixCategory(client);
  invariants.transactionMix[category] += 1;

  if (category === 'state') {
    await fetchState(metrics, client, endpoints, invariants);
    return;
  }

  if (category === 'order') {
    const openOrder = stressOpenOrder(client);
    if (openOrder) {
      await confirmAction(
        metrics,
        client,
        endpoints,
        `/orders/${encodeURIComponent(String(openOrder.id))}/cancel`,
        '/api/game/orders/:id/cancel',
        {},
        runId,
        invariants,
        'order-cancel',
      );
    } else {
      await confirmAction(
        metrics,
        client,
        endpoints,
        '/orders',
        '/api/game/orders',
        {
          assetKind: 'commodity',
          assetId: STRESS_PRODUCT_ID,
          productId: STRESS_PRODUCT_ID,
          side: 'buy',
          quantity: 1,
          price: STRESS_ORDER_PRICE,
        },
        runId,
        invariants,
        'order-place',
      );
    }
    return;
  }

  if (category === 'facilityToggle') {
    const group = stressFarmGroup(client);
    const running = Boolean(group?.enabled && group?.status === 'running');
    const operation = running ? 'pause' : 'start';
    await confirmAction(
      metrics,
      client,
      endpoints,
      `/facilities/${STRESS_FACILITY_TYPE_ID}/${operation}`,
      `/api/game/facilities/:id/${operation}`,
      {},
      runId,
      invariants,
      `facility-${operation}`,
    );
    return;
  }

  if (category === 'recipe') {
    const group = stressFarmGroup(client);
    const currentRecipe = String(group?.pendingRecipeId || group?.activeRecipeId || STRESS_FARM_RECIPES[0]);
    const currentIndex = Math.max(0, STRESS_FARM_RECIPES.indexOf(currentRecipe));
    const recipeId = STRESS_FARM_RECIPES[(currentIndex + 1) % STRESS_FARM_RECIPES.length];
    await confirmAction(
      metrics,
      client,
      endpoints,
      `/facilities/${STRESS_FACILITY_TYPE_ID}/recipe`,
      '/api/game/facilities/:id/recipe',
      { recipeId },
      runId,
      invariants,
      'facility-recipe',
    );
    return;
  }

  if (category === 'build') {
    await confirmAction(
      metrics,
      client,
      endpoints,
      '/facilities',
      '/api/game/facilities',
      { facilityTypeId: STRESS_FACILITY_TYPE_ID, quantity: 1 },
      runId,
      invariants,
      'facility-build',
    );
    return;
  }

  const activeResearch = client.state?.research?.active;
  if (activeResearch) {
    await confirmAction(
      metrics,
      client,
      endpoints,
      '/research/accelerate',
      '/api/game/research/accelerate',
      {},
      runId,
      invariants,
      'research-accelerate',
    );
    return;
  }
  const technology = nextResearchTechnology(client);
  if (!technology) {
    await fetchState(metrics, client, endpoints, invariants);
    return;
  }
  await confirmAction(
    metrics,
    client,
    endpoints,
    '/research/start',
    '/api/game/research/start',
    { technologyId: technology.id },
    runId,
    invariants,
    'research-start',
  );
}

async function runClientLoop(metrics, client, endpoints, definition, config, runId, invariants, deadline) {
  let nextPollAt = performance.now();
  if (config.profile !== 'burst') nextPollAt += (client.slot % 8) * Math.min(50, config.pollIntervalMs / 8);
  while (performance.now() < deadline) {
    if (config.profile === 'transaction-mix') {
      await runTransactionMixOperation(metrics, client, endpoints, runId, invariants);
    } else {
      const now = performance.now();
      if (definition.writes && now >= client.nextWriteAt) {
        const openOrder = stressOpenOrder(client);
        if (openOrder) {
          await postAction(
            metrics,
            client,
            endpoints,
            `/orders/${encodeURIComponent(String(openOrder.id))}/cancel`,
            '/api/game/orders/:id/cancel',
            {},
            `stress:${runId}:write-cancel:${client.slot}:${randomUUID()}`,
          );
        } else {
          await postAction(
            metrics,
            client,
            endpoints,
            '/orders',
            '/api/game/orders',
            {
              assetKind: 'commodity',
              assetId: STRESS_PRODUCT_ID,
              productId: STRESS_PRODUCT_ID,
              side: 'buy',
              quantity: 1,
              price: STRESS_ORDER_PRICE,
            },
            `stress:${runId}:write-order:${client.slot}:${randomUUID()}`,
          );
        }
        invariants.actionConfirmations += 1;
        client.nextWriteAt = performance.now() + 3_200;
        await fetchState(metrics, client, endpoints, invariants);
      } else {
        await fetchState(metrics, client, endpoints, invariants);
      }
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
  const latencyCell = (value, key) => (
    value.timedRequests === value.requests ? String(value[key]) : '未计时'
  );
  const routeRows = Object.entries(report.metrics.routes).map(([route, value]) => (
    `| ${route} | ${value.requests} | ${latencyCell(value, 'p95Ms')} | ${latencyCell(value, 'p99Ms')} | ${latencyCell(value, 'maxMs')} | ${value.unexpectedStatusCount} |`
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
    `- 耗时来源：服务端本地处理`,
    `- 总体服务端本地 p95／p99：${report.metrics.p95Ms}ms／${report.metrics.p99Ms}ms`,
    '',
    '| 路由 | 请求数 | 服务端本地 p95(ms) | 服务端本地 p99(ms) | 服务端本地最大(ms) | 非预期 |',
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
    transactionMix: Object.fromEntries(Object.keys(TRANSACTION_MIX_WEIGHTS).map((name) => [name, 0])),
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
      harness = await startLocalStressHarness({
        seedTransactionAssets: profile === 'transaction-mix',
      });
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
    configuration: {
      durationSeconds,
      pollIntervalMs,
      writes: definition.writes,
      timingSource: 'server-local',
      ...(profile === 'transaction-mix' ? { transactionMixWeights: TRANSACTION_MIX_WEIGHTS } : {}),
    },
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