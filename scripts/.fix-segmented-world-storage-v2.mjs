import { readFileSync, writeFileSync } from 'node:fs';

function replaceOnce(path, before, after, label = before.slice(0, 80)) {
  const source = readFileSync(path, 'utf8');
  if (!source.includes(before)) throw new Error(`Missing replacement target in ${path}: ${label}`);
  writeFileSync(path, source.replace(before, after));
}

replaceOnce(
  'server/src/domain-core.js',
  `export function ensurePlayer(world, user, now = Date.now()) {\n  migrateWorld(world, now);\n  const key = String(user.id);\n  if (!world.players[key]) world.players[key] = createPlayer(user, now);\n  return world.players[key];\n}`,
  `export function ensurePlayer(world, user, now = Date.now(), { migrate = true } = {}) {\n  if (migrate) migrateWorld(world, now);\n  const key = String(user.id);\n  world.players ||= {};\n  if (!world.players[key]) world.players[key] = createPlayer(user, now);\n  return world.players[key];\n}`,
  'allow current-world player ensure without a full migration',
);

replaceOnce(
  'server/src/domain-core.js',
  `function processFacilities(player, now) {\n  for (const facility of player.facilities.slice(0, ECONOMY_CONSTANTS.maxFacilitiesProcessedPerTick)) {`,
  `function processFacilities(player, now) {\n  for (const facility of (player.facilities || []).slice(0, ECONOMY_CONSTANTS.maxFacilitiesProcessedPerTick)) {`,
  'current worlds no longer carry legacy facilities arrays',
);

replaceOnce(
  'server/src/domain-core.js',
  `export function processWorld(world, now = Date.now()) {\n  migrateWorld(world, now);\n  for (const player of Object.values(world.players)) processFacilities(player, now);\n  pruneWorld(world, now);\n  return world;\n}`,
  `export function processWorld(world, now = Date.now(), { migrate = true } = {}) {\n  if (migrate) migrateWorld(world, now);\n  for (const player of Object.values(world.players || {})) processFacilities(player, now);\n  pruneWorld(world, now);\n  return world;\n}`,
  'allow current-world processing without migration',
);

replaceOnce(
  'server/src/domain-core.js',
  `export function applyAction(world, user, action, payload = {}, now = Date.now()) {\n  migrateWorld(world, now);\n  ensurePlayer(world, user, now);\n  processWorld(world, now);\n  const userId = Number(user.id);`,
  `export function applyAction(\n  world,\n  user,\n  action,\n  payload = {},\n  now = Date.now(),\n  { migrate = true, process = true } = {},\n) {\n  if (migrate) migrateWorld(world, now);\n  ensurePlayer(world, user, now, { migrate: false });\n  if (process) processWorld(world, now, { migrate: false });\n  const userId = Number(user.id);`,
  'formal actions must not repeat migration and processing',
);

replaceOnce(
  'server/src/facility-groups.js',
  `export function processFacilityGroupWorld(world, now = Date.now()) {\n  removeSystemFacilityOrders(world);\n  migrateFacilityGroupWorld(world, now);\n  withLegacyFacilitiesSuppressed(world, () => processWorld(world, now));\n  migrateFacilityGroupWorld(world, now);\n  removeSystemFacilityOrders(world);\n  for (const player of Object.values(world.players || {})) {\n    ensureWarehouse(player);\n    for (const group of player.facilityGroups || []) processGroup(world, player, group, now);\n  }\n  reconcileAllFacilityGroups(world, now);\n  stripLegacyFacilityInstances(world);\n  return world;\n}`,
  `export function processFacilityGroupWorld(world, now = Date.now(), { migrate = true } = {}) {\n  removeSystemFacilityOrders(world);\n  if (migrate) migrateFacilityGroupWorld(world, now);\n  if (migrate) withLegacyFacilitiesSuppressed(world, () => processWorld(world, now, { migrate: false }));\n  else processWorld(world, now, { migrate: false });\n  if (migrate) migrateFacilityGroupWorld(world, now);\n  removeSystemFacilityOrders(world);\n  for (const player of Object.values(world.players || {})) {\n    ensureWarehouse(player);\n    for (const group of player.facilityGroups || []) processGroup(world, player, group, now);\n  }\n  reconcileAllFacilityGroups(world, now);\n  if (migrate) stripLegacyFacilityInstances(world);\n  return world;\n}`,
  'separate cold facility migration from current-world processing',
);

replaceOnce(
  'server/src/facility-groups.js',
  `export function applyFacilityGroupAction(world, user, action, payload = {}, now = Date.now()) {\n  processFacilityGroupWorld(world, now);\n  const userId = Number(user.id);\n  let actionResult;`,
  `export function applyFacilityGroupAction(\n  world,\n  user,\n  action,\n  payload = {},\n  now = Date.now(),\n  { migrate = true, process = true } = {},\n) {\n  if (process) processFacilityGroupWorld(world, now, { migrate });\n  const userId = Number(user.id);\n  const applyBaseAction = () => applyAction(world, user, action, payload, now, { migrate: false, process: false });\n  let actionResult;`,
  'formal facility actions can rely on scheduler processing',
);

replaceOnce(
  'server/src/facility-groups.js',
  `      : withLegacyFacilitiesSuppressed(world, () => applyAction(world, user, action, payload, now));`,
  `      : (migrate ? withLegacyFacilitiesSuppressed(world, applyBaseAction) : applyBaseAction());`,
  'cancel action base fallback without hot legacy suppression',
);
replaceOnce(
  'server/src/facility-groups.js',
  `  } else {\n    actionResult = withLegacyFacilitiesSuppressed(world, () => applyAction(world, user, action, payload, now));\n  }\n\n  migrateFacilityGroupWorld(world, now);\n  if (action === 'renamePlayer' && actionResult.ok) renameFacilityOrders(world, userId);\n  reconcileAllFacilityGroups(world, now);\n  stripLegacyFacilityInstances(world);\n  return actionResult;\n}`,
  `  } else {\n    actionResult = migrate ? withLegacyFacilitiesSuppressed(world, applyBaseAction) : applyBaseAction();\n  }\n\n  if (migrate) migrateFacilityGroupWorld(world, now);\n  if (action === 'renamePlayer' && actionResult.ok) renameFacilityOrders(world, userId);\n  reconcileAllFacilityGroups(world, now);\n  if (migrate) stripLegacyFacilityInstances(world);\n  return actionResult;\n}`,
  'skip post-action migration on current runtime worlds',
);

replaceOnce(
  'server/src/runtime-action-executor.js',
  `function cancelRuntimeCommodityOrder(world, user, orderId, now) {`,
  `function cancelRuntimeCommodityOrder(world, user, orderId, now, { processWorld = true } = {}) {`,
  'commodity cancel scheduler option',
);
replaceOnce(
  'server/src/runtime-action-executor.js',
  `  processFacilityGroupWorld(world, now);\n  return cancelSettledCommodityOrder(world, user, orderId)`,
  `  if (processWorld) processFacilityGroupWorld(world, now, { migrate: false });\n  return cancelSettledCommodityOrder(world, user, orderId)`,
  'do not reprocess formal runtime world before commodity cancel',
);
replaceOnce(
  'server/src/runtime-action-executor.js',
  `    const { revision, stateJson, world } = store.loadWorld(now, mutationScope);\n    const player = ensurePlayer(world, user, now);`,
  `    const { revision, stateJson, world } = store.loadWorld(now, mutationScope);\n    const player = ensurePlayer(world, user, now, { migrate: false });`,
  'runtime player ensure must not migrate the full world',
);
replaceOnce(
  'server/src/runtime-action-executor.js',
  `        gameResult = cancelRuntimeCommodityOrder(world, user, payload.orderId, now)\n          ?? applyFacilityGroupAction(world, user, action, payload, now);`,
  `        gameResult = cancelRuntimeCommodityOrder(world, user, payload.orderId, now, {\n          processWorld: !store.scheduledProcessing,\n        }) ?? applyFacilityGroupAction(world, user, action, payload, now, {\n          migrate: false,\n          process: !store.scheduledProcessing,\n        });`,
  'formal cancel action uses scheduler barrier instead of world processing',
);
replaceOnce(
  'server/src/runtime-action-executor.js',
  `          gameResult = applyFacilityGroupAction(world, user, action, payload, now);`,
  `          gameResult = applyFacilityGroupAction(world, user, action, payload, now, {\n            migrate: false,\n            process: !store.scheduledProcessing,\n          });`,
  'auto-procure build avoids runtime migration',
);
replaceOnce(
  'server/src/runtime-action-executor.js',
  `      } else {\n        gameResult = applyFacilityGroupAction(world, user, action, payload, now);\n      }`,
  `      } else {\n        gameResult = applyFacilityGroupAction(world, user, action, payload, now, {\n          migrate: false,\n          process: !store.scheduledProcessing,\n        });\n      }`,
  'formal facility/base actions avoid runtime migration',
);

replaceOnce(
  'server/src/storage.js',
  `      const player = ensurePlayer(world, user, now);\n      ensureWarehouse(player);\n      ensureGemState(player);\n      ensureBankWorld(world, now);`,
  `      const player = ensurePlayer(world, user, now, { migrate: false });\n      ensureWarehouse(player);\n      ensureGemState(player);\n      ensureBankWorld(world, now, { normalizePlayers: false });`,
  'state write path assumes cold-migrated current world',
);

replaceOnce(
  'server/src/runtime-store-core.js',
  `      const player = ensurePlayer(world, user, now);\n      ensureWarehouse(player);`,
  `      const player = ensurePlayer(world, user, now, { migrate: false });\n      ensureWarehouse(player);`,
  'contract runtime action must not run full migration',
);

console.log('Applied current-world hot-path migration separation.');
