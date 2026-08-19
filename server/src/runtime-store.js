import { measureRequestPhase } from './request-performance.js';
import { executeRuntimeAction } from './runtime-action-executor.js';
import { EconomyStore as CoreEconomyStore } from './runtime-store-core.js';
import { installProvinceRuntimeAliases } from './provinces.js';
import { cloneWorldForMutation } from './world-storage-v2.js';
import { settleProductionForDueContractParticipants } from './production-settlement.js';

const WORLD_PROCESS_INTERVAL_MS = 1_000;
const PRODUCTION_COLD_START_YIELD_MS = 1_000;
const RETIRED_FACILITY_GROUP_FIELDS = Object.freeze([
  'pendingJoinCount',
  'pendingRecipeId',
  'stopReason',
  'cycleStaffingRateBps',
  'cycleEffectiveCount',
  'nextCycleStaffingRateBps',
  'productionWageCarryNumerator',
  'productionEmploymentTotalMicros',
  'productionEmploymentAllocatedMicros',
  'completedQuantity',
]);

function needsFacilityColdCompatibilityMigration(world) {
  if (Array.isArray(world?.facilityListings) && world.facilityListings.length > 0) return true;
  for (const player of Object.values(world?.players || {})) {
    if (player?.facilityConstruction) return true;
    if (Array.isArray(player?.facilities) && player.facilities.length > 0) return true;
    for (const group of player?.facilityGroups || []) {
      if (RETIRED_FACILITY_GROUP_FIELDS.some((field) => Object.hasOwn(group || {}, field))) return true;
    }
  }
  return false;
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
      this.processingTimer = this.setTimeoutFn(
        () => this.handleScheduledWorldWake(generation),
        PRODUCTION_COLD_START_YIELD_MS,
      );
      this.processingTimer?.unref?.();
    }
  }

  cacheWorld(revision, stateJson, world, needsPersistence = false, segmentedSnapshot = null) {
    const nextRevision = Number(revision);
    if (this.worldCache?.revision !== nextRevision) this.clientStateProjectionCache.clear();
    this.worldCache = {
      revision: nextRevision,
      stateJson,
      world: installProvinceRuntimeAliases(world),
      needsPersistence: Boolean(needsPersistence),
      segmentedSnapshot: segmentedSnapshot || this.worldCache?.segmentedSnapshot || null,
      storageSchemaVersion: 2,
    };
  }

  loadWorld(now, mutationScope = null) {
    if (!this.worldCache) {
      const loaded = super.loadWorld(now);
      if (!needsFacilityColdCompatibilityMigration(loaded.world)) return loaded;
      const world = this.migrateLoadedWorld(loaded.world, now);
      const revision = this.saveWorldIfChanged(loaded.revision, world, now, loaded.stateJson);
      return {
        revision,
        stateJson: null,
        world: measureRequestPhase('worldDraftCloneMs', () => installProvinceRuntimeAliases(structuredClone(world))),
      };
    }
    return {
      revision: this.worldCache.revision,
      stateJson: null,
      world: mutationScope
        ? measureRequestPhase('worldDraftCowMs', () => cloneWorldForMutation(this.worldCache.world, mutationScope))
        : measureRequestPhase('worldDraftCloneMs', () => installProvinceRuntimeAliases(structuredClone(this.worldCache.world))),
    };
  }

  trackSchedulerBarrier(barrier, { reschedule = true } = {}) {
    const settledSynchronously = this.authoritativeWriteExecutor.isIdle();
    const wrappedBarrier = barrier.finally(() => {
      if (this.schedulerBarrierPromise === wrappedBarrier) this.schedulerBarrierPromise = null;
      if (reschedule && !this.processingTimer && !this.schedulerClosed) this.scheduleWorldProcessing();
    });
    this.schedulerBarrierPromise = wrappedBarrier;
    if (settledSynchronously && reschedule && !this.processingTimer && !this.schedulerClosed) {
      this.scheduleWorldProcessing();
    }
    return wrappedBarrier;
  }

  handleScheduledWorldWake(generation) {
    if (this.schedulerClosed || generation !== this.schedulerGeneration) {
      this.schedulerDiagnostics.staleWakeups += 1;
      return;
    }
    this.processingTimer = null;
    const now = Math.max(0, Number(this.nowProvider()) || 0);
    this.schedulerDiagnostics.wakeups += 1;
    if (now < this.nextWorldProcessingAt) {
      this.schedulerDiagnostics.staleWakeups += 1;
      this.scheduleWorldProcessing();
      return;
    }
    this.schedulerDiagnostics.processedWakeups += 1;
    this.schedulerDiagnostics.lastLagMs = Math.max(0, now - this.nextWorldProcessingAt);
    const barrier = this.authoritativeWriteExecutor.submit({
      actor: 'system:scheduler',
      operation: 'scheduled-world-processing',
      allowWhenFull: true,
      timeoutMs: null,
      captureRequestContext: false,
      onSettled: (error) => {
        if (!error) return;
        this.schedulerNotBefore = Math.max(this.schedulerNotBefore, now + WORLD_PROCESS_INTERVAL_MS);
        console.error('Economy scheduled world processing failed', error);
      },
    }, () => this.processScheduledWorld(now));
    this.trackSchedulerBarrier(barrier).catch(() => {});
  }

  ensureScheduledProcessingBarrier() {
    if (!this.scheduledProcessing || this.schedulerClosed) return null;
    const now = Math.max(0, Number(this.nowProvider()) || 0);
    if (now < this.nextWorldProcessingAt) return null;
    if (this.schedulerBarrierPromise) return this.schedulerBarrierPromise;
    if (this.processingTimer) {
      this.clearWorldProcessingTimer();
      this.schedulerGeneration += 1;
    }
    const barrier = this.authoritativeWriteExecutor.submit({
      actor: 'system:scheduler-barrier',
      operation: 'scheduled-world-barrier',
      allowWhenFull: true,
      timeoutMs: null,
      captureRequestContext: false,
    }, () => this.processScheduledWorld(now));
    return this.trackSchedulerBarrier(barrier);
  }

  processWorldIfDue(world, now, currentUserId, options = {}) {
    // Contract deadlines are the only global path allowed to materialize offline production,
    // and only for participants of contracts that are actually due.
    settleProductionForDueContractParticipants(world, now);
    return super.processWorldIfDue(world, now, currentUserId, options);
  }

  apply(user, requestMeta, now = Date.now()) {
    return executeRuntimeAction(this, user, requestMeta, now);
  }

  enqueueAuthoritativeWrite(options, callback) {
    const actor = String(options?.actor || '');
    if (!actor.startsWith('system:')) {
      const barrier = this.ensureScheduledProcessingBarrier();
      if (barrier) {
        return measureRequestPhase('schedulerBarrierWaitMs', () => barrier).then(() => (
          this.enqueueAuthoritativeWrite(options, callback)
        ));
      }
    }
    return this.authoritativeWriteExecutor.submit(options, callback);
  }
}
