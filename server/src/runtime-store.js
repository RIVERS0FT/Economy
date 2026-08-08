import { isDeepStrictEqual } from 'node:util';
import { processBankWorld } from './banking.js';
import {
  applyPopulationPolicy,
  createPopulationAdminSummary,
  resetPopulationPolicy,
  topUpPopulationByPolicy,
} from './population-admin-control.js';
import { EconomyStore as PersistentEconomyStore } from './storage.js';
import { ensurePlayer } from './domain.js';
import { createOrderHistoryPage } from './facility-groups.js';
import {
  applyProductionContractAction,
  createProductionContractClientState,
  migrateProductionContractWorld,
  processProductionContracts,
} from './contracts.js';
import { configureContractAuditStore } from './contract-audit-store.js';
import {
  assertEconomicStateInvariants,
  beginEconomicSavepoint,
  createEconomicActionBoundary,
} from './economic-mutation.js';
import { ensureGemState } from './invitations.js';
import { processLeaderboardWorld } from './leaderboards.js';
import { configurePlayerAdminStatistics } from './player-admin-statistics.js';
import { processResearchWorld } from './research.js';
import { executeRuntimeAction } from './runtime-action-executor.js';
import { ensureWarehouse } from './warehouse.js';
import { createEconomicCalendarClientState } from './economic-events.js';
import { flushAuctionAuditEvents } from './auction-audit-store.js';
import { measureRequestPhase, setRequestGauge } from './request-performance.js';
import { createStatePartitionSnapshot } from './state-partitions.js';
import { processWeeklyCashSettlementWorld } from './weekly-cash-settlement.js';
import {
  dueWorldDeadlineDomains,
  worldDeadlineRuntimeFor,
} from './world-deadline-runtime.js';

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const WORLD_PROCESS_INTERVAL_MS = 1_000;
const ECONOMY_DEADLINE_DOMAINS = new Set([
  'facility',
  'market',
  'auction',
  'leaderboard',
  'checkIn',
  'orderPrune',
]);
const CONTRACT_ACTIONS = new Set([
  'createProductionContract',
  'acceptProductionContract',
  'proposeProductionContractNegotiation',
  'counterProductionContractNegotiation',
  'acceptProductionContractNegotiation',
  'rejectProductionContractNegotiation',
  'revokeProductionContractNegotiation',
  'cancelProductionContract',
  'prepareProductionContract',
  'fundProductionContract',
  'setProductionContractAutoReserve',
  'setProductionContractAutoFund',
  'proposeProductionContractRenewal',
  'acceptProductionContractRenewal',
  'rejectProductionContractRenewal',
  'revokeProductionContractRenewal',
  'requestProductionContractTermination',
  'terminateProductionContractNow',
  'repayPlayerLoan',
  'setPlayerLoanAutoRepay',
  'fundFacilityLease',
  'setFacilityLeaseAutoFund',
]);

function normalizeJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function stableLegacyLeaderboard(entries) {
  if (!Array.isArray(entries)) return [];
  return entries.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return entry;
    const { updatedAt: _updatedAt, ...stableEntry } = entry;
    return stableEntry;
  });
}

function stableRankedLeaderboards(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const { generatedAt: _generatedAt, ...stableValue } = value;
  return stableValue;
}

function createStablePartitionClientState(state) {
  const stableState = {
    ...state,
    leaderboard: stableLegacyLeaderboard(state?.leaderboard),
  };
  const stats = state?.stats && typeof state.stats === 'object' && !Array.isArray(state.stats)
    ? { ...state.stats }
    : state?.stats;
  const leaderboards = stableRankedLeaderboards(state?.leaderboards ?? stats?.leaderboards);
  if (stats && typeof stats === 'object' && !Array.isArray(stats)) delete stats.leaderboards;
  stableState.stats = stats;
  delete stableState.leaderboards;
  if (leaderboards) stableState.leaderboards = leaderboards;
  return stableState;
}

function createActionAcknowledgement(result, revision) {
  return normalizeJson({
    result: {
      ok: result?.ok === true,
      message: String(result?.message || ''),
    },
    revision: Number(revision),
  });
}

function contractProjectionForState(world) {
  const projection = {
    ...world,
    players: structuredClone(world.players || {}),
    productionContracts: structuredClone(world.productionContracts || []),
  };
  if (world.populationEconomy !== undefined) {
    projection.populationEconomy = structuredClone(world.populationEconomy);
  }
  return projection;
}

function contractSnapshot(world) {
  return structuredClone(world.productionContracts || []);
}

function playerSaveMetadata(world, userId) {
  const player = world?.players?.[String(userId)];
  return {
    saveEpoch: Math.max(0, Math.floor(Number(player?.saveEpoch || 0))),
    saveCreatedAt: Math.max(0, Number(player?.saveCreatedAt || 0)),
  };
}

function currentSaveWorld(world, userId) {
  const { saveCreatedAt } = playerSaveMetadata(world, userId);
  if (!saveCreatedAt) return world;
  return {
    ...world,
    orders: (world.orders || []).filter((order) => (
      Number(order?.ownerId) !== Number(userId)
      || ['open', 'partial'].includes(order?.status)
      || Number(order?.createdAt || 0) >= saveCreatedAt
    )),
  };
}

// Order history remains sourced from createOrderHistoryPage(this.worldCache.world after current-save filtering.
function filterStateForCurrentSave(state, world, userId) {
  const { saveEpoch, saveCreatedAt } = playerSaveMetadata(world, userId);
  const filtered = { ...state, saveEpoch };
  if (!saveCreatedAt) return filtered;
  filtered.orders = (filtered.orders || []).filter((order) => (
    !order?.isOwn
    || ['open', 'partial'].includes(order?.status)
    || Number(order?.createdAt || 0) >= saveCreatedAt
  ));
  filtered.productionContracts = (filtered.productionContracts || []).filter((contract) => (
    ['open', 'active'].includes(contract?.status)
    || !(contract?.isPublisher || contract?.isParticipant || contract?.isBuyer || contract?.isSupplier)
    || Number(contract?.endedAt || contract?.completedAt || contract?.createdAt || 0) >= saveCreatedAt
  ));
  filtered.assetAuctions = (filtered.assetAuctions || []).filter((auction) => (
    auction?.status === 'open'
    || !(auction?.isSeller || auction?.isHighestBidder || auction?.isOutbid)
    || Number(auction?.settledAt || auction?.createdAt || 0) >= saveCreatedAt
  ));
  return filtered;
}

function anyDueDomain(domains, candidates) {
  for (const domain of domains) if (candidates.has(domain)) return true;
  return false;
}

// Runtime policy mutations intentionally bypass the legacy population-policy audit table.
// The table remains readable only for backward-compatible retention of historical rows.
export class EconomyStore extends PersistentEconomyStore {
  constructor(...args) {
    super(...args);
    configureContractAuditStore(this);
    configurePlayerAdminStatistics(this);
  }

  scheduleWorldProcessing() {
    if (!this.scheduledProcessing || this.schedulerClosed) return null;
    this.clearWorldProcessingTimer();
    const now = Math.max(0, Number(this.nowProvider()) || 0);
    const planned = this.worldCache
      ? worldDeadlineRuntimeFor(this).planFor(
        this.worldCache.world,
        this.worldCache.revision,
        now,
      ).nextDueAt
      : now;
    if (planned === null) {
      this.nextWorldProcessingAt = Number.POSITIVE_INFINITY;
      this.schedulerDiagnostics.nextDueAt = null;
      return null;
    }
    const dueAt = Math.max(Number(planned), Number(this.schedulerNotBefore || 0));
    this.nextWorldProcessingAt = dueAt;
    this.schedulerDiagnostics.nextDueAt = dueAt;
    this.schedulerDiagnostics.schedules += 1;
    const generation = ++this.schedulerGeneration;
    const delay = Math.min(this.schedulerMaxDelayMs, Math.max(0, dueAt - now));
    this.processingTimer = this.setTimeoutFn(() => this.handleScheduledWorldWake(generation), delay);
    this.processingTimer?.unref?.();
    return dueAt;
  }

  getSchedulerDiagnostics() {
    return {
      ...super.getSchedulerDiagnostics(),
      deadlineRuntime: worldDeadlineRuntimeFor(this).getDiagnostics(),
    };
  }

  resetSchedulerDiagnostics() {
    super.resetSchedulerDiagnostics();
    worldDeadlineRuntimeFor(this).resetDiagnostics();
  }

  createClientPartitionSnapshot(state) {
    const snapshot = measureRequestPhase('partitionSnapshotMs', () => createStatePartitionSnapshot(state, {
      catalogSnapshot: this.catalogPartitionSnapshot,
    }));
    if (!this.catalogPartitionSnapshot) {
      this.catalogPartitionSnapshot = {
        version: snapshot.partitions.catalog?.version,
        partition: snapshot.partitions.catalog,
        revision: snapshot.partitionRevisions.catalog,
      };
    }
    return snapshot;
  }

  migrateLoadedWorld(world, now) {
    const prepared = super.migrateLoadedWorld(world, now);
    migrateProductionContractWorld(prepared);
    prepared.version = 26;
    return this.finalizeWorldForStorage(prepared, now);
  }

  _persistWorldWithContractAudit(revision, world, now) {
    this.finalizeWorldForStorage(world, now);
    const cached = this.worldCache;
    const unchanged = cached
      && cached.revision === revision
      && !cached.needsPersistence
      && isDeepStrictEqual(world, cached.world);
    if (unchanged) {
      this.flushContractAuditEvents(world, revision, revision);
      flushAuctionAuditEvents(this, world, revision, revision);
      return revision;
    }

    world.lastProcessedAt = now;
    const stateJson = JSON.stringify(world);
    const nextRevision = revision + 1;
    this.updateWorld.run(nextRevision, stateJson, now);
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
  }

  processWorldIfDue(world, now, currentUserId, options = {}) {
    const explicitForceDomains = Array.isArray(options.forceDomains);
    if (options.force && !explicitForceDomains) {
      const beforeContracts = contractSnapshot(world);
      const processed = super.processWorldIfDue(world, now, currentUserId, options);
      if (processed) {
        processProductionContracts(world, now);
        this.captureContractAuditTransition(beforeContracts, world, {
          triggerType: options.auditTrigger || (currentUserId === undefined ? 'scheduler' : 'request_world_process'),
          now,
        });
        assertEconomicStateInvariants(world);
      }
      worldDeadlineRuntimeFor(this).recordDueDomains(processed ? ['legacy-force'] : []);
      return processed;
    }

    const runtime = worldDeadlineRuntimeFor(this);
    const plan = runtime.planFor(world, this.worldCache?.revision, now, { force: true });
    const dueDomains = new Set(dueWorldDeadlineDomains(plan, now));
    for (const domain of options.forceDomains || []) dueDomains.add(String(domain));
    if (!options.force && now < this.nextWorldProcessingAt && dueDomains.size === 0) return false;
    if (dueDomains.size === 0) {
      runtime.recordDueDomains([]);
      return false;
    }

    let processed = false;
    measureRequestPhase('worldProcessMs', () => {
      if (anyDueDomain(dueDomains, ECONOMY_DEADLINE_DOMAINS)) {
        processLeaderboardWorld(world, now, {
          onGemReward: (reward) => this.recordGemLedgerEvent(reward),
        });
        processed = true;
      }
      if (dueDomains.has('bank')) {
        processBankWorld(world, now);
        processed = true;
      }
      if (dueDomains.has('weeklyCashSettlement')) {
        processWeeklyCashSettlementWorld(world, now);
        processed = true;
      }
      if (dueDomains.has('research')) {
        processResearchWorld(world, now);
        processed = true;
      }
      if (dueDomains.has('contract')) {
        const beforeContracts = contractSnapshot(world);
        processProductionContracts(world, now);
        this.captureContractAuditTransition(beforeContracts, world, {
          triggerType: options.auditTrigger || (currentUserId === undefined ? 'scheduler' : 'request_world_process'),
          now,
        });
        processed = true;
      }
    });

    if (processed) assertEconomicStateInvariants(world);
    runtime.recordDueDomains([...dueDomains]);
    if (this.scheduledProcessing) {
      this.schedulerNotBefore = Math.max(this.schedulerNotBefore, now + WORLD_PROCESS_INTERVAL_MS);
    } else {
      this.nextWorldProcessingAt = now + WORLD_PROCESS_INTERVAL_MS;
    }
    return processed;
  }

  getStateSnapshot(user, knownRevision, now = Date.now()) {
    const currentRevision = this.worldCache?.revision;
    if (currentRevision !== undefined && this.canReuseStateProjection(user.id, now)) {
      if (Number.isInteger(knownRevision) && knownRevision === currentRevision) {
        setRequestGauge('stateProjectionCacheHit', 1);
        return { revision: currentRevision, unchanged: true };
      }
      const cachedProjection = this.cachedStateProjection(user.id, currentRevision);
      if (cachedProjection) {
        setRequestGauge('stateProjectionCacheHit', 1);
        return cachedProjection;
      }
    }
    setRequestGauge('stateProjectionCacheHit', 0);

    const snapshot = super.getStateSnapshot(user, knownRevision, now);
    if (snapshot.unchanged || !snapshot.state) return snapshot;

    const cached = this.worldCache;
    const contractState = cached && cached.revision === snapshot.revision
      ? createProductionContractClientState(
        measureRequestPhase('contractProjectionCloneMs', () => contractProjectionForState(cached.world)),
        Number(user.id),
        now,
      )
      : this.transaction(() => {
        const { world } = this.loadWorld(now);
        return measureRequestPhase('contractStateProjectionMs', () => createProductionContractClientState(world, Number(user.id), now));
      }, { immediate: false });

    const state = filterStateForCurrentSave({
      ...createStablePartitionClientState(snapshot.state),
      ...normalizeJson(contractState),
      economicCalendar: normalizeJson(createEconomicCalendarClientState(now)),
    }, this.worldCache?.world, Number(user.id));
    const partitionSnapshot = this.createClientPartitionSnapshot(state);
    return this.rememberStateProjection(user.id, snapshot.revision, {
      ...snapshot,
      state,
      ...partitionSnapshot,
    });
  }

  listOrderHistory(user, options = {}, now = Date.now()) {
    if (this.worldCache?.world) {
      return measureRequestPhase('orderHistoryProjectionMs', () => (
        createOrderHistoryPage(currentSaveWorld(this.worldCache.world, Number(user.id)), Number(user.id), options)
      ));
    }
    return this.transaction(() => {
      const { world } = this.loadWorld(now);
      return measureRequestPhase('orderHistoryProjectionMs', () => (
        createOrderHistoryPage(currentSaveWorld(world, Number(user.id)), Number(user.id), options)
      ));
    }, { immediate: false });
  }

  apply(user, requestMeta, now = Date.now()) {
    if (!CONTRACT_ACTIONS.has(requestMeta.action)) return executeRuntimeAction(this, user, requestMeta, now);

    const {
      action,
      payload = {},
      requestKey,
      method,
      path,
    } = requestMeta;

    return this.transaction(() => {
      const cached = this.selectIdempotency.get(Number(user.id), requestKey);
      if (cached) {
        if (cached.request_method !== method || cached.request_path !== path) {
          const error = new Error('幂等键已被其他操作使用');
          error.statusCode = 409;
          throw error;
        }
        const cachedResponse = JSON.parse(String(cached.response_json));
        return createActionAcknowledgement(cachedResponse.result, cachedResponse.revision);
      }

      const { revision, stateJson, world } = this.loadWorld(now);
      const player = ensurePlayer(world, user, now);
      ensureWarehouse(player);
      ensureGemState(player);
      this.processWorldIfDue(world, now, Number(user.id), {
        force: true,
        forceDomains: [],
        auditTrigger: 'action_preprocess',
      });

      const boundary = createEconomicActionBoundary(world);
      const savepoint = beginEconomicSavepoint(this, 'economy_contract_action');
      const beforeActionPlayer = boundary.playerBefore(user.id);
      const beforeActionContracts = structuredClone(boundary.snapshot.productionContracts || []);
      let gameResult;
      try {
        gameResult = applyProductionContractAction(world, user, action, payload, now);
        if (gameResult?.ok) {
          boundary.assert();
          savepoint.release();
        } else {
          savepoint.rollback();
          boundary.rollback();
        }
      } catch (error) {
        try { savepoint.rollback(); } catch { /* outer transaction remains authoritative */ }
        boundary.rollback();
        throw error;
      }

      const activePlayer = world.players[String(user.id)];
      const actionChanged = activePlayer && (
        !isDeepStrictEqual(activePlayer, beforeActionPlayer)
        || !isDeepStrictEqual(world.productionContracts || [], beforeActionContracts)
      );
      if (gameResult?.ok && actionChanged) {
        activePlayer.lastEconomicActivityAt = now;
        this.captureContractAuditTransition(beforeActionContracts, world, {
          actorUserId: Number(user.id),
          triggerType: 'player_action',
          action,
          requestKey,
          now,
        });
      }

      const beforePostActionContracts = contractSnapshot(world);
      processProductionContracts(world, now);
      this.captureContractAuditTransition(beforePostActionContracts, world, {
        actorUserId: Number(user.id),
        triggerType: 'action_postprocess',
        action,
        requestKey,
        now,
      });
      assertEconomicStateInvariants(world);
      ensureWarehouse(world.players[String(user.id)]);
      ensureGemState(world.players[String(user.id)]);
      const nextRevision = this.saveWorldIfChanged(revision, world, now, stateJson);
      const response = createActionAcknowledgement(gameResult, nextRevision);
      this.insertIdempotency.run(
        Number(user.id),
        requestKey,
        method,
        path,
        JSON.stringify(response),
        now,
      );
      this.cleanupExpiredIdempotency(now);
      return response;
    });
  }

  updatePopulationPolicy(user, payload, requestMeta, now = Date.now()) {
    return this.adminMutation(user, requestMeta, () => {
      const { revision, stateJson, world } = this.loadWorld(now);
      this.processWorldIfDue(world, now, Number(user.id), { force: true });
      const result = applyPopulationPolicy(world, payload, { adminUserId: Number(user.id), now });
      const nextRevision = this.saveWorldIfChanged(revision, world, now, stateJson);
      return {
        policy: result.afterPolicy,
        populationEconomy: createPopulationAdminSummary(world, now),
        revision: nextRevision,
      };
    }, now);
  }

  resetPopulationPolicy(user, payload, requestMeta, now = Date.now()) {
    return this.adminMutation(user, requestMeta, () => {
      const { revision, stateJson, world } = this.loadWorld(now);
      this.processWorldIfDue(world, now, Number(user.id), { force: true });
      const result = resetPopulationPolicy(world, payload, { adminUserId: Number(user.id), now });
      const nextRevision = this.saveWorldIfChanged(revision, world, now, stateJson);
      return {
        policy: result.afterPolicy,
        populationEconomy: createPopulationAdminSummary(world, now),
        revision: nextRevision,
      };
    }, now);
  }

  topUpPopulation(user, payload, requestMeta, now = Date.now()) {
    return this.adminMutation(user, requestMeta, () => {
      const { revision, stateJson, world } = this.loadWorld(now);
      this.processWorldIfDue(world, now, Number(user.id), { force: true });
      const result = topUpPopulationByPolicy(world, payload, { now });
      const nextRevision = this.saveWorldIfChanged(revision, world, now, stateJson);
      return {
        ...result,
        populationEconomy: createPopulationAdminSummary(world, now),
        revision: nextRevision,
      };
    }, now);
  }
}
