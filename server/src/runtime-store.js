import { migrateCommodityFreezeSources } from './commodity-freeze-state.js';
import { isDeepStrictEqual } from 'node:util';
import { measureRequestPhase } from './request-performance.js';
import { executeRuntimeAction } from './runtime-action-executor.js';
import { EconomyStore as CoreEconomyStore } from './runtime-store-core.js';
import { ensurePlayer } from './domain.js';
import { installProvinceRuntimeAliases } from './provinces.js';
import { cloneWorldForMutation, createFullMutationScope } from './world-storage-v2.js';
import { settleProductionForDueContractParticipants, settleProductionForPlayerServerSide } from './production-settlement.js';
import {
  applyProductionContractAction,
  createProductionContractClientState,
  migrateProductionContractWorld,
  processProductionContracts,
} from './unified-contracts.js';
import { isDailySupplyContract, processDailySupplyContracts, withDailySupplyContext } from './daily-supply-contracts.js';
import {
  finalizeProductionOutputContracts,
  prepareProductionInputsForPlayer,
  productionInputSourcingRequired,
} from './production-input-sourcing.js';
import {
  assertEconomicStateInvariants,
  beginEconomicSavepoint,
  createEconomicActionBoundary,
} from './economic-mutation.js';
import { ensureGemState } from './invitations.js';
import { ensureWarehouse } from './warehouse.js';

const WORLD_PROCESS_INTERVAL_MS = 1_000;
const PRODUCTION_COLD_START_YIELD_MS = 1_000;
const RETIRED_FACILITY_GROUP_FIELDS = Object.freeze([
  'pendingJoinCount','pendingRecipeId','stopReason','cycleStaffingRateBps','cycleEffectiveCount','nextCycleStaffingRateBps','productionWageCarryNumerator','productionEmploymentTotalMicros','productionEmploymentAllocatedMicros','completedQuantity',
]);
const CONTRACT_ACTIONS = new Set([
  'createProductionContract','acceptProductionContract','proposeProductionContractNegotiation','counterProductionContractNegotiation','acceptProductionContractNegotiation','rejectProductionContractNegotiation','revokeProductionContractNegotiation','cancelProductionContract','prepareProductionContract','fundProductionContract','setProductionContractAutoReserve','setProductionContractAutoFund','proposeProductionContractRenewal','acceptProductionContractRenewal','rejectProductionContractRenewal','revokeProductionContractRenewal','requestProductionContractTermination','terminateProductionContractNow','repayPlayerLoan','setPlayerLoanAutoRepay','fundFacilityLease','setFacilityLeaseAutoFund',
]);

function needsFacilityColdCompatibilityMigration(world) {
  if (Array.isArray(world?.facilityListings) && world.facilityListings.length > 0) return true;
  for (const player of Object.values(world?.players || {})) {
    if (player?.facilityConstruction) return true;
    if (Array.isArray(player?.facilities) && player.facilities.length > 0) return true;
    for (const group of player?.facilityGroups || []) if (RETIRED_FACILITY_GROUP_FIELDS.some((field) => Object.hasOwn(group || {}, field))) return true;
  }
  return false;
}
function acknowledgement(result, revision) {
  return JSON.parse(JSON.stringify({ result: { ok: result?.ok === true, message: String(result?.message || '') }, revision: Number(revision) }));
}
function sameCachedRequest(cached, method, path) {
  if (!cached) return null;
  if (cached.request_method !== method || cached.request_path !== path) {
    const error = new Error('幂等键已被其他操作使用'); error.statusCode = 409; throw error;
  }
  const response = JSON.parse(String(cached.response_json));
  return acknowledgement(response.result, response.revision);
}

export class EconomyStore extends CoreEconomyStore {
  constructor(...args) {
    super(...args);
    this.schedulerBarrierPromise = null;
    if (this.scheduledProcessing && args[0] !== ':memory:' && !this.worldCache) {
      this.clearWorldProcessingTimer();
      const now = Math.max(0, Number(this.nowProvider()) || 0);
      this.nextWorldProcessingAt = now + PRODUCTION_COLD_START_YIELD_MS;
      this.schedulerDiagnostics.nextDueAt = this.nextWorldProcessingAt;
      const generation = ++this.schedulerGeneration;
      this.processingTimer = this.setTimeoutFn(() => this.handleScheduledWorldWake(generation), PRODUCTION_COLD_START_YIELD_MS);
      this.processingTimer?.unref?.();
    }
  }

  migrateLoadedWorld(world, now) {
    const migrated = super.migrateLoadedWorld(world, now);
    migrateProductionContractWorld(migrated, now);
    migrateCommodityFreezeSources(migrated);
    return migrated;
  }

  cacheWorld(revision, stateJson, world, needsPersistence = false, segmentedSnapshot = null) {
    const nextRevision = Number(revision);
    if (this.worldCache?.revision !== nextRevision) this.clientStateProjectionCache.clear();
    this.worldCache = { revision: nextRevision, stateJson, world: installProvinceRuntimeAliases(world), needsPersistence: Boolean(needsPersistence), segmentedSnapshot: segmentedSnapshot || this.worldCache?.segmentedSnapshot || null, storageSchemaVersion: 2 };
  }

  loadWorld(now, mutationScope = null) {
    if (!this.worldCache) {
      const loaded = super.loadWorld(now);
      if (!needsFacilityColdCompatibilityMigration(loaded.world)) return loaded;
      const world = this.migrateLoadedWorld(loaded.world, now);
      const revision = this.saveWorldIfChanged(loaded.revision, world, now, loaded.stateJson);
      return { revision, stateJson: null, world: measureRequestPhase('worldDraftCloneMs', () => installProvinceRuntimeAliases(structuredClone(world))) };
    }
    return { revision: this.worldCache.revision, stateJson: null, world: mutationScope ? measureRequestPhase('worldDraftCowMs', () => cloneWorldForMutation(this.worldCache.world, mutationScope)) : measureRequestPhase('worldDraftCloneMs', () => installProvinceRuntimeAliases(structuredClone(this.worldCache.world))) };
  }

  getStateSnapshot(user, knownRevision = null, now = Date.now(), options = {}) {
    const currentRevision = this.worldCache?.revision;
    if (currentRevision !== undefined && this.canReuseStateProjection(user.id, now)) {
      if (Number.isInteger(knownRevision) && Number(knownRevision) === Number(currentRevision)) {
        return { revision: Number(currentRevision), unchanged: true };
      }
      const cachedProjection = this.cachedStateProjection(user.id, currentRevision);
      if (cachedProjection) return cachedProjection;
    }
    const snapshot = super.getStateSnapshot(user, knownRevision, now, options);
    if (!snapshot || snapshot.unchanged || !snapshot.state) return snapshot;
    const project = (world) => {
      const contractState = createProductionContractClientState(world, Number(user.id), now);
      const state = { ...snapshot.state, ...contractState };
      const partitionSnapshot = this.createClientPartitionSnapshot(state);
      return this.rememberStateProjection(user.id, snapshot.revision, { ...snapshot, state, ...partitionSnapshot });
    };
    if (this.worldCache?.world) return project(this.worldCache.world);
    return this.transaction(() => project(this.loadWorld(now).world), { immediate: false });
  }

  trackSchedulerBarrier(barrier, { reschedule = true } = {}) {
    const settledSynchronously = this.authoritativeWriteExecutor.isIdle();
    const wrappedBarrier = barrier.finally(() => {
      if (this.schedulerBarrierPromise === wrappedBarrier) this.schedulerBarrierPromise = null;
      if (reschedule && !this.processingTimer && !this.schedulerClosed) this.scheduleWorldProcessing();
    });
    this.schedulerBarrierPromise = wrappedBarrier;
    if (settledSynchronously && reschedule && !this.processingTimer && !this.schedulerClosed) this.scheduleWorldProcessing();
    return wrappedBarrier;
  }

  handleScheduledWorldWake(generation) {
    if (this.schedulerClosed || generation !== this.schedulerGeneration) { this.schedulerDiagnostics.staleWakeups += 1; return; }
    this.processingTimer = null;
    const now = Math.max(0, Number(this.nowProvider()) || 0);
    this.schedulerDiagnostics.wakeups += 1;
    if (now < this.nextWorldProcessingAt) { this.schedulerDiagnostics.staleWakeups += 1; this.scheduleWorldProcessing(); return; }
    this.schedulerDiagnostics.processedWakeups += 1;
    this.schedulerDiagnostics.lastLagMs = Math.max(0, now - this.nextWorldProcessingAt);
    const barrier = this.authoritativeWriteExecutor.submit({ actor: 'system:scheduler', operation: 'scheduled-world-processing', allowWhenFull: true, timeoutMs: null, captureRequestContext: false, onSettled: (error) => { if (!error) return; this.schedulerNotBefore = Math.max(this.schedulerNotBefore, now + WORLD_PROCESS_INTERVAL_MS); console.error('Economy scheduled world processing failed', error); } }, () => this.processScheduledWorld(now));
    this.trackSchedulerBarrier(barrier).catch(() => {});
  }

  ensureScheduledProcessingBarrier() {
    if (!this.scheduledProcessing || this.schedulerClosed) return null;
    const now = Math.max(0, Number(this.nowProvider()) || 0);
    if (now < this.nextWorldProcessingAt) return null;
    if (this.schedulerBarrierPromise) return this.schedulerBarrierPromise;
    if (this.processingTimer) { this.clearWorldProcessingTimer(); this.schedulerGeneration += 1; }
    const barrier = this.authoritativeWriteExecutor.submit({ actor: 'system:scheduler-barrier', operation: 'scheduled-world-barrier', allowWhenFull: true, timeoutMs: null, captureRequestContext: false }, () => this.processScheduledWorld(now));
    return this.trackSchedulerBarrier(barrier);
  }

  processWorldIfDue(world, now, currentUserId, options = {}) {
    const beforeDaily = structuredClone(world.productionContracts || []);
    processDailySupplyContracts(world, now);
    const afterDaily = (world.productionContracts || []).filter(isDailySupplyContract);
    const dailyChanged = !isDeepStrictEqual(beforeDaily.filter(isDailySupplyContract), afterDaily);
    if (dailyChanged) this.captureContractAuditTransition(beforeDaily, world, { actorUserId: null, triggerType: 'scheduler', action: null, requestKey: null, now });

    const dailyContracts = afterDaily;
    const beforeCycles = structuredClone(dailyContracts);
    world.productionContracts = (world.productionContracts || []).filter((contract) => !isDailySupplyContract(contract));
    let legacyProcessed;
    try {
      legacyProcessed = withDailySupplyContext(world, dailyContracts, () => {
        settleProductionForDueContractParticipants(world, now);
        return super.processWorldIfDue(world, now, currentUserId, options);
      });
    } finally {
      const legacyContracts = world.productionContracts || [];
      world.productionContracts = [...legacyContracts, ...dailyContracts];
      this.captureContractAuditTransition([...legacyContracts, ...beforeCycles], world, {
        actorUserId: null, triggerType: 'production_output_reserve', action: null, requestKey: null, now,
      });
    }
    return legacyProcessed || dailyChanged || !isDeepStrictEqual(beforeCycles, dailyContracts);
  }

  prepareProductionInputs(user, requestMeta, now) {
    const cached = sameCachedRequest(this.selectIdempotency.get(Number(user.id), requestMeta.requestKey), requestMeta.method, requestMeta.path);
    if (cached) return { cached, baseline: null };
    const baseline = this.transaction(() => {
      const scope = createFullMutationScope();
      const { revision, stateJson, world } = this.loadWorld(now, scope);
      const beforeContracts = structuredClone(world.productionContracts || []);
      const boundary = createEconomicActionBoundary(world);
      const savepoint = beginEconomicSavepoint(this, 'economy_production_input_source');
      let value;
      try {
        value = prepareProductionInputsForPlayer(world, Number(user.id), now);
        boundary.assert(); savepoint.release();
      } catch (error) {
        try { savepoint.rollback(); } catch { /* outer transaction remains authoritative */ }
        boundary.rollback(); throw error;
      }
      this.captureContractAuditTransition(beforeContracts, world, { actorUserId: Number(user.id), triggerType: 'production_input_source', action: requestMeta.action, requestKey: requestMeta.requestKey, now });
      assertEconomicStateInvariants(world);
      this.saveWorldIfChanged(revision, world, now, stateJson);
      return value;
    });
    return { cached: null, baseline };
  }

  finalizeProductionInputs(user, baseline, response, requestMeta, now) {
    if (!(baseline instanceof Map) || !response) return response;
    const nextRevision = this.transaction(() => {
      const { revision, stateJson, world } = this.loadWorld(now, createFullMutationScope());
      const beforeContracts = structuredClone(world.productionContracts || []);
      finalizeProductionOutputContracts(world, Number(user.id), baseline, now);
      this.captureContractAuditTransition(beforeContracts, world, { actorUserId: Number(user.id), triggerType: 'production_output_reserve', action: requestMeta.action, requestKey: requestMeta.requestKey, now });
      assertEconomicStateInvariants(world);
      return this.saveWorldIfChanged(revision, world, now, stateJson);
    });
    if (Number(nextRevision) !== Number(response.revision)) {
      response.revision = Number(nextRevision);
      this.database.prepare('UPDATE economy_idempotency SET response_json = ? WHERE user_id = ? AND request_key = ?').run(JSON.stringify(response), Number(user.id), requestMeta.requestKey);
    }
    return response;
  }

  applyContractAction(user, requestMeta, baseline, now) {
    const { action, payload = {}, requestKey, method, path } = requestMeta;
    return this.transaction(() => {
      const cached = sameCachedRequest(this.selectIdempotency.get(Number(user.id), requestKey), method, path);
      if (cached) return cached;
      const { revision, stateJson, world } = this.loadWorld(now, createFullMutationScope());
      const player = ensurePlayer(world, user, now, { migrate: false }); ensureWarehouse(player); ensureGemState(player);
      this.processWorldIfDue(world, now, Number(user.id), { force: true, forceDomains: [], auditTrigger: 'action_preprocess' });
      const beforeCycles = structuredClone(world.productionContracts || []);
      settleProductionForPlayerServerSide(world, Number(user.id), now);
      this.captureContractAuditTransition(beforeCycles, world, {
        actorUserId: Number(user.id), triggerType: 'production_output_reserve', action, requestKey, now,
      });
      const boundary = createEconomicActionBoundary(world);
      const savepoint = beginEconomicSavepoint(this, 'economy_contract_action');
      const beforeActionPlayer = structuredClone(world.players[String(user.id)]);
      const beforeActionContracts = structuredClone(world.productionContracts || []);
      let gameResult;
      try {
        gameResult = applyProductionContractAction(world, user, action, payload, now);
        if (gameResult?.ok) { boundary.assert(); savepoint.release(); }
        else { savepoint.rollback(); boundary.rollback(); }
      } catch (error) {
        try { savepoint.rollback(); } catch { /* outer transaction remains authoritative */ }
        boundary.rollback(); throw error;
      }
      const activePlayer = world.players[String(user.id)];
      if (gameResult?.ok && activePlayer && (!isDeepStrictEqual(activePlayer, beforeActionPlayer) || !isDeepStrictEqual(world.productionContracts || [], beforeActionContracts))) {
        activePlayer.lastEconomicActivityAt = now;
        this.captureContractAuditTransition(beforeActionContracts, world, { actorUserId: Number(user.id), triggerType: 'player_action', action, requestKey, now });
      }
      const beforePost = structuredClone(world.productionContracts || []);
      processProductionContracts(world, now);
      finalizeProductionOutputContracts(world, Number(user.id), baseline, now);
      this.captureContractAuditTransition(beforePost, world, { actorUserId: Number(user.id), triggerType: 'action_postprocess', action, requestKey, now });
      assertEconomicStateInvariants(world); ensureWarehouse(world.players[String(user.id)]); ensureGemState(world.players[String(user.id)]);
      const nextRevision = this.saveWorldIfChanged(revision, world, now, stateJson);
      const response = acknowledgement(gameResult, nextRevision);
      this.insertIdempotency.run(Number(user.id), requestKey, method, path, JSON.stringify(response), now);
      this.cleanupExpiredIdempotency(now);
      return response;
    });
  }

  executeDirectRuntimeAction(user, requestMeta, now) {
    return executeRuntimeAction(this, user, requestMeta, now);
  }

  apply(user, requestMeta, now = Date.now()) {
    // Cycle inputs, output reservations, trades and their audit share the action's atomic transaction.
    if (CONTRACT_ACTIONS.has(requestMeta.action)) return this.applyContractAction(user, requestMeta, null, now);
    return this.executeDirectRuntimeAction(user, requestMeta, now);
  }

  enqueueAuthoritativeWrite(options, callback) {
    const actor = String(options?.actor || '');
    if (!actor.startsWith('system:')) {
      const barrier = this.ensureScheduledProcessingBarrier();
      if (barrier) return measureRequestPhase('schedulerBarrierWaitMs', () => barrier).then(() => this.authoritativeWriteExecutor.submit(options, callback));
    }
    return this.authoritativeWriteExecutor.submit(options, callback);
  }
}
