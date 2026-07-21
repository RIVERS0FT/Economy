import { readFileSync } from 'node:fs';
import { canAcceptRevision } from '../src/app/revisionGate.js';
import { createStateDeliveryCache } from '../src/app/stateDelivery.js';

const read = (path) => readFileSync(path, 'utf8');
const failures = [];

function requireText(path, fragments) {
  const content = read(path);
  for (const fragment of fragments) {
    if (!content.includes(fragment)) failures.push(`${path} 缺少状态容量规则: ${fragment}`);
  }
}

function forbidText(path, fragments) {
  const content = read(path);
  for (const fragment of fragments) {
    if (content.includes(fragment)) failures.push(`${path} 恢复了禁止的状态容量规则: ${fragment}`);
  }
}

requireText('README.md', [
  '游戏状态使用全局世界修订号排序，并按目录、玩家、市场、拍卖、排行榜五个分区增量同步',
  '权威动作响应固定只返回 `{ result: { ok, message }, revision }`',
  '动作已经提交但补拉失败时不得改写为操作失败',
  '客户端默认每 5 秒轮询状态',
  '客户端只接受不低于当前值的状态修订号',
  '大型 JSON 响应必须使用 gzip 压缩',
]);

requireText('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', [
  '?revision=N&catalog=',
  '`catalog`、`player`、`market`、`auction`、`leaderboard`',
  '普通玩家权威动作响应固定为 `{ result: { ok, message }, revision }`',
  '不得携带订单 ID、兑换数量、结算金额或其他动作内部字段',
  '动作事务和 `economy_idempotency.response_json` 只生成并保存这份精简确认',
  '动作发起前已经接受的全局 `revision`',
  '不得在补拉前直接写入客户端状态修订号',
  '补拉失败不得把已经提交成功的动作改写为失败',
  '`X-Economy-State-Revisions`',
  '{ revision, unchanged: true }',
  '普通轮询不得承担时间推进',
  '正式服务的全局调度器保证到期处理延后不超过 1 秒',
  '正式客户端默认每 5 秒轮询一次修订号',
  '只有 `GET state` 的分区交付响应可以更新 `EconomyState`',
  '发起任一权威动作时必须使用 `AbortController` 取消正在进行的状态轮询',
  '工作动作必须在请求发出时同步进入本地“处理中”状态',
  'gzip_types application/json',
  '部署脚本必须修补既有游戏 API snippet 或手工 `location`',
]);

requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', [
  '默认每 5 秒按服务器全局修订号轮询',
  '目录、玩家、市场、拍卖和排行榜五个状态分区',
  '可选 3／5／10 秒',
  '不得恢复每 1 秒完整状态刷新',
  '按钮必须在同一交互周期立即显示“处理中”',
  '任何低于当前修订号的迟到响应不得覆盖工作响应',
]);

requireText('server/src/storage.js', [
  "immediate ? 'BEGIN IMMEDIATE' : 'BEGIN'",
  'this.worldCache = null',
  'this.scheduledProcessing = Boolean(scheduledProcessing)',
  'setInterval(() =>',
  'processScheduledWorld(now = Date.now())',
  'structuredClone(this.worldCache.world)',
  'isDeepStrictEqual(world, cached.world)',
  'processWorldIfDue(world, now',
  '(this.scheduledProcessing || now < this.nextWorldProcessingAt)',
  'getStateSnapshot(user, knownRevision',
  'unchanged: true',
  'function createActionAcknowledgement(result, revision)',
  'const response = createActionAcknowledgement(gameResult, nextRevision);',
  'createActionAcknowledgement(cachedResponse.result, cachedResponse.revision)',
]);

forbidText('server/src/storage.js', [
  'JSON.parse(stateJson)',
  'candidate === previousStateJson',
  'const state = createVersionedClientState(world, Number(user.id), now);\n      const response',
  'normalizeJson({ result: gameResult, revision: nextRevision, state })',
]);
forbidText('server/src/leaderboards.js', [
  'STORE_HOOK',
  'EconomyStore.prototype',
]);

requireText('server/src/state-partitions.js', [
  "'catalog'",
  "'player'",
  "'market'",
  "'auction'",
  "'leaderboard'",
  "createHash('sha256')",
  'createPartitionedStateDelivery',
  'createPartitionedActionDelivery',
  "message: String(actionResponse?.result?.message || '')",
  'readKnownPartitionRevisionsFromSearch',
  'readKnownPartitionRevisionsFromHeader',
]);

requireText('server/src/app.js', [
  "url.searchParams.get('revision')",
  'store.getStateSnapshot(user, knownRevision)',
  'createPartitionedStateDelivery(',
  'createPartitionedActionDelivery(actionResponse, knownPartitions)',
  "request.headers['x-economy-state-revisions']",
]);

requireText('server/src/index.js', ["import './app.js'"]);

requireText('src/app/stateDelivery.js', [
  'STATE_PARTITION_NAMES',
  'mergeStatePatches',
  'createStateDeliveryCache',
  'payload.revision < revision',
]);

requireText('src/api/game.ts', [
  'GameStatePollResponse',
  'export interface GameActionResponse {',
  'result: GameActionResult;',
  'revision: number;',
  'knownPartitionRevisions()',
  "params.set('revision', String(revision))",
  'params.set(name, value)',
  'stateDeliveryCache.accept(payload)',
  'signal?: AbortSignal',
]);
forbidText('src/api/game.ts', [
  "const STATE_REVISIONS_HEADER = 'X-Economy-State-Revisions'",
  'headers.set(STATE_REVISIONS_HEADER',
  'export interface GameActionResponse extends StateDeliveryEnvelope',
  'state?: EconomyState;\n}',
]);

requireText('src/app/gameViewModel.ts', [
  "useState('5')",
  'revisionRef.current',
  'canAcceptRevision(currentRevision, incomingRevision)',
  'getGameState(revisionRef.current, controller.signal)',
  'const stateResponse = await getGameState(revisionRef.current);',
  'stateResponse.revision < response.revision',
  '操作已完成，但状态同步失败',
  'return response.result;',
  'refreshTaskRef.current?.controller.abort()',
  "mode === 'normal' && actionsInFlightRef.current > 0",
  'existing.controller.abort()',
  "action === 'work' && workPendingRef.current",
  'setIsWorking(true)',
  'setIsWorking(false)',
]);
forbidText('src/app/gameViewModel.ts', [
  'acceptVersionedState(response.revision, response.state, action',
  'refreshAbortRef.current',
]);

requireText('src/pages/OverviewPage.tsx', [
  "isWorking ? '处理中…'",
  'disabled={isWorking || workRemaining > 0}',
]);

if (!canAcceptRevision(null, 1)
  || !canAcceptRevision(7, 7)
  || !canAcceptRevision(7, 8)
  || canAcceptRevision(7, 6)
  || canAcceptRevision(null, undefined)
  || canAcceptRevision(7, undefined)) {
  failures.push('revision 门禁必须只接受不低于当前值的有效修订号');
}

const deliveryCache = createStateDeliveryCache();
const initialDelivery = deliveryCache.accept({
  revision: 7,
  unchanged: false,
  partitionRevisions: {
    catalog: 'catalog-0001',
    player: 'player-00001',
    market: 'market-00001',
    auction: 'auction-0001',
    leaderboard: 'leader-00001',
  },
  patches: {
    catalog: { version: 15, products: [], facilityTypes: [] },
    player: { userId: 1, credits: 100 },
    market: { orders: [] },
    auction: { collectibles: [] },
    leaderboard: { leaderboard: [] },
  },
});
const incrementalDelivery = deliveryCache.accept({
  revision: 8,
  unchanged: false,
  partitionRevisions: {
    catalog: 'catalog-0001',
    player: 'player-00002',
    market: 'market-00001',
    auction: 'auction-0001',
    leaderboard: 'leader-00001',
  },
  patches: { player: { credits: 101 } },
});
const staleDelivery = deliveryCache.accept({
  revision: 6,
  unchanged: false,
  partitionRevisions: { player: 'player-stale' },
  patches: { player: { credits: 1 } },
});
if (initialDelivery.state?.credits !== 100
  || incrementalDelivery.state?.credits !== 101
  || staleDelivery.state?.credits !== 101
  || deliveryCache.getPartitionRevisions().player !== 'player-00002') {
  failures.push('客户端分区缓存必须合并增量补丁，并拒绝旧全局修订号覆盖当前状态');
}

requireText('src/pages/SettingsPage.tsx', [
  '状态刷新频率',
  '<option value="3">每 3s</option>',
  '<option value="5">每 5s</option>',
  '<option value="10">每 10s</option>',
]);
forbidText('src/pages/SettingsPage.tsx', [
  '<option value="1">每 1s</option>',
  '<option value="3">每 3 秒</option>',
  '<option value="5">每 5 秒</option>',
  '<option value="10">每 10 秒</option>',
]);

for (const path of [
  'deploy/nginx/game.riversoft.top.economy-location.conf',
  'scripts/configure-economy-nginx.py',
]) {
  requireText(path, [
    'gzip on;',
    'gzip_vary on;',
    'gzip_proxied any;',
    'gzip_min_length 1024;',
    'gzip_comp_level 5;',
    'gzip_types application/json;',
  ]);
}

if (failures.length) {
  console.error(`状态交付容量验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('状态交付容量验证通过：世界缓存、单一全局调度、五分区增量补丁、动作精简确认与确认后分区补拉、修订号门禁、可抢占刷新任务、5 秒默认间隔和 JSON gzip 均已锁定。');
