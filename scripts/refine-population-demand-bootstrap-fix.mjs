import { readFileSync, writeFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const write = (path, content) => writeFileSync(path, content, 'utf8');

function replaceExact(path, from, to) {
  const content = read(path);
  if (!content.includes(from)) throw new Error(`${path} 缺少待替换内容:\n${from}`);
  if (content.indexOf(from) !== content.lastIndexOf(from)) throw new Error(`${path} 待替换内容出现多次`);
  write(path, content.replace(from, to));
}

replaceExact(
  'server/src/asset-events.js',
  '  world.version = 9;',
  '  world.version = 11;',
);

replaceExact(
  'server/test/domain.test.js',
  `    assert.ok(state.demandGroups.food.lastCommitted <= 330);\n    assert.ok(state.demandGroups.household.lastCommitted <= 320);`,
  `    const persisted = JSON.parse(String(store.selectWorld.get().state_json));\n    assert.equal(persisted.version, 11);\n    assert.ok(persisted.demandGroups.food.lastCommitted <= 330);\n    assert.ok(persisted.demandGroups.household.lastCommitted <= 320);`,
);

replaceExact(
  'server/test/warehouse.test.js',
  "      buyOrder({ remaining: 7, side: 'sell' }),",
  "      buyOrder({ remaining: 7, side: 'sell', price: 999 }),",
);

replaceExact(
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  '- 世界版本 10 升级到 11 时删除旧人口／系统订单，保留玩家订单及冻结资产，并把两类人口需求标记为当前事务立即执行；不得留下一个需求周期的空窗。',
  '- 世界版本 10 升级到 11 时删除旧人口／系统订单，保留玩家订单及冻结资产，并把两类人口需求标记为当前事务立即执行；不得留下一个需求周期的空窗。所有日志清理、兼容结构清理和序列化辅助函数只能保留或提升当前世界版本，不得把世界版本写回旧值，否则会重复执行迁移、重复生成需求并持续推进修订号。',
);

replaceExact(
  'scripts/verify-staple-crops-demand.mjs',
  `]) assert.ok(domain.includes(text), 'domain.js 缺少: ' + text);\nconst balanced = read('server/src/balanced-market.js');`,
  `]) assert.ok(domain.includes(text), 'domain.js 缺少: ' + text);\nconst assetEvents = read('server/src/asset-events.js');\nassert.ok(assetEvents.includes('world.version = 11;'), '日志清理器必须保留世界版本 11');\nassert.equal(assetEvents.includes('world.version = 9;'), false, '日志清理器不得把世界版本降回 9');\nconst balanced = read('server/src/balanced-market.js');`,
);

replaceExact(
  'scripts/verify-staple-crops-demand.mjs',
  `  ['docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', ["ownerType: 'player' | 'population'", '不提供系统流动性买单或卖单', '同一事务立即生成当前周期人口买单']],\n]) {`,
  `  ['docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', ["ownerType: 'player' | 'population'", '不提供系统流动性买单或卖单', '同一事务立即生成当前周期人口买单']],\n  ['docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', ['世界版本 10 升级到 11', '不得把世界版本写回旧值']],\n]) {`,
);

for (const [path, forbidden] of [
  ['server/src/domain.js', 'world.version = 10;'],
  ['server/src/domain-core.js', 'world.version = 10;'],
  ['server/src/facility-groups.js', 'world.version = 10;'],
  ['server/src/asset-events.js', 'world.version = 9;'],
]) {
  if (read(path).includes(forbidden)) throw new Error(`${path} 仍包含旧世界版本赋值: ${forbidden}`);
}

console.log('人口需求启动修复已补全日志清理版本与回归测试。');
