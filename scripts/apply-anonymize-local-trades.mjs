import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const branch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
if (branch !== 'agent/anonymize-local-trades') {
  throw new Error(`拒绝在非目标分支执行: ${branch}`);
}

function read(path) {
  return readFileSync(path, 'utf8');
}

function write(path, content) {
  writeFileSync(path, content, 'utf8');
}

function replace(path, from, to, minimum = 1) {
  const source = read(path);
  const count = source.split(from).length - 1;
  if (count < minimum) throw new Error(`${path} 缺少替换锚点: ${from.slice(0, 120)}`);
  write(path, source.split(from).join(to));
}

function appendOnce(path, marker, block) {
  const source = read(path);
  if (source.includes(marker)) return;
  write(path, `${source.trimEnd()}\n\n${block.trim()}\n`);
}

const versionDocs = [
  'README.md',
  'docs/README.md',
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
  'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md',
  'docs/WAREHOUSE_EXPANSION_DESIGN.md',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  'docs/LOCAL_ACTIVITY_LOG_DESIGN.md',
];
for (const path of versionDocs) {
  let source = read(path);
  source = source
    .replaceAll('客户端状态版本：`14`', '客户端状态版本：`15`')
    .replaceAll('客户端状态版本：14', '客户端状态版本：15')
    .replaceAll('EconomyState.version` 固定为 14', 'EconomyState.version` 固定为 15')
    .replaceAll('客户端状态版本固定为 14', '客户端状态版本固定为 15');
  write(path, source);
}

replace('server/src/facility-groups.js', `function normalizeOrder(order) {
  const kind = orderKind(order);
  const assetId = orderAssetId(order);
  order.assetKind = kind;
  order.assetId = assetId;
  if (kind === 'facility') order.facilityTypeId = assetId;
  else order.productId = assetId;
  order.fills = Array.isArray(order.fills) ? order.fills : [];
  return order;
}
`, `function normalizeOrder(order) {
  const kind = orderKind(order);
  const assetId = orderAssetId(order);
  order.assetKind = kind;
  order.assetId = assetId;
  if (kind === 'facility') order.facilityTypeId = assetId;
  else order.productId = assetId;
  order.fills = Array.isArray(order.fills) ? order.fills : [];
  return order;
}

function publicOrderFill(fill) {
  return {
    id: String(fill.id || ''),
    quantity: Number(fill.quantity || 0),
    price: Number(fill.price || 0),
    total: Number(fill.total || 0),
    createdAt: Number(fill.createdAt || 0),
  };
}

function publicOrderView(order, userId) {
  const normalized = clone(normalizeOrder(order));
  const isOwn = Number(normalized.ownerId) === Number(userId);
  normalized.isOwn = isOwn;
  delete normalized.ownerType;
  delete normalized.ownerId;
  delete normalized.ownerName;
  delete normalized.demandGroupId;
  delete normalized.demandTier;
  delete normalized.demandCycleId;
  if (isOwn) normalized.fills = normalized.fills.map(publicOrderFill);
  else delete normalized.fills;
  return normalized;
}
`);
replace('server/src/facility-groups.js', 'const normalizedOrders = (world.orders || []).map((order) => clone(normalizeOrder(order)));', 'const normalizedOrders = (world.orders || []).map((order) => publicOrderView(order, userId));');
replace('server/src/facility-groups.js', '    version: 14,', '    version: 15,');
replace('server/src/storage.js', '    version: 14,', '    version: 15,');

replace('src/types.ts', `export interface OrderFill {
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
`, `/** Public fill returned to ordinary players. Counterparties and order links stay server-internal. */
export interface OrderFill {
  id: string;
  quantity: number;
  price: number;
  total: number;
  createdAt: number;
}
`);
replace('src/types.ts', `  ownerType: OrderOwnerType;
  ownerId?: number;
  ownerName: string;
`, `  /** True only for the authenticated player's own order. */
  isOwn?: boolean;
  /** Server-internal ownership fields are omitted from ordinary player responses. */
  ownerType?: OrderOwnerType;
  ownerId?: number;
  ownerName?: string;
`);
replace('src/types.ts', '  counterparty: string;\n', '');
replace('src/types.ts', '  version: 14;', '  version: 15;');

replace('src/app/gameViewModel.ts', 'order.ownerId === game.userId &&', 'order.isOwn &&');
replace('src/pages/MarketPage.tsx', 'order.ownerId === game.userId', 'order.isOwn', 2);
replace('src/pages/MarketPage.tsx', '<span role="columnheader">类型</span><span role="columnheader">资产</span><span role="columnheader">方向</span><span role="columnheader" className="numeric-cell">数量</span><span role="columnheader" className="numeric-cell">价格</span><span role="columnheader" className="numeric-cell">总额</span><span role="columnheader">来源</span><span role="columnheader">时间</span>', '<span role="columnheader">类型</span><span role="columnheader">资产</span><span role="columnheader">方向</span><span role="columnheader" className="numeric-cell">数量</span><span role="columnheader" className="numeric-cell">价格</span><span role="columnheader" className="numeric-cell">总额</span><span role="columnheader">时间</span>');
replace('src/pages/MarketPage.tsx', '                        <span role="cell">{trade.counterparty}</span>\n', '');

replace('src/utils/localActivityStore.ts', 'const STORAGE_VERSION = 4;', 'const STORAGE_VERSION = 5;');
replace('src/utils/localActivityStore.ts', `function parseDocument(raw: string | null): LocalActivityDocument | null {
`, `function normalizeTrades(trades: unknown[]): TradeRecord[] {
  return trades.slice(0, MAX_TRADES).map((raw) => {
    const trade = raw as Partial<TradeRecord>;
    return {
      id: String(trade.id || createId('local-trade')),
      type: trade.type === 'facility' ? 'facility' : 'commodity',
      productId: typeof trade.productId === 'string' ? trade.productId : undefined,
      facilityTypeId: typeof trade.facilityTypeId === 'string' ? trade.facilityTypeId : undefined,
      side: trade.side === 'sell' ? 'sell' : 'buy',
      quantity: Number(trade.quantity || 0),
      price: Number(trade.price || 0),
      total: Number(trade.total || 0),
      createdAt: Number(trade.createdAt || 0),
      description: String(trade.description || '订单成交'),
    };
  });
}

function parseDocument(raw: string | null): LocalActivityDocument | null {
`);
replace('src/utils/localActivityStore.ts', '      trades: Array.isArray(parsed.trades) ? parsed.trades.slice(0, MAX_TRADES) : [],', '      trades: Array.isArray(parsed.trades) ? normalizeTrades(parsed.trades) : [],');
replace('src/utils/localActivityStore.ts', `  for (const legacyVersion of [3, 2, 1]) {
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
`, `  for (const legacyVersion of [4, 3, 2, 1]) {
    const legacy = parseDocument(window.localStorage.getItem(storageKey(userId, legacyVersion)));
    if (legacy) {
      const migrated: LocalActivityDocument = {
        version: STORAGE_VERSION,
        assetEvents: legacy.assetEvents.filter((event) => event.category !== 'trade' && event.sourceType !== 'trade'),
        trades: [],
        snapshot: undefined,
      };
      writeDocument(userId, migrated);
      return migrated;
    }
  }
`);
replace('src/utils/localActivityStore.ts', `    window.localStorage.setItem(storageKey(userId), JSON.stringify(document));
`, `    window.localStorage.setItem(storageKey(userId), JSON.stringify(document));
    for (const legacyVersion of [4, 3, 2, 1]) {
      window.localStorage.removeItem(storageKey(userId, legacyVersion));
    }
`);
replace('src/utils/localActivityStore.ts', '    orders: state.orders.filter((order) => order.ownerId === state.userId),', '    orders: state.orders.filter((order) => order.isOwn),');
replace('src/utils/localActivityStore.ts', '    if (order.ownerId !== after.userId) continue;', '    if (!order.isOwn) continue;');
replace('src/utils/localActivityStore.ts', '        counterparty: fill.counterparty,\n', '');

for (const path of ['server/test/domain.test.js', 'server/test/asset-events.test.js', 'server/test/warehouse.test.js']) {
  if (!existsSync(path)) continue;
  let source = read(path);
  source = source.replaceAll('state.version, 14', 'state.version, 15');
  write(path, source);
}

for (const path of ['scripts/verify-gems-invitations-and-bans.mjs', 'scripts/verify-document-authority.mjs']) {
  let source = read(path);
  source = source
    .replaceAll('version: 14', 'version: 15')
    .replaceAll('客户端状态版本：`14`', '客户端状态版本：`15`')
    .replaceAll('客户端状态版本：14', '客户端状态版本：15')
    .replaceAll('客户端状态版本必须为 14', '客户端状态版本必须为 15')
    .replaceAll('版本 14/12', '版本 15/12');
  write(path, source);
}

replace('scripts/verify-market-assets.mjs', `for (const text of ['export interface OrderFill','fills?: OrderFill[]','makerOrderId','takerOrderId',"FacilityStatus = 'running' | 'stopped' | 'error'"]) requireText('src/types.ts', text);
for (const text of ['STORAGE_VERSION = 4','previousFillIds','fill.price','fill.total','fill.counterparty']) requireText('src/utils/localActivityStore.ts', text);
`, `for (const text of ['export interface OrderFill','fills?: OrderFill[]','isOwn?: boolean',"FacilityStatus = 'running' | 'stopped' | 'error'"]) requireText('src/types.ts', text);
for (const text of ['STORAGE_VERSION = 5','previousFillIds','fill.price','fill.total','normalizeTrades']) requireText('src/utils/localActivityStore.ts', text);
for (const text of ['makerOrderId','takerOrderId','counterparty: string']) forbidText('src/types.ts', text);
for (const text of ['fill.counterparty','trade.counterparty']) forbidText('src/utils/localActivityStore.ts', text);
`);

replace('package.json', 'node scripts/verify-market-assets.mjs && node --experimental-strip-types scripts/verify-market-chart.mjs', 'node scripts/verify-market-assets.mjs && node scripts/verify-local-trade-privacy.mjs && node --experimental-strip-types scripts/verify-market-chart.mjs');

write('docs/LOCAL_ACTIVITY_LOG_DESIGN.md', `# Economy 本地活动日志设计

> 状态：当前浏览器本地资产事件与匿名成交记录基线
> 适用项目：\`RIVERS0FT/Economy\`
> 更新时间：2026-07-17
> 本地文档版本：v5
> 客户端状态版本：15
> 世界状态版本：12

## 1. 边界

服务器保存权威经济状态，本地日志仅由当前浏览器比较相邻权威状态生成，不参与资产、仓库、工厂、生产、订单、产权、估值或排名。

本地日志可以记录资金、库存、仓库、工厂集群、生产、下单、撤单和本人订单成交，但普通玩家只能感知自己的订单完成情况，不得知道成交去向、来源或对手身份。

## 2. 本地存储

当前键为：

\`\`\`text
economy.local-activity.v5.<userId>
\`\`\`

每个账号最多保存 480 条资产事件和 240 条匿名成交记录。更换设备、清除站点数据、无痕模式或存储错误时允许丢失，不得影响服务器状态。

v4 及更早版本的成交记录可能含有对手方信息。升级到 v5 时必须清除全部旧成交记录和交易类资产事件、丢弃旧快照并以当前匿名权威状态重新建立快照；非交易资产事件可以保留。v5 写入成功后必须删除 v1 至 v4 的旧键。

## 3. 快照

快照只保存生成展示差异所需字段：资金、冻结资金、库存、仓库、工厂集群、施工、本人订单及匿名 fills、商品目录和工厂目录。

不得保存其他订单的真实所有者、人口需求组、对手订单 ID、Cookie、会话令牌或服务器世界 JSON。首次加载只建立快照，不生成事件；相同状态、幂等重试和重复渲染不得重复写日志。

## 4. 匿名逐笔成交

成交记录只读取本人公开 fill 的以下字段：

\`\`\`text
id
price
quantity
total
createdAt
\`\`\`

资产、方向和描述从本人的订单获得。不得保存、展示或推断 \`counterparty\`、\`ownerType\`、\`ownerName\`、\`demandGroupId\`、\`makerOrderId\`、\`takerOrderId\` 或 \`liquidity\`。

同一订单扫过多个价格时仍按真实成交价逐笔记录，不得合并为平均价。玩家可以看到部分成交、全部成交、数量、价格、总额和时间，但不能判断成交来自玩家还是人口需求。

## 5. 展示与窗口化

- 市场页显示商品和工厂统一资产的本地匿名成交，列为类型、资产、方向、数量、价格、总额和时间，不设置“来源”列。
- 资产页显示资金、商品、仓库、工厂和生产变化。
- 概览页最多显示最近 6 条匿名成交。
- 所有界面必须标注“本地记录”。
- 资产事件与本地成交必须使用共享 \`VirtualList\` 窗口化组件；筛选和统计针对完整数组，DOM 只创建当前视口及少量 overscan。
- 不得用分页、截断、\`slice\` 或只显示最近记录替代窗口化，也不得降低本地存储上限。

## 6. 清除与错误

清除日志时保留当前匿名权威快照，避免把现有资产误记为新变化。localStorage 读取或写入失败时继续接受服务器状态，不阻断任何权威游戏动作，也不向服务器上传本地日志恢复。

## 7. 防回退

不得恢复：

- 普通玩家本地成交中的对手名称、对手类型、需求组或对手订单 ID；
- 普通玩家状态中的 \`counterparty\`、\`makerOrderId\`、\`takerOrderId\` 或 \`liquidity\`；
- 非本人订单的真实 \`ownerId\`、\`ownerName\`、\`ownerType\`、\`demandGroupId\`、\`demandTier\` 或 \`demandCycleId\`；
- 仅隐藏页面列但继续在 API 或 localStorage 中保留来源信息；
- 服务器 trades、ledger 或 assetEvents 数组；
- 使用本地日志修改正式资产；
- 对高增长记录恢复全量 DOM 渲染。

未更新本设计和防回退检查的日志修改不应合并。
`);

appendOnce('README.md', '普通玩家成交回报只展示本人订单的成交结果', `- 普通玩家成交回报只展示本人订单的成交结果；订单簿、状态接口和浏览器本地记录不得暴露成交来源、去向、人口需求组、对手身份或对手订单 ID。`);
appendOnce('docs/README.md', '成交匿名化', `- 成交匿名化：普通玩家只能感知本人订单的部分成交或全部完成，API、本地存储和市场页面均不得暴露来源、去向或对手订单。`);
appendOnce('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', '## 普通玩家订单与成交匿名化', `## 普通玩家订单与成交匿名化

服务器内部订单继续保存真实所有者、需求组和 maker/taker 关系，用于撮合、结算、人口货币发行统计和管理员审计。普通玩家状态必须经过集中式公开订单序列化：本人订单仅增加 \`isOwn: true\` 并返回由 \`id / quantity / price / total / createdAt\` 组成的匿名 fills；其他订单返回 \`isOwn: false\` 且不返回 fills。

普通玩家状态中的所有订单都不得返回真实 \`ownerId\`、\`ownerName\`、\`ownerType\`、\`demandGroupId\`、\`demandTier\` 或 \`demandCycleId\`。公开 fill 不得返回 \`counterparty\`、\`makerOrderId\`、\`takerOrderId\` 或 \`liquidity\`。人口需求订单与玩家订单在普通玩家 JSON 中必须使用相同结构，不能通过字段差异判断来源。

客户端通过 \`isOwn\` 识别本人订单，并只显示订单部分成交、全部成交、成交数量、价格、总额和时间。隐藏界面列不能替代 API 脱敏。`);
appendOnce('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', '### 本地成交匿名展示', `### 本地成交匿名展示

市场页“本地成交记录”固定展示类型、资产、方向、数量、价格、总额和时间七列，不得设置“来源”列，不得显示人口需求名称、玩家名称、“匿名玩家”或其他对手类型占位。订单反馈只描述本人的买单或卖单部分成交、全部成交以及剩余数量。`);
appendOnce('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', '## 普通玩家订单序列化边界', `## 普通玩家订单序列化边界

世界 JSON 内部保留完整撮合信息；普通玩家 API 必须通过单一公开订单序列化函数输出匿名视图。该函数删除所有订单的真实所有者和人口需求字段，只为本人订单返回匿名 fills，并删除其他订单 fills。管理员审计若需要真实对手信息必须使用独立管理员接口，不得复用普通玩家 DTO。

本次仅提升客户端状态版本到 15，本地活动存储提升到 v5；世界状态版本继续为 12，不迁移或重置玩家资产和订单。`);

write('scripts/verify-local-trade-privacy.mjs', `import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const failures = [];
const requireFile = (path) => { if (!existsSync(resolve(root, path))) failures.push('缺少文件: ' + path); };
const requireText = (path, text) => { if (!read(path).includes(text)) failures.push(path + ' 缺少: ' + text); };
const forbidText = (path, text) => { if (read(path).includes(text)) failures.push(path + ' 不应包含: ' + text); };

[
  'server/src/facility-groups.js',
  'src/types.ts',
  'src/app/gameViewModel.ts',
  'src/utils/localActivityStore.ts',
  'src/pages/MarketPage.tsx',
  'docs/LOCAL_ACTIVITY_LOG_DESIGN.md',
  'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
].forEach(requireFile);

for (const text of [
  'function publicOrderView(order, userId)',
  'normalized.isOwn = isOwn',
  'delete normalized.ownerType',
  'delete normalized.ownerId',
  'delete normalized.ownerName',
  'delete normalized.demandGroupId',
  'delete normalized.demandTier',
  'delete normalized.demandCycleId',
  'normalized.fills.map(publicOrderFill)',
  'else delete normalized.fills',
  'version: 15',
]) requireText('server/src/facility-groups.js', text);

for (const text of ['isOwn?: boolean', 'version: 15;', 'export interface OrderFill']) requireText('src/types.ts', text);
for (const text of ['counterparty: string', 'makerOrderId', 'takerOrderId', "liquidity: 'maker' | 'taker'"]) forbidText('src/types.ts', text);

for (const text of [
  'STORAGE_VERSION = 5',
  'normalizeTrades',
  'legacyVersion of [4, 3, 2, 1]',
  "event.category !== 'trade' && event.sourceType !== 'trade'",
  'window.localStorage.removeItem(storageKey(userId, legacyVersion))',
  'orders: state.orders.filter((order) => order.isOwn)',
  'if (!order.isOwn) continue',
]) requireText('src/utils/localActivityStore.ts', text);
for (const text of ['fill.counterparty', 'trade.counterparty', 'counterparty:']) forbidText('src/utils/localActivityStore.ts', text);

requireText('src/app/gameViewModel.ts', 'order.isOwn &&');
requireText('src/pages/MarketPage.tsx', 'order.isOwn');
for (const text of ['trade.counterparty', 'role="columnheader">来源']) forbidText('src/pages/MarketPage.tsx', text);

for (const [path, text] of [
  ['docs/LOCAL_ACTIVITY_LOG_DESIGN.md', '普通玩家只能感知自己的订单完成情况'],
  ['docs/LOCAL_ACTIVITY_LOG_DESIGN.md', '隐藏页面列但继续在 API 或 localStorage 中保留来源信息'],
  ['docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', '集中式公开订单序列化'],
  ['docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', '不得设置“来源”列'],
  ['docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', '单一公开订单序列化函数'],
]) requireText(path, text);

if (failures.length) {
  console.error('普通玩家成交匿名化验证失败:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('普通玩家订单 API、本地存储和市场成交展示均已匿名化。');
`);

write('server/test/order-privacy.test.js', `import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, ensurePlayer } from '../src/domain.js';
import { createFacilityGroupClientState } from '../src/facility-groups.js';

const now = Date.UTC(2026, 6, 17, 12, 0, 0);
const alice = { id: 101, name: 'Alice' };
const bob = { id: 202, name: 'Bob' };

test('ordinary player order state removes counterparties, demand sources, and linked order ids', () => {
  const world = createWorld(now);
  ensurePlayer(world, alice, now);
  ensurePlayer(world, bob, now);
  world.orders = [
    {
      id: 'alice-sell', assetKind: 'commodity', assetId: 'wheat', productId: 'wheat',
      side: 'sell', ownerType: 'player', ownerId: alice.id, ownerName: 'Alice',
      price: 4, quantity: 10, remaining: 5, status: 'partial', createdAt: now,
      fills: [{
        id: 'fill-secret', quantity: 5, price: 4, total: 20, createdAt: now,
        counterparty: '饮食需求', makerOrderId: 'alice-sell', takerOrderId: 'population-secret', liquidity: 'maker',
      }],
    },
    {
      id: 'population-secret', assetKind: 'commodity', assetId: 'wheat', productId: 'wheat',
      side: 'buy', ownerType: 'population', ownerName: '饮食需求', demandGroupId: 'food', demandTier: 'raw', demandCycleId: 99,
      price: 3, quantity: 20, remaining: 20, status: 'open', createdAt: now,
      fills: [{ id: 'hidden-fill', quantity: 1, price: 3, total: 3, createdAt: now }],
    },
  ];

  const state = createFacilityGroupClientState(world, alice.id, now);
  assert.equal(state.version, 15);
  const own = state.orders.find((order) => order.id === 'alice-sell');
  const external = state.orders.find((order) => order.id === 'population-secret');

  assert.equal(own.isOwn, true);
  assert.deepEqual(own.fills, [{ id: 'fill-secret', quantity: 5, price: 4, total: 20, createdAt: now }]);
  assert.equal(external.isOwn, false);
  assert.equal('fills' in external, false);

  for (const order of state.orders) {
    for (const field of ['ownerType', 'ownerId', 'ownerName', 'demandGroupId', 'demandTier', 'demandCycleId']) {
      assert.equal(field in order, false, field + ' must not be public');
    }
  }
  const serialized = JSON.stringify(state.orders);
  for (const secret of ['饮食需求', 'counterparty', 'makerOrderId', 'takerOrderId', 'liquidity']) {
    assert.equal(serialized.includes(secret), false, secret + ' leaked');
  }
});
`);

let authority = read('scripts/verify-document-authority.mjs');
if (!authority.includes('普通玩家成交记录不得暴露来源、去向或对手订单')) {
  authority = authority.replace(
    "    '宝石商店固定汇率、单向兑换、兑换幂等与独立页面',",
    "    '宝石商店固定汇率、单向兑换、兑换幂等与独立页面',\n    '普通玩家成交记录不得暴露来源、去向或对手订单',",
  );
  write('scripts/verify-document-authority.mjs', authority);
}

let ci = read('.github/workflows/ci.yml');
ci = ci.replace('  contents: write', '  contents: read');
ci = ci.replace(`
      - name: Apply local trade anonymization bundle
        run: node scripts/apply-anonymize-local-trades.mjs
`, '');
if (!ci.includes('Verify local trade privacy')) {
  ci = ci.replace(`      - name: Verify market assets
        run: node scripts/verify-market-assets.mjs
`, `      - name: Verify market assets
        run: node scripts/verify-market-assets.mjs

      - name: Verify local trade privacy
        run: node scripts/verify-local-trade-privacy.mjs
`);
}
write('.github/workflows/ci.yml', ci);

unlinkSync('scripts/apply-anonymize-local-trades.mjs');

execSync('git config user.name "github-actions[bot]"');
execSync('git config user.email "41898282+github-actions[bot]@users.noreply.github.com"');
execSync('git add -A');
execSync('git commit -m "匿名化普通玩家成交记录"', { stdio: 'inherit' });
execSync('git push origin HEAD:agent/anonymize-local-trades', { stdio: 'inherit' });
