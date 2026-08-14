import { readFileSync, writeFileSync } from 'node:fs';

function replaceOnce(path, before, after, label = before.slice(0, 80)) {
  const source = readFileSync(path, 'utf8');
  if (!source.includes(before)) throw new Error(`Missing replacement target in ${path}: ${label}`);
  writeFileSync(path, source.replace(before, after));
}

function appendOnce(path, marker, block) {
  const source = readFileSync(path, 'utf8');
  if (source.includes(marker)) return;
  writeFileSync(path, `${source.trimEnd()}\n\n${block.trim()}\n`);
}

replaceOnce(
  'server/src/world-storage-v2.js',
  `const CORE_LOCAL_SEGMENTS = Object.freeze([\n  'bank',\n  'weeklyCashSettlement',\n  'populationEconomy',\n  'marketDemand',\n  'demandGroups',\n  'priceTransmission',\n  'markets',\n  'stats',\n  'moneyPrecision',\n  'auctionFeeEscrowCredits',\n  'version',\n]);`,
  `const CORE_LOCAL_SEGMENTS = Object.freeze([\n  'bank',\n  'weeklyCashSettlement',\n  'populationEconomy',\n  'marketDemand',\n  'stats',\n  'moneyPrecision',\n  'auctionFeeEscrowCredits',\n  'version',\n]);`,
  'do not clone read-only market domains for local actions',
);

replaceOnce(
  'server/src/facility-groups.js',
  `  const bankAccount = ensurePlayerBankAccount(player);\n  const availableCashValue = Number(player.credits || 0);`,
  `  const bankDepositValue = Number(player?.bankAccount?.depositCredits || 0);\n  const availableCashValue = Number(player.credits || 0);`,
  'asset summary must not normalize player bank state during projection',
);
replaceOnce(
  'server/src/facility-groups.js',
  `  const bankDepositValue = Number(bankAccount.depositCredits || 0);\n  const availableCommodityValue = commodity.available;`,
  `  const availableCommodityValue = commodity.available;`,
  'remove mutating bank projection helper result',
);

replaceOnce(
  'server/src/domain-core.js',
  `    facilities: clone(player.facilities || []),\n    products: clone(PRODUCT_CATALOG),\n    facilityTypes: clone(FACILITY_TYPE_CATALOG),\n    markets: clone(world.markets),\n    orders: clone(world.orders),\n    facilityListings: clone(world.facilityListings),\n    trades: clone(player.trades || []),\n    ledger: clone(player.ledger || []),`,
  `    facilities: migrate ? clone(player.facilities || []) : [],\n    products: migrate ? clone(PRODUCT_CATALOG) : PRODUCT_CATALOG,\n    facilityTypes: migrate ? clone(FACILITY_TYPE_CATALOG) : [],\n    markets: clone(world.markets),\n    orders: migrate ? clone(world.orders) : [],\n    facilityListings: migrate ? clone(world.facilityListings) : [],\n    trades: migrate ? clone(player.trades || []) : [],\n    ledger: migrate ? clone(player.ledger || []) : [],`,
  'avoid cloning legacy fields discarded by the V33 projection',
);

replaceOnce(
  'server/test/state-polling.test.js',
  `    const unchanged = store.getStateSnapshot(alice, action.revision, now + 3_000);`,
  `    const unchanged = store.getStateSnapshot(alice, action.revision, now + 2_500);`,
  'poll before the next unscheduled world-processing deadline',
);

replaceOnce(
  'server/test/world-storage-v2.test.js',
  `const alice = { id: 1, email: 'alice@example.com', name: 'Alice', role: 'user' };`,
  `const alice = { id: 1, email: 'alice@example.com', name: 'Alice', role: 'user' };\nconst bob = { id: 2, email: 'bob@example.com', name: 'Bob', role: 'user' };`,
  'second player fixture',
);
replaceOnce(
  'server/test/world-storage-v2.test.js',
  `      assert.equal(state.bank.depositCredits, depositCredits);`,
  `      assert.equal(state.bankAccount.depositCredits, depositCredits);`,
  'V33 bank client field',
);

appendOnce(
  'server/test/world-storage-v2.test.js',
  "test('current V2 cold restarts do not advance revision or rewrite segmented rows'",
  `test('current V2 cold restarts do not advance revision or rewrite segmented rows', () => {\n  const directory = mkdtempSync(join(tmpdir(), 'economy-storage-v2-cold-'));\n  const databasePath = join(directory, 'economy.sqlite');\n  try {\n    const first = new EconomyStore(databasePath, { scheduledProcessing: true });\n    first.getState(alice, now);\n    const before = first.database.prepare(\n      \"SELECT m.revision, m.updated_at, s.updated_revision AS orders_revision, s.state_json AS orders_json FROM economy_world_meta m JOIN economy_world_segments s ON s.segment_key = 'orders' WHERE m.id = 1\",\n    ).get();\n    first.stopScheduler();\n    first.close();\n\n    const second = new EconomyStore(databasePath, { scheduledProcessing: true });\n    second.getState(alice, now + 1);\n    const afterSecond = second.database.prepare(\n      \"SELECT m.revision, m.updated_at, s.updated_revision AS orders_revision, s.state_json AS orders_json FROM economy_world_meta m JOIN economy_world_segments s ON s.segment_key = 'orders' WHERE m.id = 1\",\n    ).get();\n    assert.deepEqual(afterSecond, before);\n    second.stopScheduler();\n    second.close();\n\n    const third = new EconomyStore(databasePath, { scheduledProcessing: true });\n    third.getState(alice, now + 2);\n    const afterThird = third.database.prepare(\n      \"SELECT m.revision, m.updated_at, s.updated_revision AS orders_revision, s.state_json AS orders_json FROM economy_world_meta m JOIN economy_world_segments s ON s.segment_key = 'orders' WHERE m.id = 1\",\n    ).get();\n    assert.deepEqual(afterThird, before);\n    third.stopScheduler();\n    third.close();\n  } finally {\n    rmSync(directory, { recursive: true, force: true });\n  }\n});\n\ntest('legacy monolithic world migrates to V2 only once', () => {\n  const directory = mkdtempSync(join(tmpdir(), 'economy-storage-v2-legacy-'));\n  const databasePath = join(directory, 'economy.sqlite');\n  try {\n    const seed = new EconomyStore(databasePath, { scheduledProcessing: false });\n    seed.getState(alice, now);\n    const legacyWorldJson = JSON.stringify(seed.worldCache.world);\n    seed.database.prepare('DELETE FROM economy_world_meta').run();\n    seed.database.prepare('DELETE FROM economy_world_players').run();\n    seed.database.prepare('DELETE FROM economy_world_segments').run();\n    seed.database.prepare(\n      'UPDATE economy_world SET revision = ?, state_json = ?, updated_at = ? WHERE id = 1',\n    ).run(7, legacyWorldJson, now);\n    seed.close();\n\n    const migrated = new EconomyStore(databasePath, { scheduledProcessing: true });\n    migrated.getState(alice, now + 1);\n    const firstMeta = migrated.database.prepare(\n      'SELECT revision, world_version, storage_schema_version, updated_at FROM economy_world_meta WHERE id = 1',\n    ).get();\n    assert.equal(Number(firstMeta.storage_schema_version), WORLD_STORAGE_SCHEMA_VERSION);\n    migrated.stopScheduler();\n    migrated.close();\n\n    const reopened = new EconomyStore(databasePath, { scheduledProcessing: true });\n    reopened.getState(alice, now + 2);\n    const secondMeta = reopened.database.prepare(\n      'SELECT revision, world_version, storage_schema_version, updated_at FROM economy_world_meta WHERE id = 1',\n    ).get();\n    assert.deepEqual(secondMeta, firstMeta);\n    reopened.stopScheduler();\n    reopened.close();\n  } finally {\n    rmSync(directory, { recursive: true, force: true });\n  }\n});\n\ntest('dirty player write leaves unrelated player and market rows byte-identical', () => {\n  const store = new EconomyStore(':memory:', { scheduledProcessing: true });\n  try {\n    store.getState(alice, now);\n    store.getState(bob, now + 1);\n    const bobBefore = store.database.prepare(\n      'SELECT updated_revision, state_json FROM economy_world_players WHERE user_id = 2',\n    ).get();\n    const marketsBefore = store.database.prepare(\n      \"SELECT updated_revision, state_json FROM economy_world_segments WHERE segment_key = 'markets'\",\n    ).get();\n\n    const result = store.apply(alice, action('bankDeposit', { amount: 10 }, 'storage-v2-dirty-12345678'), now + 2);\n    assert.equal(result.result.ok, true);\n\n    const bobAfter = store.database.prepare(\n      'SELECT updated_revision, state_json FROM economy_world_players WHERE user_id = 2',\n    ).get();\n    const marketsAfter = store.database.prepare(\n      \"SELECT updated_revision, state_json FROM economy_world_segments WHERE segment_key = 'markets'\",\n    ).get();\n    assert.deepEqual(bobAfter, bobBefore);\n    assert.deepEqual(marketsAfter, marketsBefore);\n  } finally {\n    store.stopScheduler();\n    store.close();\n  }\n});`,
);

console.log('Applied segmented world storage V2 regression and projection fixes.');
