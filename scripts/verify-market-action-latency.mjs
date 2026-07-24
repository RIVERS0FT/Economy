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
  "void syncConfirmedAction(response, 'placeOrder').finally(finish);",
  'return response.result;',
]) requireText(model, text);

for (const text of [
  'const DEFAULT_READ_TIMEOUT_MS = 8_000;',
  'const DEFAULT_WRITE_TIMEOUT_MS = 12_000;',
  "throw new GameApiError(408, '游戏服务器响应超时，请稍后重试');",
]) requireText(api, text);

for (const text of [
  '`order-matching.js`：商品与工厂共用的价格优先、同价时间优先、maker price、部分成交、订单状态推进、逐笔 fill 与手续费结算编排',
  '绕过统一商品撮合层处理玩家订单',
  '权威动作响应固定为 `{ result: { ok, message }, revision }`',
]) requireText(serverDesign, text);
for (const text of [
  '权威刷新必须中止正在等待的普通轮询',
  '普通状态读取超时为 8 秒，经济写请求超时为 12 秒',
]) requireText(countdownDesign, text);

if (failures.length > 0) {
  console.error('市场动作延迟防回退验证失败:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('市场动作延迟防回退验证通过：商品订单单次共享撮合、全量修复版本化、POST 后异步补拉、重复提交锁和请求超时均已锁定。');
