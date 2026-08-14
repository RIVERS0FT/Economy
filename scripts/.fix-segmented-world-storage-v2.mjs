import { readFileSync, writeFileSync } from 'node:fs';

function replaceOnce(path, before, after, label = before.slice(0, 80)) {
  const source = readFileSync(path, 'utf8');
  if (!source.includes(before)) throw new Error(`Missing replacement target in ${path}: ${label}`);
  writeFileSync(path, source.replace(before, after));
}

replaceOnce(
  'server/src/world-storage-v2.js',
  "export const WORLD_STORAGE_SCHEMA_VERSION = 2;",
  "export const WORLD_STORAGE_SCHEMA_VERSION = 2;\nexport const AUTHORITATIVE_WORLD_VERSION = 29;",
  'authoritative world version',
);

replaceOnce(
  'server/src/world-storage-v2.js',
  `const CORE_LOCAL_SEGMENTS = Object.freeze([\n  'bank',\n  'weeklyCashSettlement',\n  'moneyPrecision',\n  'auctionFeeEscrowCredits',\n  'version',\n]);`,
  `const CORE_LOCAL_SEGMENTS = Object.freeze([\n  'bank',\n  'weeklyCashSettlement',\n  'populationEconomy',\n  'marketDemand',\n  'demandGroups',\n  'priceTransmission',\n  'markets',\n  'stats',\n  'moneyPrecision',\n  'auctionFeeEscrowCredits',\n  'version',\n]);`,
  'local COW segment closure',
);

replaceOnce(
  'server/src/world-storage-v2.js',
  `    return {\n      revision: Number(meta.revision),\n      world,\n      snapshot,\n    };`,
  `    return {\n      revision: Number(meta.revision),\n      worldVersion: Number(meta.world_version || 0),\n      storageSchemaVersion: Number(meta.storage_schema_version || 0),\n      updatedAt: Number(meta.updated_at || 0),\n      world,\n      snapshot,\n    };`,
  'segmented meta return',
);

replaceOnce(
  'server/src/storage.js',
  `  applySegmentedWorldWrite,\n  createFullMutationScope,`,
  `  applySegmentedWorldWrite,\n  AUTHORITATIVE_WORLD_VERSION,\n  createFullMutationScope,`,
  'storage authoritative version import',
);

replaceOnce(
  'server/src/storage.js',
  `    world.version = 29;`,
  `    world.version = AUTHORITATIVE_WORLD_VERSION;`,
  'finalize authoritative version',
);

replaceOnce(
  'server/src/storage.js',
  `    const segmented = readSegmentedWorld(this);\n    if (segmented) {\n      const world = this.migrateLoadedWorld(segmented.world, now);\n      const migratedSnapshot = snapshotSegmentedWorld(world);\n      const needsPersistence = !segmentedSnapshotsEqual(segmented.snapshot, migratedSnapshot);\n      this.cacheWorld(\n        segmented.revision,\n        null,\n        world,\n        needsPersistence,\n        needsPersistence ? segmented.snapshot : migratedSnapshot,\n      );\n      return {\n        revision: segmented.revision,\n        stateJson: null,\n        world: measureRequestPhase('worldCloneMs', () => structuredClone(world)),\n      };\n    }`,
  `    const segmented = readSegmentedWorld(this);\n    if (segmented) {\n      const currentStorageWorld = segmented.storageSchemaVersion === 2\n        && segmented.worldVersion === AUTHORITATIVE_WORLD_VERSION\n        && Number(segmented.world?.version || 0) === AUTHORITATIVE_WORLD_VERSION;\n      if (currentStorageWorld) {\n        this.cacheWorld(segmented.revision, null, segmented.world, false, segmented.snapshot);\n        return {\n          revision: segmented.revision,\n          stateJson: null,\n          world: measureRequestPhase('worldCloneMs', () => structuredClone(segmented.world)),\n        };\n      }\n\n      const world = this.migrateLoadedWorld(\n        migrateWorld(structuredClone(segmented.world), now),\n        now,\n      );\n      const migratedSnapshot = snapshotSegmentedWorld(world);\n      const migrationChanged = !segmentedSnapshotsEqual(segmented.snapshot, migratedSnapshot);\n      const revision = segmented.revision + (migrationChanged ? 1 : 0);\n      const persistedSnapshot = writeFullSegmentedWorld(this, revision, world, now);\n      this.cacheWorld(revision, null, world, false, persistedSnapshot);\n      return {\n        revision,\n        stateJson: null,\n        world: measureRequestPhase('worldCloneMs', () => structuredClone(world)),\n      };\n    }`,
  'cold segmented migration fast path',
);

replaceOnce(
  'server/src/banking.js',
  `export function ensureBankWorld(world, now = Date.now()) {`,
  `export function ensureBankWorld(world, now = Date.now(), { normalizePlayers = true } = {}) {`,
  'scoped bank ensure signature',
);
replaceOnce(
  'server/src/banking.js',
  `  world.bank = bank;\n  for (const player of Object.values(world.players || {})) ensurePlayerBankAccount(player, now);\n  return bank;`,
  `  world.bank = bank;\n  if (normalizePlayers) {\n    for (const player of Object.values(world.players || {})) ensurePlayerBankAccount(player, now);\n  }\n  return bank;`,
  'scoped bank player normalization',
);
replaceOnce(
  'server/src/banking.js',
  `export function applyBankAction(world, user, action, payload = {}, now = Date.now()) {\n  migrateBankWorld(world, now);\n  processBankWorld(world, now);`,
  `export function applyBankAction(world, user, action, payload = {}, now = Date.now(), { processWorld = true } = {}) {\n  if (processWorld) {\n    migrateBankWorld(world, now);\n    processBankWorld(world, now);\n  } else {\n    ensureBankWorld(world, now, { normalizePlayers: false });\n  }`,
  'scoped bank action processing',
);

replaceOnce(
  'server/src/weekly-cash-settlement.js',
  `export function ensureWeeklyCashSettlementWorld(world, now = Date.now()) {`,
  `export function ensureWeeklyCashSettlementWorld(world, now = Date.now(), { normalizePlayers = true } = {}) {`,
  'scoped weekly ensure signature',
);
replaceOnce(
  'server/src/weekly-cash-settlement.js',
  `  world.weeklyCashSettlement = state;\n  for (const player of Object.values(world.players || {})) ensurePlayerWeeklyCashSettlement(player, now);\n  return state;`,
  `  world.weeklyCashSettlement = state;\n  if (normalizePlayers) {\n    for (const player of Object.values(world.players || {})) ensurePlayerWeeklyCashSettlement(player, now);\n  }\n  return state;`,
  'scoped weekly player normalization',
);
replaceOnce(
  'server/src/weekly-cash-settlement.js',
  `function createAssessment(world, player, type, weekKey, assessedAt) {\n  const state = ensureWeeklyCashSettlementWorld(world, assessedAt);`,
  `function createAssessment(world, player, type, weekKey, assessedAt) {\n  const state = ensureWeeklyCashSettlementWorld(world, assessedAt, { normalizePlayers: false });`,
  'weekly local assessment',
);
replaceOnce(
  'server/src/weekly-cash-settlement.js',
  `export function activateWeeklyCashSettlement(world, player, now = Date.now()) {\n  processWeeklyCashSettlementWorld(world, now);`,
  `export function activateWeeklyCashSettlement(world, player, now = Date.now(), { processWorld = true } = {}) {\n  if (processWorld) processWeeklyCashSettlementWorld(world, now);\n  else ensureWeeklyCashSettlementWorld(world, now, { normalizePlayers: false });`,
  'weekly local activation',
);
replaceOnce(
  'server/src/weekly-cash-settlement.js',
  `export function collectPlayerWeeklyCashSettlement(world, player, now = Date.now()) {\n  const worldState = ensureWeeklyCashSettlementWorld(world, now);`,
  `export function collectPlayerWeeklyCashSettlement(world, player, now = Date.now()) {\n  const worldState = ensureWeeklyCashSettlementWorld(world, now, { normalizePlayers: false });`,
  'weekly local collection',
);
replaceOnce(
  'server/src/weekly-cash-settlement.js',
  `export function settlePlayerWeeklyCashOnLogin(world, player, now = Date.now()) {\n  processWeeklyCashSettlementWorld(world, now);`,
  `export function settlePlayerWeeklyCashOnLogin(world, player, now = Date.now(), { processWorld = true } = {}) {\n  if (processWorld) processWeeklyCashSettlementWorld(world, now);\n  else ensureWeeklyCashSettlementWorld(world, now, { normalizePlayers: false });`,
  'weekly local login settlement',
);

replaceOnce(
  'server/src/research.js',
  `export function processResearchWorld(world, now = Date.now()) {\n  migrateResearchWorld(world, now);\n  for (const player of Object.values(world.players || {})) {\n    const research = ensurePlayerResearch(world, player, now);\n    if (!research?.active) continue;\n    releaseResearchEmployment(world, player, now);\n    completeResearchIfDue(world, player, now);\n  }\n  return world;\n}`,
  `export function processPlayerResearch(world, player, now = Date.now()) {\n  const research = ensurePlayerResearch(world, player, now);\n  if (!research?.active) return research;\n  releaseResearchEmployment(world, player, now);\n  completeResearchIfDue(world, player, now);\n  return player.research;\n}\n\nexport function processResearchWorld(world, now = Date.now()) {\n  migrateResearchWorld(world, now);\n  for (const player of Object.values(world.players || {})) processPlayerResearch(world, player, now);\n  return world;\n}`,
  'player-scoped research processing',
);
replaceOnce(
  'server/src/research.js',
  `export function applyResearchAction(world, user, action, payload = {}, now = Date.now()) {\n  if (action !== 'startResearch' && action !== 'accelerateResearch') return null;\n  processResearchWorld(world, now);\n  const player = world.players?.[String(user?.id)];\n  if (!player) return { ok: false, message: '玩家不存在' };`,
  `export function applyResearchAction(world, user, action, payload = {}, now = Date.now()) {\n  if (action !== 'startResearch' && action !== 'accelerateResearch') return null;\n  const player = world.players?.[String(user?.id)];\n  if (!player) return { ok: false, message: '玩家不存在' };\n  if (Number(world.version || 0) < RESEARCH_WORLD_VERSION) processResearchWorld(world, now);\n  else processPlayerResearch(world, player, now);`,
  'research action local catch-up',
);
replaceOnce(
  'server/src/research.js',
  `export function validateResearchAccess(world, user, action, payload = {}, now = Date.now()) {\n  if (!world?.players?.[String(user?.id)]) return null;\n  processResearchWorld(world, now);\n  const player = world.players[String(user.id)];`,
  `export function validateResearchAccess(world, user, action, payload = {}, now = Date.now()) {\n  if (!world?.players?.[String(user?.id)]) return null;\n  const player = world.players[String(user.id)];\n  if (Number(world.version || 0) < RESEARCH_WORLD_VERSION) processResearchWorld(world, now);\n  else processPlayerResearch(world, player, now);`,
  'research access local catch-up',
);

replaceOnce(
  'server/src/runtime-action-executor.js',
  `        gameResult = applyBankAction(world, user, action, payload, now);`,
  `        gameResult = applyBankAction(world, user, action, payload, now, {\n          processWorld: !store.scheduledProcessing,\n        });`,
  'runtime scoped bank action',
);
replaceOnce(
  'server/src/runtime-action-executor.js',
  `    ensureBankWorld(world, now);\n    ensurePlayerBankAccount(player, now);\n    ensureWeeklyCashSettlementWorld(world, now);`,
  `    ensureBankWorld(world, now, { normalizePlayers: !store.scheduledProcessing });\n    ensurePlayerBankAccount(player, now);\n    ensureWeeklyCashSettlementWorld(world, now, { normalizePlayers: !store.scheduledProcessing });`,
  'runtime scoped normalization',
);
replaceOnce(
  'server/src/runtime-action-executor.js',
  `    settlePlayerWeeklyCashOnLogin(world, world.players[String(user.id)], now);`,
  `    settlePlayerWeeklyCashOnLogin(world, world.players[String(user.id)], now, {\n      processWorld: !store.scheduledProcessing,\n    });`,
  'runtime scoped login settlement',
);
replaceOnce(
  'server/src/runtime-action-executor.js',
  `        const activated = activateWeeklyCashSettlement(world, activePlayer, now);`,
  `        const activated = activateWeeklyCashSettlement(world, activePlayer, now, {\n          processWorld: !store.scheduledProcessing,\n        });`,
  'runtime scoped weekly activation',
);

console.log('Applied segmented world storage V2 correctness fixes.');
