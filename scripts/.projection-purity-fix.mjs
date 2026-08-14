import { readFileSync, writeFileSync } from 'node:fs';

function replaceOnce(path, before, after, label) {
  const source = readFileSync(path, 'utf8');
  if (!source.includes(before)) throw new Error(`Missing ${label} in ${path}`);
  writeFileSync(path, source.replace(before, after));
}

replaceOnce(
  'server/src/facility-groups.js',
  `export function publicOrderView(order, userId) {\n  const normalized = clone(normalizeOrder(order));`,
  `export function publicOrderView(order, userId) {\n  const normalized = normalizeOrder(clone(order));`,
  'public order projection must normalize a clone',
);

replaceOnce(
  'server/src/storage.js',
  `  finalizeWorldForStorage(world, _now, mutationScope = null) {\n    if (mutationScope) {\n      measureRequestPhase('moneyNormalizeMs', () => normalizeWorldMoneyPrecisionScoped(world, mutationScope));\n    } else {\n      stripLegacyFacilityInstances(world);\n      stripPlayerLogs(world);\n      measureRequestPhase('moneyNormalizeMs', () => normalizeWorldMoneyPrecision(world));\n    }\n    world.version = AUTHORITATIVE_WORLD_VERSION;\n    return world;\n  }`,
  `  finalizeWorldForStorage(world, _now, mutationScope = null) {\n    if (mutationScope) {\n      if (mutationScope.allPlayers || mutationScope.playerIds === null) {\n        stripLegacyFacilityInstances(world);\n      } else {\n        for (const userId of mutationScope.playerIds || []) {\n          const player = world.players?.[String(userId)];\n          if (player) delete player.facilities;\n        }\n      }\n      measureRequestPhase('moneyNormalizeMs', () => normalizeWorldMoneyPrecisionScoped(world, mutationScope));\n    } else {\n      stripLegacyFacilityInstances(world);\n      stripPlayerLogs(world);\n      measureRequestPhase('moneyNormalizeMs', () => normalizeWorldMoneyPrecision(world));\n    }\n    world.version = AUTHORITATIVE_WORLD_VERSION;\n    return world;\n  }`,
  'scoped persistence strips legacy facility fields for dirty players',
);

console.log('Made order projection read-only and scoped persistence strip legacy player fields.');
