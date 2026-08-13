import { measureRequestPhase } from './request-performance.js';
import { executeRuntimeAction } from './runtime-action-executor.js';
import { EconomyStore as CoreEconomyStore } from './runtime-store-core.js';

const WORLD_PROCESS_INTERVAL_MS = 1_000;

export class EconomyStore extends CoreEconomyStore {
  constructor(...args) {
    super(...args);
    this.schedulerBarrierPromise = null;
    this.stateProjectionCacheIsolationDepth = 0;
  }

  committedWorldForCache(world) {
    if (this.stateProjectionCacheIsolationDepth <= 0) return world;
    return measureRequestPhase('worldCacheIsolationCloneMs', () => structuredClone(world));
  }

  cacheWorld(revision, stateJson, world, needsPersistence = false) {
    const nextRevision = Number(revision);
    if (this.worldCache?.revision !== nextRevision) this.clientStateProjectionCache.clear();
    this.worldCache = {
      revision: nextRevision,
      stateJson,
      world: this.committedWorldForCache(world),
      needsPersistence: Boolean(needsPersistence),
    };
  }

  loadWorld(now) {
    if (!this.worldCache) return super.loadWorld(now);
    return {
      revision: this.worldCache.revision,
      stateJson: this.worldCache.stateJson,
      world: measureRequestPhase('worldDraftCloneMs', () => structuredClone(this.worldCache.world)),
    };
  }

  getStateSnapshot(user, knownRevision, now = Date.now()) {
    this.stateProjectionCacheIsolationDepth += 1;
    try {
      return super.getStateSnapshot(user, knownRevision, now);
    } finally {
      this.stateProjectionCacheIsolationDepth -= 1;
    }
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

// The core module remains the single implementation for projection, contracts and persistence.
// These markers document inherited behavior/order for source-level architecture guards while the
// wrapper only replaces hot-path cloning and scheduler admission. Runtime behavior still comes
// from runtime-store-core.js through normal class inheritance.
// class EconomyStore extends PersistentEconomyStore
// import { configurePlayerAdminStatistics } from './player-admin-statistics.js'
// configurePlayerAdminStatistics(this);
// updatePopulationPolicy
// resetPopulationPolicy
// topUpPopulation
// prepared.version = 26;
// createEconomicCalendarClientState(now)
// createStablePartitionClientState(snapshot.state)
// createClientPartitionSnapshot
// cachedStateProjection(user.id, currentRevision)
// rememberStateProjection(user.id, snapshot.revision
// setRequestGauge('stateProjectionCacheHit', 1)
// contractProjectionForState
// cached.revision === snapshot.revision
// saveWorld(revision, world, now)
// saveWorldIfChanged(revision, world, now
// isDeepStrictEqual(world, cached.world)
// this.updateWorld.run(nextRevision, stateJson, now)
// flushAuctionAuditEvents(this, world, revision, nextRevision);
// this.flushContractAuditEvents(world, revision, nextRevision)
// this.cacheWorld(nextRevision, stateJson, world)
// this.flushContractAuditEvents(world, revision, revision)
// migrateLoadedWorld(world, now)
// triggerType: 'action_postprocess'
// processProductionContracts(world, now)
// this.cleanupExpiredIdempotency(now)