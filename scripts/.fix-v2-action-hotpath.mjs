import { readFileSync, writeFileSync } from 'node:fs';

function replaceOnce(path, before, after) {
  let source = readFileSync(path, 'utf8');
  if (source.includes(before)) {
    source = source.replace(before, after);
    writeFileSync(path, source);
    return;
  }
  if (!source.includes(after)) throw new Error(`${path}: source marker not found`);
}

const assetTestPath = 'server/test/asset-events.test.js';
let assetTest = readFileSync(assetTestPath, 'utf8');
assetTest = assetTest
  .replace(/import \{ EconomyStore as RuntimeEconomyStore \} from '\.\.\/src\/runtime-store\.js';\n/g, '')
  .replace(/import \{ readSegmentedWorld \} from '\.\.\/src\/world-storage-v2\.js';\n/g, '')
  .replace(
    "import { EconomyStore } from '../src/storage.js';\n",
    "import { EconomyStore } from '../src/storage.js';\nimport { EconomyStore as RuntimeEconomyStore } from '../src/runtime-store.js';\nimport { readSegmentedWorld } from '../src/world-storage-v2.js';\n",
  );
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
  `  apply(user, { action, payload, requestKey, method, path }, now = Date.now()) {\n    payload = normalizePlayerMoneyPayload(action, payload);\n    return this.transaction(() => {\n      const cached = this.selectIdempotency.get(Number(user.id), requestKey);\n      if (cached) {\n        if (cached.request_method !== method || cached.request_path !== path) {\n          const error = new Error('幂等键已被其他操作使用');\n          error.statusCode = 409;\n          throw error;\n        }\n        const cachedResponse = JSON.parse(String(cached.response_json));\n        return createActionAcknowledgement(cachedResponse.result, cachedResponse.revision);\n      }\n\n      const { revision, stateJson, world } = this.loadWorld(now);\n      const player = ensurePlayer(world, user, now);\n      ensureWarehouse(player);\n      ensureGemState(player);\n      ensureBankWorld(world, now);\n      ensurePlayerBankAccount(player, now);`,
  `  apply(user, { action, payload, requestKey, method, path }, now = Date.now()) {\n    payload = normalizePlayerMoneyPayload(action, payload);\n    return this.transaction(() => {\n      const cached = this.selectIdempotency.get(Number(user.id), requestKey);\n      if (cached) {\n        if (cached.request_method !== method || cached.request_path !== path) {\n          const error = new Error('幂等键已被其他操作使用');\n          error.statusCode = 409;\n          throw error;\n        }\n        const cachedResponse = JSON.parse(String(cached.response_json));\n        return createActionAcknowledgement(cachedResponse.result, cachedResponse.revision);\n      }\n\n      const { revision, stateJson, world } = this.loadWorld(now);\n      const player = ensurePlayer(world, user, now, { migrate: false });\n      ensureWarehouse(player);\n      ensureGemState(player);\n      ensureBankWorld(world, now, { normalizePlayers: false });\n      ensurePlayerBankAccount(player, now);`,
);
replaceOnce(
  'server/src/storage.js',
  "      this.processWorldIfDue(world, now, Number(user.id), { force: true });\n      settlePlayerWeeklyCashOnLogin(world, player, now);",
  "      this.processWorldIfDue(world, now, Number(user.id));\n      settlePlayerWeeklyCashOnLogin(world, player, now);",
);
