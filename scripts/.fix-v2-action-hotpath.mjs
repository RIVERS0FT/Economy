import { readFileSync, writeFileSync } from 'node:fs';

function replaceOnce(path, before, after) {
  let source = readFileSync(path, 'utf8');
  if (source.includes(after)) return;
  if (!source.includes(before)) throw new Error(`${path}: source marker not found`);
  source = source.replace(before, after);
  writeFileSync(path, source);
}

const assetTestPath = 'server/test/asset-events.test.js';
let assetTest = readFileSync(assetTestPath, 'utf8');
assetTest = assetTest
  .replace(/(?:import \{ EconomyStore as RuntimeEconomyStore \} from '\.\.\/src\/runtime-store\.js';\n)+/, "import { EconomyStore as RuntimeEconomyStore } from '../src/runtime-store.js';\n")
  .replace(/(?:import \{ readSegmentedWorld \} from '\.\.\/src\/world-storage-v2\.js';\n)+/, "import { readSegmentedWorld } from '../src/world-storage-v2.js';\n");
writeFileSync(assetTestPath, assetTest);

replaceOnce(
  'server/src/storage.js',
  "    const player = ensurePlayer(world, user, now);\n    player.credits += Number(row.reward_credits);",
  "    const player = ensurePlayer(world, user, now, { migrate: false });\n    player.credits += Number(row.reward_credits);",
);
replaceOnce(
  'server/src/storage.js',
  "      const player = ensurePlayer(world, user, now);\n      ensureGemState(player);\n      ensureBankWorld(world, now);\n      ensurePlayerBankAccount(player, now);",
  "      const player = ensurePlayer(world, user, now, { migrate: false });\n      ensureGemState(player);\n      ensureBankWorld(world, now, { normalizePlayers: false });\n      ensurePlayerBankAccount(player, now);",
);
replaceOnce(
  'server/src/storage.js',
  "      const player = ensurePlayer(world, user, now);\n      ensureWarehouse(player);\n      ensureGemState(player);\n      ensureBankWorld(world, now);\n      ensurePlayerBankAccount(player, now);",
  "      const player = ensurePlayer(world, user, now, { migrate: false });\n      ensureWarehouse(player);\n      ensureGemState(player);\n      ensureBankWorld(world, now, { normalizePlayers: false });\n      ensurePlayerBankAccount(player, now);",
);
replaceOnce(
  'server/src/storage.js',
  "      this.processWorldIfDue(world, now, Number(user.id), { force: true });\n      settlePlayerWeeklyCashOnLogin(world, player, now);",
  "      this.processWorldIfDue(world, now, Number(user.id));\n      settlePlayerWeeklyCashOnLogin(world, player, now);",
);
