import { createServer } from 'node:http';
import { authenticateRequest } from './auth.js';
import { checkRateLimit } from './rateLimit.js';
import { EconomyStore } from './storage.js';

const port = Number(process.env.PORT || 3002);
const databasePath = process.env.ECONOMY_DB_PATH || '/var/lib/riversoft-economy/economy.sqlite';
const publicOrigin = process.env.PUBLIC_ORIGIN || 'https://game.riversoft.top';
const store = new EconomyStore(databasePath);

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(body);
}

function sendError(response, statusCode, message) {
  sendJson(response, statusCode, { message });
}

function validateRequestOrigin(request) {
  const origin = request.headers.origin;
  if (origin && origin !== publicOrigin) return false;
  const fetchSite = request.headers['sec-fetch-site'];
  return !fetchSite || ['same-origin', 'same-site', 'none'].includes(fetchSite);
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 16_384) {
      const error = new Error('请求内容过大');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (size === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('请求 JSON 无效');
    error.statusCode = 400;
    throw error;
  }
}

function requireIdempotencyKey(request) {
  const key = String(request.headers['idempotency-key'] || '');
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(key)) {
    const error = new Error('缺少有效的 Idempotency-Key');
    error.statusCode = 400;
    throw error;
  }
  return key;
}

function resolveAction(method, path) {
  if (method === 'POST' && path === '/api/game/work') return { action: 'work', category: 'general' };
  if (method === 'POST' && path === '/api/game/facilities') return { action: 'buildFacility', category: 'general' };
  if (method === 'POST' && path === '/api/game/orders') return { action: 'placeOrder', category: 'orders' };
  if (method === 'POST' && path === '/api/game/warehouse/upgrade') return { action: 'upgradeWarehouse', category: 'general' };
  if (method === 'PATCH' && path === '/api/game/profile') return { action: 'renamePlayer', category: 'general' };
  if (method === 'POST' && path === '/api/game/reset') return { action: 'resetPlayer', category: 'general' };

  const facilityAction = path.match(/^\/api\/game\/facilities\/([^/]+)\/(start|pause|stop|list|plan)$/);
  if (method === 'POST' && facilityAction) {
    const actionMap = {
      start: 'startFacility',
      pause: 'pauseFacility',
      stop: 'pauseFacility',
      list: 'listFacility',
      plan: 'setProductionPlan',
    };
    return {
      action: actionMap[facilityAction[2]],
      category: 'general',
      routePayload: { facilityId: decodeURIComponent(facilityAction[1]) },
    };
  }

  const listingAction = path.match(/^\/api\/game\/facility-listings\/([^/]+)\/(cancel|buy)$/);
  if (method === 'POST' && listingAction) {
    return {
      action: listingAction[2] === 'cancel' ? 'cancelFacilityListing' : 'buyFacility',
      category: 'general',
      routePayload: { listingId: decodeURIComponent(listingAction[1]) },
    };
  }

  const orderAction = path.match(/^\/api\/game\/orders\/([^/]+)\/cancel$/);
  if (method === 'POST' && orderAction) {
    return {
      action: 'cancelOrder',
      category: 'orders',
      routePayload: { orderId: decodeURIComponent(orderAction[1]) },
    };
  }
  return null;
}

const server = createServer(async (request, response) => {
  const method = request.method || 'GET';
  const url = new URL(request.url || '/', 'http://localhost');
  const path = url.pathname;

  try {
    if (method === 'GET' && path === '/health') {
      sendJson(response, 200, { ok: true, service: 'economy-api' });
      return;
    }

    if (!path.startsWith('/api/game/')) {
      sendError(response, 404, '接口不存在');
      return;
    }

    if (!validateRequestOrigin(request)) {
      sendError(response, 403, '请求来源不受信任');
      return;
    }

    const user = await authenticateRequest(request);
    if (!user) {
      sendError(response, 401, '请先登录');
      return;
    }

    if (method === 'GET' && path === '/api/game/state') {
      sendJson(response, 200, { state: store.getState(user) });
      return;
    }

    const route = resolveAction(method, path);
    if (!route) {
      sendError(response, 404, '游戏操作不存在');
      return;
    }

    const retryAfter = checkRateLimit(user.id, route.category);
    if (retryAfter) {
      response.setHeader('Retry-After', String(retryAfter));
      sendError(response, 429, `操作过于频繁，请在 ${retryAfter} 秒后重试`);
      return;
    }

    const requestKey = requireIdempotencyKey(request);
    const body = await readJson(request);
    const payload = { ...body, ...(route.routePayload || {}) };
    const actionResponse = store.apply(user, {
      action: route.action,
      payload,
      requestKey,
      method,
      path,
    });
    sendJson(response, 200, actionResponse);
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    if (statusCode >= 500) console.error(error);
    sendError(response, statusCode, statusCode >= 500 ? '游戏服务器暂时不可用' : error.message);
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Economy API listening on 127.0.0.1:${port}`);
});

function shutdown() {
  server.close(() => {
    store.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5_000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
