import { readFileSync, writeFileSync } from 'node:fs';

function replaceOnce(path, before, after, label) {
  const source = readFileSync(path, 'utf8');
  if (!source.includes(before)) throw new Error(`Missing ${label} in ${path}`);
  writeFileSync(path, source.replace(before, after));
}

replaceOnce(
  'server/src/leaderboards.js',
  `function processWorldAt(world, now, priorOrderReferences = []) {\n  processFacilityGroupWorld(world, now, { migrate: false });\n  processAssetAuctions(world, now, { migrate: false });`,
  `function processWorldAt(world, now, priorOrderReferences = [], { migrate = true } = {}) {\n  processFacilityGroupWorld(world, now, { migrate });\n  processAssetAuctions(world, now, { migrate });`,
  'leaderboard processWorldAt migration option',
);

replaceOnce(
  'server/src/leaderboards.js',
  `export function processLeaderboardWorld(world, now = Date.now(), options = {}) {\n  world.players ||= {};`,
  `export function processLeaderboardWorld(world, now = Date.now(), options = {}) {\n  const migrate = options.migrate !== false;\n  world.players ||= {};`,
  'leaderboard migration mode',
);

replaceOnce(
  'server/src/leaderboards.js',
  `  if (!validLeaderboardState(world.leaderboardState)) {\n    processFacilityGroupWorld(world, now, { migrate: false });\n    processAssetAuctions(world, now, { migrate: false });`,
  `  if (!validLeaderboardState(world.leaderboardState)) {\n    processFacilityGroupWorld(world, now, { migrate });\n    processAssetAuctions(world, now, { migrate });`,
  'leaderboard initialization migration mode',
);

replaceOnce(
  'server/src/leaderboards.js',
  `    processWorldAt(world, state.endsAt - 1, priorOrders);`,
  `    processWorldAt(world, state.endsAt - 1, priorOrders, { migrate });`,
  'leaderboard rollover migration mode',
);

replaceOnce(
  'server/src/leaderboards.js',
  `  processWorldAt(world, now, priorOrders);`,
  `  processWorldAt(world, now, priorOrders, { migrate });`,
  'leaderboard current processing migration mode',
);

replaceOnce(
  'server/src/storage.js',
  `    processLeaderboardWorld(world, now, {\n      onGemReward: (reward) => this.recordGemLedgerEvent(reward),\n    });`,
  `    processLeaderboardWorld(world, now, {\n      migrate: false,\n      onGemReward: (reward) => this.recordGemLedgerEvent(reward),\n    });`,
  'base runtime scheduler leaderboard migration skip',
);

replaceOnce(
  'server/src/runtime-store-core.js',
  `        processLeaderboardWorld(world, now, {\n          onGemReward: (reward) => this.recordGemLedgerEvent(reward),\n        });`,
  `        processLeaderboardWorld(world, now, {\n          migrate: false,\n          onGemReward: (reward) => this.recordGemLedgerEvent(reward),\n        });`,
  'formal scheduler leaderboard migration skip',
);

console.log('Restored cold leaderboard migration while keeping runtime scheduler migration-free.');
