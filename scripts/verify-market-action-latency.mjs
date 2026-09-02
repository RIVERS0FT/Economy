import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const failures = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const requireText = (path, text) => {
  if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`);
};
const forbidText = (path, text) => {
  if (read(path).includes(text)) failures.push(`${path} 不得包含: ${text}`);
};

const domain = 'server/src/domain.js';
const model = 'src/app/gameViewModel.ts';
const api = 'src/api/game.ts';
const contractsApi = 'src/contracts/api.ts';
const main = 'src/main.tsx';
const writeCoordinator = 'src/api/idempotentGameWriteFetch.ts';
const serverDesign = 'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md';
const countdownDesign = 'docs/AUTHORITATIVE_COUNTDOWN_DESIGN.md';

for (const text of [
  'const ORDER_BOOK_INTEGRITY_VERSION = 1',
  'const needsOrderBookRepair = Number(world.orderBookIntegrityVersion || 0) < ORDER_BOOK_INTEGRITY_VERSION',
  'if (needsOrderBookRepair) reconcileCommodityOrderBook(migrated, now);',
  'migrated.orderBookIntegrityVersion = ORDER_BOOK_INTEGRITY_VERSION',
  'balancedMarket.matchOrder(world, incoming, now);',
  'const processedWorldAt = new WeakMap();',
  'if (processedWorldAt.get(world) === now) return world;',
  'processedWorldAt.delete(world);',
]) requireText(domain, text);
forbidText(domain, 'const hiddenIds = new Set');
forbidText(domain, 'world.orders = originalOrders.filter');

for (const text of [
  'const orderPendingRef = useRef(false);',
  "return { ok: false, message: '市场订单正在同步中，请勿重复提交' };",
  "syncConfirmedAction(response, 'placeOrder');",
  'finish();',
  'return response.result;',
]) requireText(model, text);
forbidText(model, ".finally(finish)");

for (const text of [
  'const DEFAULT_READ_TIMEOUT_MS = 8_000;',
  'const DEFAULT_WRITE_TIMEOUT_MS = 12_000;',
  "throw new GameApiError(408, '游戏服务器响应超时，请稍后重试');",
]) requireText(api, text);

for (const text of [
  "const GAME_API_PATH_PREFIX = '/economy-api/game';",
  'const SESSION_BOOTSTRAP_PATH = `${GAME_API_PATH_PREFIX}/session`;',
  'const WRITE_ATTEMPT_TIMEOUT_MS = 12_000;',
  "const STORAGE_KEY = 'economy.pending-write-idempotency.v1';",
  "headers.set('Idempotency-Key', reservation.key);",
  "headers.set('X-Economy-State-Revisions', JSON.stringify(revisions));",
  'acceptExternalStateDelivery(payload);',
  'function isSessionBootstrapWrite(input',
  'const timeout = isSessionBootstrapWrite(input)',
  'if (timeout !== null) globalThis.clearTimeout(timeout);',
  'for (let attemptIndex = 0; attemptIndex < 2; attemptIndex += 1)',
  'attemptIndex === 0 ? init.signal : undefined',
  'return response.status === 408 || response.status === 429 || response.status >= 500;',
  'pendingWrites.set(fingerprint, reservation);',
]) requireText(writeCoordinator, text);

for (const text of [
  "import { installIdempotentGameWriteFetch } from './api/idempotentGameWriteFetch';",
  'installIdempotentGameWriteFetch();',
]) requireText(main, text);

for (const text of [
  "const GAME_API_BASE = '/economy-api/game';",
  "'Idempotency-Key': requestKey()",
]) requireText(contractsApi, text);

// 撮合模块文件名和调用路径由上面的实际源码及共享撮合专项 verifier 直接验证；
// SERVER DESIGN 只保留动作确认与状态交付等稳定服务器架构约束，不复制模块目录。
for (const text of [
  '普通玩家权威动作的持久化幂等确认仍固定为 `{ result: { ok, message }, revision }`',
  '正常成功路径不得为了取得同一动作结果再追加一次 `GET state`',
]) requireText(serverDesign, text);
for (const text of [
  '权威刷新必须中止正在等待的普通轮询',
  '普通状态读取超时为 8 秒，普通经济写请求单次尝试超时为 12 秒',
  '`/economy-api/game/session`',
  '`proxy_read_timeout 30s`',
  '同一逻辑写操作在超时、断网和结果未确认期间必须持续复用同一个 `Idempotency-Key`',
  'HTTP 408、429 与任意 5xx',
]) requireText(countdownDesign, text);

if (failures.length > 0) {
  console.error('市场动作延迟防回退验证失败:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('市场动作延迟防回退验证通过：商品订单单次共享撮合、全量修复版本化、动作权威增量回执、确认即结束 pending、普通写请求超时、会话启动例外、限流保留与同键确认重试均已锁定。');
