import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
function replace(path, from, to) {
  const source = readFileSync(path, 'utf8');
  if (source.split(from).length !== 2) throw new Error('Expected one exact match: ' + path + ' / ' + from.slice(0, 90));
  writeFileSync(path, source.replace(from, to));
}
function put(path, content) {
  if (existsSync(path)) throw new Error('Refusing to overwrite new file ' + path);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content.trimStart().replace(/\s*$/, '\n'));
}
function append(path, text) { writeFileSync(path, readFileSync(path, 'utf8').trimEnd() + '\n\n' + text.trim() + '\n'); }

replace('server/src/system-market.js',
  '    const buyQuantity = isYesterday ? positiveInteger(market.todayBuyQuantity) : 0;\n    const sellQuantity = isYesterday ? positiveInteger(market.todaySellQuantity) : 0;',
  '    // Archive the original day independently from the eligible pricing input.\n    const archivedBuyQuantity = positiveInteger(market.todayBuyQuantity);\n    const archivedSellQuantity = positiveInteger(market.todaySellQuantity);\n    const buyQuantity = isYesterday ? archivedBuyQuantity : 0;\n    const sellQuantity = isYesterday ? archivedSellQuantity : 0;');
replace('server/src/system-market.js',
  '      dateKey: String(market.priceDateKey || yesterdayKey),\n      price: market.officialPrice,\n      buyQuantity,\n      sellQuantity,',
  '      dateKey: String(market.priceDateKey || yesterdayKey),\n      price: market.officialPrice,\n      buyQuantity: archivedBuyQuantity,\n      sellQuantity: archivedSellQuantity,');
replace('server/src/commercial-buildings.js', '  DEFAULT_PROVINCE_ID,', '  DEFAULT_PROVINCE_ID,\n  PROVINCE_CATALOG,');
replace('server/src/commercial-buildings.js',
  '  const number = Number(value);\n  if (!Number.isFinite(number)) return null;\n  const normalized = Math.floor(number);\n  return normalized >= 1 && normalized <= max ? normalized : null;',
  '  return typeof value === \'number\' && Number.isSafeInteger(value) && value >= 1 && value <= max ? value : null;');
replace('server/src/commercial-buildings.js', 'normalizePositiveInteger(payload.quantity ?? 1, MAX_BUILD_QUANTITY)', 'normalizePositiveInteger(payload.quantity, MAX_BUILD_QUANTITY)');
replace('server/src/commercial-buildings.js',
  "  const operation = String(payload.operation || '');\n  const userId = Number(user.id);",
  "  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return result(false, '商业建筑参数无效');\n  if (typeof payload.provinceId !== 'string' || !PROVINCE_CATALOG.some((province) => province.id === payload.provinceId)) {\n    return result(false, '必须指定有效的商业建筑地区');\n  }\n  const operation = String(payload.operation || '');\n  const userId = Number(user.id);");

put('src/utils/commercialInputAvailability.ts', `
import type { CommodityFreezeDetail, ProductInventory } from '../types';
import type { CommercialBuildingGroup, CommercialBuildingTypeDefinition } from '../types/commercial';
import { commercialStaffingCapacity, hasCommercialCycle, projectCommercialStaffingRate } from '../../shared/commercial-staffing.js';

/** Read-only next-cycle estimates. Current locked inputs and warehouse totals stay unchanged. */
export function commercialNextCycleAvailability(group: CommercialBuildingGroup, type: CommercialBuildingTypeDefinition,
  inventories: Record<string, ProductInventory>, freezeDetails: Record<string, CommodityFreezeDetail[]> | undefined, now: number) {
  const startAt = hasCommercialCycle(group) && Number.isFinite(group.cycleCompletesAt)
    ? Math.max(now, Number(group.cycleCompletesAt)) : now;
  const rate = projectCommercialStaffingRate(group, startAt);
  const effectiveCount = rate === null ? null
    : commercialStaffingCapacity(group.count, rate, group.staffingBatchCarryBps ?? 0).effectiveCount;
  const sourceId = group.provinceId + ':' + group.commercialTypeId;
  const required = effectiveCount === null ? undefined : Object.fromEntries(type.consumptionInputs.map((input) =>
    [input.productId, input.quantity * effectiveCount]));
  const usable: Record<string, number | null> = {};
  for (const input of type.consumptionInputs) {
    const inventory = inventories[input.productId];
    const available = inventory?.available ?? 0;
    const frozen = inventory?.frozen ?? 0;
    const entries = freezeDetails?.[input.productId];
    // Missing source attribution is unknown, not evidence of a shortage or permission to spend all frozen goods.
    if (frozen > 0 && !entries) { usable[input.productId] = null; continue; }
    const own = (entries ?? []).reduce((sum, entry) => sum + (entry.kind === 'commercial'
      && entry.sourceId === sourceId && Number.isSafeInteger(entry.quantity) && entry.quantity > 0 ? entry.quantity : 0), 0);
    usable[input.productId] = available + Math.min(frozen, own);
  }
  return { required, usable };
}
`);
replace('src/components/commercial/CommercialBuildingDetail.tsx',
  "import type { ProductDefinition, ProductInventory } from '../../types';",
  "import type { CommodityFreezeDetail, ProductDefinition, ProductInventory } from '../../types';\nimport { commercialNextCycleAvailability } from '../../utils/commercialInputAvailability';");
replace('src/components/commercial/CommercialBuildingDetail.tsx',
  'export function CommercialBuildingDetail({ group, type, products, inventories, markets, now, pending, onToggle,',
  'export function CommercialBuildingDetail({ group, type, products, inventories, inventoryFreezeDetails, markets, now, pending, onToggle,');
replace('src/components/commercial/CommercialBuildingDetail.tsx',
  '  inventories: Record<string, ProductInventory>;',
  '  inventories: Record<string, ProductInventory>;\n  inventoryFreezeDetails?: Record<string, CommodityFreezeDetail[]>;');
replace('src/components/commercial/CommercialBuildingDetail.tsx',
  '  const nextRequirements = Object.fromEntries(type.consumptionInputs.map((input) => [input.productId, input.quantity * group.count]));',
  '  const nextCycle = commercialNextCycleAvailability(group, type, inventories, inventoryFreezeDetails, liveNow);');
replace('src/components/commercial/CommercialBuildingDetail.tsx',
  'requiredForNextCycle={nextRequirements}',
  'requiredForNextCycle={nextCycle.required} usableForNextCycle={nextCycle.usable}');
replace('src/components/buildings/BuildingSettlementProducts.tsx',
  "  itemClassName, onOpenProductMarket, quantityLabel = '生产数量', requiredForNextCycle }: {",
  "  itemClassName, onOpenProductMarket, quantityLabel = '生产数量', requiredForNextCycle, usableForNextCycle }: {");
replace('src/components/buildings/BuildingSettlementProducts.tsx',
  '  requiredForNextCycle?: Record<string, number>;',
  '  requiredForNextCycle?: Record<string, number>;\n  usableForNextCycle?: Record<string, number | null>;');
replace('src/components/buildings/BuildingSettlementProducts.tsx',
  '        const shortage = requiredForNextCycle !== undefined && warehouseQuantity < (requiredForNextCycle[item.productId] ?? 0);',
  '        const usableQuantity = usableForNextCycle === undefined ? warehouseQuantity : usableForNextCycle[item.productId];\n        const shortage = requiredForNextCycle !== undefined && usableQuantity != null\n          && usableQuantity < (requiredForNextCycle[item.productId] ?? 0);');
replace('src/pages/CommercePage.tsx',
  'products={game.products} inventories={game.inventories} markets={game.markets} now={game.lastProcessedAt}',
  'products={game.products} inventories={game.inventories} inventoryFreezeDetails={game.inventoryFreezeDetails}\n        markets={game.markets} now={game.lastProcessedAt}');

put('src/api/gameWriteSession.ts', `
export class GameWriteSessionChangedError extends Error {
  readonly code = 'WRITE_SESSION_CHANGED';
  constructor() { super('登录账号已变化，原操作仅能在原账号中确认，请重新登录后核对。'); this.name = 'GameWriteSessionChangedError'; }
}
export interface GameWriteSession { readonly userId: number | null; readonly generation: number; readonly signal: AbortSignal; }
let generation = 0;
let controller = new AbortController();
let current: GameWriteSession = { userId: null, generation, signal: controller.signal };
const listeners = new Set<() => void>();
function rotate(userId: number | null, closed: boolean) {
  controller.abort(new GameWriteSessionChangedError());
  controller = new AbortController();
  current = { userId, generation: ++generation, signal: controller.signal };
  if (closed) controller.abort(new GameWriteSessionChangedError());
  for (const listener of listeners) listener();
}
export function beginGameWriteSession(userId: number) {
  if (!Number.isSafeInteger(userId) || userId < 1) throw new TypeError('Invalid game write identity');
  if (current.userId !== userId || current.signal.aborted) rotate(userId, false);
}
export function endGameWriteSession() { rotate(null, true); }
export function captureGameWriteSession() { assertGameWriteSession(current); return current; }
export function isCurrentGameWriteSession(session: GameWriteSession) { return session === current && !session.signal.aborted; }
export function assertGameWriteSession(session: GameWriteSession) {
  if (!isCurrentGameWriteSession(session)) throw new GameWriteSessionChangedError();
}
export function subscribeGameWriteSession(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
`);
append('src/app/immediateCommandIntent.ts', `export function resetFacilityEnabledIntents() {
  const keys = [...facilityEnabledIntents.keys()];
  facilityEnabledIntents.clear();
  for (const key of keys) emit(key);
}`);
replace('src/api/auth.ts', "import type { AuthUser } from '../types';",
  "import type { AuthUser } from '../types';\nimport { beginGameWriteSession, endGameWriteSession } from './gameWriteSession';");
replace('src/api/auth.ts', '  if (response.status === 401) return null;', '  if (response.status === 401) { endGameWriteSession(); return null; }');
replace('src/api/auth.ts',
  '  return ((await response.json()) as AuthResponse).user;',
  '  const user = ((await response.json()) as AuthResponse).user;\n  beginGameWriteSession(user.id);\n  return user;');
replace('src/api/auth.ts',
  'export async function login(email: string, password: string): Promise<AuthUser> {',
  'export async function login(email: string, password: string): Promise<AuthUser> {\n  endGameWriteSession();');
replace('src/api/auth.ts',
  '    body: JSON.stringify({ email, password }),\n  });\n  return payload.user;',
  '    body: JSON.stringify({ email, password }),\n  });\n  beginGameWriteSession(payload.user.id);\n  return payload.user;');
replace('src/api/auth.ts', 'export async function logout(): Promise<void> {', 'export async function logout(): Promise<void> {\n  endGameWriteSession();');
replace('src/app/App.tsx',
  "import { LoginPage } from './LoginPage';",
  "import { LoginPage } from './LoginPage';\nimport { endGameWriteSession } from '../api/gameWriteSession';");
replace('src/app/App.tsx', '  const handleSignedOut = useCallback(() => {', '  const handleSignedOut = useCallback(() => {\n    endGameWriteSession();');
replace('src/app/gameViewModel.ts', "import { logout } from '../api/auth';", "import { logout } from '../api/auth';\nimport { resetGameSession } from '../api/game';");
replace('src/app/gameViewModel.ts',
  'async function signOut() { try { await logout(); } finally { resetGameStateDelivery(); onSignedOutRef.current(); } }',
  'async function signOut() { try { await logout(); } finally { resetGameSession(); onSignedOutRef.current(); } }');

replace('src/api/gameWriteConfirmation.ts', '  preserveTransportError?: boolean;', '  preserveTransportError?: boolean;\n  sessionSignal?: AbortSignal;');
replace('src/api/gameWriteConfirmation.ts',
  '  const timeout = options.timeoutMs === null ? null : globalThis.setTimeout(abort, options.timeoutMs);',
  '  const abortSession = () => { controller.abort(); rejectAbort(options.sessionSignal?.reason ?? new Error(\'Game write session changed\')); };\n  const timeout = options.timeoutMs === null ? null : globalThis.setTimeout(abort, options.timeoutMs);\n  options.sessionSignal?.addEventListener(\'abort\', abortSession, { once: true });\n  if (options.sessionSignal?.aborted) abortSession();');
replace('src/api/gameWriteConfirmation.ts',
  "    options.signal?.removeEventListener('abort', abort);",
  "    options.signal?.removeEventListener('abort', abort);\n    options.sessionSignal?.removeEventListener('abort', abortSession);");
replace('src/api/gameWriteConfirmation.ts',
  '  for (let attemptIndex = 0; attemptIndex < 2; attemptIndex += 1) {\n    try {',
  '  for (let attemptIndex = 0; attemptIndex < 2; attemptIndex += 1) {\n    if (options.sessionSignal?.aborted) throw options.sessionSignal.reason;\n    try {');
replace('src/api/gameWriteConfirmation.ts',
  '    } catch (reason) {\n      lastFailure = reason;',
  '    } catch (reason) {\n      if (options.sessionSignal?.aborted) throw options.sessionSignal.reason;\n      lastFailure = reason;');
replace('src/api/game.ts',
  '  const claim = manualCommodity ? null : pendingProductionSettlement;',
  "  const directControl = /^\\/facilities\\/[^/]+\\/(start|stop|pause)$/.test(path);\n  if (directControl) delete requestBody.productionSettlement;\n  const claim = manualCommodity || directControl ? null : pendingProductionSettlement;");

replace('src/api/idempotentGameWriteFetch.ts',
  "import { fetchConfirmedGameWrite, isConfirmedActionResult, isUnconfirmedWriteStatus } from './gameWriteConfirmation';",
  "import { fetchConfirmedGameWrite, GameWriteUnconfirmedError, isConfirmedActionResult, isUnconfirmedWriteStatus } from './gameWriteConfirmation';\nimport { assertGameWriteSession, captureGameWriteSession, endGameWriteSession, GameWriteSessionChangedError, isCurrentGameWriteSession, subscribeGameWriteSession } from './gameWriteSession';");
replace('src/api/idempotentGameWriteFetch.ts', '  rejectFacilityEnabledIntent,', '  rejectFacilityEnabledIntent,\n  resetFacilityEnabledIntents,');
replace('src/api/idempotentGameWriteFetch.ts', '  createdAt: number;', '  createdAt: number;\n  queueKey?: string;');
replace('src/api/idempotentGameWriteFetch.ts',
  '        createdAt: Number(reservation.createdAt),',
  '        createdAt: Number(reservation.createdAt),\n        ...(typeof reservation.queueKey === \'string\' ? { queueKey: reservation.queueKey } : {}),');
replace('src/api/idempotentGameWriteFetch.ts',
  'function reserveWriteKey(fingerprint: string, proposedKey: string) {',
  'function reserveWriteKey(fingerprint: string, proposedKey: string, queueKey?: string) {');
replace('src/api/idempotentGameWriteFetch.ts',
  '  const existing = pendingWrites.get(fingerprint);\n  if (existing) return existing;',
  '  const existing = pendingWrites.get(fingerprint);\n  if (queueKey && [...pendingWrites.entries()].some(([key, entry]) => key !== fingerprint && entry.queueKey === queueKey)) {\n    throw new GameWriteUnconfirmedError();\n  }\n  if (existing) return existing;');
replace('src/api/idempotentGameWriteFetch.ts',
  '  const reservation = { key: proposedKey, createdAt: now };',
  '  const reservation = { key: proposedKey, createdAt: now, ...(queueKey ? { queueKey } : {}) };');
{
  const path = 'src/api/idempotentGameWriteFetch.ts';
  const source = readFileSync(path, 'utf8');
  const marker = 'export function installIdempotentGameWriteFetch() {';
  if (source.split(marker).length !== 2) throw new Error('Coordinator install boundary changed');
  writeFileSync(path, source.slice(0, source.indexOf(marker)) + `export function createIdempotentGameWriteFetch(nativeFetch: typeof fetch): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = requestMethod(input, init);
    if (!isTargetGameWrite(input, method) || typeof init?.body !== 'string') return nativeFetch(input, init);
    const headers = new Headers(init.headers);
    const proposedKey = headers.get('Idempotency-Key');
    if (!proposedKey) return nativeFetch(input, init);
    const session = captureGameWriteSession();
    if (session.userId !== null) headers.set('X-Economy-User-Id', String(session.userId));
    const legacyFingerprint = stableFingerprint([method, canonicalRequestPath(input),
      headers.get('X-Economy-Save-Epoch') || '', init.body].join('\\n'));
    const owner = String(session.userId ?? 'unbound');
    const fingerprint = owner + ':' + legacyFingerprint;
    const flightKey = String(session.generation) + ':' + fingerprint;
    const deduplicate = isManualCommodityWrite(input, init.body);
    const existing = deduplicate ? inFlightWrites.get(flightKey) : undefined;
    if (existing) {
      const response = await existing;
      assertGameWriteSession(session);
      return response.clone();
    }
    const immediateIntent = facilityToggleIntent(input, init);
    const queueKey = immediateIntent ? owner + ':' + (headers.get('X-Economy-Save-Epoch') || '') + ':' + immediateIntent.queueKey : undefined;
    const isOrder = parsedRequestUrl(input).pathname === GAME_API_PATH_PREFIX + '/orders';
    const notify = (phase: Parameters<typeof publishCommodityWriteProgress>[1]) => {
      if (isOrder && isCurrentGameWriteSession(session)) publishCommodityWriteProgress(init.body as string, phase);
    };
    const operation = runSerializedDirectControl(queueKey ? String(session.generation) + ':' + queueKey : null, async () => {
      try {
        assertGameWriteSession(session);
        hydratePendingWrites();
        prunePendingWrites(Date.now());
        // Old unowned reservations cannot safely be assigned to whichever account logs in next.
        if (pendingWrites.has(legacyFingerprint)) throw new GameWriteUnconfirmedError();
        const wasPending = pendingWrites.has(fingerprint);
        // Reserve after the preceding control has confirmed and released its key.
        // An unresolved different control blocks this queue rather than silently reordering commands.
        const reservation = reserveWriteKey(fingerprint, proposedKey, queueKey);
        headers.set('Idempotency-Key', reservation.key);
        attachKnownStateRevisions(input, headers);
        notify(wasPending ? 'confirming' : 'submitting');
        const { response, payload } = await fetchConfirmedGameWrite(nativeFetch, input, { ...init, headers }, {
          timeoutMs: isSessionBootstrapWrite(input) ? null : WRITE_ATTEMPT_TIMEOUT_MS,
          signal: init.signal,
          sessionSignal: session.signal,
          validateSuccess: isOrder ? isConfirmedActionResult : undefined,
          onConfirming: () => notify('confirming'),
          preserveTransportError: !deduplicate,
        });
        assertGameWriteSession(session);
        if (payload && typeof payload === 'object' && 'code' in payload && payload.code === 'WRITE_SESSION_MISMATCH') {
          endGameWriteSession();
          throw new GameWriteSessionChangedError();
        }
        const reconciliation = reconcileActionDelivery(response, payload);
        if (immediateIntent) {
          if (!response.ok || reconciliation.commandOk === false) {
            rejectFacilityEnabledIntent(immediateIntent.provinceId, immediateIntent.facilityTypeId, immediateIntent.sequence);
          } else {
            acknowledgeFacilityEnabledIntent(immediateIntent.provinceId, immediateIntent.facilityTypeId,
              immediateIntent.sequence, reconciliation.authorityApplied);
          }
        }
        if (!shouldKeepReservation(response)) {
          releaseWriteKey(fingerprint, reservation.key);
          notify('settled');
        } else notify('unconfirmed');
        return response;
      } catch (reason) {
        notify('unconfirmed');
        if (immediateIntent && isCurrentGameWriteSession(session)) {
          rejectFacilityEnabledIntent(immediateIntent.provinceId, immediateIntent.facilityTypeId, immediateIntent.sequence);
        }
        throw reason;
      }
    });
    if (deduplicate) inFlightWrites.set(flightKey, operation);
    try {
      const response = await operation;
      assertGameWriteSession(session);
      return response.clone();
    } finally { if (inFlightWrites.get(flightKey) === operation) inFlightWrites.delete(flightKey); }
  };
}

export function installIdempotentGameWriteFetch() {
  if (installed || typeof globalThis.fetch !== 'function') return;
  installed = true;
  subscribeGameWriteSession(resetFacilityEnabledIntents);
  globalThis.fetch = createIdempotentGameWriteFetch(globalThis.fetch.bind(globalThis));
}
`);
}

put('server/src/game-write-identity.js', `
/** The authenticated cookie remains authoritative. This additive header prevents stale-tab writes to a different account. */
export function assertGameWriteIdentity(user, expectedUserId) {
  if (expectedUserId === undefined) return;
  const expected = typeof expectedUserId === 'string' && /^[1-9][0-9]*$/.test(expectedUserId) ? Number(expectedUserId) : NaN;
  if (!Number.isSafeInteger(expected) || expected !== Number(user?.id)) {
    const error = new Error('登录账号已变化，请在原账号中确认操作结果');
    error.statusCode = 409;
    error.code = 'WRITE_SESSION_MISMATCH';
    throw error;
  }
}
`);
replace('server/src/app.js', "import { createServer } from 'node:http';", "import { createServer } from 'node:http';\nimport { assertGameWriteIdentity } from './game-write-identity.js';");
replace('server/src/app.js',
  '    const user = await authenticateRequest(request, {\n      maxCacheAgeMs: authenticationCacheMaxAgeForRequest(method, path),\n    });',
  '    const user = await authenticateRequest(request, {\n      maxCacheAgeMs: authenticationCacheMaxAgeForRequest(method, path),\n    });\n    if (user && method !== \'GET\' && method !== \'HEAD\' && path.startsWith(\'/api/game/\')) {\n      assertGameWriteIdentity(user, request.headers[\'x-economy-user-id\']);\n    }');

replace('scripts/verify-market-action-latency.mjs',
  "  'inFlightWrites.get(fingerprint)',", "  'inFlightWrites.get(flightKey)',");
replace('docs/AUTHORITATIVE_COUNTDOWN_DESIGN.md',
  '客户端以 HTTP 方法、路径与查询串、`X-Economy-Save-Epoch` 和 JSON 请求体组成逻辑操作指纹',
  '客户端以已认证玩家身份、HTTP 方法、路径与查询串、`X-Economy-Save-Epoch` 和稳定 JSON 请求体组成逻辑操作指纹');
append('docs/AUTHORITATIVE_COUNTDOWN_DESIGN.md', `## 写命令顺序与登录会话隔离

工厂启停属于有序控制命令。幂等键只在前一个命令完成确认、进入实际发送阶段后预留；一次已确认命令之后的新启停意图必须获得新键，即使内容与更早命令相同。前一个不同命令仍未确认时，后续命令不得越过它执行；原命令只允许复用原键确认。控制指纹不携带易变的生产结算提案，服务端仍在动作事务内完成权威结算。

运行中的请求、控制队列、进度事件、回执应用及自动确认重试绑定登录会话代次；持久化待确认记录按玩家身份和存档世代隔离，不按登录代次删除。退出登录、身份改变或认证失效立即中止旧代次的等待和重试，未发送队列不得发出，旧回执不得更新新会话。再次登录原账号可以按原键确认其待确认操作；其他账号不得复用其请求或回执。旧版本未归属玩家的待确认记录不得自动归入当前账号；同指纹新请求在旧记录失效前保持待核对，而不是换键重复发送。

已认证客户端的每次游戏写请求携带原玩家身份；Cookie 切换的服务器拒绝契约归服务器架构设计。会话取消与单次请求超时不同：会话取消绝不触发下一次确认尝试，也不清除已经发送但结果未知的幂等记录。普通状态缓存 reset 不等于完整退出登录；退出使用完整会话 reset 清除页面存档锁。`);
append('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', `## 游戏写请求的预期身份校验

游戏写请求可携带 \`X-Economy-User-Id\`，表示发起页面原先认证的玩家，而不是授权来源。服务端仍只信任 Cookie 认证身份；请求头存在时必须是正安全整数且与认证身份完全一致，否则在会话初始化、业务动作、幂等回放和写队列提交之前返回 HTTP 409 与 \`WRITE_SESSION_MISMATCH\`，不得对新账号执行旧请求。缺少该新增请求头的旧客户端继续通过既有认证和存档世代校验；新正式客户端在账号初始化后始终携带该头。此规则覆盖另一标签页修改共享 Cookie 的情况，不依赖浏览器成功取消网络请求。`);
replace('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md',
  '当前日只把真正的上一自然日视为价格输入，缺失日按零成交处理。',
  '当前日只把真正的上一自然日视为价格输入，缺失日按零成交处理。历史归档与调价输入必须分离：清空旧计数之前，始终按旧 `priceDateKey` 保存原日真实买量、卖量和官方价；早于昨天的数据不参与今日调价，但不得因此被归档成零成交量。');
replace('docs/COMMERCIAL_BUILDINGS_DESIGN.md',
  '请求必须明确携带地区、商业类型和正整数数量；',
  '请求必须明确携带有效地区、商业类型和数值类型的正安全整数数量；缺失数量、布尔值、小数、越界值及未知地区必须拒绝，不得对新动作取整或回退到默认地区；');
append('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', `## 商业经营库存提示

商业详情的下一周期缺货提示使用商业业务规则产生的等效经营需求及本集群可消费库存，不得直接按总建筑数和未冻结库存判断。经营冻结只计入当前地区、当前商业集群的来源，不能使用其他建筑、合同、拍卖或历史未知来源。仓库可用数量仍单独显示，不把冻结改写为可用；缺少满员率或冻结来源明细时保持未知，不断言下一周期缺货。运行中已投入商品和锁定结算不因下一周期预估更新而改变。`);
console.log('AUDIT_REPAIRS_APPLIED');
