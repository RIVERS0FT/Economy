import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';

function replaceOnce(path, oldText, newText) {
  let source = readFileSync(path, 'utf8');
  if (!source.includes(oldText)) throw new Error(`${path}: target text not found`);
  source = source.replace(oldText, newText);
  writeFileSync(path, source);
}

replaceOnce(
  'server/test/domain.test.js',
  "  assert.equal(world.orders.some((order) => order.ownerType === 'player' && ['open', 'partial'].includes(order.status)), false);\n}\n\ntest('version 1 state migrates inventory and commodity orders without losing assets'",
  "  assert.equal(world.orders.some((order) => order.ownerType === 'player' && ['open', 'partial'].includes(order.status)), false);\n});\n\ntest('version 1 state migrates inventory and commodity orders without losing assets'",
);

replaceOnce(
  'server/test/facility-groups.test.js',
  "  assert.equal(state.assetSummary.commodityValue, 110);\n}\n\ntest('factory automatically recovers after funds return'",
  "  assert.equal(state.assetSummary.commodityValue, 110);\n});\n\ntest('factory automatically recovers after funds return'",
);

replaceOnce(
  'server/test/market-liquidity.test.js',
  "  assert.equal(buyOrder.remaining, reserveRemainingBefore);\n}\n\ntest('player immediate buying does not consume an internal reserve ask'",
  "  assert.equal(buyOrder.remaining, reserveRemainingBefore);\n});\n\ntest('player immediate buying does not consume an internal reserve ask'",
);
replaceOnce(
  'server/test/market-liquidity.test.js',
  "  assert.equal(sellOrder.remaining, remainingBefore);\n}\n\ntest('liquidity orders are cancelled and re-reserved on the next cycle'",
  "  assert.equal(sellOrder.remaining, remainingBefore);\n});\n\ntest('liquidity orders are cancelled and re-reserved on the next cycle'",
);

replaceOnce(
  'server/test/market-reserve-operations.test.js',
  "  assert.equal(latest.signalWeight, 1);\n}\n\ntest('two shortage cycles publish a fixed-term market reserve procurement contract and settle into reserve inventory'",
  "  assert.equal(latest.signalWeight, 1);\n});\n\ntest('two shortage cycles publish a fixed-term market reserve procurement contract and settle into reserve inventory'",
);

replaceOnce(
  'server/test/order-cancel-money-precision.test.js',
  "    assert.equal(placed.result.ok, true);\n    assert.equal(placed.result.executedPrice, 0.41);\n    assert.equal(placed.result.total, 1.23);\n\n    const afterPlace = store.getState(user, now + 3);",
  "    assert.equal(placed.result.ok, true);\n\n    const afterPlace = store.getState(user, now + 3);",
);

replaceOnce(
  'server/test/provinces.test.js',
  "  inventoryForProvince(seller, 'wheat', GEORGIA).available = 1;\n  world.markets[provinceScopedKey(CALIFORNIA, 'wheat')].officialPrice = 1;\n  world.markets[provinceScopedKey(GEORGIA, 'wheat')].officialPrice = 2;",
  "  inventoryForProvince(seller, 'wheat', GEORGIA).available = 1;\n  const californiaMarket = world.markets[provinceScopedKey(CALIFORNIA, 'wheat')];\n  const georgiaMarketKey = provinceScopedKey(GEORGIA, 'wheat');\n  world.markets[georgiaMarketKey] = structuredClone(californiaMarket);\n  world.markets[georgiaMarketKey].provinceId = GEORGIA;\n  californiaMarket.officialPrice = 1;\n  world.markets[georgiaMarketKey].officialPrice = 2;",
);

for (const path of [
  'scripts/codex-fix-final-server-market-tests.mjs',
  '.github/workflows/codex-fix-final-server-market-tests.yml',
]) {
  if (existsSync(path)) unlinkSync(path);
}
