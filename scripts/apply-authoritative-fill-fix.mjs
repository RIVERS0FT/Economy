import { readFileSync, writeFileSync, rmSync } from 'node:fs';

function read(path) { return readFileSync(path, 'utf8'); }
function write(path, content) { writeFileSync(path, content); }
function replaceOnce(content, before, after, label) {
  if (!content.includes(before)) throw new Error(`Missing ${label}`);
  return content.replace(before, after);
}
function appendOnce(content, marker, section) {
  if (content.includes(marker)) return content;
  return `${content.trimEnd()}\n\n${section.trim()}\n`;
}

// Shared client types: each player order carries exact authoritative fills.
{
  const path = 'src/types.ts';
  let content = read(path);
  content = replaceOnce(content,
`export interface AssetOrder {
  id: string;`,
`export interface OrderFill {
  id: string;
  quantity: number;
  price: number;
  total: number;
  counterparty: string;
  createdAt: number;
  makerOrderId: string;
  takerOrderId: string;
  liquidity: 'maker' | 'taker';
}

export interface AssetOrder {
  id: string;`, 'OrderFill interface');
  content = replaceOnce(content,
`  remaining: number;
  status: OrderStatus;`,
`  remaining: number;
  fills?: OrderFill[];
  status: OrderStatus;`, 'AssetOrder fills');
  write(path, content);
}

// Commodity matching: persist every exact maker-price fill on player orders.
{
  const path = 'server/src/domain.js';
  let content = read(path);
  content = replaceOnce(content,
`  world.orders ||= [];
  for (const order of world.orders) order.productId ||= 'grain';`,
`  world.orders ||= [];
  for (const order of world.orders) {
    order.productId ||= 'grain';
    order.fills = Array.isArray(order.fills) ? order.fills : [];
  }`, 'commodity order migration');
  content = replaceOnce(content,
`function describeCounterparty(order) {
  return order.ownerName || (order.ownerType === 'population' ? '人口需求' : '市场');
}
`,
`function describeCounterparty(order) {
  return order.ownerName || (order.ownerType === 'population' ? '人口需求' : '市场');
}

function appendPlayerOrderFill(order, fill) {
  if (order.ownerType !== 'player') return;
  order.fills = Array.isArray(order.fills) ? order.fills : [];
  order.fills.push(fill);
  order.fills = order.fills.slice(-120);
}
`, 'commodity fill helper');
  content = replaceOnce(content,
`function executeTrade(world, incoming, resting, quantity, createdAt) {
  const buy = incoming.side === 'buy' ? incoming : resting;
  const sell = incoming.side === 'sell' ? incoming : resting;
  const price = resting.price;
  incoming.remaining -= quantity;
  resting.remaining -= quantity;
  incoming.status = incoming.remaining === 0 ? 'filled' : 'partial';
  resting.status = resting.remaining === 0 ? 'filled' : 'partial';
  if (buy.ownerType === 'player') settlePlayerBuy(world, buy, quantity, price, describeCounterparty(sell), createdAt);
  if (sell.ownerType === 'player') settlePlayerSell(world, sell, quantity, price, buy, createdAt);
  recordPrice(world, incoming.productId, price, quantity, createdAt);
}`,
`function executeTrade(world, incoming, resting, quantity, createdAt) {
  const buy = incoming.side === 'buy' ? incoming : resting;
  const sell = incoming.side === 'sell' ? incoming : resting;
  const price = resting.price;
  const fillId = createId('order-fill');
  const fillBase = {
    id: fillId,
    quantity,
    price,
    total: quantity * price,
    createdAt,
    makerOrderId: resting.id,
    takerOrderId: incoming.id,
  };
  incoming.remaining -= quantity;
  resting.remaining -= quantity;
  incoming.status = incoming.remaining === 0 ? 'filled' : 'partial';
  resting.status = resting.remaining === 0 ? 'filled' : 'partial';
  appendPlayerOrderFill(buy, {
    ...fillBase,
    counterparty: describeCounterparty(sell),
    liquidity: buy.id === resting.id ? 'maker' : 'taker',
  });
  appendPlayerOrderFill(sell, {
    ...fillBase,
    counterparty: describeCounterparty(buy),
    liquidity: sell.id === resting.id ? 'maker' : 'taker',
  });
  if (buy.ownerType === 'player') settlePlayerBuy(world, buy, quantity, price, describeCounterparty(sell), createdAt);
  if (sell.ownerType === 'player') settlePlayerSell(world, sell, quantity, price, buy, createdAt);
  recordPrice(world, incoming.productId, price, quantity, createdAt);
}`, 'commodity executeTrade');
  write(path, content);
}

// Facility matching uses the same exact-fill contract.
{
  const path = 'server/src/facility-groups.js';
  let content = read(path);
  content = replaceOnce(content,
`  if (kind === 'facility') order.facilityTypeId = assetId;
  else order.productId = assetId;
  return order;`,
`  if (kind === 'facility') order.facilityTypeId = assetId;
  else order.productId = assetId;
  order.fills = Array.isArray(order.fills) ? order.fills : [];
  return order;`, 'unified order fill migration');
  content = replaceOnce(content,
`function describeCounterparty(order) {
  return order.ownerName || (order.ownerType === 'market' ? '系统资产市场' : '玩家');
}
`,
`function describeCounterparty(order) {
  return order.ownerName || (order.ownerType === 'market' ? '系统资产市场' : '玩家');
}

function appendPlayerOrderFill(order, fill) {
  if (order.ownerType !== 'player') return;
  order.fills = Array.isArray(order.fills) ? order.fills : [];
  order.fills.push(fill);
  order.fills = order.fills.slice(-120);
}
`, 'facility fill helper');
  content = replaceOnce(content,
`function executeFacilityTrade(world, incoming, resting, quantity, createdAt) {
  const buy = incoming.side === 'buy' ? incoming : resting;
  const sell = incoming.side === 'sell' ? incoming : resting;
  const typeId = orderAssetId(incoming);
  const price = resting.price;

  incoming.remaining -= quantity;
  resting.remaining -= quantity;
  incoming.status = incoming.remaining === 0 ? 'filled' : 'partial';
  resting.status = resting.remaining === 0 ? 'filled' : 'partial';
`,
`function executeFacilityTrade(world, incoming, resting, quantity, createdAt) {
  const buy = incoming.side === 'buy' ? incoming : resting;
  const sell = incoming.side === 'sell' ? incoming : resting;
  const typeId = orderAssetId(incoming);
  const price = resting.price;
  const fillId = \`facility-order-fill-\${crypto.randomUUID()}\`;
  const fillBase = {
    id: fillId,
    quantity,
    price,
    total: quantity * price,
    createdAt,
    makerOrderId: resting.id,
    takerOrderId: incoming.id,
  };

  incoming.remaining -= quantity;
  resting.remaining -= quantity;
  incoming.status = incoming.remaining === 0 ? 'filled' : 'partial';
  resting.status = resting.remaining === 0 ? 'filled' : 'partial';
  appendPlayerOrderFill(buy, {
    ...fillBase,
    counterparty: describeCounterparty(sell),
    liquidity: buy.id === resting.id ? 'maker' : 'taker',
  });
  appendPlayerOrderFill(sell, {
    ...fillBase,
    counterparty: describeCounterparty(buy),
    liquidity: sell.id === resting.id ? 'maker' : 'taker',
  });
`, 'facility executeTrade');
  write(path, content);
}

// Browser records now consume exact fill events; legacy v2 trade records are discarded.
{
  const path = 'src/utils/localActivityStore.ts';
  let content = read(path);
  content = replaceOnce(content, 'const STORAGE_VERSION = 2;', 'const STORAGE_VERSION = 3;', 'local storage version');
  content = replaceOnce(content,
`interface LocalMarketSnapshot {
  lastPrice: number;
}

`, '', 'local market snapshot interface');
  content = replaceOnce(content,
`  products: ProductDefinition[];
  markets: Record<string, LocalMarketSnapshot>;
  facilityMarkets: Record<string, LocalMarketSnapshot>;
}`,
`  products: ProductDefinition[];
}`, 'snapshot market fields');
  content = replaceOnce(content,
`    products: state.products,
    markets: Object.fromEntries(
      Object.entries(state.markets).map(([productId, market]) => [productId, { lastPrice: market.lastPrice }]),
    ),
    facilityMarkets: Object.fromEntries(
      Object.entries(state.facilityMarkets).map(([typeId, market]) => [typeId, { lastPrice: market.lastPrice }]),
    ),`,
`    products: state.products,`, 'snapshot market values');
  content = replaceOnce(content,
`function readDocument(userId: number): LocalActivityDocument {
  if (typeof window === 'undefined') return emptyDocument();
  const current = parseDocument(window.localStorage.getItem(storageKey(userId)));
  if (current) return current;
  const legacy = parseDocument(window.localStorage.getItem(storageKey(userId, 1)));
  return legacy ?? emptyDocument();
}`,
`function readDocument(userId: number): LocalActivityDocument {
  if (typeof window === 'undefined') return emptyDocument();
  const current = parseDocument(window.localStorage.getItem(storageKey(userId)));
  if (current) return current;
  for (const legacyVersion of [2, 1]) {
    const legacy = parseDocument(window.localStorage.getItem(storageKey(userId, legacyVersion)));
    if (legacy) {
      return {
        version: STORAGE_VERSION,
        assetEvents: legacy.assetEvents,
        trades: [],
        snapshot: undefined,
      };
    }
  }
  return emptyDocument();
}`, 'legacy document migration');
  content = replaceOnce(content,
`function deriveAssetTrades(
  before: LocalStateSnapshot,
  after: LocalStateSnapshot,
  createdAt: number,
): TradeRecord[] {
  const previousById = new Map(before.orders.map((order) => [order.id, order]));
  const records: TradeRecord[] = [];
  for (const order of after.orders) {
    if (order.ownerId !== after.userId) continue;
    const previousRemaining = previousById.get(order.id)?.remaining ?? order.quantity;
    const executedQuantity = Math.max(0, previousRemaining - order.remaining);
    if (!executedQuantity) continue;
    const kind = order.assetKind === 'facility' || order.facilityTypeId ? 'facility' : 'commodity';
    const assetId = order.assetId ?? order.facilityTypeId ?? order.productId ?? 'grain';
    const price = kind === 'facility'
      ? after.facilityMarkets[assetId]?.lastPrice ?? order.price
      : after.markets[assetId]?.lastPrice ?? order.price;
    const name = kind === 'facility' ? facilityName(assetId) : productName(after, assetId);
    records.push({
      id: createId('local-trade'),
      type: kind,
      productId: kind === 'commodity' ? assetId : undefined,
      facilityTypeId: kind === 'facility' ? assetId : undefined,
      side: order.side,
      quantity: executedQuantity,
      price,
      total: executedQuantity * price,
      counterparty: '订单簿成交',
      createdAt,
      description: \`\${order.side === 'buy' ? '买入' : '卖出'} \${name}\`,
    });
  }
  return records;
}`,
`function deriveAssetTrades(
  before: LocalStateSnapshot,
  after: LocalStateSnapshot,
  createdAt: number,
): TradeRecord[] {
  const previousById = new Map(before.orders.map((order) => [order.id, order]));
  const records: TradeRecord[] = [];
  for (const order of after.orders) {
    if (order.ownerId !== after.userId) continue;
    const previousFillIds = new Set((previousById.get(order.id)?.fills ?? []).map((fill) => fill.id));
    const kind = order.assetKind === 'facility' || order.facilityTypeId ? 'facility' : 'commodity';
    const assetId = order.assetId ?? order.facilityTypeId ?? order.productId ?? 'grain';
    const name = kind === 'facility' ? facilityName(assetId) : productName(after, assetId);
    for (const fill of order.fills ?? []) {
      if (previousFillIds.has(fill.id)) continue;
      records.push({
        id: \`local-trade-\${fill.id}\`,
        type: kind,
        productId: kind === 'commodity' ? assetId : undefined,
        facilityTypeId: kind === 'facility' ? assetId : undefined,
        side: order.side,
        quantity: fill.quantity,
        price: fill.price,
        total: fill.total,
        counterparty: fill.counterparty,
        createdAt: fill.createdAt || createdAt,
        description: \`\${order.side === 'buy' ? '买入' : '卖出'} \${name}\`,
      });
    }
  }
  return records.sort((left, right) => right.createdAt - left.createdAt || left.id.localeCompare(right.id));
}`, 'exact local fill derivation');
  write(path, content);
}

// Regression tests for multi-level commodity fills and facility fills.
{
  const path = 'server/test/domain.test.js';
  let content = read(path);
  content = replaceOnce(content,
`const bob = { id: 2, email: 'bob@example.com', name: 'Bob' };
const now`,
`const bob = { id: 2, email: 'bob@example.com', name: 'Bob' };
const carol = { id: 3, email: 'carol@example.com', name: 'Carol' };
const now`, 'third test user');
  content = appendOnce(content, "commodity order fills preserve every exact resting price", `
test('commodity order fills preserve every exact resting price', () => {
  const world = createWorld(now);
  world.orders = [];
  const buyer = ensurePlayer(world, alice, now);
  const sellerA = ensurePlayer(world, bob, now);
  const sellerB = ensurePlayer(world, carol, now);
  buyer.credits = 100;
  sellerA.inventories.grain.available = 1;
  sellerB.inventories.grain.available = 1;

  assert.equal(applyAction(world, bob, 'placeOrder', {
    productId: 'grain', side: 'sell', quantity: 1, price: 5,
  }, now + 1).ok, true);
  assert.equal(applyAction(world, carol, 'placeOrder', {
    productId: 'grain', side: 'sell', quantity: 1, price: 6,
  }, now + 2).ok, true);
  assert.equal(applyAction(world, alice, 'placeOrder', {
    productId: 'grain', side: 'buy', quantity: 2, price: 20,
  }, now + 3).ok, true);

  const buyOrder = world.orders.find((order) => order.ownerId === alice.id && order.side === 'buy');
  assert.deepEqual(
    buyOrder.fills.map((fill) => ({ price: fill.price, quantity: fill.quantity })),
    [{ price: 5, quantity: 1 }, { price: 6, quantity: 1 }],
  );
  assert.equal(buyer.credits, 89);
  assert.equal(buyer.frozenCredits, 0);
  assert.equal(buyer.inventories.grain.available, 2);
});`);
  write(path, content);
}

{
  const path = 'server/test/facility-groups.test.js';
  let content = read(path);
  content = replaceOnce(content,
`  const sellOrder = world.orders.find((order) => order.ownerId === bob.id && order.assetKind === 'facility');
  assert.equal(sellOrder.remaining, 1);
  assert.equal(sellOrder.status, 'partial');`,
`  const sellOrder = world.orders.find((order) => order.ownerId === bob.id && order.assetKind === 'facility');
  const buyOrder = world.orders.find((order) => order.ownerId === alice.id && order.assetKind === 'facility' && order.side === 'buy');
  assert.equal(sellOrder.remaining, 1);
  assert.equal(sellOrder.status, 'partial');
  assert.deepEqual(buyOrder.fills.map((fill) => ({ price: fill.price, quantity: fill.quantity })), [
    { price: 80, quantity: 2 },
  ]);`, 'facility fill assertion');
  write(path, content);
}

// Design and anti-regression rules.
{
  const path = 'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md';
  let content = read(path);
  content = appendOnce(content, '## 成交价格与权威成交明细', `
## 成交价格与权威成交明细

每次撮合的成交价格固定为撮合前已经位于订单簿中的对手方挂单价格（maker price）。成交后该挂单可能因完全成交而立即从当前订单簿消失，但服务器必须在相关玩家订单的 \`fills\` 中保存该次成交的价格、数量、总额、对手方、maker 订单 ID、taker 订单 ID 和时间。

同一订单扫过多个价格时必须生成多条独立成交明细，不得把多档成交合并为平均价，也不得使用资产的 \`lastPrice\` 反推玩家成交价。客户端本地成交记录只能比较相邻权威状态中的新增 \`fills\`，逐条展示真实成交价格。

订单簿、价格曲线和 \`lastPrice\` 是市场状态；玩家成交记录是订单级权威明细。两者不得互相替代。`);
  write(path, content);
}

{
  const path = 'docs/LOCAL_ACTIVITY_LOG_DESIGN.md';
  let content = read(path);
  content = content.replace('> 本地文档版本：`v2`', '> 本地文档版本：`v3`');
  content = content.replaceAll('economy.local-activity.v2.<userId>', 'economy.local-activity.v3.<userId>');
  content = content.replace('## 3. v2 权威快照', '## 3. v3 权威快照');
  content = appendOnce(content, '## 13. 权威成交明细迁移', `
## 13. 权威成交明细迁移

本地日志 v3 不再根据订单剩余数量和市场 \`lastPrice\` 猜测成交价。服务器为玩家订单保存逐笔 \`fills\`；客户端只为相邻快照中新出现的 fill ID 创建成交记录，价格和总额直接使用 \`fill.price\` 与 \`fill.total\`。

同一订单在一轮请求中扫过多个价格时，每个撮合价格分别生成一条记录，不得合并为加权平均价或最终市场价。v1、v2 本地成交记录可能包含反推价格，因此升级到 v3 时保留资产事件但清空旧成交记录，并先建立新快照，避免继续展示错误价格或生成迁移假成交。

防回退检查必须禁止成交记录读取商品或工厂市场的 \`lastPrice\`。`);
  write(path, content);
}

{
  const path = 'README.md';
  let content = read(path);
  content = content.replace('- 客户端状态版本：8', '- 客户端状态版本：9');
  content = content.replace('- 世界状态版本：4', '- 世界状态版本：5');
  content = content.replaceAll('economy.local-activity.v2.<userId>', 'economy.local-activity.v3.<userId>');
  content = appendOnce(content, '## 权威成交价格', `
## 权威成交价格

每次成交使用撮合前订单簿中的对手方挂单价格。服务器在玩家订单 \`fills\` 中逐笔保存真实成交价格、数量和总额；同一订单扫过多个价格时分别记录。浏览器成交记录不得使用市场最后成交价反推订单成交价。`);
  write(path, content);
}

{
  const path = 'scripts/verify-market-assets.mjs';
  let content = read(path);
  content = replaceOnce(content,
`  'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md','docs/GIFT_CODE_AND_ADMIN_DESIGN.md'`,
`  'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md','docs/GIFT_CODE_AND_ADMIN_DESIGN.md','docs/LOCAL_ACTIVITY_LOG_DESIGN.md',
  'src/utils/localActivityStore.ts','src/types.ts'`, 'verification files');
  content = replaceOnce(content,
`for (const text of ['economy_gift_codes','economy_gift_redemptions','requireAdmin','getAdminSummary']) requireText('server/src/storage.js', text);`,
`for (const text of ['economy_gift_codes','economy_gift_redemptions','requireAdmin','getAdminSummary']) requireText('server/src/storage.js', text);
for (const text of ['export interface OrderFill','fills?: OrderFill[]','makerOrderId','takerOrderId']) requireText('src/types.ts', text);
for (const text of ['STORAGE_VERSION = 3','previousFillIds','fill.price','fill.total','fill.counterparty']) requireText('src/utils/localActivityStore.ts', text);
for (const text of ['after.markets[assetId]?.lastPrice','after.facilityMarkets[assetId]?.lastPrice','executedQuantity * price']) forbidText('src/utils/localActivityStore.ts', text);
for (const text of ['maker price','不得使用资产的 \\`lastPrice\\` 反推玩家成交价','逐笔 \\`fills\\`']) requireText('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', text);`, 'fill verification');
  write(path, content);
}

rmSync('scripts/apply-authoritative-fill-fix.mjs', { force: true });
rmSync('.github/workflows/apply-authoritative-fill-fix.yml', { force: true });
console.log('Authoritative order fill fix applied.');
