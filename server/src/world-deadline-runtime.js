import { createWorldDeadlinePlan } from './world-deadline-planner.js';

const runtimeByStore = new WeakMap();

function normalizedRevision(value) {
  const revision = Number(value);
  return Number.isInteger(revision) && revision >= 0 ? revision : null;
}

function normalizedNow(value) {
  return Math.max(0, Number(value) || 0);
}

export function dueWorldDeadlineDomains(plan, now = Date.now()) {
  const timestamp = normalizedNow(now);
  if (!plan || typeof plan !== 'object' || !plan.deadlines || typeof plan.deadlines !== 'object') return [];
  return Object.entries(plan.deadlines)
    .filter(([, deadline]) => (
      deadline !== null
      && deadline !== undefined
      && Number.isFinite(Number(deadline))
      && Number(deadline) <= timestamp
    ))
    .map(([name]) => name);
}

export class WorldDeadlineRuntime {
  constructor() {
    this.worldRef = null;
    this.revision = null;
    this.plan = null;
    this.diagnostics = {
      builds: 0,
      cacheHits: 0,
      invalidations: 0,
      lastBuildAt: null,
      lastDueDomains: [],
    };
  }

  invalidate() {
    this.worldRef = null;
    this.revision = null;
    this.plan = null;
    this.diagnostics.invalidations += 1;
  }

  planFor(world, revision, now = Date.now(), { force = false } = {}) {
    const timestamp = normalizedNow(now);
    const nextRevision = normalizedRevision(revision);
    const reusable = !force
      && this.plan
      && this.worldRef === world
      && this.revision === nextRevision
      && (
        this.plan.nextDueAt === null
        || !Number.isFinite(Number(this.plan.nextDueAt))
        || timestamp <= Number(this.plan.nextDueAt)
      );
    if (reusable) {
      this.diagnostics.cacheHits += 1;
      this.diagnostics.lastDueDomains = dueWorldDeadlineDomains(this.plan, timestamp);
      return this.plan;
    }

    const plan = createWorldDeadlinePlan(world, timestamp);
    this.worldRef = world;
    this.revision = nextRevision;
    this.plan = plan;
    this.diagnostics.builds += 1;
    this.diagnostics.lastBuildAt = timestamp;
    this.diagnostics.lastDueDomains = dueWorldDeadlineDomains(plan, timestamp);
    return plan;
  }

  recordDueDomains(domains) {
    this.diagnostics.lastDueDomains = [...new Set(domains || [])];
  }

  resetDiagnostics() {
    this.diagnostics = {
      builds: 0,
      cacheHits: 0,
      invalidations: 0,
      lastBuildAt: null,
      lastDueDomains: [],
    };
  }

  getDiagnostics() {
    return {
      ...this.diagnostics,
      lastDueDomains: [...this.diagnostics.lastDueDomains],
    };
  }
}

export function worldDeadlineRuntimeFor(store) {
  let runtime = runtimeByStore.get(store);
  if (!runtime) {
    runtime = new WorldDeadlineRuntime();
    runtimeByStore.set(store, runtime);
  }
  return runtime;
}
