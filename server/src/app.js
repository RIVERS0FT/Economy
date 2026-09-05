import { createServer } from 'node:http';
import { getStableAdminSummary } from './admin-summary.js';
import { createAdminServerStatus } from './server-status.js';
import { authenticateRequest, authenticationCacheMaxAgeForRequest } from './auth.js';
import { ensurePlayer } from './domain.js';
import {
  configureGiftCodeAdminStore,
  createGiftCodeBatch,
  listGiftCodePage,
  listGiftRedemptionPage,
} from './gift-code-batch.js';
import { decodeRouteParameter, resolveAction } from './game-routes.js';
import { checkRateLimit } from './rateLimit.js';
import { EconomyRegistrationStore } from './registration-store.js';
import {
  createRegistrationService,
  fingerprintIpAddress,
  loadRegistrationSecret,
  requestIpAddress,
} from './registration.js';
import {
  createPartitionedActionDelivery,
  createPartitionedStateDelivery,
  readKnownPartitionRevisionsFromHeader,
  readKnownPartitionRevisionsFromSearch,
} from './state-partitions.js';
import { EconomyStore } from './runtime-store.js';
import { createTutorialStore, CURRENT_TUTORIAL_VERSION } from './tutorial-store.js';
import { cleanupEmailVerificationRecords } from './verification-retention.js';
import { measureRequestPhase, requestProcessingMs, setRequestGauge } from './request-performance.js';
import {
  assertPlayerSaveEpoch,
  deletePlayerSave,
  getPlayerSaveDeletionPreflight,
} from './save-deletion.js';

const port = Number(process.env.PORT || 3002);
const databasePath = process.env.ECONOMY_DB_PATH || '/var/lib/riversoft-economy/economy.sqlite';
const publicOrigin = process.env.PUBLIC_ORIGIN || 'https://game.riversoft.top';
const store = new EconomyStore(databasePath);
const tutorialStore = createTutorialStore(store);
const registrationSecret = loadRegistrationSecret();
const registrationStore = new EconomyRegistrationStore(store, {
  secret: registrationSecret,
  ensurePlayer,
  publicOrigin,
});
const enqueueAuthoritativeWrite = (options, callback) => store.enqueueAuthoritativeWrite(options, callback);
const userWriteOptions = (user, operation) => ({
  actor: `user:${Number(user.id)}`,
  operation,
});
const sessionMetadataWriteOptions = (user) => ({
  actor: `system:session-metadata:${Number(user.id)}`,
  operation: 'session-metadata-repair',
});
const registrationService = createRegistrationService({
  registrationStore,
  executeWrite: enqueueAuthoritativeWrite,
});
configureGiftCodeAdminStore(store);

function sendJson(response, statusCode, payload, extraHeaders = {}) {
  const body = measureRequestPhase('serializeResponseMs', () => JSON.stringify(payload));
  setRequestGauge('responseJsonBytes', Buffer.byteLength(body));
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Server-Timing': `app;dur=${requestProcessingMs().toFixed(3)}`,
    ...extraHeaders,
  });
  response.end(body);
}

function sendError(response, statusCode, message, extra = {}) {
  sendJson(response, statusCode, { message, ...extra });
}

function validateRequestOrigin(request) {
  const origin = request.headers.origin;
  if (origin && origin !== publicOrigin) return false;
  const fetchSite = request.headers['sec-fetch-site'];
  return !fetchSite || ['same-origin', 'same-site', 'none'].includes(fetchSite);
}

async function readJson(request, maxBytes = 16_384) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) {
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

function requireAdmin(user) {
  if (user?.role !== 'admin') {
    const error = new Error('需要管理员权限');
    error.statusCode = 403;
    throw error;
  }
}

function registrationIpFingerprint(request) {
  return fingerprintIpAddress(requestIpAddress(request), registrationSecret);
}

const server = createServer(async (request, response) => {
  const method = request.method || 'GET';
  const url = new URL(request.url || '/', 'http://localhost');
  const path = url.pathname;

  try {
    if (method === 'GET' && path === '/health') {
      const writeExecutor = store.getAuthoritativeWriteDiagnostics();
      sendJson(response, 200, {
        ok: true,
        service: 'economy-api',
        writeQueue: {
          accepting: writeExecutor.accepting,
          running: writeExecutor.running,
          queueDepth: writeExecutor.queueDepth,
          rejected: writeExecutor.rejected,
        },
      });
      return;
    }

    const isGamePath = path.startsWith('/api/game/');
    const isRegistrationPath = path.startsWith('/api/registration/');
    if (!isGamePath && !isRegistrationPath) {
      sendError(response, 404, '接口不存在');
      return;
    }

    if (!validateRequestOrigin(request)) {
      sendError(response, 403, '请求来源不受信任');
      return;
    }

    if (isRegistrationPath) {
      const registrationActor = `system:registration-retention:${registrationIpFingerprint(request).slice(0, 16)}`;
      await enqueueAuthoritativeWrite({ actor: registrationActor, operation: 'verification-retention' }, () => {
        cleanupEmailVerificationRecords(registrationStore.database);
      });
      const requestKey = requireIdempotencyKey(request);
      const body = await readJson(request);
      const ipFingerprint = registrationIpFingerprint(request);

      if (method === 'POST' && path === '/api/registration/email-code') {
        const result = await registrationService.requestEmailCode({
          email: body.email,
          ipFingerprint,
          requestKey,
        });
        sendJson(response, 202, result);
        return;
      }

      if (method === 'POST' && path === '/api/registration/complete') {
        const account = await registrationService.complete({
          email: body.email,
          password: body.password,
          code: body.code,
          inviteCode: body.inviteCode,
          invitationSource: body.invitationSource,
          ipFingerprint,
          requestKey,
        });
        const cookieHeaders = account.setCookie.length > 0 ? { 'Set-Cookie': account.setCookie } : {};
        sendJson(response, 200, { user: account.user }, cookieHeaders);
        return;
      }

      sendError(response, 404, '注册接口不存在');
      return;
    }

    const user = await authenticateRequest(request, {
      maxCacheAgeMs: authenticationCacheMaxAgeForRequest(method, path),
    });
    if (!user) {
      sendError(response, 401, '请先登录');
      return;
    }

    if (method === 'POST' && path === '/api/game/session') {
      const requestKey = requireIdempotencyKey(request);
      const body = await readJson(request);
      const sessionMode = registrationStore.sessionBootstrapMode(user.id);
      const startedAt = Date.now();
      const queueAtStart = store.getAuthoritativeWriteDiagnostics();
      try {
        const session = sessionMode === 'existing'
          ? registrationStore.readExistingSession({ user, inviteCode: body.inviteCode })
          : await enqueueAuthoritativeWrite(
            sessionMode === 'metadata-repair'
              ? sessionMetadataWriteOptions(user)
              : userWriteOptions(user, 'session-profile-creation'),
            () => registrationStore.initializeSession({
              user,
              ipFingerprint: registrationIpFingerprint(request),
              inviteCode: body.inviteCode,
              requestKey,
            }),
          );
        sendJson(response, 200, session);
      } finally {
        const totalMs = Math.max(0, Date.now() - startedAt);
        if (totalMs >= 1_000) {
          console.warn('ECONOMY_SESSION_SLOW', JSON.stringify({
            sessionMode,
            totalMs,
            queueDepth: Number(queueAtStart.queueDepth || 0),
            queueRunning: Boolean(queueAtStart.running),
          }));
        }
      }
      return;
    }

    if (method === 'POST' && path === '/api/game/invitations/claim') {
      sendError(response, 410, '邀请码只能在首次创建 Economy 玩家档案时填写，注册完成后不能补填');
      return;
    }

    if (path.startsWith('/api/game/admin/')) {
      requireAdmin(user);
      if (method === 'GET' && path === '/api/game/admin/summary') {
        const summary = getStableAdminSummary(store, user);
        sendJson(response, 200, { summary });
        return;
      }
      if (method === 'GET' && path === '/api/game/admin/server-status') {
        sendJson(response, 200, {
          serverStatus: createAdminServerStatus({
            store,
            databasePath,
            range: url.searchParams.get('range'),
          }),
        });
        return;
      }
      if (method === 'GET' && path === '/api/game/admin/population-economy') {
        const summary = getStableAdminSummary(store, user);
        sendJson(response, 200, { summary });
        return;
      }
      if (method === 'GET' && path === '/api/game/admin/player-statistics') {
        sendJson(response, 200, {
          playerStatistics: store.getPlayerStatistics(user, url.searchParams.get('range')),
        });
        return;
      }
      if (method === 'PUT' && path === '/api/game/admin/population-economy/policy') {
        const requestKey = requireIdempotencyKey(request);
        const body = await readJson(request);
        sendJson(response, 200, await enqueueAuthoritativeWrite(userWriteOptions(user, 'admin-population-policy'), () => store.updatePopulationPolicy(user, body, { requestKey, method, path })));
        return;
      }
      if (method === 'POST' && path === '/api/game/admin/population-economy/policy/reset') {
        const requestKey = requireIdempotencyKey(request);
        const body = await readJson(request);
        sendJson(response, 200, await enqueueAuthoritativeWrite(userWriteOptions(user, 'admin-population-policy-reset'), () => store.resetPopulationPolicy(user, body, { requestKey, method, path })));
        return;
      }
      if (method === 'POST' && path === '/api/game/admin/population-economy/top-up') {
        const requestKey = requireIdempotencyKey(request);
        const body = await readJson(request);
        sendJson(response, 200, await enqueueAuthoritativeWrite(userWriteOptions(user, 'admin-population-top-up'), () => store.topUpPopulation(user, body, { requestKey, method, path })));
        return;
      }
      if (method === 'GET' && path === '/api/game/admin/community-link') {
        sendJson(response, 200, { communityLink: store.getCommunityLink() });
        return;
      }
      if (method === 'PUT' && path === '/api/game/admin/community-link') {
        const requestKey = requireIdempotencyKey(request);
        const body = await readJson(request);
        sendJson(response, 200, {
          communityLink: await enqueueAuthoritativeWrite(userWriteOptions(user, 'admin-community-link'), () => store.updateCommunityLink(user, body, { requestKey, method, path })),
        });
        return;
      }
      if (method === 'GET' && path === '/api/game/admin/gift-codes') {
        const page = listGiftCodePage(store, user, {
          cursor: url.searchParams.get('cursor'),
          limit: url.searchParams.get('limit'),
        });
        sendJson(response, 200, {
          giftCodes: page.items,
          total: page.total,
          nextCursor: page.nextCursor,
        });
        return;
      }
      if (method === 'POST' && path === '/api/game/admin/gift-codes') {
        const requestKey = requireIdempotencyKey(request);
        const body = await readJson(request);
        sendJson(response, 200, {
          giftCode: await enqueueAuthoritativeWrite(userWriteOptions(user, 'admin-gift-code-create'), () => store.createGiftCode(user, body, { requestKey, method, path })),
        });
        return;
      }
      if (method === 'POST' && path === '/api/game/admin/gift-codes/batch') {
        const requestKey = requireIdempotencyKey(request);
        const body = await readJson(request);
        sendJson(response, 200, {
          result: await enqueueAuthoritativeWrite(userWriteOptions(user, 'admin-gift-code-batch'), () => createGiftCodeBatch(store, user, body, { requestKey, method, path })),
        });
        return;
      }
      const disableMatch = path.match(/^\/api\/game\/admin\/gift-codes\/(\d+)\/disable$/);
      if (method === 'POST' && disableMatch) {
        const requestKey = requireIdempotencyKey(request);
        sendJson(response, 200, await enqueueAuthoritativeWrite(userWriteOptions(user, 'admin-gift-code-disable'), () => store.disableGiftCode(user, Number(disableMatch[1]), { requestKey, method, path })));
        return;
      }
      const redemptionsMatch = path.match(/^\/api\/game\/admin\/gift-codes\/(\d+)\/redemptions$/);
      if (method === 'GET' && redemptionsMatch) {
        const page = listGiftRedemptionPage(store, user, Number(redemptionsMatch[1]), {
          cursor: url.searchParams.get('cursor'),
          limit: url.searchParams.get('limit'),
        });
        sendJson(response, 200, {
          redemptions: page.items,
          total: page.total,
          nextCursor: page.nextCursor,
        });
        return;
      }
      if (path.startsWith('/api/game/admin/collectibles')) {
        sendError(response, 410, '藏品管理接口已永久移除');
        return;
      }
      if (method === 'GET' && path === '/api/game/admin/bans') {
        sendJson(response, 200, { incidents: registrationStore.listBanIncidents() });
        return;
      }
      const banIncident = path.match(/^\/api\/game\/admin\/bans\/(\d+)$/);
      if (method === 'GET' && banIncident) {
        sendJson(response, 200, registrationStore.getBanIncident(Number(banIncident[1])));
        return;
      }
      const banUser = path.match(/^\/api\/game\/admin\/bans\/users\/(\d+)\/ban$/);
      if (method === 'POST' && banUser) {
        const requestKey = requireIdempotencyKey(request);
        const body = await readJson(request);
        sendJson(response, 200, await enqueueAuthoritativeWrite(userWriteOptions(user, 'admin-ban-user'), () => registrationStore.banUser({
          userId: Number(banUser[1]),
          adminUserId: Number(user.id),
          note: body.note,
          incidentId: body.incidentId,
          requestKey,
        })));
        return;
      }
      const unbanUser = path.match(/^\/api\/game\/admin\/bans\/users\/(\d+)\/unban$/);
      if (method === 'POST' && unbanUser) {
        const requestKey = requireIdempotencyKey(request);
        const body = await readJson(request);
        sendJson(response, 200, await enqueueAuthoritativeWrite(userWriteOptions(user, 'admin-unban-user'), () => registrationStore.unbanUser({
          userId: Number(unbanUser[1]),
          adminUserId: Number(user.id),
          note: body.note,
          requestKey,
        })));
        return;
      }
      const rebanUser = path.match(/^\/api\/game\/admin\/bans\/users\/(\d+)\/reban$/);
      if (method === 'POST' && rebanUser) {
        const requestKey = requireIdempotencyKey(request);
        const body = await readJson(request);
        sendJson(response, 200, await enqueueAuthoritativeWrite(userWriteOptions(user, 'admin-reban-user'), () => registrationStore.rebanUser({
          userId: Number(rebanUser[1]),
          adminUserId: Number(user.id),
          note: body.note,
          requestKey,
        })));
        return;
      }
      const banAllIncident = path.match(/^\/api\/game\/admin\/bans\/(\d+)\/ban-all$/);
      if (method === 'POST' && banAllIncident) {
        const requestKey = requireIdempotencyKey(request);
        const body = await readJson(request);
        sendJson(response, 200, await enqueueAuthoritativeWrite(userWriteOptions(user, 'admin-ban-incident'), () => registrationStore.banIncident({
          incidentId: Number(banAllIncident[1]),
          adminUserId: Number(user.id),
          note: body.note,
          requestKey,
        })));
        return;
      }
      const reviewIncident = path.match(/^\/api\/game\/admin\/bans\/(\d+)\/review$/);
      if (method === 'POST' && reviewIncident) {
        const requestKey = requireIdempotencyKey(request);
        const body = await readJson(request);
        sendJson(response, 200, await enqueueAuthoritativeWrite(userWriteOptions(user, 'admin-review-incident'), () => registrationStore.reviewIncident({
          incidentId: Number(reviewIncident[1]),
          adminUserId: Number(user.id),
          note: body.note,
          requestKey,
        })));
        return;
      }
      const closeIncident = path.match(/^\/api\/game\/admin\/bans\/(\d+)\/close$/);
      if (method === 'POST' && closeIncident) {
        const requestKey = requireIdempotencyKey(request);
        const body = await readJson(request);
        sendJson(response, 200, await enqueueAuthoritativeWrite(userWriteOptions(user, 'admin-close-incident'), () => registrationStore.closeIncident({
          incidentId: Number(closeIncident[1]),
          adminUserId: Number(user.id),
          note: body.note,
          requestKey,
        })));
        return;
      }
      const unbanIncident = path.match(/^\/api\/game\/admin\/bans\/(\d+)\/unban-all$/);
      if (method === 'POST' && unbanIncident) {
        const requestKey = requireIdempotencyKey(request);
        const body = await readJson(request);
        sendJson(response, 200, await enqueueAuthoritativeWrite(userWriteOptions(user, 'admin-unban-incident'), () => registrationStore.unbanIncident({
          incidentId: Number(unbanIncident[1]),
          adminUserId: Number(user.id),
          note: body.note,
          requestKey,
        })));
        return;
      }
      sendError(response, 404, '管理员接口不存在');
      return;
    }

    if (!registrationStore.getRegistration(user.id)) {
      await enqueueAuthoritativeWrite(userWriteOptions(user, 'automatic-player-registration'), () => (
        registrationStore.ensureLoggedInPlayer({
          user,
          ipFingerprint: registrationIpFingerprint(request),
        })
      ));
    }
    registrationStore.assertPlayerActive(user.id);

    if (method === 'GET' && path === '/api/game/save-deletion/preflight') {
      const preflight = await enqueueAuthoritativeWrite(
        userWriteOptions(user, 'save-deletion-preflight'),
        () => getPlayerSaveDeletionPreflight(store, user),
      );
      sendJson(response, 200, { preflight });
      return;
    }

    if (method === 'POST' && path === '/api/game/save-deletion') {
      const retryAfter = checkRateLimit(user.id, 'general');
      if (retryAfter) {
        response.setHeader('Retry-After', String(retryAfter));
        sendError(response, 429, `操作过于频繁，请在 ${retryAfter} 秒后重试`);
        return;
      }
      const requestKey = requireIdempotencyKey(request);
      const body = await readJson(request);
      const result = await enqueueAuthoritativeWrite(
        userWriteOptions(user, 'save-deletion'),
        () => deletePlayerSave(store, user, {
          confirmation: body.confirmation,
          requestKey,
          expectedSaveEpoch: request.headers['x-economy-save-epoch'],
          method,
          path,
        }),
      );
      sendJson(response, 200, result);
      return;
    }

    if (method === 'GET' && path === '/api/game/tutorial') {
      sendJson(response, 200, {
        tutorial: tutorialStore.getStatus(user.id),
        currentVersion: CURRENT_TUTORIAL_VERSION,
      });
      return;
    }

    if (method === 'POST' && path === '/api/game/tutorial/complete') {
      const retryAfter = checkRateLimit(user.id, 'general');
      if (retryAfter) {
        response.setHeader('Retry-After', String(retryAfter));
        sendError(response, 429, `操作过于频繁，请在 ${retryAfter} 秒后重试`);
        return;
      }
      const requestKey = requireIdempotencyKey(request);
      const body = await readJson(request);
      sendJson(response, 200, await enqueueAuthoritativeWrite(userWriteOptions(user, 'tutorial-complete'), () => tutorialStore.complete(user.id, body.version, {
        requestKey,
        method,
        path,
      })));
      return;
    }

    if (method === 'GET' && path === '/api/game/invitations') {
      const invitation = await enqueueAuthoritativeWrite(userWriteOptions(user, 'invitation-summary'), () => registrationStore.getInvitationSummary(user.id));
      sendJson(response, 200, { invitation });
      return;
    }
    if (method === 'GET' && path === '/api/game/gem-shop') {
      const gemShop = await enqueueAuthoritativeWrite(userWriteOptions(user, 'gem-shop-summary'), () => store.getGemShopSummary(user));
      sendJson(response, 200, { gemShop });
      return;
    }

    if (method === 'GET' && path === '/api/game/contracts/performance') {
      sendJson(response, 200, { performance: store.getContractPerformance(user) });
      return;
    }

    if (method === 'GET' && path === '/api/game/contracts/history') {
      sendJson(response, 200, {
        history: store.listContractAuditHistory(user, {
          cursor: url.searchParams.get('cursor'),
          limit: url.searchParams.get('limit'),
          status: url.searchParams.get('status'),
          kind: url.searchParams.get('kind'),
          productId: url.searchParams.get('productId'),
          role: url.searchParams.get('role'),
          from: url.searchParams.get('from'),
          to: url.searchParams.get('to'),
        }),
      });
      return;
    }

    const contractAuditMatch = path.match(/^\/api\/game\/contracts\/([^/]+)\/audit$/);
    if (method === 'GET' && contractAuditMatch) {
      sendJson(response, 200, {
        audit: store.getContractAuditDetail(
          user,
          decodeRouteParameter(contractAuditMatch[1]),
          {
            cursor: url.searchParams.get('cursor'),
            limit: url.searchParams.get('limit'),
          },
        ),
      });
      return;
    }

    if (method === 'GET' && path === '/api/game/community-link') {
      sendJson(response, 200, { communityLink: store.getCommunityLink() });
      return;
    }

    if (method === 'GET' && path === '/api/game/market-detail') {
      sendJson(response, 200, store.getMarketDetail(user, {
        provinceId: url.searchParams.get('provinceId'),
        assetKind: url.searchParams.get('assetKind'),
        assetId: url.searchParams.get('assetId'),
        knownRevision: url.searchParams.get('revision'),
      }));
      return;
    }

    if (method === 'GET' && path === '/api/game/facility-build-quote') {
      sendJson(response, 200, store.getFacilityBuildQuote(user, {
        provinceId: url.searchParams.get('provinceId'),
        facilityTypeId: url.searchParams.get('facilityTypeId'),
        quantity: url.searchParams.get('quantity'),
      }));
      return;
    }

    const auctionBidHistoryMatch = path.match(/^\/api\/game\/auctions\/([^/]+)\/bids$/);
    if (method === 'GET' && auctionBidHistoryMatch) {
      sendJson(response, 200, {
        history: store.getAuctionBidHistory(user, decodeRouteParameter(auctionBidHistoryMatch[1])),
      });
      return;
    }

    if (method === 'GET' && path === '/api/game/state') {
      const revisionValue = url.searchParams.get('revision');
      const knownRevision = revisionValue !== null && /^\d+$/.test(revisionValue)
        ? Number(revisionValue)
        : undefined;
      const knownPartitions = readKnownPartitionRevisionsFromSearch(url.searchParams);
      const snapshot = store.stateReadRequiresWrite(user)
        ? await enqueueAuthoritativeWrite(userWriteOptions(user, 'state-read-settlement'), () => (
          store.getStateSnapshot(user, knownRevision)
        ))
        : store.getStateSnapshot(user, knownRevision);
      sendJson(response, 200, createPartitionedStateDelivery(snapshot, knownPartitions));
      return;
    }

    if (method === 'GET' && path === '/api/game/orders/history') {
      sendJson(response, 200, {
        orderHistory: store.listOrderHistory(user, {
          cursor: url.searchParams.get('cursor'),
          limit: url.searchParams.get('limit'),
        }),
      });
      return;
    }

    if (path === '/api/game/collectible-auctions' || path.startsWith('/api/game/collectible-auctions/')) {
      sendError(response, 410, '藏品拍卖接口已永久移除，请使用通用资产拍卖接口');
      return;
    }

    if (method === 'POST' && /^\/api\/game\/facilities\/[^/]+\/plan$/.test(path)) {
      sendError(response, 410, '生产计划已移除，工厂开启后仅持续生产');
      return;
    }

    if (method === 'POST' && path === '/api/game/reset') {
      sendError(response, 410, '经济状态重置功能已永久移除');
      return;
    }

    const route = resolveAction(method, path);
    if (route?.action === 'retiredFacilityConstructionAcceleration') {
      sendError(response, 410, '工厂建造已改为资金与材料即时完成，施工加速接口已退役');
      return;
    }
    if (route?.action === 'retiredFacilityMarket') {
      sendError(response, 410, '工厂资产仅允许通过拍卖交易');
      return;
    }
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
    const actionResponse = await enqueueAuthoritativeWrite(
      userWriteOptions(user, `game-action:${route.action}`),
      () => {
        assertPlayerSaveEpoch(store, user, request.headers['x-economy-save-epoch']);
        return store.apply(user, {
          action: route.action,
          payload,
          requestKey,
          method,
          path,
        });
      },
    );
    const compactManualCommodityOrder = route.action === 'placeOrder'
      && payload.assetKind === 'commodity'
      && !payload.execution;
    if (compactManualCommodityOrder) {
      sendJson(response, 200, {
        ...actionResponse,
        commandRevision: actionResponse.revision,
        serverNow: Date.now(),
      });
      return;
    }

    const actionDeliveryNow = Date.now();
    Object.defineProperty(actionResponse, 'stateSnapshot', {
      configurable: true,
      enumerable: false,
      value: store.getStateSnapshot(user, null, actionDeliveryNow),
    });
    const knownPartitions = readKnownPartitionRevisionsFromHeader(
      request.headers['x-economy-state-revisions'],
    );
    sendJson(response, 200, createPartitionedActionDelivery(actionResponse, knownPartitions, actionDeliveryNow));
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    const errorCode = String(error?.code || '');
    const expectedCapacityError = statusCode === 503 && errorCode.startsWith('WRITE_QUEUE_');
    if (error?.retryAfterSeconds) response.setHeader('Retry-After', String(error.retryAfterSeconds));
    if (statusCode >= 500 && !expectedCapacityError) console.error(error);
    sendError(
      response,
      statusCode,
      statusCode >= 500 && !expectedCapacityError ? '游戏服务器暂时不可用' : error.message,
      statusCode >= 500 && !expectedCapacityError ? {} : {
        ...(errorCode ? { code: errorCode } : {}),
        ...(error?.incidentId ? { incidentId: Number(error.incidentId) } : {}),
      },
    );
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Economy API listening on 127.0.0.1:${port}`);
});

function shutdown() {
  server.close(() => {
    void store.shutdown().then(
      () => process.exit(0),
      (error) => {
        console.error('Economy graceful shutdown failed', error);
        process.exit(1);
      },
    );
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
