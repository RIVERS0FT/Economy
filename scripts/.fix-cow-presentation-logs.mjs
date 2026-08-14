import { readFileSync, writeFileSync } from 'node:fs';

function patch(path, before, after) {
  let source = readFileSync(path, 'utf8');
  if (source.includes(after)) return;
  if (!source.includes(before)) throw new Error(`${path}: patch source not found`);
  source = source.replace(before, after);
  writeFileSync(path, source);
}

patch(
  'server/src/domain-core.js',
  `function addLedger(player, category, amount, description, createdAt = Date.now()) {\n  player.ledger.unshift({\n    id: createId('ledger'),\n    category,\n    amount,\n    balanceAfter: player.credits,\n    createdAt,\n    description,\n  });\n  player.ledger = player.ledger.slice(0, ECONOMY_CONSTANTS.maxLedgerPerPlayer);\n}\n\nfunction addTrade(player, trade) {\n  player.trades.unshift({ id: createId('trade'), ...trade });\n  player.trades = player.trades.slice(0, ECONOMY_CONSTANTS.maxTradesPerPlayer);\n}`,
  `function addLedger(player, category, amount, description, createdAt = Date.now()) {\n  if (!Array.isArray(player.ledger)) return;\n  player.ledger.unshift({\n    id: createId('ledger'),\n    category,\n    amount,\n    balanceAfter: player.credits,\n    createdAt,\n    description,\n  });\n  player.ledger = player.ledger.slice(0, ECONOMY_CONSTANTS.maxLedgerPerPlayer);\n}\n\nfunction addTrade(player, trade) {\n  if (!Array.isArray(player.trades)) return;\n  player.trades.unshift({ id: createId('trade'), ...trade });\n  player.trades = player.trades.slice(0, ECONOMY_CONSTANTS.maxTradesPerPlayer);\n}`,
);

patch(
  'server/test/asset-events.test.js',
  "import { EconomyStore } from '../src/storage.js';\n",
  "import { EconomyStore } from '../src/storage.js';\nimport { EconomyStore as RuntimeEconomyStore } from '../src/runtime-store.js';\n",
);

const testPath = 'server/test/asset-events.test.js';
let tests = readFileSync(testPath, 'utf8');
const marker = "test('actions update authoritative state without writing player logs to SQLite', () => {";
const inserted = `test('runtime COW work remains valid after V2 persistence strips presentation logs', () => {\n  const store = new RuntimeEconomyStore(':memory:', { scheduledProcessing: false });\n  const now = 1_700_000_000_000;\n  try {\n    store.getState(alice, now);\n    assertPlayerLogsAbsent(persistedWorld(store).players['1']);\n    const worked = store.apply(alice, request(\n      'work',\n      {},\n      'work-after-log-strip-12345678',\n      '/api/game/work',\n    ), now + 1);\n    assert.equal(worked.result.ok, true);\n    assertPlayerLogsAbsent(persistedWorld(store).players['1']);\n  } finally {\n    store.close();\n  }\n});\n\n${marker}`;
if (!tests.includes("runtime COW work remains valid after V2 persistence strips presentation logs")) {
  if (!tests.includes(marker)) throw new Error('asset-events insertion marker missing');
  tests = tests.replace(marker, inserted);
  writeFileSync(testPath, tests);
}
