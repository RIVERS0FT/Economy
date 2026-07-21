export const CURRENT_TUTORIAL_VERSION = 1 as const;

export const TUTORIAL_STEP_IDS = [
  'work',
  'build-facility',
  'start-facility',
  'complete-production',
  'place-sell-order',
  'complete-sale',
] as const;

export type TutorialStepId = typeof TUTORIAL_STEP_IDS[number];
export type TutorialRunStatus = 'active' | 'hidden';

export interface TutorialRunStats {
  workClicks: number;
  buildSubmits: number;
  facilityStartClicks: number;
  productionCompletions: number;
  sellOrderSubmits: number;
  saleCompletions: number;
}

export interface TutorialRunContext {
  facilityTypeId?: string;
  productionBaseline?: number;
  productId?: string;
  sellOrderBaselineIds: string[];
}

export interface LocalTutorialRun {
  version: typeof CURRENT_TUTORIAL_VERSION;
  runId: string;
  status: TutorialRunStatus;
  currentStep: TutorialStepId;
  completedStepIds: TutorialStepId[];
  stats: TutorialRunStats;
  context: TutorialRunContext;
  startedAt: number;
  updatedAt: number;
}

function storageKey(userId: number) {
  return `economy.game-tutorial.v${CURRENT_TUTORIAL_VERSION}.${userId}`;
}

function pendingCompletionKey(userId: number) {
  return `economy.game-tutorial-completion-pending.v${CURRENT_TUTORIAL_VERSION}.${userId}`;
}

function createRunId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `tutorial-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function emptyStats(): TutorialRunStats {
  return {
    workClicks: 0,
    buildSubmits: 0,
    facilityStartClicks: 0,
    productionCompletions: 0,
    sellOrderSubmits: 0,
    saleCompletions: 0,
  };
}

function readItem(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeItem(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Tutorial persistence is optional and must never block gameplay.
  }
}

function removeItem(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Tutorial persistence is optional and must never block gameplay.
  }
}

function isTutorialStep(value: unknown): value is TutorialStepId {
  return typeof value === 'string' && TUTORIAL_STEP_IDS.includes(value as TutorialStepId);
}

function normalizeRun(value: unknown): LocalTutorialRun | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<LocalTutorialRun>;
  if (raw.version !== CURRENT_TUTORIAL_VERSION || !isTutorialStep(raw.currentStep)) return null;
  const completedStepIds = Array.isArray(raw.completedStepIds)
    ? raw.completedStepIds.filter(isTutorialStep)
    : [];
  const stats = raw.stats ?? emptyStats();
  return {
    version: CURRENT_TUTORIAL_VERSION,
    runId: typeof raw.runId === 'string' && raw.runId ? raw.runId : createRunId(),
    status: raw.status === 'hidden' ? 'hidden' : 'active',
    currentStep: raw.currentStep,
    completedStepIds,
    stats: {
      workClicks: Math.max(0, Number(stats.workClicks || 0)),
      buildSubmits: Math.max(0, Number(stats.buildSubmits || 0)),
      facilityStartClicks: Math.max(0, Number(stats.facilityStartClicks || 0)),
      productionCompletions: Math.max(0, Number(stats.productionCompletions || 0)),
      sellOrderSubmits: Math.max(0, Number(stats.sellOrderSubmits || 0)),
      saleCompletions: Math.max(0, Number(stats.saleCompletions || 0)),
    },
    context: {
      facilityTypeId: typeof raw.context?.facilityTypeId === 'string' ? raw.context.facilityTypeId : undefined,
      productionBaseline: Number.isFinite(Number(raw.context?.productionBaseline))
        ? Number(raw.context?.productionBaseline)
        : undefined,
      productId: typeof raw.context?.productId === 'string' ? raw.context.productId : undefined,
      sellOrderBaselineIds: Array.isArray(raw.context?.sellOrderBaselineIds)
        ? raw.context.sellOrderBaselineIds.filter((item): item is string => typeof item === 'string')
        : [],
    },
    startedAt: Number(raw.startedAt || Date.now()),
    updatedAt: Number(raw.updatedAt || Date.now()),
  };
}

export function createTutorialRun(now = Date.now()): LocalTutorialRun {
  return {
    version: CURRENT_TUTORIAL_VERSION,
    runId: createRunId(),
    status: 'active',
    currentStep: TUTORIAL_STEP_IDS[0],
    completedStepIds: [],
    stats: emptyStats(),
    context: { sellOrderBaselineIds: [] },
    startedAt: now,
    updatedAt: now,
  };
}

export function loadTutorialRun(userId: number): LocalTutorialRun | null {
  if (typeof window === 'undefined') return null;
  const raw = readItem(storageKey(userId));
  if (!raw) return null;
  try {
    const run = normalizeRun(JSON.parse(raw));
    if (!run) removeItem(storageKey(userId));
    return run;
  } catch {
    removeItem(storageKey(userId));
    return null;
  }
}

export function saveTutorialRun(userId: number, run: LocalTutorialRun) {
  if (typeof window === 'undefined') return;
  writeItem(storageKey(userId), JSON.stringify(run));
}

export function clearTutorialRun(userId: number) {
  if (typeof window === 'undefined') return;
  removeItem(storageKey(userId));
}

export function hasPendingTutorialCompletion(userId: number) {
  return typeof window !== 'undefined' && readItem(pendingCompletionKey(userId)) === '1';
}

export function setPendingTutorialCompletion(userId: number, pending: boolean) {
  if (typeof window === 'undefined') return;
  if (pending) writeItem(pendingCompletionKey(userId), '1');
  else removeItem(pendingCompletionKey(userId));
}
