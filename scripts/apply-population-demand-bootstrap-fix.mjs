import { readFileSync, writeFileSync } from 'node:fs';

function read(path) {
  return readFileSync(path, 'utf8');
}

function write(path, content) {
  writeFileSync(path, content, 'utf8');
}

function replaceExact(path, from, to) {
  const content = read(path);
  if (!content.includes(from)) throw new Error(`${path} 缺少待替换内容:\n${from}`);
  if (content.indexOf(from) !== content.lastIndexOf(from)) throw new Error(`${path} 待替换内容出现多次`);
  write(path, content.replace(from, to));
}

function replaceAllRequired(path, from, to, minimum = 1) {
  const content = read(path);
  const count = content.split(from).length - 1;
  if (count < minimum) throw new Error(`${path} 至少需要 ${minimum} 处 ${from}，实际 ${count}`);
  write(path, content.split(from).join(to));
}

function insertBefore(path, marker, addition) {
  const content = read(path);
  if (!content.includes(marker)) throw new Error(`${path} 缺少插入标记: ${marker}`);
  if (content.includes(addition.trim())) throw new Error(`${path} 已包含待插入内容`);
  write(path, content.replace(marker, `${addition}${marker}`));
}

replaceExact(
  'server/src/domain.js',
  `function defaultDemandGroupState(group, now) {\n  return {\n    demandGroupId: group.id,\n    cycleMs: group.cycleMs,\n    nextDemandAt: now + group.cycleMs,\n    lastCycleId: Math.floor(now / group.cycleMs),\n    lastBudget: group.baseBudget,\n    lastCommitted: 0,\n    satisfaction: 0,\n    lastAllocation: {},\n  };\n}`,
  `function defaultDemandGroupState(group, now) {\n  return {\n    demandGroupId: group.id,\n    cycleMs: group.cycleMs,\n    nextDemandAt: now,\n    lastCycleId: Math.floor(now / group.cycleMs) - 1,\n    lastBudget: group.baseBudget,\n    lastCommitted: 0,\n    satisfaction: 0,\n    lastAllocation: {},\n  };\n}`,
);
replaceExact(
  'server/src/domain.js',
  '    return previousVersion >= 10 && isValidPopulationOrder(order);',
  '    return previousVersion >= 11 && isValidPopulationOrder(order);',
);
replaceExact(
  'server/src/domain.js',
  `  migrated.version = 10;\n  return normalizeDemandWorld(migrated, now);\n}`,
  `  const normalized = normalizeDemandWorld(migrated, now);\n  if (previousVersion < 11) {\n    for (const group of DEMAND_GROUP_CATALOG) {\n      const state = normalized.demandGroups[group.id];\n      state.nextDemandAt = now;\n      state.lastCycleId = Math.floor(now / group.cycleMs) - 1;\n      state.lastCommitted = 0;\n      state.satisfaction = 0;\n      state.lastAllocation = {};\n    }\n  }\n  normalized.version = 11;\n  return normalized;\n}`,
);
replaceAllRequired('server/src/domain.js', 'world.version = 10;', 'world.version = 11;');

replaceExact(
  'server/src/domain-core.js',
  `    nextDemandAt: now + group.cycleMs,\n    lastCycleId: -1,`,
  `    nextDemandAt: now,\n    lastCycleId: Math.floor(now / group.cycleMs) - 1,`,
);
replaceExact('server/src/domain-core.js', '    version: 10,', '    version: 11,');
replaceAllRequired('server/src/domain-core.js', 'world.version = 10;', 'world.version = 11;');
replaceAllRequired('server/src/facility-groups.js', 'world.version = 10;', 'world.version = 11;', 2);

const immediateTests = `test('new worlds create population demand during the first authoritative state read', () => {\n  const store = new EconomyStore(':memory:');\n  try {\n    const state = store.getState(alice, now);\n    const populationOrders = state.orders.filter((order) => order.ownerType === 'population');\n    assert.ok(populationOrders.length > 0);\n    assert.deepEqual([...new Set(populationOrders.map((order) => order.ownerName))].sort(), ['家庭用品需求', '饮食需求']);\n    assert.ok(state.demandGroups.food.lastCommitted <= 330);\n    assert.ok(state.demandGroups.household.lastCommitted <= 320);\n  } finally {\n    store.close();\n  }\n});\n\ntest('world version 10 migration immediately rebuilds current-cycle population demand', () => {\n  const world = createWorld(now);\n  const player = ensurePlayer(world, alice, now);\n  player.inventories.wheat.available = 2;\n  world.version = 10;\n  world.orders = [{\n    id: 'player-wheat-sell', assetKind: 'commodity', assetId: 'wheat', productId: 'wheat',\n    side: 'sell', ownerType: 'player', ownerId: alice.id, ownerName: 'Alice',\n    price: 99, quantity: 2, remaining: 2, status: 'open', createdAt: now,\n  }];\n  for (const group of Object.values(world.demandGroups)) {\n    group.nextDemandAt = now + 5 * 60 * 1000;\n    group.lastCycleId = Math.floor(now / group.cycleMs);\n    group.lastCommitted = group.lastBudget;\n  }\n\n  processWorld(world, now + 1);\n\n  assert.equal(world.version, 11);\n  assert.ok(world.orders.some((order) => order.id === 'player-wheat-sell'));\n  const populationOrders = world.orders.filter((order) => order.ownerType === 'population');\n  assert.ok(populationOrders.length > 0);\n  assert.ok(populationOrders.every((order) => order.demandCycleId === Math.floor((now + 1) / (5 * 60 * 1000))));\n  assert.ok(world.demandGroups.food.nextDemandAt > now + 1);\n  assert.ok(world.demandGroups.household.nextDemandAt > now + 1);\n});\n\n`;
insertBefore(
  'server/test/domain.test.js',
  "test('migration removes market and legacy population orders while preserving player orders', () => {",
  immediateTests,
);
replaceAllRequired('server/test/domain.test.js', 'assert.equal(world.version, 10);', 'assert.equal(world.version, 11);', 2);

const versionedDocs = [
  'docs/README.md',
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
  'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md',
  'docs/WAREHOUSE_EXPANSION_DESIGN.md',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  'docs/LOCAL_ACTIVITY_LOG_DESIGN.md',
];
replaceExact('README.md', '世界状态版本：`10`', '世界状态版本：`11`');
for (const path of versionedDocs) replaceExact(path, '世界状态版本：10', '世界状态版本：11');

replaceExact(
  'README.md',
  '- 饮食需求每 5 分钟最多 330 货币预算，家庭用品需求每 5 分钟最多 320 货币预算；预算随参考价换算为数量，价格上涨不会扩大系统货币发行。',
  '- 饮食需求每 5 分钟最多 330 货币预算，家庭用品需求每 5 分钟最多 320 货币预算；预算随参考价换算为数量，价格上涨不会扩大系统货币发行。\n- 新世界首次状态处理和需求模型升级迁移必须立即生成当前周期人口买单，不得在删除旧订单后等待下一个 5 分钟周期；当期预算仍只能发行一次。',
);
replaceExact(
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  '两个需求组各自共享固定预算。人口订单数量按“分配预算 ÷ 人口参考价”取整；价格上涨只减少可购买数量，不扩大预算。未使用预算不结转。',
  '两个需求组各自共享固定预算。人口订单数量按“分配预算 ÷ 人口参考价”取整；价格上涨只减少可购买数量，不扩大预算。未使用预算不结转。\n\n新世界首次权威状态处理，以及从旧需求模型升级到当前世界版本后的首次状态处理，必须立即生成当前周期人口需求买单，不得等待首个 5 分钟周期结束。迁移生成仍只允许每组使用一次固定周期预算；后续按整周期推进，已成交或已耗尽的当期需求不得重复补发。',
);
replaceExact(
  'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md',
  '`FacilityListing` 只允许作为版本 10 迁移兼容空结构存在，不得重新成为业务模型。',
  '`FacilityListing` 只允许作为历史迁移兼容空结构存在，不得重新成为业务模型。',
);
replaceExact(
  'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md',
  '- 迁移必须删除旧 `ownerType = market` 商品订单和旧企业采购／普通人口需求订单，同时保留玩家订单及其冻结资产。',
  '- 迁移必须删除旧 `ownerType = market` 商品订单和旧企业采购／普通人口需求订单，同时保留玩家订单及其冻结资产。\n- 新世界首次状态处理与需求模型升级迁移必须在同一事务立即生成当前周期人口买单；不得删除旧订单后把订单簿留空到下一周期，也不得因补发重复使用当期预算。',
);
replaceExact(
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  '`server/src/balanced-market.js` 是 `domain.js` 使用的市场运行辅助层，负责让新世界、缺失市场、通用人口需求和系统流动性读取正式整数参考价。它不得定义第二套商品目录，只能接收 `domain.js` 已生成的正式目录。兼容核心执行期间，门面必须暂时抑制旧需求周期并保证正式流动性已存在，避免旧参考价重新生成系统订单。',
  '`server/src/balanced-market.js` 是 `domain.js` 使用的市场运行辅助层，负责市场结构修复、商品订单撮合和逐笔成交记录。它不得定义第二套商品目录，只能接收 `domain.js` 已生成的正式目录，也不得生成系统流动性、企业采购或普通人口需求订单。',
);
replaceExact(
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  '- 客户端 `EconomyState.version` 固定为 12。\n- SQLite 世界版本固定为 8。\n- 邮箱验证码注册不修改世界 JSON 结构，不提高世界版本。\n- 现有玩家订单、成交和价格历史不重写；新世界、缺失市场及后续系统流动性使用正式参考价。',
  '- 客户端 `EconomyState.version` 固定为 14。\n- SQLite 世界版本固定为 11。\n- 邮箱验证码注册不修改世界 JSON 结构，不提高世界版本。\n- 世界版本 10 升级到 11 时删除旧人口／系统订单，保留玩家订单及冻结资产，并把两类人口需求标记为当前事务立即执行；不得留下一个需求周期的空窗。',
);

replaceAllRequired('scripts/verify-document-authority.mjs', '世界状态版本：`10`', '世界状态版本：`11`');
replaceAllRequired('scripts/verify-document-authority.mjs', '世界状态版本：10', '世界状态版本：11');
replaceAllRequired('scripts/verify-document-authority.mjs', '版本 14/10', '版本 14/11');
replaceAllRequired('scripts/verify-market-assets.mjs', 'world.version = 10', 'world.version = 11');
replaceAllRequired('scripts/verify-facility-groups.mjs', 'world.version = 10', 'world.version = 11');
replaceExact('scripts/verify-staple-crops-demand.mjs', "'previousVersion >= 10',", "'previousVersion >= 11', 'previousVersion < 11', 'nextDemandAt: now',");
replaceExact(
  'scripts/verify-staple-crops-demand.mjs',
  "  ['README.md', ['仅允许玩家订单和人口需求订单', '饮食需求', '家庭用品需求', '双向价格传导']],\n  ['docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', ['成本推动', '需求拉动', '上一周期快照', '固定预算']],\n  ['docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', [\"ownerType: 'player' | 'population'\", '不提供系统流动性买单或卖单']],",
  "  ['README.md', ['仅允许玩家订单和人口需求订单', '饮食需求', '家庭用品需求', '双向价格传导', '立即生成当前周期人口买单']],\n  ['docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', ['成本推动', '需求拉动', '上一周期快照', '固定预算', '首次权威状态处理']],\n  ['docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', [\"ownerType: 'player' | 'population'\", '不提供系统流动性买单或卖单', '同一事务立即生成当前周期人口买单']],",
);
replaceExact(
  'scripts/verify-staple-crops-demand.mjs',
  "  'price transmission is damped and also carries price decreases',\n]) assert.ok(tests.includes(text), '测试缺少: ' + text);",
  "  'price transmission is damped and also carries price decreases',\n]) assert.ok(tests.includes(text), '测试缺少: ' + text);\nconst domainTests = read('server/test/domain.test.js');\nfor (const text of [\n  'new worlds create population demand during the first authoritative state read',\n  'world version 10 migration immediately rebuilds current-cycle population demand',\n]) assert.ok(domainTests.includes(text), '需求启动测试缺少: ' + text);",
);

const forbiddenVersionAssignments = [
  ['server/src/domain.js', 'world.version = 10;'],
  ['server/src/domain-core.js', 'world.version = 10;'],
  ['server/src/facility-groups.js', 'world.version = 10;'],
];
for (const [path, text] of forbiddenVersionAssignments) {
  if (read(path).includes(text)) throw new Error(`${path} 仍包含旧世界版本赋值`);
}

console.log('人口需求启动与版本 11 迁移修复已应用。');
