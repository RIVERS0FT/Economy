import { readFileSync, writeFileSync } from 'node:fs';

function read(path) {
  return readFileSync(path, 'utf8');
}

function write(path, content) {
  writeFileSync(path, content, 'utf8');
}

function replaceOnce(path, pattern, replacement, label) {
  const source = read(path);
  const matches = source.match(pattern);
  if (!matches) throw new Error(`${path}: missing patch target: ${label}`);
  const next = source.replace(pattern, replacement);
  if (next === source) throw new Error(`${path}: patch made no change: ${label}`);
  write(path, next);
}

function replaceLiteral(path, before, after, label) {
  const source = read(path);
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`${path}: missing literal patch target: ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`${path}: ambiguous literal patch target: ${label}`);
  }
  write(path, source.slice(0, first) + after + source.slice(first + before.length));
}

// A persisted canonical JSON string is already available for every committed revision.
// Parse that string for ordinary write drafts instead of structuredClone-ing the very large
// committed object. Keep structuredClone only for the rare cache state that still needs persistence.
replaceLiteral(
  'server/src/runtime-store.js',
  `    this.schedulerBarrierPromise = null;\n    this.stateProjectionCacheIsolationDepth = 0;\n`,
  `    this.schedulerBarrierPromise = null;\n`,
  'remove projection isolation depth',
);
replaceOnce(
  'server/src/runtime-store.js',
  /\n  committedWorldForCache\(world\) \{[\s\S]*?\n  \}\n\n  cacheWorld/,
  `\n  cacheWorld`,
  'remove cache isolation clone helper',
);
replaceLiteral(
  'server/src/runtime-store.js',
  `      world: this.committedWorldForCache(world),\n`,
  `      world,\n`,
  'commit world by reference after successful persistence',
);
replaceOnce(
  'server/src/runtime-store.js',
  /  loadWorld\(now\) \{\n    if \(!this\.worldCache\) return super\.loadWorld\(now\);\n    return \{\n      revision: this\.worldCache\.revision,\n      stateJson: this\.worldCache\.stateJson,\n      world: measureRequestPhase\('worldDraftCloneMs', \(\) => structuredClone\(this\.worldCache\.world\)\),\n    \};\n  \}/,
  `  loadWorld(now) {\n    if (!this.worldCache) return super.loadWorld(now);\n    const canParseCanonicalState = !this.worldCache.needsPersistence\n      && typeof this.worldCache.stateJson === 'string'\n      && this.worldCache.stateJson.length > 0;\n    return {\n      revision: this.worldCache.revision,\n      stateJson: this.worldCache.stateJson,\n      world: canParseCanonicalState\n        ? measureRequestPhase('worldDraftParseMs', () => JSON.parse(this.worldCache.stateJson))\n        : measureRequestPhase('worldDraftCloneMs', () => structuredClone(this.worldCache.world)),\n    };\n  }`,
  'parse canonical JSON for write draft',
);
replaceOnce(
  'server/src/runtime-store.js',
  /\n  getStateSnapshot\(user, knownRevision, now = Date\.now\(\)\) \{[\s\S]*?\n  \}\n\n  trackSchedulerBarrier/,
  `\n  trackSchedulerBarrier`,
  'remove projection isolation wrapper',
);
replaceOnce(
  'server/src/runtime-store.js',
  /\/\/ committedWorldForCache\(world\)\n\/\/ stateProjectionCacheIsolationDepth\n\/\/ worldCacheIsolationCloneMs\n/,
  '',
  'remove obsolete architecture markers',
);

// The base state builder is now explicitly usable as a read-only projection helper.
replaceLiteral(
  'server/src/storage.js',
  `function createVersionedClientState(world, userId, now, checkIn) {\n  const player = world.players[String(userId)];\n  ensureWarehouse(player);\n  ensureGemState(player);\n`,
  `export function createVersionedClientState(world, userId, now, checkIn) {\n  const player = world.players[String(userId)];\n`,
  'export pure client-state builder',
);
replaceOnce(
  'server/src/storage.js',
  /  canReuseStateProjection\(userId, now = Date\.now\(\)\) \{\n    return Boolean\(\n      this\.worldCache\n      && \(this\.scheduledProcessing \|\| now < this\.nextWorldProcessingAt\)\n      && !playerNeedsWeeklyLoginSettlement\(this\.worldCache\.world\.players\?\.\[String\(userId\)\], now\)\n    \);\n  \}/,
  `  canReuseStateProjection(userId, now = Date.now()) {\n    const player = this.worldCache?.world?.players?.[String(userId)];\n    return Boolean(\n      this.worldCache\n      && player\n      && (this.scheduledProcessing || now < this.nextWorldProcessingAt)\n      && !playerNeedsWeeklyLoginSettlement(player, now)\n    );\n  }`,
  'require existing player for committed-state projection',
);

// Avoid the legacy migration entrypoint when createClientState is used by the formal runtime projection.
replaceLiteral(
  'server/src/domain-core.js',
  `export function createClientState(world, userId, now = Date.now()) {\n  migrateWorld(world, now);\n`,
  `export function createClientState(world, userId, now = Date.now(), { migrate = true } = {}) {\n  if (migrate) migrateWorld(world, now);\n`,
  'make domain client migration optional',
);
replaceLiteral(
  'server/src/facility-groups.js',
  `export function createFacilityGroupClientState(world, userId, now = Date.now()) {\n  migrateFacilityGroupWorld(world, now);\n  const base = withLegacyFacilitiesSuppressed(world, () => createClientState(world, userId, now));\n`,
  `export function createFacilityGroupClientState(world, userId, now = Date.now()) {\n  const base = createClientState(world, userId, now, { migrate: false });\n`,
  'remove facility migration from client projection',
);

// Read-only summaries must not normalize authoritative objects while serving GET state.
replaceLiteral(
  'server/src/warehouse.js',
  `export function createWarehouseSummary(player) {\n  ensureWarehouse(player);\n  return {\n`,
  `export function createWarehouseSummary(player) {\n  return {\n`,
  'make warehouse summary read-only',
);
replaceLiteral(
  'server/src/asset-auctions.js',
  `export function createAssetAuctionClientState(world, userId, now = Date.now()) {\n  processAssetAuctions(world, now);\n  return {\n`,
  `export function createAssetAuctionClientState(world, userId, _now = Date.now()) {\n  return {\n`,
  'remove auction settlement from client projection',
);
replaceLiteral(
  'server/src/contracts.js',
  `export function createProductionContractClientState(world, userId, now = Date.now()) {\n  const runtimeIndex = processProductionContractsWithIndex(world, now);\n`,
  `export function createProductionContractClientState(world, userId, now = Date.now()) {\n  const runtimeIndex = createContractRuntimeIndex(world);\n`,
  'remove contract processing from client projection',
);
replaceOnce(
  'server/src/contract-runtime-index.js',
  /export function createContractRuntimeIndex\(world\) \{\n  world\.productionContracts \|\|= \[\];\n  const contracts = world\.productionContracts;/,
  `export function createContractRuntimeIndex(world) {\n  const contracts = Array.isArray(world?.productionContracts) ? world.productionContracts : [];`,
  'make contract runtime index construction read-only',
);

replaceLiteral(
  'server/src/weekly-cash-settlement.js',
  `export function createWeeklyCashSettlementClientState(world, player, now = Date.now()) {\n  const worldState = ensureWeeklyCashSettlementWorld(world, now);\n  const playerState = ensurePlayerWeeklyCashSettlement(player, now);\n`,
  `export function createWeeklyCashSettlementClientState(world, player, now = Date.now()) {\n  const worldState = world?.weeklyCashSettlement && typeof world.weeklyCashSettlement === 'object'\n    ? world.weeklyCashSettlement\n    : defaultWorldState(now);\n  const playerState = player?.weeklyCashSettlement && typeof player.weeklyCashSettlement === 'object'\n    ? player.weeklyCashSettlement\n    : defaultPlayerState(now);\n`,
  'make weekly settlement client state read-only',
);

replaceLiteral(
  'server/src/banking.js',
  `export function mortgagedFacilityQuantity(player, facilityTypeId) {\n  const loan = ensurePlayerBankAccount(player).activeLoan;\n`,
  `export function mortgagedFacilityQuantity(player, facilityTypeId) {\n  const loan = player?.bankAccount?.activeLoan || null;\n`,
  'read mortgage without bank normalization',
);
replaceLiteral(
  'server/src/banking.js',
  `export function activeLoanLiability(player) {\n  const loan = ensurePlayerBankAccount(player).activeLoan;\n`,
  `export function activeLoanLiability(player) {\n  const loan = player?.bankAccount?.activeLoan || null;\n`,
  'read loan liability without bank normalization',
);
replaceLiteral(
  'server/src/banking.js',
  `export function createBankClientState(world, player, now = Date.now()) {\n  const bank = ensureBankWorld(world, now);\n  const account = ensurePlayerBankAccount(player, now);\n`,
  `export function createBankClientState(world, player, now = Date.now()) {\n  const bank = world?.bank && typeof world.bank === 'object'\n    ? world.bank\n    : defaultBankWorld(now);\n  const account = player?.bankAccount && typeof player.bankAccount === 'object'\n    ? player.bankAccount\n    : defaultPlayerBankAccount(player, now);\n`,
  'make bank client state read-only',
);

replaceOnce(
  'server/src/research.js',
  /export function createResearchClientState\(world, player\) \{\n  const research = clone\(ensurePlayerResearch\(world, player\)\);/,
  `export function createResearchClientState(_world, player) {\n  const research = clone(\n    player?.research && typeof player.research === 'object'\n      ? player.research\n      : {\n          unlockedComplexity: 'C1',\n          completedTechnologyIds: RESEARCH_TECHNOLOGY_CATALOG\n            .filter((technology) => technology.initial)\n            .map((technology) => technology.id),\n          completedAtByTechnologyId: {},\n          completedAt: null,\n          active: null,\n        },\n  );`,
  'make research client state read-only',
);

// Leaderboard projection used to run migration/normalization helpers over all players.
// Keep those helpers for scheduled processing, but use a separate immutable view path for GET state.
replaceLiteral(
  'server/src/leaderboards.js',
  `import { activeLoanLiability, ensurePlayerBankAccount } from './banking.js';\n`,
  `import { activeLoanLiability } from './banking.js';\n`,
  'remove projection-time bank normalizer import',
);
replaceLiteral(
  'server/src/leaderboards.js',
  `  const cash = safeNonNegativeInteger(player.credits)\n    + safeNonNegativeInteger(player.frozenCredits)\n    + safeNonNegativeInteger(ensurePlayerBankAccount(player).depositCredits);\n`,
  `  const cash = safeNonNegativeInteger(player.credits)\n    + safeNonNegativeInteger(player.frozenCredits)\n    + safeNonNegativeInteger(player?.bankAccount?.depositCredits);\n`,
  'make operating assets bank read-only',
);
replaceLiteral(
  'server/src/leaderboards.js',
  `  const cash = safeNonNegativeInteger(player.credits)\n    + safeNonNegativeInteger(player.frozenCredits)\n    + safeNonNegativeInteger(ensurePlayerBankAccount(player).depositCredits);\n`,
  `  const cash = safeNonNegativeInteger(player.credits)\n    + safeNonNegativeInteger(player.frozenCredits)\n    + safeNonNegativeInteger(player?.bankAccount?.depositCredits);\n`,
  'make wealth assets bank read-only',
);
const leaderboardReadOnlyHelpers = `
const snapshotRowsCache = new WeakMap();

function readPlayerStats(player) {
  return player?.stats && typeof player.stats === 'object' ? player.stats : {};
}

function readSettledPersonalBest(player, boardId) {
  const best = readPlayerStats(player).leaderboardPersonalBests?.[boardId];
  const score = Number(best?.score);
  const periodKey = typeof best?.periodKey === 'string' ? best.periodKey : '';
  return Number.isFinite(score) && periodKey ? { score, periodKey } : null;
}

function readExternalCredits(player) {
  const stats = readPlayerStats(player);
  return safeNonNegativeInteger(stats.giftIssued)
    + safeNonNegativeInteger(stats.gemExchangeCredits)
    + safeNonNegativeInteger(stats.adminCreditsIssued);
}

function readPolicyAdjustment(player) {
  const stats = readPlayerStats(player);
  return Number(stats.bankDepositInterestEarned || 0)
    - Number(stats.weeklyCashSettlementBurned || 0)
    - Number(stats.weeklyCashSettlementReserveTransferred || 0);
}

function readOperatingAssets(player) {
  const cash = safeNonNegativeInteger(player?.credits)
    + safeNonNegativeInteger(player?.frozenCredits)
    + safeNonNegativeInteger(player?.bankAccount?.depositCredits);
  const commodity = PRODUCT_CATALOG.reduce((sum, product) => (
    sum + inventoryQuantity(player, product.id) * product.basePrice
  ), 0);
  const facilities = (player?.facilityGroups || []).reduce((sum, group) => {
    const facility = FACILITY_BY_ID.get(String(group.facilityTypeId || ''));
    return sum + (facility ? safeNonNegativeInteger(group.count) * facility.systemValue : 0);
  }, 0);
  return cash + commodity + facilities - activeLoanLiability(player) - weeklySettlementLiability(player);
}

function snapshotRowsFor(world, state, boardId) {
  return Object.values(world?.players || {}).map((player) => {
    const userId = String(player.userId);
    const common = {
      userId: player.userId,
      playerName: player.playerName,
      activityAt: leaderboardActivityAt(player),
    };
    if (boardId === 'wealth') {
      const score = wealthAssetsFor(world, player);
      return {
        ...common,
        score,
        secondary: safeNonNegativeInteger(player.credits) + safeNonNegativeInteger(player.frozenCredits),
        tertiary: 0,
      };
    }
    if (boardId === 'growth') {
      const currentAssets = readOperatingAssets(player);
      const currentExternalCredits = readExternalCredits(player);
      const currentPolicyAdjustment = readPolicyAdjustment(player);
      const openingAssetsValue = Number(state?.openingAssets?.[userId]);
      const openingExternalValue = Number(state?.openingExternalCredits?.[userId]);
      const openingPolicyValue = Number(state?.openingPolicyAdjustments?.[userId]);
      const openingAssets = Number.isFinite(openingAssetsValue) ? openingAssetsValue : currentAssets;
      const openingExternalCredits = Number.isFinite(openingExternalValue)
        ? openingExternalValue
        : currentExternalCredits;
      const openingPolicyAdjustment = Number.isFinite(openingPolicyValue)
        ? openingPolicyValue
        : currentPolicyAdjustment;
      const score = currentAssets
        - openingAssets
        - (currentExternalCredits - openingExternalCredits)
        - (currentPolicyAdjustment - openingPolicyAdjustment);
      return { ...common, score, secondary: currentAssets, tertiary: 0 };
    }
    if (boardId === 'production') {
      const production = state?.production?.[userId] || { score: 0, quantity: 0 };
      const quantity = safeNonNegativeInteger(production.quantity);
      return { ...common, score: quantity, secondary: 0, tertiary: 0 };
    }
    const trading = state?.trading?.[userId] || { score: 0, tradeCount: 0, buyers: {} };
    return {
      ...common,
      score: safeNonNegativeInteger(trading.score),
      secondary: safeNonNegativeInteger(trading.tradeCount),
      tertiary: Object.keys(trading.buyers || {}).length,
    };
  }).sort(compareLeaderboardRows).map((entry, index) => ({ ...entry, rank: index + 1 }));
}

function snapshotRowsByBoard(world, state) {
  const cached = snapshotRowsCache.get(world);
  if (cached?.state === state) return cached.rowsByBoard;
  const rowsByBoard = Object.fromEntries(BOARD_IDS.map((boardId) => [
    boardId,
    snapshotRowsFor(world, state, boardId),
  ]));
  snapshotRowsCache.set(world, { state, rowsByBoard });
  return rowsByBoard;
}
`;
replaceLiteral(
  'server/src/leaderboards.js',
  `function boardDefinition(boardId) {\n  if (boardId === 'wealth') return { title: '财富榜', description: '按最近订单簿成交价计算的实时总资产', unit: 'currency', rewarded: false };\n  if (boardId === 'growth') return { title: '增长榜', description: '本周经营资产净增长', unit: 'currency', rewarded: true };\n  if (boardId === 'production') return { title: '生产榜', description: '本周服务器确认完成的商品产出总数量', unit: 'quantity', rewarded: true };\n  return { title: '交易榜', description: '本周订单簿实际卖出成交额', unit: 'currency', rewarded: true };\n}\n\nexport function createLeaderboardSnapshot`,
  `function boardDefinition(boardId) {\n  if (boardId === 'wealth') return { title: '财富榜', description: '按最近订单簿成交价计算的实时总资产', unit: 'currency', rewarded: false };\n  if (boardId === 'growth') return { title: '增长榜', description: '本周经营资产净增长', unit: 'currency', rewarded: true };\n  if (boardId === 'production') return { title: '生产榜', description: '本周服务器确认完成的商品产出总数量', unit: 'quantity', rewarded: true };\n  return { title: '交易榜', description: '本周订单簿实际卖出成交额', unit: 'currency', rewarded: true };\n}\n${leaderboardReadOnlyHelpers}\nexport function createLeaderboardSnapshot`,
  'add read-only leaderboard projection helpers',
);
replaceOnce(
  'server/src/leaderboards.js',
  /export function createLeaderboardSnapshot\(world, currentUserId, now = Date\.now\(\)\) \{[\s\S]*?\n\}\n\nfunction awardPeriod/,
  `export function createLeaderboardSnapshot(world, currentUserId, now = Date.now()) {\n  const state = validLeaderboardState(world?.leaderboardState)\n    ? world.leaderboardState\n    : createEmptyPeriodState(leaderboardPeriodFor(now), true);\n  const rowsByBoard = snapshotRowsByBoard(world, state);\n  const boards = {};\n  for (const boardId of BOARD_IDS) {\n    const definition = boardDefinition(boardId);\n    const rows = rowsByBoard[boardId];\n    const rewardEnabled = definition.rewarded && !state.partial;\n    const current = rows.find((entry) => Number(entry.userId) === Number(currentUserId));\n    const currentPlayer = world?.players?.[String(currentUserId)];\n    const personalBest = currentPlayer ? readSettledPersonalBest(currentPlayer, boardId) : null;\n    boards[boardId] = {\n      id: boardId,\n      ...definition,\n      entries: rows.slice(0, LEADERBOARD_TOP_LIMIT).map((entry) => publicEntry(entry, currentUserId, rewardEnabled)),\n      currentPlayer: current ? publicEntry(current, currentUserId, rewardEnabled) : null,\n      totalPlayers: rows.length,\n      personalBest: personalBest ? {\n        ...personalBest,\n        currentIsRecord: !state.partial && Boolean(current) && Number(current.score) > personalBest.score,\n      } : null,\n    };\n  }\n  return {\n    period: {\n      key: state.periodKey,\n      startsAt: state.startsAt,\n      endsAt: state.endsAt,\n      partial: Boolean(state.partial),\n      rewardEnabled: !state.partial,\n      rewards: [...LEADERBOARD_REWARDS],\n      timeZone: LEADERBOARD_TIME_ZONE,\n    },\n    boards,\n  };\n}\n\nfunction awardPeriod`,
  'replace leaderboard projection with read-only path',
);

// On a cache miss, GET state now projects directly from the immutable committed world.
replaceLiteral(
  'server/src/runtime-store-core.js',
  `import { EconomyStore as PersistentEconomyStore } from './storage.js';\n`,
  `import { EconomyStore as PersistentEconomyStore, createVersionedClientState } from './storage.js';\n`,
  'import pure base state builder',
);
replaceOnce(
  'server/src/runtime-store-core.js',
  /function contractProjectionForState\(world\) \{[\s\S]*?\n\}\n\nfunction contractSnapshot/,
  `function contractSnapshot`,
  'remove cloned contract projection world',
);
replaceOnce(
  'server/src/runtime-store-core.js',
  /  getStateSnapshot\(user, knownRevision, now = Date\.now\(\)\) \{[\s\S]*?\n  \}\n\n  listOrderHistory/,
  `  getStateSnapshot(user, knownRevision, now = Date.now()) {\n    const currentRevision = this.worldCache?.revision;\n    if (currentRevision !== undefined && this.canReuseStateProjection(user.id, now)) {\n      if (Number.isInteger(knownRevision) && knownRevision === currentRevision) {\n        setRequestGauge('stateProjectionCacheHit', 1);\n        return { revision: currentRevision, unchanged: true };\n      }\n      const cachedProjection = this.cachedStateProjection(user.id, currentRevision);\n      if (cachedProjection) {\n        setRequestGauge('stateProjectionCacheHit', 1);\n        return cachedProjection;\n      }\n\n      const world = this.worldCache.world;\n      const player = world.players?.[String(user.id)];\n      if (player) {\n        setRequestGauge('stateProjectionCacheHit', 0);\n        const baseState = measureRequestPhase('stateProjectionMs', () => createVersionedClientState(\n          world,\n          Number(user.id),\n          now,\n          this.dailyCheckInSummaryFor(player, now),\n        ));\n        const contractState = measureRequestPhase('contractStateProjectionMs', () => (\n          createProductionContractClientState(world, Number(user.id), now)\n        ));\n        const state = filterStateForCurrentSave({\n          ...createStablePartitionClientState(baseState),\n          ...contractState,\n          economicCalendar: createEconomicCalendarClientState(now),\n        }, world, Number(user.id));\n        const partitionSnapshot = this.createClientPartitionSnapshot(state);\n        return this.rememberStateProjection(user.id, currentRevision, {\n          revision: currentRevision,\n          unchanged: false,\n          state,\n          ...partitionSnapshot,\n        });\n      }\n    }\n    setRequestGauge('stateProjectionCacheHit', 0);\n\n    const snapshot = super.getStateSnapshot(user, knownRevision, now);\n    if (snapshot.unchanged || !snapshot.state) return snapshot;\n\n    const cached = this.worldCache;\n    const contractState = cached && cached.revision === snapshot.revision\n      ? measureRequestPhase('contractStateProjectionMs', () => (\n          createProductionContractClientState(cached.world, Number(user.id), now)\n        ))\n      : this.transaction(() => {\n        const { world } = this.loadWorld(now);\n        return measureRequestPhase('contractStateProjectionMs', () => (\n          createProductionContractClientState(world, Number(user.id), now)\n        ));\n      }, { immediate: false });\n\n    const state = filterStateForCurrentSave({\n      ...createStablePartitionClientState(snapshot.state),\n      ...contractState,\n      economicCalendar: createEconomicCalendarClientState(now),\n    }, this.worldCache?.world, Number(user.id));\n    const partitionSnapshot = this.createClientPartitionSnapshot(state);\n    return this.rememberStateProjection(user.id, snapshot.revision, {\n      ...snapshot,\n      state,\n      ...partitionSnapshot,\n    });\n  }\n\n  listOrderHistory`,
  'project cache miss directly from committed world',
);

// Architecture regression test: canonical JSON draft + pure committed projection.
replaceOnce(
  'server/test/runtime-hotpath-architecture.test.js',
  /  assert\.match\(runtime, \/worldDraftCloneMs\/\);[\s\S]*?  assert\.match\(core, \/filterStateForCurrentSave\/\);/,
  `  assert.match(runtime, /worldDraftParseMs/);\n  assert.match(runtime, /JSON\\.parse\\(this\\.worldCache\\.stateJson\\)/);\n  assert.match(runtime, /worldDraftCloneMs/);\n  assert.doesNotMatch(cacheBody, /structuredClone/);\n  assert.doesNotMatch(runtime, /committedWorldForCache/);\n  assert.doesNotMatch(runtime, /stateProjectionCacheIsolationDepth/);\n  assert.doesNotMatch(runtime, /worldCacheIsolationCloneMs/);\n  assert.match(runtime, /ensureScheduledProcessingBarrier/);\n  assert.match(runtime, /schedulerBarrierPromise/);\n  assert.match(runtime, /schedulerBarrierWaitMs/);\n  assert.match(runtime, /settledSynchronously/);\n  assert.match(runtime, /captureRequestContext:\\s*false/);\n  assert.match(runtime, /return executeRuntimeAction\\(this, user, requestMeta, now\\)/);\n  assert.match(core, /filterStateForCurrentSave/);\n  assert.match(core, /createVersionedClientState/);\n  assert.match(core, /const world = this\\.worldCache\\.world/);\n  assert.doesNotMatch(core, /contractProjectionForState/);`,
  'update runtime architecture assertions',
);
replaceLiteral(
  'server/test/runtime-hotpath-architecture.test.js',
  `test('state projection cannot mutate the committed cache after persistence', () => {\n`,
  `test('committed state cache miss projects without a world draft or cache mutation', () => {\n  const store = new EconomyStore(':memory:', { scheduledProcessing: true });\n  try {\n    const now = 1_700_000_000_000;\n    store.getStateSnapshot(alice, undefined, now);\n    store.clientStateProjectionCache.clear();\n    const before = JSON.stringify(store.worldCache.world);\n    const originalLoadWorld = store.loadWorld.bind(store);\n    let loadWorldCalls = 0;\n    store.loadWorld = (...args) => {\n      loadWorldCalls += 1;\n      return originalLoadWorld(...args);\n    };\n\n    const snapshot = store.getStateSnapshot(alice, undefined, now + 500);\n    assert.equal(snapshot.unchanged, false);\n    assert.ok(snapshot.state);\n    assert.equal(loadWorldCalls, 0);\n    assert.equal(JSON.stringify(store.worldCache.world), before);\n  } finally {\n    store.stopScheduler();\n    store.close();\n  }\n});\n\ntest('canonical JSON write draft is isolated from the committed world', () => {\n  const store = new EconomyStore(':memory:');\n  try {\n    const now = 1_700_000_000_000;\n    store.getStateSnapshot(alice, undefined, now);\n    const committed = store.worldCache.world;\n    const loaded = store.loadWorld(now + 1);\n    assert.notEqual(loaded.world, committed);\n    assert.equal(JSON.stringify(loaded.world), store.worldCache.stateJson);\n    loaded.world.players[String(alice.id)].credits += 1;\n    assert.notEqual(loaded.world.players[String(alice.id)].credits, committed.players[String(alice.id)].credits);\n  } finally {\n    store.close();\n  }\n});\n\ntest('state projection cannot mutate the committed cache after persistence', () => {\n`,
  'add committed state projection and draft isolation tests',
);

// Update source-level anti-regression guard.
replaceLiteral(
  'scripts/verify-authoritative-hotpaths.mjs',
  `  'worldDraftCloneMs',\n  'ensureScheduledProcessingBarrier',\n`,
  `  'worldDraftParseMs',\n  'worldDraftCloneMs',\n  'createVersionedClientState',\n  'const world = this.worldCache.world',\n  'ensureScheduledProcessingBarrier',\n`,
  'guard canonical draft and committed projection',
);
replaceOnce(
  'scripts/verify-authoritative-hotpaths.mjs',
  /for \(const text of \[\n  'return executeRuntimeAction\(this, user, requestMeta, now\)',\n  'committedWorldForCache\(world\)',\n  'stateProjectionCacheIsolationDepth',\n  'worldCacheIsolationCloneMs',\n  'settledSynchronously',\n  'captureRequestContext: false',\n\]\) assert\.ok\(runtimeWrapper\.includes\(text\), `正式运行时编排层缺少: \$\{text\}`\);/,
  `for (const text of [\n  'return executeRuntimeAction(this, user, requestMeta, now)',\n  'worldDraftParseMs',\n  'JSON.parse(this.worldCache.stateJson)',\n  'settledSynchronously',\n  'captureRequestContext: false',\n]) assert.ok(runtimeWrapper.includes(text), \`正式运行时编排层缺少: \${text}\`);\nfor (const text of [\n  'committedWorldForCache(world)',\n  'stateProjectionCacheIsolationDepth',\n  'worldCacheIsolationCloneMs',\n  'contractProjectionForState',\n]) assert.equal(runtimeStore.includes(text), false, \`正式状态读取不得恢复投影克隆: \${text}\`);`,
  'replace isolation-clone guards with pure projection guards',
);
replaceLiteral(
  'scripts/verify-authoritative-hotpaths.mjs',
  `console.log('权威热路径验证通过：按领域截止时间推进、统一单草稿经济动作回滚、调度 barrier、状态投影缓存隔离、商品订单快速撮合、价格档位订单簿、六分区稳定根视图与客户端订单索引均受防回退约束。');\n`,
  `console.log('权威热路径验证通过：按领域截止时间推进、规范 JSON 单草稿经济动作、调度 barrier、只读 committed world 状态投影、商品订单快速撮合、价格档位订单簿、六分区稳定根视图与客户端订单索引均受防回退约束。');\n`,
  'update verifier success text',
);

// Record the new runtime rule in the authoritative design and index so later work cannot restore
// migration/settlement work in GET state or a full committed-world clone for every write.
replaceOnce(
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  /运行时内存状态必须区分\*\*已提交世界（committed world）\*\*与\*\*请求草稿（world draft）\*\*。[\s\S]*?经济活动判定只允许复制当前玩家自身的动作前快照；合同动作可额外复制合同集合用于变更判定和审计，不得复制第二份完整世界。/,
  `运行时内存状态必须区分**已提交世界（committed world）**与**请求草稿（world draft）**。正式服务命中内存缓存的普通玩家权威写只允许创建一份隔离请求草稿；当缓存已经持有与 committed world 对应的规范 \\`stateJson\\` 时，草稿必须优先通过一次 \\`JSON.parse(stateJson)\\` 构造，避免对大世界对象执行高成本 \\`structuredClone\\`，只有缓存仍标记 \\`needsPersistence\\`、规范 JSON 尚不可作为当前权威快照时才允许回退到完整克隆。SQLite 世界写入与对应合同／拍卖审计在同一事务成功后，请求草稿直接交接为新的 committed world。动作业务失败时，附属 SQLite 写入通过 \\`SAVEPOINT\\` 回滚，未提交请求草稿直接丢弃；玩家动作不得为了恢复世界再创建第二份完整世界快照。经济活动判定只允许复制当前玩家自身的动作前快照；合同动作可额外复制合同集合用于变更判定和审计，不得复制第二份完整世界。\n\n\\`GET state\\` 的正式投影路径必须是纯只读操作：已有玩家、无需登录周结算且后台调度启用时，缓存未命中也直接从 committed world 构造当前玩家状态、合同／拍卖／银行／研发／排行榜投影和六分区，不得创建 world draft，不得执行世界迁移、领域结算、全玩家兼容初始化或持久化，也不得再通过 \\`worldCacheIsolationCloneMs\\` 复制 committed world 来容忍投影写入。首次建档或登录周结算等确实需要写入的 GET 必须先完成权威事务，再从新 committed world 执行同一只读投影。`,
  'replace committed-world runtime rule',
);
replaceOnce(
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  /基础客户端快照生成后，合同分区必须复用同一修订号的内存缓存，只克隆合同计算可能修改的玩家、合同与人口经济投影；除首次建档、登录结算等 `GET state` 自身持久化后的缓存隔离副本外，同一次状态读取不得再开启第二次完整世界事务、完整世界克隆或对完整客户端状态执行第二次 JSON 往返规范化。/,
  `基础客户端快照生成后，合同、拍卖、银行、研发和排行榜分区必须复用同一 committed world 及其运行时派生索引，以只读方式生成客户端视图；同一次状态读取不得开启第二次完整世界事务、完整世界克隆、全玩家迁移／规范化或对完整客户端状态执行第二次 JSON 往返规范化。`,
  'replace projection-clone allowance',
);
replaceOnce(
  'docs/README.md',
  /67\. 世界冷加载迁移与热保存必须分离：[\s\S]*?\n68\./,
  `67. 世界冷加载迁移与热保存必须分离：完整世界迁移、旧字段补全和全玩家兼容初始化只允许在首次加载或版本升级时执行。正式运行时必须区分已提交世界与请求草稿；普通玩家权威写只允许一份请求草稿，已有规范 \\`stateJson\\` 时必须优先通过 \\`JSON.parse\\` 构造隔离草稿，只有缓存仍需持久化时才回退完整 \\`structuredClone\\`，成功持久化后草稿直接交接为新的已提交世界。正式 \\`GET state\\` 对已有玩家的缓存未命中路径必须直接从已提交世界执行纯只读投影，不得创建请求草稿、执行迁移／领域结算／全玩家初始化、写库或通过额外完整世界克隆容忍投影副作用；合同、拍卖、银行、研发和排行榜客户端状态同样必须只读生成。正式调度继续按同一修订号计划和实际到期领域推进，玩家写入到达已过期截止时间时先复用同一权威写执行器中的调度 barrier，动作主体不得重复承担同一轮全服推进。普通商品下单继续直接使用统一订单簿快速路径；普通动作热路径只允许一次最终资金精度收口和一次持久化判定，幂等记录过期清理最多每 5 分钟执行一次。以上规则归属 \\`SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md\\`，并由 \\`server/test/runtime-hot-path.test.js\\`、\\`server/test/authoritative-hotpaths.test.js\\`、\\`server/test/runtime-hotpath-architecture.test.js\\`、\\`scripts/verify-runtime-efficiency.mjs\\` 与 \\`scripts/verify-authoritative-hotpaths.mjs\\` 防回退。\n68.`,
  'update authoritative hotpath index rule',
);

console.log('API hotpath v2 patch applied');
