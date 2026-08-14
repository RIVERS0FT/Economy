// Temporary branch-only verifier migration helper; remove it with the temporary workflow before squash merge.
import { readFileSync, writeFileSync } from 'node:fs';

function patch(path, before, after) {
  let source = readFileSync(path, 'utf8');
  if (source.includes(after)) return;
  if (!source.includes(before)) throw new Error(`${path}: patch source not found`);
  source = source.replace(before, after);
  writeFileSync(path, source);
}

const hotpathPath = 'scripts/verify-authoritative-hotpaths.mjs';
let hotpathSource = readFileSync(hotpathPath, 'utf8');
hotpathSource = hotpathSource.replace("  '已提交世界',\n  '请求草稿',", "  'committed world',\n  'Mutation Scope',");
writeFileSync(hotpathPath, hotpathSource);

const capacityPath = 'scripts/verify-state-delivery-capacity.mjs';
let capacitySource = readFileSync(capacityPath, 'utf8');
capacitySource = capacitySource.replace("  'isDeepStrictEqual(world, cached.world)',\n", '');
const storageForbidMarker = "\nforbidText('server/src/storage.js', [";
if (!capacitySource.includes("requireText('server/src/world-storage-v2.js'")) {
  capacitySource = capacitySource.replace(storageForbidMarker, `\nrequireText('server/src/world-storage-v2.js', [\n  'prepareSegmentedWorldWrite(',\n  'segmentedSnapshotsEqual(',\n  'applySegmentedWorldWrite(',\n]);\n${storageForbidMarker}`);
}
writeFileSync(capacityPath, capacitySource);

const populationVerifierPath = 'scripts/verify-staple-crops-demand.mjs';
let populationVerifierSource = readFileSync(populationVerifierPath, 'utf8');
populationVerifierSource = populationVerifierSource.replace(
  "const runtimeStore = read('server/src/runtime-store.js');",
  "const runtimeStore = `${read('server/src/runtime-store-core.js')}\\n${read('server/src/runtime-store.js')}`;",
);
writeFileSync(populationVerifierPath, populationVerifierSource);

const auctionVerifierPath = 'scripts/verify-asset-auctions.mjs';
let auctionVerifierSource = readFileSync(auctionVerifierPath, 'utf8');
auctionVerifierSource = auctionVerifierSource.replace("  'flushAuctionAuditEvents(this, world, revision, nextRevision);',\n  'getAuctionBidHistory(user, auctionId, now = Date.now())',", "  'getAuctionBidHistory(user, auctionId, now = Date.now())',");
auctionVerifierSource = auctionVerifierSource.replace(
  "requireText('server/src/runtime-store.js', ['flushAuctionAuditEvents(this, world, revision, nextRevision);', 'prepared.version = 26;']);",
  "requireText('server/src/runtime-store-core.js', ['flushAuctionAuditEvents(this, world, revision, nextRevision);']);\nrequireText('server/src/world-storage-v2.js', ['AUTHORITATIVE_WORLD_VERSION = 29;']);",
);
writeFileSync(auctionVerifierPath, auctionVerifierSource);

const adminPlayerVerifierPath = 'scripts/verify-admin-player-statistics.mjs';
let adminPlayerVerifierSource = readFileSync(adminPlayerVerifierPath, 'utf8');
adminPlayerVerifierSource = adminPlayerVerifierSource.replace(
  "requireText('server/src/runtime-store.js', [\n  \"import { configurePlayerAdminStatistics } from './player-admin-statistics.js'\",\n  'configurePlayerAdminStatistics(this);',\n]);",
  "const runtimeStoreSource = `${read('server/src/runtime-store-core.js')}\\n${read('server/src/runtime-store.js')}`;\nfor (const fragment of [\"import { configurePlayerAdminStatistics } from './player-admin-statistics.js'\", 'configurePlayerAdminStatistics(this);']) {\n  if (!runtimeStoreSource.includes(fragment)) failures.push(`runtime store 缺少玩家运营统计规则: ${fragment}`);\n}",
);
writeFileSync(adminPlayerVerifierPath, adminPlayerVerifierSource);

patch(
  'server/src/storage.js',
  `    if (mutationScope) {\n      if (mutationScope.allPlayers || mutationScope.playerIds === null) {\n        stripLegacyFacilityInstances(world);\n      } else {\n        for (const userId of mutationScope.playerIds || []) {\n          const player = world.players?.[String(userId)];\n          if (player) delete player.facilities;\n        }\n      }\n      measureRequestPhase('moneyNormalizeMs', () => normalizeWorldMoneyPrecisionScoped(world, mutationScope));`,
  `    if (mutationScope) {\n      if (mutationScope.allPlayers || mutationScope.playerIds === null) {\n        stripLegacyFacilityInstances(world);\n        stripPlayerLogs(world);\n      } else {\n        for (const userId of mutationScope.playerIds || []) {\n          const player = world.players?.[String(userId)];\n          if (!player) continue;\n          delete player.facilities;\n          delete player.trades;\n          delete player.ledger;\n          delete player.assetEvents;\n        }\n      }\n      measureRequestPhase('moneyNormalizeMs', () => normalizeWorldMoneyPrecisionScoped(world, mutationScope));`,
);

patch(
  'server/src/contract-audit-store.js',
  "import { internalMoneyToMicros, microsToInternalMoney, multiplyMoneyByInteger, roundInternalMoney } from './money.js';\n",
  "import { internalMoneyToMicros, microsToInternalMoney, multiplyMoneyByInteger, roundInternalMoney } from './money.js';\nimport { readSegmentedWorld } from './world-storage-v2.js';\n",
);
patch(
  'server/src/contract-audit-store.js',
  `  store.bootstrapLegacyContractAudit = () => {\n    const row = store.database.prepare('SELECT revision, state_json, updated_at FROM economy_world WHERE id = 1').get();\n    if (!row) return;\n    let world;\n    try {\n      world = JSON.parse(String(row.state_json));\n    } catch {\n      return;\n    }\n    const contracts = Array.isArray(world.productionContracts) ? world.productionContracts : [];`,
  `  store.bootstrapLegacyContractAudit = () => {\n    const segmented = readSegmentedWorld(store);\n    let revision;\n    let updatedAt;\n    let world;\n    if (segmented) {\n      revision = Number(segmented.revision);\n      updatedAt = Number(segmented.updatedAt || 0);\n      world = segmented.world;\n    } else {\n      const row = store.database.prepare('SELECT revision, state_json, updated_at FROM economy_world WHERE id = 1').get();\n      if (!row) return;\n      try {\n        world = JSON.parse(String(row.state_json));\n      } catch {\n        return;\n      }\n      revision = Number(row.revision);\n      updatedAt = Number(row.updated_at || 0);\n    }\n    const contracts = Array.isArray(world.productionContracts) ? world.productionContracts : [];`,
);
patch(
  'server/src/contract-audit-store.js',
  "queueTransitionEvent(world, { triggerType: 'migration', now: Number(row.updated_at || snapshot.endedAt || snapshot.completedAt || snapshot.createdAt || Date.now()) }, snapshot, 'legacy_snapshot_imported', {",
  "queueTransitionEvent(world, { triggerType: 'migration', now: Number(updatedAt || snapshot.endedAt || snapshot.completedAt || snapshot.createdAt || Date.now()) }, snapshot, 'legacy_snapshot_imported', {",
);
patch(
  'server/src/contract-audit-store.js',
  "metadata: { importedRevision: Number(row.revision) },",
  "metadata: { importedRevision: revision },",
);
patch(
  'server/src/contract-audit-store.js',
  "        Number(row.revision),\n        Number(row.revision),",
  "        revision,\n        revision,",
);

patch(
  'server/test/asset-events.test.js',
  "import { EconomyStore } from '../src/storage.js';\n",
  "import { EconomyStore } from '../src/storage.js';\nimport { readSegmentedWorld } from '../src/world-storage-v2.js';\n",
);
patch(
  'server/test/asset-events.test.js',
  `function persistedWorld(store) {\n  const row = store.selectWorld.get();\n  return JSON.parse(String(row.state_json));\n}`,
  `function persistedWorld(store) {\n  return readSegmentedWorld(store)?.world;\n}`,
);

patch(
  'server/test/domain.test.js',
  "import { EconomyStore } from '../src/storage.js';\n",
  "import { EconomyStore } from '../src/storage.js';\nimport { readSegmentedWorld } from '../src/world-storage-v2.js';\n",
);
patch(
  'server/test/domain.test.js',
  "const cycleMs = 5 * 60 * 1000;\n",
  "const cycleMs = 5 * 60 * 1000;\n\nfunction persistedWorld(store) {\n  return readSegmentedWorld(store)?.world;\n}\n",
);
for (const before of [
  "const firstWorld = JSON.parse(String(store.selectWorld.get().state_json));",
  "const afterPoll = JSON.parse(String(store.selectWorld.get().state_json));",
  "const afterSuccess = JSON.parse(String(store.selectWorld.get().state_json));",
  "const afterFailure = JSON.parse(String(store.selectWorld.get().state_json));",
  "const persisted = JSON.parse(String(store.selectWorld.get().state_json));",
]) {
  const name = before.match(/const (\w+)/)?.[1];
  patch('server/test/domain.test.js', before, `const ${name} = persistedWorld(store);`);
}

patch(
  'tests/stress/run.mjs',
  "    if (!expected) throw new Error(`${method} ${route} 返回非预期状态 ${response.status}`);",
  "    if (!expected) throw new Error(`${method} ${route} 返回非预期状态 ${response.status}：${text.slice(0, 500)}`);",
);
patch(
  'tests/stress/localHarness.mjs',
  `      return {\n        serverOutlierCount: (stdout.match(/Economy request outlier/g) || []).length\n          + (stderr.match(/Economy request outlier/g) || []).length,\n        serverErrorLogCount: (stderr.match(/Error:/g) || []).length,\n      };`,
  `      return {\n        serverOutlierCount: (stdout.match(/Economy request outlier/g) || []).length\n          + (stderr.match(/Economy request outlier/g) || []).length,\n        serverErrorLogCount: (stderr.match(/Error:/g) || []).length,\n        serverErrorTail: stderr.slice(-4_000),\n      };`,
);
patch(
  'tests/stress/run.mjs',
  "  if (diagnostics?.serverErrorLogCount > 0) failures.push(`隔离服务器记录了 ${diagnostics.serverErrorLogCount} 条错误日志`);",
  "  if (diagnostics?.serverErrorLogCount > 0) failures.push(`隔离服务器记录了 ${diagnostics.serverErrorLogCount} 条错误日志：${diagnostics.serverErrorTail || ''}`);",
);
