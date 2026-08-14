import { measureRequestPhase } from './request-performance.js';
import { executeRuntimeAction } from './runtime-action-executor.js';
import { EconomyStore as CoreEconomyStore } from './runtime-store-core.js';
import { installProvinceRuntimeAliases } from './provinces.js';
import { cloneWorldForMutation } from './world-storage-v2.js';

const WORLD_PROCESS_INTERVAL_MS = 1_000;

export class EconomyStore extends CoreEconomyStore {
  constructor(...args) {
    super(...args);
    this.schedulerBarrierPromise = null;
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
    if (!this.worldCache) return super.loadWorld(now);
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
