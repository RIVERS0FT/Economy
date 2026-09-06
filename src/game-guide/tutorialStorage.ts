export const CURRENT_TUTORIAL_VERSION = 3 as const;

export const TUTORIAL_STEP_IDS = [
  'build-facility',
  'start-facility',
  'complete-production',
  'set-auto-sell',
  'complete-sale',
  'start-research',
  'review-contracts',
  'make-bank-deposit',
  'review-leaderboard',
] as const;

export type TutorialStepId = typeof TUTORIAL_STEP_IDS[number];

export interface TutorialRunStats {
  buildSubmits: number;
  facilityStartClicks: number;
  productionCompletions: number;
  autoSellSettings: number;
  saleCompletions: number;
  researchStarts: number;
  contractReviews: number;
  bankDeposits: number;
}

export interface TutorialRunContext {
  provinceId?: string;
  facilityTypeId?: string;
  productionBaseline?: number;
  productId?: string;
  autoSellStartedAt?: number;
}

export interface LocalTutorialRun {
  version: typeof CURRENT_TUTORIAL_VERSION;
  runId: string;
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

function skippedKey(userId: number) {
  return `economy.game-tutorial-skipped.v${CURRENT_TUTORIAL_VERSION}.${userId}`;
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
    buildSubmits: 0,
    facilityStartClicks: 0,
    productionCompletions: 0,
    autoSellSettings: 0,
    saleCompletions: 0,
    researchStarts: 0,
    contractReviews: 0,
    bankDeposits: 0,
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
  const rawStep = (raw as { currentStep?: unknown }).currentStep;
  const currentStep = rawStep === 'work' ? 'build-facility' : rawStep;
  if (raw.version !== CURRENT_TUTORIAL_VERSION || !isTutorialStep(currentStep)) return null;
  const completedStepIds = Array.isArray(raw.completedStepIds)
    ? raw.completedStepIds.filter(isTutorialStep)
    : [];
  const stats = raw.stats ?? emptyStats();
  return {
    version: CURRENT_TUTORIAL_VERSION,
    runId: typeof raw.runId === 'string' && raw.runId ? raw.runId : createRunId(),
    currentStep,
    completedStepIds,
    stats: {
      buildSubmits: Math.max(0, Number(stats.buildSubmits || 0)),
      facilityStartClicks: Math.max(0, Number(stats.facilityStartClicks || 0)),
      productionCompletions: Math.max(0, Number(stats.productionCompletions || 0)),
      autoSellSettings: Math.max(0, Number(stats.autoSellSettings || 0)),
      saleCompletions: Math.max(0, Number(stats.saleCompletions || 0)),
      researchStarts: Math.max(0, Number(stats.researchStarts || 0)),
      contractReviews: Math.max(0, Number(stats.contractReviews || 0)),
      bankDeposits: Math.max(0, Number(stats.bankDeposits || 0)),
    },
    context: {
      provinceId: typeof raw.context?.provinceId === 'string' ? raw.context.provinceId : undefined,
      facilityTypeId: typeof raw.context?.facilityTypeId === 'string' ? raw.context.facilityTypeId : undefined,
      productionBaseline: Number.isFinite(Number(raw.context?.productionBaseline))
        ? Number(raw.context?.productionBaseline)
        : undefined,
      productId: typeof raw.context?.productId === 'string' ? raw.context.productId : undefined,
      autoSellStartedAt: Number.isFinite(Number(raw.context?.autoSellStartedAt))
        ? Number(raw.context?.autoSellStartedAt)
        : undefined,
    },
    startedAt: Number(raw.startedAt || Date.now()),
    updatedAt: Number(raw.updatedAt || Date.now()),
  };
}

export function createTutorialRun(now = Date.now()): LocalTutorialRun {
  return {
    version: CURRENT_TUTORIAL_VERSION,
    runId: createRunId(),
    currentStep: TUTORIAL_STEP_IDS[0],
    completedStepIds: [],
    stats: emptyStats(),
    context: {},
    startedAt: now,
    updatedAt: now,
  };
}

export function loadTutorialRun(userId: number): LocalTutorialRun | null {
  if (typeof window === 'undefined') return null;
  const raw = readItem(storageKey(userId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed
      && typeof parsed === 'object'
      && (parsed as { status?: unknown }).status === 'hidden'
    ) {
      removeItem(storageKey(userId));
      writeItem(skippedKey(userId), '1');
      return null;
    }
    const run = normalizeRun(parsed);
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

export function isTutorialSkipped(userId: number) {
  return typeof window !== 'undefined' && readItem(skippedKey(userId)) === '1';
}

export function setTutorialSkipped(userId: number, skipped: boolean) {
  if (typeof window === 'undefined') return;
  if (skipped) writeItem(skippedKey(userId), '1');
  else removeItem(skippedKey(userId));
}

export function clearTutorialSkip(userId: number) {
  setTutorialSkipped(userId, false);
}

export function hasPendingTutorialCompletion(userId: number) {
  return typeof window !== 'undefined' && readItem(pendingCompletionKey(userId)) === '1';
}

export function setPendingTutorialCompletion(userId: number, pending: boolean) {
  if (typeof window === 'undefined') return;
  if (pending) writeItem(pendingCompletionKey(userId), '1');
  else removeItem(pendingCompletionKey(userId));
}
