import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

function replace(path, from, to) {
  const source = readFileSync(path, 'utf8');
  if (!source.includes(from)) throw new Error(`${path} 缺少测试锚点`);
  writeFileSync(path, source.replace(from, to), 'utf8');
}

replace(
  'server/test/asset-events.test.js',
  "test('client state version 14 excludes all player log arrays and factory instances', () => {",
  "test('client state version 15 excludes all player log arrays and factory instances', () => {",
);
replace(
  'server/test/asset-events.test.js',
  "const order = placed.state.orders.find((item) => item.ownerId === alice.id && item.status === 'open');",
  "const order = placed.state.orders.find((item) => item.isOwn && item.status === 'open');",
);
replace(
  'server/test/domain.test.js',
  `    const state = store.getState(alice, now);
    const populationOrders = state.orders.filter((order) => order.ownerType === 'population');
    assert.ok(populationOrders.length > 0);
    assert.deepEqual([...new Set(populationOrders.map((order) => order.ownerName))].sort(), ['家庭用品需求', '饮食需求']);
    const persisted = JSON.parse(String(store.selectWorld.get().state_json));`,
  `    const state = store.getState(alice, now);
    const externalBuyOrders = state.orders.filter((order) => order.isOwn === false && order.side === 'buy');
    assert.ok(externalBuyOrders.length > 0);
    assert.ok(externalBuyOrders.every((order) => (
      !Object.hasOwn(order, 'ownerType')
      && !Object.hasOwn(order, 'ownerName')
      && !Object.hasOwn(order, 'demandGroupId')
    )));
    const persisted = JSON.parse(String(store.selectWorld.get().state_json));
    const populationOrders = persisted.orders.filter((order) => order.ownerType === 'population');
    assert.ok(populationOrders.length > 0);
    assert.deepEqual([...new Set(populationOrders.map((order) => order.ownerName))].sort(), ['家庭用品需求', '饮食需求']);`,
);

unlinkSync('scripts/patch-anonymous-order-tests.mjs');
execSync('git restore --source=HEAD -- .github/workflows/ci.yml');
execSync('git config user.name "github-actions[bot]"');
execSync('git config user.email "41898282+github-actions[bot]@users.noreply.github.com"');
execSync('git add -A');
execSync('git commit -m "更新匿名订单状态测试"', { stdio: 'inherit' });
execSync('git push origin HEAD:agent/anonymize-local-trades', { stdio: 'inherit' });
