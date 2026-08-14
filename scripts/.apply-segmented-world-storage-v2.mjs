import { readFileSync, writeFileSync } from 'node:fs';

function read(path) {
  return readFileSync(path, 'utf8');
}

function write(path, content) {
  writeFileSync(path, content);
}

function replaceOnce(path, before, after) {
  const source = read(path);
  const index = source.indexOf(before);
  if (index < 0) throw new Error(`${path}: missing replacement target:\n${before.slice(0, 240)}`);
  if (source.indexOf(before, index + before.length) >= 0) {
    throw new Error(`${path}: replacement target is not unique`);
  }
  write(path, source.slice(0, index) + after + source.slice(index + before.length));
}

replaceOnce(
  'server/src/storage.js',
  "import { normalizePlayerMoneyPayload, normalizeWorldMoneyPrecision } from './money.js';",
  "import { normalizePlayerMoneyPayload, normalizeWorldMoneyPrecision, normalizeWorldMoneyPrecisionScoped } from './money.js';",
);
replaceOnce(
  'server/src/storage.js',
  "import {\n  configureAuctionAuditStore,\n  flushAuctionAuditEvents,\n  listRecentAuctionBidEvents,\n} from './auction-audit-store.js';",
  "import {\n  configureAuctionAuditStore,\n  flushAuctionAuditEvents,\n  listRecentAuctionBidEvents,\n} from './auction-audit-store.js';\nimport {\n  applySegmentedWorldWrite,\n  createFullMutationScope,\n  installSegmentedWorldStorage,\n  prepareSegmentedWorldWrite,\n  readSegmentedWorld,\n  snapshotSegmentedWorld,\n  writeFullSegmentedWorld,\n} from './world-storage-v2.js';",
);
replaceOnce(
  'server/src/storage.js',
  "    this.updateWorld = this.database.prepare(\n      'UPDATE economy_world SET revision = ?, state_json = ?, updated_at = ? WHERE id = 1',\n    );\n    this.selectIdempotency = this.database.prepare(",
  "    this.updateWorld = this.database.prepare(\n      'UPDATE economy_world SET revision = ?, state_json = ?, updated_at = ? WHERE id = 1',\n    );\n    installSegmentedWorldStorage(this);\n    this.selectIdempotency = this.database.prepare(",
);
replaceOnce(
  'server/src/storage.js',
  `  finalizeWorldForStorage(world, _now) {
    stripLegacyFacilityInstances(world);
    stripPlayerLogs(world);
    measureRequestPhase('moneyNormalizeMs', () => normalizeWorldMoneyPrecision(world));
    world.version = 29;
    return world;
  }`,
  `  finalizeWorldForStorage(world, _now, mutationScope = null) {
    if (mutationScope) {
      measureRequestPhase('moneyNormalizeMs', () => normalizeWorldMoneyPrecisionScoped(world, mutationScope));
    } else {
      stripLegacyFacilityInstances(world);
      stripPlayerLogs(world);
      measureRequestPhase('moneyNormalizeMs', () => normalizeWorldMoneyPrecision(world));
    }
    world.version = 29;
    return world;
  }`,
);
replaceOnce(
  'server/src/storage.js',
  `  cacheWorld(revision, stateJson, world, needsPersistence = false) {
    const nextRevision = Number(revision);
    if (this.worldCache?.revision !== nextRevision) this.clientStateProjectionCache.clear();
    this.worldCache = {
      revision: nextRevision,
      stateJson,
      world: measureRequestPhase('worldCloneMs', () => structuredClone(world)),
      needsPersistence: Boolean(needsPersistence),
    };
  }`,
  `  cacheWorld(revision, stateJson, world, needsPersistence = false, segmentedSnapshot = null) {
    const nextRevision = Number(revision);
    if (this.worldCache?.revision !== nextRevision) this.clientStateProjectionCache.clear();
    this.worldCache = {
      revision: nextRevision,
      stateJson,
      world: measureRequestPhase('worldCloneMs', () => structuredClone(world)),
      needsPersistence: Boolean(needsPersistence),
      segmentedSnapshot: segmentedSnapshot || snapshotSegmentedWorld(world),
      storageSchemaVersion: 2,
    };
  }`,
);
replaceOnce(
  'server/src/storage.js',
  `  loadWorld(now) {
    if (this.worldCache) {
      return {
        revision: this.worldCache.revision,
        stateJson: this.worldCache.stateJson,
        world: measureRequestPhase('worldCloneMs', () => structuredClone(this.worldCache.world)),
      };
    }

    const row = this.selectWorld.get();
    if (!row) {
      const world = this.migrateLoadedWorld(stripPlayerLogs(createWorld(now)), now);
      const stateJson = measureRequestPhase('serializeWorldMs', () => JSON.stringify(world));
      this.insertWorld.run(1, stateJson, now);
      this.cacheWorld(1, stateJson, world);
      setRequestGauge('worldJsonBytes', Buffer.byteLength(stateJson));
      return { revision: 1, stateJson, world: measureRequestPhase('worldCloneMs', () => structuredClone(world)) };
    }

    const persistedStateJson = String(row.state_json);
    const world = this.migrateLoadedWorld(migrateWorld(JSON.parse(persistedStateJson), now), now);
    const stateJson = measureRequestPhase('serializeWorldMs', () => JSON.stringify(world));
    this.cacheWorld(Number(row.revision), stateJson, world, stateJson !== persistedStateJson);
    setRequestGauge('worldJsonBytes', Buffer.byteLength(stateJson));
    return { revision: Number(row.revision), stateJson, world: measureRequestPhase('worldCloneMs', () => structuredClone(world)) };
  }

  serializeWorld(world, now) {
    return measureRequestPhase('serializeWorldMs', () => JSON.stringify(this.finalizeWorldForStorage(world, now)));
  }

  saveWorld(revision, world, now) {
    world.lastProcessedAt = now;
    const stateJson = this.serializeWorld(world, now);
    const nextRevision = revision + 1;
    measureRequestPhase('worldUpdateMs', () => this.updateWorld.run(nextRevision, stateJson, now));
    flushAuctionAuditEvents(this, world, revision, nextRevision);
    this.cacheWorld(nextRevision, stateJson, world);
    if (!this.scheduledProcessing) this.nextWorldProcessingAt = now + WORLD_PROCESS_INTERVAL_MS;
    return nextRevision;
  }

  saveWorldIfChanged(revision, world, now, _previousStateJson) {
    this.finalizeWorldForStorage(world, now);
    const cached = this.worldCache;
    const unchanged = cached
      && cached.revision === revision
      && !cached.needsPersistence
      && measureRequestPhase('worldEqualityMs', () => isDeepStrictEqual(world, cached.world));
    if (unchanged) {
      flushAuctionAuditEvents(this, world, revision, revision);
      return revision;
    }

    world.lastProcessedAt = now;
    const stateJson = measureRequestPhase('serializeWorldMs', () => JSON.stringify(world));
    const nextRevision = revision + 1;
    measureRequestPhase('worldUpdateMs', () => this.updateWorld.run(nextRevision, stateJson, now));
    flushAuctionAuditEvents(this, world, revision, nextRevision);
    this.cacheWorld(nextRevision, stateJson, world);
    return nextRevision;
  }`,
  `  loadWorld(now) {
    if (this.worldCache) {
      return {
        revision: this.worldCache.revision,
        stateJson: null,
        world: measureRequestPhase('worldCloneMs', () => structuredClone(this.worldCache.world)),
      };
    }

    const segmented = readSegmentedWorld(this);
    if (segmented) {
      const world = this.migrateLoadedWorld(segmented.world, now);
      const snapshot = writeFullSegmentedWorld(this, segmented.revision, world, now);
      this.cacheWorld(segmented.revision, null, world, false, snapshot);
      return {
        revision: segmented.revision,
        stateJson: null,
        world: measureRequestPhase('worldCloneMs', () => structuredClone(world)),
      };
    }

    const row = this.selectWorld.get();
    if (!row) {
      const world = this.migrateLoadedWorld(stripPlayerLogs(createWorld(now)), now);
      const legacyStateJson = measureRequestPhase('serializeWorldMs', () => JSON.stringify(world));
      this.insertWorld.run(1, legacyStateJson, now);
      const snapshot = writeFullSegmentedWorld(this, 1, world, now);
      this.cacheWorld(1, null, world, false, snapshot);
      return { revision: 1, stateJson: null, world: measureRequestPhase('worldCloneMs', () => structuredClone(world)) };
    }

    const persistedStateJson = String(row.state_json);
    const world = this.migrateLoadedWorld(migrateWorld(JSON.parse(persistedStateJson), now), now);
    const revision = Number(row.revision);
    const snapshot = writeFullSegmentedWorld(this, revision, world, now);
    this.cacheWorld(revision, null, world, false, snapshot);
    setRequestGauge('legacyWorldJsonBytes', Buffer.byteLength(persistedStateJson));
    return { revision, stateJson: null, world: measureRequestPhase('worldCloneMs', () => structuredClone(world)) };
  }

  serializeWorld(world, now) {
    return measureRequestPhase('serializeWorldMs', () => JSON.stringify(this.finalizeWorldForStorage(world, now)));
  }

  persistSegmentedWorld(revision, world, now, mutationScope = createFullMutationScope()) {
    this.finalizeWorldForStorage(world, now, mutationScope);
    const plan = prepareSegmentedWorldWrite(this, revision, world, now, mutationScope);
    if (!plan.changed) return { revision, plan };
    const nextRevision = applySegmentedWorldWrite(this, plan, world, now);
    return { revision: nextRevision, plan };
  }

  saveWorld(revision, world, now, mutationScope = createFullMutationScope()) {
    const persisted = this.persistSegmentedWorld(revision, world, now, mutationScope);
    flushAuctionAuditEvents(this, world, revision, persisted.revision);
    if (persisted.revision !== revision) {
      this.cacheWorld(persisted.revision, null, world, false, persisted.plan.snapshot);
    }
    if (!this.scheduledProcessing) this.nextWorldProcessingAt = now + WORLD_PROCESS_INTERVAL_MS;
    return persisted.revision;
  }

  saveWorldIfChanged(revision, world, now, _previousStateJson, mutationScope = createFullMutationScope()) {
    const persisted = this.persistSegmentedWorld(revision, world, now, mutationScope);
    flushAuctionAuditEvents(this, world, revision, persisted.revision);
    if (persisted.revision !== revision) {
      this.cacheWorld(persisted.revision, null, world, false, persisted.plan.snapshot);
    }
    return persisted.revision;
  }`,
);

replaceOnce(
  'server/src/runtime-store.js',
  "import { EconomyStore as CoreEconomyStore } from './runtime-store-core.js';",
  "import { EconomyStore as CoreEconomyStore } from './runtime-store-core.js';\nimport { cloneWorldForMutation } from './world-storage-v2.js';",
);
replaceOnce(
  'server/src/runtime-store.js',
  `  cacheWorld(revision, stateJson, world, needsPersistence = false) {
    const nextRevision = Number(revision);
    if (this.worldCache?.revision !== nextRevision) this.clientStateProjectionCache.clear();
    this.worldCache = {
      revision: nextRevision,
      stateJson,
      world,
      needsPersistence: Boolean(needsPersistence),
    };
  }

  loadWorld(now) {
    if (!this.worldCache) return super.loadWorld(now);
    const canParseCanonicalState = !this.worldCache.needsPersistence
      && typeof this.worldCache.stateJson === 'string'
      && this.worldCache.stateJson.length > 0;
    return {
      revision: this.worldCache.revision,
      stateJson: this.worldCache.stateJson,
      world: canParseCanonicalState
        ? measureRequestPhase('worldDraftParseMs', () => JSON.parse(this.worldCache.stateJson))
        : measureRequestPhase('worldDraftCloneMs', () => structuredClone(this.worldCache.world)),
    };
  }`,
  `  cacheWorld(revision, stateJson, world, needsPersistence = false, segmentedSnapshot = null) {
    const nextRevision = Number(revision);
    if (this.worldCache?.revision !== nextRevision) this.clientStateProjectionCache.clear();
    this.worldCache = {
      revision: nextRevision,
      stateJson,
      world,
      needsPersistence: Boolean(needsPersistence),
      segmentedSnapshot: segmentedSnapshot || this.worldCache?.segmentedSnapshot || null,
      storageSchemaVersion: 2,
    };
  }

  loadWorld(now, mutationScope = null) {
    if (!this.worldCache) return super.loadWorld(now);
    return {
      revision: this.worldCache.revision,
      stateJson: null,
      world: mutationScope
        ? measureRequestPhase('worldDraftCowMs', () => cloneWorldForMutation(this.worldCache.world, mutationScope))
        : measureRequestPhase('worldDraftCloneMs', () => structuredClone(this.worldCache.world)),
    };
  }`,
);

replaceOnce(
  'server/src/money.js',
  `export function normalizeWorldMoneyPrecision(world) {
  if (!world || typeof world !== 'object') return world;`,
  `export function normalizeWorldMoneyPrecisionScoped(world, scope = {}) {
  if (!world || typeof world !== 'object') return world;
  const allPlayers = Boolean(scope.allPlayers || scope.playerIds === null);
  const allSegments = Boolean(scope.allSegments || scope.segments === null);
  if (Number(world.moneyPrecision?.version || 0) < MONEY_PRECISION_VERSION) {
    if (!allPlayers || !allSegments) {
      throw new Error('分区资金规范化要求世界先完成冷迁移');
    }
    return normalizeWorldMoneyPrecision(world);
  }

  world.moneyPrecision ||= { version: MONEY_PRECISION_VERSION, roundingReserveMicros: 0 };
  world.moneyPrecision.version = MONEY_PRECISION_VERSION;
  world.moneyPrecision.roundingReserveMicros = 0;

  if (allPlayers) {
    for (const player of Object.values(world.players || {})) normalizePlayer(world, player);
  } else {
    for (const id of scope.playerIds || []) {
      const player = world.players?.[String(id)];
      if (player) normalizePlayer(world, player);
    }
  }

  const segments = allSegments ? null : new Set(scope.segments || []);
  const has = (...keys) => allSegments || keys.some((key) => segments.has(key));
  if (has('orders')) normalizeOrders(world);
  if (has('markets', 'facilityMarkets')) normalizeMarkets(world);
  if (has('assetAuctions')) normalizeAuctions(world);
  if (has('productionContracts')) normalizeContracts(world);
  if (has('auctionFeeEscrowCredits')) {
    world.auctionFeeEscrowCredits = Math.max(0, roundInternalMoney(world.auctionFeeEscrowCredits || 0) || 0);
  }
  if (has('populationEconomy')) quantizeInternalTree(world.populationEconomy);
  if (has('marketDemand')) quantizeInternalTree(world.marketDemand);
  if (has('bank') && world.bank) {
    world.bank.interestPoolMicros = Math.max(0, Math.trunc(Number(world.bank.interestPoolMicros || 0)));
    quantizeInternalTree(world.bank);
  }
  return world;
}

export function normalizeWorldMoneyPrecision(world) {
  if (!world || typeof world !== 'object') return world;`,
);

replaceOnce(
  'server/src/economic-mutation.js',
  `export function assertEconomicStateInvariants(world) {
  if (!world || typeof world !== 'object') throw new Error('经济状态不变量失败：世界状态无效');
  assertFiniteNonNegative(world.auctionFeeEscrowCredits, '拍卖发布费托管');

  for (const [userId, player] of Object.entries(world.players || {})) {
    assertFiniteNonNegative(player?.credits, \`玩家 \${userId} 可用资金\`);
    assertFiniteNonNegative(player?.frozenCredits, \`玩家 \${userId} 冻结资金\`);
    assertSafeQuantity(player?.gems, \`玩家 \${userId} 宝石\`);

    for (const [productId, inventory] of Object.entries(player?.inventories || {})) {
      assertSafeQuantity(inventory?.available, \`玩家 \${userId} \${productId} 可用库存\`);
      assertSafeQuantity(inventory?.frozen, \`玩家 \${userId} \${productId} 冻结库存\`);
    }

    for (const group of player?.facilityGroups || []) {
      const facilityId = String(group?.facilityTypeId || 'unknown');
      assertSafeQuantity(group?.count, \`玩家 \${userId} \${facilityId} 工厂数量\`);
      assertSafeQuantity(group?.participatingCount, \`玩家 \${userId} \${facilityId} 参与生产数量\`);
      if (group?.pendingJoinCount !== undefined) {
        assertSafeQuantity(group.pendingJoinCount, \`玩家 \${userId} \${facilityId} 待加入数量\`);
      }
    }

    const bank = player?.bankAccount;
    if (bank && typeof bank === 'object') {
      assertFiniteNonNegative(bank.depositCredits, \`玩家 \${userId} 银行存款\`);
      for (const loan of bank.loans || []) {
        assertFiniteNonNegative(loan?.principalRemaining ?? loan?.principalCredits, \`玩家 \${userId} 贷款本金\`);
        assertFiniteNonNegative(loan?.interestRemaining ?? 0, \`玩家 \${userId} 贷款利息\`);
      }
    }
  }

  return true;
}`,
  `function assertPlayerEconomicState(userId, player) {
  assertFiniteNonNegative(player?.credits, \`玩家 \${userId} 可用资金\`);
  assertFiniteNonNegative(player?.frozenCredits, \`玩家 \${userId} 冻结资金\`);
  assertSafeQuantity(player?.gems, \`玩家 \${userId} 宝石\`);

  for (const [productId, inventory] of Object.entries(player?.inventories || {})) {
    assertSafeQuantity(inventory?.available, \`玩家 \${userId} \${productId} 可用库存\`);
    assertSafeQuantity(inventory?.frozen, \`玩家 \${userId} \${productId} 冻结库存\`);
  }

  for (const group of player?.facilityGroups || []) {
    const facilityId = String(group?.facilityTypeId || 'unknown');
    assertSafeQuantity(group?.count, \`玩家 \${userId} \${facilityId} 工厂数量\`);
    assertSafeQuantity(group?.participatingCount, \`玩家 \${userId} \${facilityId} 参与生产数量\`);
    if (group?.pendingJoinCount !== undefined) {
      assertSafeQuantity(group.pendingJoinCount, \`玩家 \${userId} \${facilityId} 待加入数量\`);
    }
  }

  const bank = player?.bankAccount;
  if (bank && typeof bank === 'object') {
    assertFiniteNonNegative(bank.depositCredits, \`玩家 \${userId} 银行存款\`);
    for (const loan of bank.loans || []) {
      assertFiniteNonNegative(loan?.principalRemaining ?? loan?.principalCredits, \`玩家 \${userId} 贷款本金\`);
      assertFiniteNonNegative(loan?.interestRemaining ?? 0, \`玩家 \${userId} 贷款利息\`);
    }
  }
}

export function assertEconomicStateInvariantsScoped(world, scope = {}) {
  if (!world || typeof world !== 'object') throw new Error('经济状态不变量失败：世界状态无效');
  if (scope.includeAuctionEscrow !== false) {
    assertFiniteNonNegative(world.auctionFeeEscrowCredits, '拍卖发布费托管');
  }
  const allPlayers = Boolean(scope.allPlayers || scope.playerIds === null);
  if (allPlayers) {
    for (const [userId, player] of Object.entries(world.players || {})) assertPlayerEconomicState(userId, player);
  } else {
    for (const id of scope.playerIds || []) {
      const player = world.players?.[String(id)];
      if (player) assertPlayerEconomicState(String(id), player);
    }
  }
  return true;
}

export function assertEconomicStateInvariants(world) {
  return assertEconomicStateInvariantsScoped(world, {
    allPlayers: true,
    playerIds: null,
    includeAuctionEscrow: true,
  });
}`,
);

replaceOnce(
  'server/src/runtime-action-executor.js',
  "import { assertEconomicStateInvariants, beginEconomicSavepoint } from './economic-mutation.js';",
  "import { assertEconomicStateInvariants, assertEconomicStateInvariantsScoped, beginEconomicSavepoint } from './economic-mutation.js';",
);
replaceOnce(
  'server/src/runtime-action-executor.js',
  "import { ensureWarehouse } from './warehouse.js';",
  "import { ensureWarehouse } from './warehouse.js';\nimport { createRuntimeMutationScope } from './world-storage-v2.js';",
);
replaceOnce(
  'server/src/runtime-action-executor.js',
  'function executeActionBody(store, world, user, action, payload, requestKey, now) {',
  'function executeActionBody(store, world, user, action, payload, requestKey, now, mutationScope) {',
);
replaceOnce(
  'server/src/runtime-action-executor.js',
  "      measureRequestPhase('economicInvariantMs', () => assertEconomicStateInvariants(world));",
  "      measureRequestPhase('economicInvariantMs', () => assertEconomicStateInvariantsScoped(world, mutationScope));",
);
replaceOnce(
  'server/src/runtime-action-executor.js',
  `  const payload = normalizePlayerMoneyPayload(action, requestMeta.payload);

  return store.transaction(() => {`,
  `  const payload = normalizePlayerMoneyPayload(action, requestMeta.payload);
  const mutationScope = createRuntimeMutationScope(
    store.worldCache?.world,
    user.id,
    action,
    payload,
    { scheduledProcessing: store.scheduledProcessing },
  );

  return store.transaction(() => {`,
);
replaceOnce(
  'server/src/runtime-action-executor.js',
  '    const { revision, stateJson, world } = store.loadWorld(now);',
  '    const { revision, stateJson, world } = store.loadWorld(now, mutationScope);',
);
replaceOnce(
  'server/src/runtime-action-executor.js',
  `      requestKey,
      now,
    );`,
  `      requestKey,
      now,
      mutationScope,
    );`,
);
replaceOnce(
  'server/src/runtime-action-executor.js',
  '    const nextRevision = store.saveWorldIfChanged(revision, world, now, stateJson);',
  '    const nextRevision = store.saveWorldIfChanged(revision, world, now, stateJson, mutationScope);',
);

replaceOnce(
  'server/src/runtime-store-core.js',
  "import {\n  dueWorldDeadlineDomains,\n  worldDeadlineRuntimeFor,\n} from './world-deadline-runtime.js';",
  "import {\n  dueWorldDeadlineDomains,\n  worldDeadlineRuntimeFor,\n} from './world-deadline-runtime.js';\nimport {\n  applySegmentedWorldWrite,\n  createFullMutationScope,\n  prepareSegmentedWorldWrite,\n} from './world-storage-v2.js';",
);
replaceOnce(
  'server/src/runtime-store-core.js',
  `  _persistWorldWithContractAudit(revision, world, now) {
    this.finalizeWorldForStorage(world, now);
    const cached = this.worldCache;
    const unchanged = cached
      && cached.revision === revision
      && !cached.needsPersistence
      && measureRequestPhase('worldEqualityMs', () => isDeepStrictEqual(world, cached.world));
    if (unchanged) {
      this.flushContractAuditEvents(world, revision, revision);
      flushAuctionAuditEvents(this, world, revision, revision);
      return revision;
    }

    world.lastProcessedAt = now;
    const stateJson = measureRequestPhase('serializeWorldMs', () => JSON.stringify(world));
    const nextRevision = revision + 1;
    measureRequestPhase('worldUpdateMs', () => this.updateWorld.run(nextRevision, stateJson, now));
    this.flushContractAuditEvents(world, revision, nextRevision);
    flushAuctionAuditEvents(this, world, revision, nextRevision);
    this.cacheWorld(nextRevision, stateJson, world);
    return nextRevision;
  }

  saveWorld(revision, world, now) {
    return this._persistWorldWithContractAudit(revision, world, now);
  }

  saveWorldIfChanged(revision, world, now, _previousStateJson) {
    return this._persistWorldWithContractAudit(revision, world, now);
  }`,
  `  _persistWorldWithContractAudit(revision, world, now, mutationScope = createFullMutationScope()) {
    this.finalizeWorldForStorage(world, now, mutationScope);
    const plan = prepareSegmentedWorldWrite(this, revision, world, now, mutationScope);
    if (!plan.changed) {
      this.flushContractAuditEvents(world, revision, revision);
      flushAuctionAuditEvents(this, world, revision, revision);
      return revision;
    }

    const nextRevision = applySegmentedWorldWrite(this, plan, world, now);
    this.flushContractAuditEvents(world, revision, nextRevision);
    flushAuctionAuditEvents(this, world, revision, nextRevision);
    this.cacheWorld(nextRevision, null, world, false, plan.snapshot);
    return nextRevision;
  }

  saveWorld(revision, world, now, mutationScope = createFullMutationScope()) {
    return this._persistWorldWithContractAudit(revision, world, now, mutationScope);
  }

  saveWorldIfChanged(revision, world, now, _previousStateJson, mutationScope = createFullMutationScope()) {
    return this._persistWorldWithContractAudit(revision, world, now, mutationScope);
  }`,
);

console.log('segmented world storage v2 core integration applied');
