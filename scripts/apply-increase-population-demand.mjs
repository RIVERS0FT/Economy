import { readFileSync, writeFileSync } from 'node:fs';

function read(path) {
  return readFileSync(path, 'utf8');
}

function write(path, content) {
  writeFileSync(path, content);
}

function replaceExact(path, from, to, expectedCount = 1) {
  const source = read(path);
  const count = source.split(from).length - 1;
  if (count !== expectedCount) {
    throw new Error(`${path} 期望找到 ${expectedCount} 处锚点，实际 ${count} 处：${from}`);
  }
  write(path, source.replaceAll(from, to));
}

function replaceAtLeast(path, from, to, minimum = 1) {
  const source = read(path);
  const count = source.split(from).length - 1;
  if (count < minimum) {
    throw new Error(`${path} 至少应找到 ${minimum} 处锚点，实际 ${count} 处：${from}`);
  }
  write(path, source.replaceAll(from, to));
}

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

replaceExact('README.md', '- 世界状态版本：`11`', '- 世界状态版本：`12`');
replaceExact(
  'README.md',
  '饮食需求每 5 分钟最多 330 货币预算，家庭用品需求每 5 分钟最多 320 货币预算；',
  '饮食需求每 5 分钟最多 500 货币预算，家庭用品需求每 5 分钟最多 480 货币预算；',
);
for (const path of versionedDocs) {
  replaceExact(path, '> 世界状态版本：11', '> 世界状态版本：12');
}

replaceExact('server/src/domain.js', '    baseBudget: 330,', '    baseBudget: 500,');
replaceExact('server/src/domain.js', '    baseBudget: 320,', '    baseBudget: 480,');
replaceExact('server/src/domain.js', '  world.version = 11;', '  world.version = 12;', 2);
replaceExact('server/src/domain.js', '    return previousVersion >= 11 && isValidPopulationOrder(order);', '    return previousVersion >= 12 && isValidPopulationOrder(order);');
replaceExact('server/src/domain.js', '  if (previousVersion < 11) {', '  if (previousVersion < 12) {');
replaceExact('server/src/domain.js', '  normalized.version = 11;', '  normalized.version = 12;');

replaceExact('server/src/domain-core.js', 'cycleMs: ECONOMY_CONSTANTS.demandCycleMs, baseBudget: 330,', 'cycleMs: ECONOMY_CONSTANTS.demandCycleMs, baseBudget: 500,');
replaceExact('server/src/domain-core.js', 'cycleMs: ECONOMY_CONSTANTS.demandCycleMs, baseBudget: 320,', 'cycleMs: ECONOMY_CONSTANTS.demandCycleMs, baseBudget: 480,');
replaceExact('server/src/domain-core.js', '    version: 11,', '    version: 12,');
replaceExact('server/src/domain-core.js', '  world.version = 11;', '  world.version = 12;');
replaceAtLeast('server/src/storage.js', 'world.version = 11;', 'world.version = 12;', 3);
replaceExact('server/src/asset-events.js', '  world.version = 11;', '  world.version = 12;');

const facilityGroups = read('server/src/facility-groups.js');
if (facilityGroups.includes('world.version = 11;')) {
  write('server/src/facility-groups.js', facilityGroups.replaceAll('world.version = 11;', 'world.version = 12;'));
}

replaceExact(
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  '- `food`：显示名称“饮食需求”，每周期最多 330 货币预算；',
  '- `food`：显示名称“饮食需求”，每周期最多 500 货币预算；',
);
replaceExact(
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  '- `household`：显示名称“家庭用品需求”，每周期最多 320 货币预算；',
  '- `household`：显示名称“家庭用品需求”，每周期最多 480 货币预算；',
);
replaceExact(
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  '两个需求组各自共享固定预算。',
  '两个需求组各自共享固定预算；本次提高预算只扩大每周期可成交数量，不改变需求品类、五分钟周期、弹性、价格上限或预算不结转规则。',
);
replaceExact(
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  '新世界首次权威状态处理，以及从旧需求模型升级到当前世界版本后的首次状态处理，必须立即生成当前周期人口需求买单，',
  '新世界首次权威状态处理，以及从世界版本 11 升级到 12 后的首次状态处理，必须删除旧周期人口订单并立即生成当前周期人口需求买单，',
);

replaceExact(
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  '- SQLite 世界版本固定为 11。',
  '- SQLite 世界版本固定为 12。',
);
replaceExact(
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  '- 世界版本 10 升级到 11 时删除旧人口／系统订单，保留玩家订单及冻结资产，并把两类人口需求标记为当前事务立即执行；不得留下一个需求周期的空窗。',
  '- 世界版本 11 升级到 12 时删除旧人口订单，保留玩家订单及冻结资产，并以饮食 500、家庭用品 480 的新预算把两类人口需求标记为当前事务立即执行；不得留下一个需求周期的空窗。',
);

replaceExact('scripts/verify-document-authority.mjs', "'世界状态版本：`11`',", "'世界状态版本：`12`',");
replaceExact('scripts/verify-document-authority.mjs', "if (!content.includes('世界状态版本：11')) failures.push(`${path} 世界状态版本必须为 10`);", "if (!content.includes('世界状态版本：12')) failures.push(`${path} 世界状态版本必须为 12`);");
replaceExact('scripts/verify-document-authority.mjs', '版本 14/11', '版本 14/12');

replaceExact('scripts/verify-staple-crops-demand.mjs', 'assert.equal(food.baseBudget, 330);', 'assert.equal(food.baseBudget, 500);');
replaceExact('scripts/verify-staple-crops-demand.mjs', 'assert.equal(household.baseBudget, 320);', 'assert.equal(household.baseBudget, 480);');
replaceExact('scripts/verify-staple-crops-demand.mjs', "'previousVersion >= 11', 'previousVersion < 11'", "'previousVersion >= 12', 'previousVersion < 12'");
replaceExact('scripts/verify-staple-crops-demand.mjs', "assert.ok(assetEvents.includes('world.version = 11;'), '日志清理器必须保留世界版本 11');", "assert.ok(assetEvents.includes('world.version = 12;'), '日志清理器必须保留世界版本 12');");
replaceExact('scripts/verify-staple-crops-demand.mjs', "assert.equal(assetEvents.includes('world.version = 9;'), false, '日志清理器不得把世界版本降回 9');", "assert.equal(assetEvents.includes('world.version = 11;'), false, '日志清理器不得把世界版本降回 11');");
replaceExact('scripts/verify-staple-crops-demand.mjs', "'world version 10 migration immediately rebuilds current-cycle population demand',", "'world version 11 migration immediately rebuilds current-cycle population demand',");
replaceExact('scripts/verify-staple-crops-demand.mjs', "['世界版本 10 升级到 11', '不得把世界版本写回旧值']", "['世界版本 11 升级到 12', '不得把世界版本写回旧值']");
replaceExact('scripts/verify-staple-crops-demand.mjs', '仅保留两类固定预算需求，并按生产链双向滞后传导价格。', '两类人口需求预算提高至 500／480，并按生产链双向滞后传导价格。');

for (const path of ['scripts/verify-market-assets.mjs', 'scripts/verify-facility-groups.mjs']) {
  const source = read(path);
  if (!source.includes('world.version = 11;')) throw new Error(`${path} 缺少世界版本 11 锚点`);
  write(path, source.replaceAll('world.version = 11;', 'world.version = 12;'));
}

let tests = read('server/test/domain.test.js');
tests = tests
  .replaceAll('<= 330', '<= 500')
  .replaceAll('<= 320', '<= 480')
  .replaceAll('persisted.version, 11', 'persisted.version, 12')
  .replace("test('world version 10 migration immediately rebuilds current-cycle population demand'", "test('world version 11 migration immediately rebuilds current-cycle population demand'")
  .replace('  world.version = 10;\n  world.orders = [{', '  world.version = 11;\n  world.orders = [{')
  .replaceAll('world.version, 11', 'world.version, 12');
if (!tests.includes('world version 11 migration immediately rebuilds current-cycle population demand')) {
  throw new Error('domain.test.js 未更新人口需求迁移测试名称');
}
write('server/test/domain.test.js', tests);

console.log('人口需求预算、世界版本、迁移、测试和设计文档已更新。');
