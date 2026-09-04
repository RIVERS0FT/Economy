import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';

function replaceOnce(path, oldText, newText) {
  let source = readFileSync(path, 'utf8');
  if (!source.includes(oldText)) throw new Error(`${path}: target not found`);
  source = source.replace(oldText, newText);
  writeFileSync(path, source);
}

replaceOnce(
  'server/test/domain.test.js',
  "  assert.equal(nextOrder.price, Number(nextOrder.price.toFixed(2)));\n}\n\ntest('population-funded market demand does not scale with active player count'",
  "  assert.equal(nextOrder.price, Number(nextOrder.price.toFixed(2)));\n});\n\ntest('population-funded market demand does not scale with active player count'",
);

replaceOnce(
  'server/test/order-cancel-money-precision.test.js',
  "import { FACILITY_TYPE_CATALOG } from '../src/domain.js';\nimport { EconomyStore } from '../src/runtime-store.js';",
  "import { FACILITY_TYPE_CATALOG } from '../src/domain.js';\nimport { dailyCheckInPeriodFor } from '../src/daily-check-in.js';\nimport { EconomyStore } from '../src/runtime-store.js';",
);
replaceOnce(
  'server/test/order-cancel-money-precision.test.js',
  "    player.credits = 100;\n    loaded.world.markets[provinceScopedKey(DEFAULT_PROVINCE_ID, 'wheat')].officialPrice = 0.41;\n    store.saveWorld(loaded.revision, loaded.world, now + 1);",
  "    player.credits = 100;\n    const market = loaded.world.markets[provinceScopedKey(DEFAULT_PROVINCE_ID, 'wheat')];\n    const pricePeriod = dailyCheckInPeriodFor(now + 2);\n    market.officialPrice = 0.41;\n    market.priceDateKey = pricePeriod.todayKey;\n    market.nextPriceAt = pricePeriod.nextResetAt;\n    market.todayBuyQuantity = 0;\n    market.todaySellQuantity = 0;\n    store.saveWorld(loaded.revision, loaded.world, now + 1);",
);

for (const path of [
  'scripts/codex-fix-last-two-server-tests.mjs',
  '.github/workflows/codex-fix-last-two-server-tests.yml',
]) {
  if (existsSync(path)) unlinkSync(path);
}
