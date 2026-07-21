from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT / path).read_text(encoding='utf-8')


def write(path, content):
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding='utf-8')


def replace_once(path, old, new):
    content = read(path)
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected one occurrence, found {count}: {old[:80]!r}')
    write(path, content.replace(old, new, 1))


def regex_once(path, pattern, replacement):
    content = read(path)
    updated, count = re.subn(pattern, replacement, content, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f'{path}: expected one regex occurrence, found {count}: {pattern[:80]!r}')
    write(path, updated)


write('server/src/order-matching.js', """import { randomUUID } from 'node:crypto';
import { applyMarketSellFee } from './market-sell-fee.js';
import { isOpenOrder, orderAssetId, orderKind } from './order-identity.js';

const MAX_PLAYER_FILLS = 120;

function samePlayer(left, right) {
  return left?.ownerType === 'player'
    && right?.ownerType === 'player'
    && Number(left.ownerId) === Number(right.ownerId);
}

export function orderPricesCross(incomingSide, incomingPrice, restingPrice) {
  const incoming = Number(incomingPrice);
  const resting = Number(restingPrice);
  if (!Number.isFinite(incoming) || !Number.isFinite(resting)) return false;
  return incomingSide === 'buy' ? incoming >= resting : incomingSide === 'sell' ? incoming <= resting : false;
}

export function compareRestingOrders(incomingSide, left, right) {
  const leftPrice = Number(left.price);
  const rightPrice = Number(right.price);
  if (leftPrice !== rightPrice) return incomingSide === 'buy' ? leftPrice - rightPrice : rightPrice - leftPrice;
  return Number(left.createdAt || 0) - Number(right.createdAt || 0);
}

function defaultCounterparty(order) {
  return order?.ownerName || (order?.ownerType === 'population' ? '市场系统' : '玩家');
}

function appendPlayerFill(order, fill) {
  if (order.ownerType !== 'player') return;
  order.fills = Array.isArray(order.fills) ? order.fills : [];
  order.fills.push(fill);
  order.fills = order.fills.slice(-MAX_PLAYER_FILLS);
}

function advanceOrder(order, quantity, createdAt) {
  order.remaining = Number(order.remaining) - quantity;
  order.status = order.remaining === 0 ? 'filled' : 'partial';
  order.lastFilledAt = createdAt;
}

export function matchIncomingOrder({
  world,
  incoming,
  createdAt,
  canMatch = () => true,
  describeCounterparty = defaultCounterparty,
  settleTrade,
  recordTrade = () => {},
  createFillId = () => `order-fill-${randomUUID()}`,
}) {
  if (!world || !incoming || typeof settleTrade !== 'function') {
    throw new TypeError('matchIncomingOrder requires world, incoming, and settleTrade');
  }
  if (!isOpenOrder(incoming)) return { fillCount: 0, filledQuantity: 0 };

  const incomingKind = orderKind(incoming);
  const incomingAssetId = orderAssetId(incoming);
  const oppositeSide = incoming.side === 'buy' ? 'sell' : incoming.side === 'sell' ? 'buy' : null;
  if (!oppositeSide || !incomingAssetId) return { fillCount: 0, filledQuantity: 0 };

  const candidates = (world.orders || [])
    .filter((resting) => (
      resting.id !== incoming.id
      && orderKind(resting) === incomingKind
      && orderAssetId(resting) === incomingAssetId
      && resting.side === oppositeSide
      && isOpenOrder(resting)
      && !samePlayer(incoming, resting)
      && orderPricesCross(incoming.side, incoming.price, resting.price)
      && canMatch({ world, incoming, resting })
    ))
    .sort((left, right) => compareRestingOrders(incoming.side, left, right));

  let fillCount = 0;
  let filledQuantity = 0;
  for (const resting of candidates) {
    if (!isOpenOrder(incoming)) break;
    if (!isOpenOrder(resting)) continue;

    const quantity = Math.min(Number(incoming.remaining), Number(resting.remaining));
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    const price = Number(resting.price);
    const buy = incoming.side === 'buy' ? incoming : resting;
    const sell = incoming.side === 'sell' ? incoming : resting;
    const fillBase = {
      id: createFillId(),
      quantity,
      price,
      total: quantity * price,
      createdAt,
      makerOrderId: resting.id,
      takerOrderId: incoming.id,
    };
    const sellerSettlement = sell.ownerType === 'player'
      ? applyMarketSellFee(sell, fillBase.total)
      : { fee: 0, netTotal: fillBase.total };

    advanceOrder(incoming, quantity, createdAt);
    advanceOrder(resting, quantity, createdAt);
    appendPlayerFill(buy, {
      ...fillBase,
      fee: 0,
      netTotal: fillBase.total,
      counterparty: describeCounterparty(sell),
      liquidity: buy.id === resting.id ? 'maker' : 'taker',
    });
    appendPlayerFill(sell, {
      ...fillBase,
      ...sellerSettlement,
      counterparty: describeCounterparty(buy),
      liquidity: sell.id === resting.id ? 'maker' : 'taker',
    });

    settleTrade({
      world,
      incoming,
      resting,
      buy,
      sell,
      quantity,
      price,
      fill: fillBase,
      sellerSettlement,
      createdAt,
    });
    recordTrade({
      world,
      incoming,
      resting,
      buy,
      sell,
      quantity,
      price,
      fill: fillBase,
      takerSide: incoming.side,
      createdAt,
    });
    fillCount += 1;
    filledQuantity += quantity;
  }

  return { fillCount, filledQuantity };
}
""")

replace_once(
    'server/src/balanced-market.js',
    "import { applyMarketSellFee } from './market-sell-fee.js';\n",
    "import { isOpenOrder } from './order-identity.js';\nimport { matchIncomingOrder } from './order-matching.js';\n",
)
regex_once(
    'server/src/balanced-market.js',
    r"  const isOpenOrder = \(order\) => Number\(order\?\.remaining \|\| 0\) > 0\n    && \(order\?\.status === 'open' \|\| order\?\.status === 'partial'\);\n",
    '',
)
regex_once(
    'server/src/balanced-market.js',
    r"\n  function appendFill\(order, fill\) \{.*?\n  \}\n(?=\n  function counterparty)",
    '',
)
regex_once(
    'server/src/balanced-market.js',
    r"  function executeTrade\(world, incoming, resting, quantity, createdAt\) \{.*?\n  function matchOrder\(world, incoming, createdAt\) \{.*?\n  \}\n(?=\n  function rebalanceNewWorld)",
    """  function matchOrder(world, incoming, createdAt) {
    if (!isCommodityOwner(incoming)) throw new Error(`Unsupported commodity order owner: ${incoming?.ownerType}`);
    if (!hasValidOwner(world, incoming)) return { fillCount: 0, filledQuantity: 0 };
    return matchIncomingOrder({
      world,
      incoming,
      createdAt,
      canMatch: ({ resting }) => (
        isCommodityOwner(resting)
        && hasValidOwner(world, resting)
        && !(resting.ownerType === 'population' && incoming.ownerType === 'population')
      ),
      describeCounterparty: counterparty,
      settleTrade: ({ buy, sell, quantity, price, sellerSettlement }) => {
        if (buy.ownerType === 'player') settlePlayerBuy(world, buy, quantity, price, counterparty(sell), createdAt);
        if (sell.ownerType === 'player') settlePlayerSell(world, sell, quantity, price, buy, sellerSettlement, createdAt);
        if (buy.demandTier === LIQUIDITY_BUY) settleLiquidityBuy(world, buy, quantity, price);
        if (sell.demandTier === LIQUIDITY_SELL) settleLiquiditySell(world, sell, quantity, price);
      },
      recordTrade: ({ buy, sell, quantity, price, takerSide }) => {
        const signalWeight = isLiquidityOrder(buy) || isLiquidityOrder(sell) ? LIQUIDITY_SIGNAL_WEIGHT : 1;
        recordPrice(world, incoming.productId, price, quantity, takerSide, createdAt, signalWeight);
      },
    });
  }
""",
)

replace_once(
    'server/src/facility-groups.js',
    "import { applyMarketSellFee } from './market-sell-fee.js';\n",
    "import { matchIncomingOrder } from './order-matching.js';\n",
)
regex_once(
    'server/src/facility-groups.js',
    r"\nfunction sortCandidates\(orders, incomingSide\) \{.*?\n\}\n(?=\nfunction describeCounterparty)",
    '',
)
regex_once(
    'server/src/facility-groups.js',
    r"\nfunction appendPlayerOrderFill\(order, fill\) \{.*?\n\}\n(?=\nfunction addPurchasedGroup)",
    '',
)
regex_once(
    'server/src/facility-groups.js',
    r"function executeFacilityTrade\(world, incoming, resting, quantity, createdAt\) \{.*?\nfunction matchFacilityOrder\(world, incoming, createdAt\) \{.*?\n\}\n(?=\nexport function processFacilityGroupWorld)",
    """function matchFacilityOrder(world, incoming, createdAt) {
  const typeId = orderAssetId(incoming);
  return matchIncomingOrder({
    world,
    incoming,
    createdAt,
    canMatch: ({ resting }) => resting.ownerType === 'player' && incoming.ownerType === 'player',
    describeCounterparty,
    settleTrade: ({ buy, sell, quantity, price, sellerSettlement }) => {
      if (buy.ownerType === 'player') {
        const buyer = world.players[String(buy.ownerId)];
        if (!buyer) throw new Error(`Missing facility buyer ${buy.ownerId}`);
        const reserved = quantity * Number(buy.price);
        const actual = quantity * price;
        buyer.frozenCredits -= reserved;
        buyer.credits += reserved - actual;
        buyer.stats.facilityVolume = Number(buyer.stats.facilityVolume || 0) + actual;
        addPurchasedGroup(buyer, typeId, quantity);
      }

      if (sell.ownerType === 'player') {
        const seller = world.players[String(sell.ownerId)];
        if (!seller) throw new Error(`Missing facility seller ${sell.ownerId}`);
        const group = groupFor(seller, typeId);
        if (!group || group.count < quantity) throw new Error('卖方工厂数量不足');
        group.count -= quantity;
        seller.credits += sellerSettlement.netTotal;
        seller.stats.systemSinks = Number(seller.stats.systemSinks || 0) + sellerSettlement.fee;
        seller.stats.facilityVolume = Number(seller.stats.facilityVolume || 0) + quantity * price;
        if (group.count === 0) seller.facilityGroups = seller.facilityGroups.filter((item) => item !== group);
      }
    },
    recordTrade: ({ quantity, price, takerSide }) => {
      recordFacilityPrice(world, typeId, price, quantity, takerSide, createdAt);
    },
  });
}
""",
)

write('server/test/order-matching.test.js', """import assert from 'node:assert/strict';
import test from 'node:test';
import { matchIncomingOrder } from '../src/order-matching.js';

function order({
  id,
  assetKind = 'commodity',
  assetId = 'wheat',
  side,
  ownerId,
  ownerType = 'player',
  price,
  quantity,
  createdAt,
}) {
  return {
    id,
    assetKind,
    assetId,
    ...(assetKind === 'facility' ? { facilityTypeId: assetId } : { productId: assetId }),
    side,
    ownerType,
    ownerId,
    ownerName: ownerType === 'population' ? '市场系统' : `玩家${ownerId}`,
    price,
    quantity,
    remaining: quantity,
    status: 'open',
    createdAt,
    fills: [],
  };
}

for (const assetKind of ['commodity', 'facility']) {
  test(`shared matcher preserves price-time priority, maker price, and partial fills for ${assetKind}`, () => {
    const assetId = assetKind === 'facility' ? 'farm' : 'wheat';
    const priceTenOlder = order({ id: `${assetKind}-sell-10-old`, assetKind, assetId, side: 'sell', ownerId: 1, price: 10, quantity: 1, createdAt: 2 });
    const priceTenNewer = order({ id: `${assetKind}-sell-10-new`, assetKind, assetId, side: 'sell', ownerId: 2, price: 10, quantity: 1, createdAt: 3 });
    const priceElevenEarlier = order({ id: `${assetKind}-sell-11`, assetKind, assetId, side: 'sell', ownerId: 3, price: 11, quantity: 2, createdAt: 1 });
    const incoming = order({ id: `${assetKind}-buy`, assetKind, assetId, side: 'buy', ownerId: 9, price: 12, quantity: 3, createdAt: 4 });
    const world = { orders: [priceElevenEarlier, priceTenNewer, priceTenOlder, incoming] };
    const settlements = [];

    const result = matchIncomingOrder({
      world,
      incoming,
      createdAt: 5,
      createFillId: (() => {
        let value = 0;
        return () => `fill-${++value}`;
      })(),
      settleTrade: ({ resting, quantity, price }) => settlements.push({ resting: resting.id, quantity, price }),
    });

    assert.deepEqual(result, { fillCount: 3, filledQuantity: 3 });
    assert.deepEqual(settlements, [
      { resting: priceTenOlder.id, quantity: 1, price: 10 },
      { resting: priceTenNewer.id, quantity: 1, price: 10 },
      { resting: priceElevenEarlier.id, quantity: 1, price: 11 },
    ]);
    assert.equal(incoming.status, 'filled');
    assert.equal(priceElevenEarlier.status, 'partial');
    assert.equal(priceElevenEarlier.remaining, 1);
    assert.deepEqual(incoming.fills.map((fill) => fill.price), [10, 10, 11]);
    assert.deepEqual(incoming.fills.map((fill) => fill.makerOrderId), [priceTenOlder.id, priceTenNewer.id, priceElevenEarlier.id]);
    assert.ok(incoming.fills.every((fill) => fill.takerOrderId === incoming.id && fill.liquidity === 'taker'));
    assert.equal(priceTenOlder.fills[0].liquidity, 'maker');
    assert.equal(priceTenOlder.fills[0].fee, 1);
    assert.equal(priceTenOlder.lastFilledAt, 5);
  });
}

test('shared matcher skips a same-player crossing order and continues to an eligible counterparty', () => {
  const ownSell = order({ id: 'own-sell', side: 'sell', ownerId: 1, price: 5, quantity: 1, createdAt: 1 });
  const otherSell = order({ id: 'other-sell', side: 'sell', ownerId: 2, price: 6, quantity: 1, createdAt: 2 });
  const incoming = order({ id: 'incoming-buy', side: 'buy', ownerId: 1, price: 6, quantity: 1, createdAt: 3 });
  const world = { orders: [ownSell, otherSell, incoming] };

  matchIncomingOrder({ world, incoming, createdAt: 4, settleTrade: () => {} });

  assert.equal(ownSell.status, 'open');
  assert.equal(ownSell.remaining, 1);
  assert.equal(otherSell.status, 'filled');
  assert.equal(incoming.fills[0].price, 6);
});

test('asset adapter can exclude otherwise crossing system orders without duplicating the matching loop', () => {
  const systemSell = order({ id: 'system-sell', side: 'sell', ownerType: 'population', price: 5, quantity: 1, createdAt: 1 });
  const playerSell = order({ id: 'player-sell', side: 'sell', ownerId: 2, price: 6, quantity: 1, createdAt: 2 });
  const incoming = order({ id: 'system-buy', side: 'buy', ownerType: 'population', price: 6, quantity: 1, createdAt: 3 });
  const world = { orders: [systemSell, playerSell, incoming] };

  matchIncomingOrder({
    world,
    incoming,
    createdAt: 4,
    canMatch: ({ incoming: taker, resting }) => !(taker.ownerType === 'population' && resting.ownerType === 'population'),
    settleTrade: () => {},
  });

  assert.equal(systemSell.status, 'open');
  assert.equal(playerSell.status, 'filled');
  assert.equal(incoming.status, 'filled');
  assert.equal(incoming.fills, undefined);
});
""")

write('scripts/verify-order-matching-core.mjs', """import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const requiredFiles = [
  'server/src/order-matching.js',
  'server/src/balanced-market.js',
  'server/src/facility-groups.js',
  'server/test/order-matching.test.js',
  'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md',
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
];
for (const path of requiredFiles) assert.ok(existsSync(path), `缺少共享撮合文件: ${path}`);

const core = read('server/src/order-matching.js');
for (const text of [
  'export function matchIncomingOrder',
  'export function compareRestingOrders',
  'export function orderPricesCross',
  "import { applyMarketSellFee } from './market-sell-fee.js'",
  "import { isOpenOrder, orderAssetId, orderKind } from './order-identity.js'",
  'makerOrderId: resting.id',
  'takerOrderId: incoming.id',
  "order.status = order.remaining === 0 ? 'filled' : 'partial'",
  '!samePlayer(incoming, resting)',
]) assert.ok(core.includes(text), `共享撮合内核缺少: ${text}`);
for (const forbidden of ['PRODUCT_CATALOG', 'FACILITY_TYPE_CATALOG', 'inventoryFor(', 'groupFor(']) {
  assert.equal(core.includes(forbidden), false, `共享撮合内核不得绑定资产业务: ${forbidden}`);
}

for (const path of ['server/src/balanced-market.js', 'server/src/facility-groups.js']) {
  const source = read(path);
  assert.ok(source.includes("import { matchIncomingOrder } from './order-matching.js'"), `${path} 未接入共享撮合内核`);
  assert.ok(source.includes('matchIncomingOrder({'), `${path} 未调用共享撮合内核`);
}
const commodity = read('server/src/balanced-market.js');
const facility = read('server/src/facility-groups.js');
for (const forbidden of ['function executeTrade(', 'function appendFill(']) {
  assert.equal(commodity.includes(forbidden), false, `商品模块残留重复撮合逻辑: ${forbidden}`);
}
for (const forbidden of ['function executeFacilityTrade(', 'function sortCandidates(', 'function appendPlayerOrderFill(']) {
  assert.equal(facility.includes(forbidden), false, `工厂模块残留重复撮合逻辑: ${forbidden}`);
}

const tests = read('server/test/order-matching.test.js');
for (const text of ['price-time priority', 'maker price', 'partial fills', 'same-player', 'system orders']) {
  assert.ok(tests.includes(text), `共享撮合测试缺少: ${text}`);
}
const design = read('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md');
for (const text of ['共享撮合内核', '`server/src/order-matching.js`', '唯一撮合状态机', '不得各自重新实现']) {
  assert.ok(design.includes(text), `统一订单簿设计缺少: ${text}`);
}
const architecture = read('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md');
assert.ok(architecture.includes('`server/src/order-matching.js`'), '服务器架构未登记共享撮合内核');

console.log('共享撮合内核验证通过：商品与工厂复用价格时间优先、maker price、部分成交、fill 和手续费状态机。');
""")

replace_once(
    'package.json',
    '"verify:architecture": "node scripts/verify-document-authority.mjs &&',
    '"verify:order-matching-core": "node scripts/verify-order-matching-core.mjs",\n    "verify:architecture": "node scripts/verify-document-authority.mjs && node scripts/verify-order-matching-core.mjs &&',
)

replace_once(
    'README.md',
    '- 商品和工厂共用统一限价订单结构，支持价格优先、同价时间优先、部分成交和撤单。不同主体且价格交叉的可成交订单必须立即按 maker price 撮合；同一玩家的新商品或工厂订单若会与自己的反向订单交叉，必须在冻结资产前拒绝。',
    '- 商品和工厂共用统一限价订单结构，并统一调用 `server/src/order-matching.js` 执行价格优先、同价时间优先、maker price、部分成交、订单状态推进、逐笔 fill 和卖方手续费；商品与工厂模块只提供资产结算和行情记录适配器。不同主体且价格交叉的可成交订单必须立即撮合；同一玩家的新商品或工厂订单若会与自己的反向订单交叉，必须在冻结资产前拒绝。',
)

replace_once(
    'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md',
    '公开订单簿的长期稳定状态不得包含可成交的不同主体交叉订单、同一玩家交叉订单或系统交叉订单。瞬时函数调用内部可以在新订单创建后立即进入撮合，但事务返回和客户端状态序列化之前必须恢复非交叉状态。\n\n## 5. maker price 与逐笔成交',
    '''公开订单簿的长期稳定状态不得包含可成交的不同主体交叉订单、同一玩家交叉订单或系统交叉订单。瞬时函数调用内部可以在新订单创建后立即进入撮合，但事务返回和客户端状态序列化之前必须恢复非交叉状态。\n\n### 4.1 共享撮合内核\n\n`server/src/order-matching.js` 是商品与工厂限价订单的唯一撮合状态机。商品 `balanced-market.js` 与工厂 `facility-groups.js` 必须调用同一个 `matchIncomingOrder`，不得各自重新实现候选排序、价格交叉判断或逐笔成交循环。\n\n共享内核统一负责：\n\n- 同资产、反方向和有效未完成订单筛选；\n- 价格优先、同价时间优先；\n- 同一玩家自成交的最后一道阻断；\n- resting order 作为 maker，并使用 maker price；\n- 部分成交数量、`remaining`、`status` 与 `lastFilledAt` 推进；\n- `makerOrderId`、`takerOrderId`、`liquidity`、手续费与净额字段的逐笔 fill；\n- 统一调用玩家卖方手续费规则。\n\n资产适配器只允许负责自身业务结算与行情记录：商品适配器转移玩家库存、消费需求预算和市场储备资产；工厂适配器转移工厂集群数量并维护生产参与状态。共享内核不得导入商品目录、工厂目录、仓库或生产规则，适配器也不得重新实现排序、maker/taker、fill 或订单状态推进。历史迁移和运行时新订单必须复用同一内核，避免两类资产形成不同撮合语义。\n\n## 5. maker price 与逐笔成交''',
)

replace_once(
    'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
    '`server/src/balanced-market.js` 是 `domain.js` 使用的商品市场撮合与结算层，负责市场结构修复、统一玩家／消费需求／市场储备撮合、逐笔成交记录和储备资产转移。`server/src/market-liquidity.js` 是双边储备报价的唯一模块，负责一次性种子、真实资金与库存冻结、周期撤单重挂、库存目标和动态价差。两者不得定义第二套商品目录，只能接收 `domain.js` 已生成的正式目录；商品玩家订单必须在保留兼容核心参数校验与冻结后转交 `balanced-market.js` 撮合，不得绕回旧撮合路径。企业采购、普通人口需求和系统工厂订单仍禁止。',
    '`server/src/order-matching.js` 是商品与工厂统一限价订单的唯一撮合状态机，统一负责价格优先、同价时间优先、maker price、部分成交、订单状态推进、逐笔 fill、自成交阻断和玩家卖方手续费；不得导入商品目录、工厂目录、仓库或生产规则。`server/src/balanced-market.js` 是 `domain.js` 使用的商品结算适配层，负责市场结构修复、玩家／消费需求／市场储备资产转移和商品行情记录；`server/src/facility-groups.js` 是工厂数量与生产状态结算适配层。两者必须调用 `order-matching.js`，不得各自重新实现候选排序或成交循环。`server/src/market-liquidity.js` 是双边储备报价的唯一模块，负责一次性种子、真实资金与库存冻结、周期撤单重挂、库存目标和动态价差。上述模块不得定义第二套商品或工厂目录，只能接收 `domain.js` 已生成的正式目录；商品玩家订单必须在保留兼容核心参数校验与冻结后转交共享撮合内核，不得绕回旧撮合路径。企业采购、普通人口需求和系统工厂订单仍禁止。',
)

# The workflow removes both itself and this script before committing the real change.
print('Unified order matching refactor prepared.')
