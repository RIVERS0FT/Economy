import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  completeTutorial,
  getTutorialStatus,
  type TutorialCompletionState,
} from '../api/game';
import type { LoadedGameViewModel } from '../app/gameViewModel';
import { subscribeStateAuthoritySlice } from '../app/stateDelivery.js';
import { requestAutoSellPanel } from '../auto-sell/autoSellStorage';
import { tutorialStepDefinition, TUTORIAL_STEPS } from './tutorialDefinition';
import {
  clearTutorialRun,
  createTutorialRun,
  CURRENT_TUTORIAL_VERSION,
  hasPendingTutorialCompletion,
  loadTutorialRun,
  saveTutorialRun,
  setPendingTutorialCompletion,
  TUTORIAL_STEP_IDS,
  type LocalTutorialRun,
  type TutorialRunStats,
  type TutorialStepId,
} from './tutorialStorage';

export interface GameTutorialController {
  ready: boolean;
  run: LocalTutorialRun | null;
  isActive: boolean;
  isVisible: boolean;
  isCompleted: boolean;
  currentStep: ReturnType<typeof tutorialStepDefinition> | null;
  currentStepIndex: number;
  totalSteps: number;
  statusLabel: string;
  restart: () => void;
  hide: () => void;
  show: () => void;
  openCurrentTarget: () => void;
  recordBuildSubmit: (facilityTypeId: string) => void;
  recordFacilityStartClick: (facilityTypeId: string) => void;
  recordAutoSellSetting: (productId: string) => void;
  recordAutoSellCompletion: (productId: string) => void;
  recordResearchStart: () => void;
  recordBankDeposit: () => void;
}

export type TutorialAwareGameViewModel = LoadedGameViewModel & {
  tutorial: GameTutorialController;
};

type TutorialStatKey = keyof TutorialRunStats;

function nextStep(stepId: TutorialStepId) {
  const index = TUTORIAL_STEP_IDS.indexOf(stepId);
  return TUTORIAL_STEP_IDS[index + 1];
}

function advanceRun(
  run: LocalTutorialRun,
  expectedStep: TutorialStepId,
  statKey: TutorialStatKey,
  contextPatch: Partial<LocalTutorialRun['context']> = {},
): LocalTutorialRun {
  if (run.currentStep !== expectedStep) return run;
  const following = nextStep(expectedStep);
  if (!following) return run;
  return {
    ...run,
    currentStep: following,
    completedStepIds: run.completedStepIds.includes(expectedStep)
      ? run.completedStepIds
      : [...run.completedStepIds, expectedStep],
    stats: { ...run.stats, [statKey]: run.stats[statKey] + 1 },
    context: { ...run.context, ...contextPatch },
    updatedAt: Date.now(),
  };
}

function preferredSellProductId(model: LoadedGameViewModel, requested?: string) {
  if (requested && model.game.products.some((product) => product.id === requested)) return requested;
  const stocked = model.game.products.find((product) => (
    Number(model.game.inventories[product.id]?.available || 0) > 0
  ));
  return stocked?.id ?? model.game.products[0]?.id ?? 'wheat';
}

export function useGameTutorial(model: LoadedGameViewModel): GameTutorialController {
  const userId = model.user.id;
  const [run, setRun] = useState<LocalTutorialRun | null>(() => loadTutorialRun(userId));
  const [serverStatus, setServerStatus] = useState<TutorialCompletionState | null>(null);
  const [ready, setReady] = useState(false);
  const finishingRef = useRef(false);

  const persistRun = useCallback((nextRun: LocalTutorialRun | null) => {
    if (nextRun) saveTutorialRun(userId, nextRun);
    else clearTutorialRun(userId);
    setRun(nextRun);
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setReady(false);
    finishingRef.current = false;
    const storedRun = loadTutorialRun(userId);
    setRun(storedRun);

    void (async () => {
      try {
        let response = await getTutorialStatus(controller.signal);
        if (cancelled) return;
        if (
response.tutorial.completedVersion < CURRENT_TUTORIAL_VERSION
&& hasPendingTutorialCompletion(userId)
        ) {
try {
  const completion = await completeTutorial(CURRENT_TUTORIAL_VERSION);
  response = {
    tutorial: completion.tutorial,
    currentVersion: CURRENT_TUTORIAL_VERSION,
  };
  setPendingTutorialCompletion(userId, false);
} catch {
  // Keep the pending marker. Replays do not need to restart after a completed local run.
}
        } else if (response.tutorial.completedVersion >= CURRENT_TUTORIAL_VERSION) {
setPendingTutorialCompletion(userId, false);
        }
        if (cancelled) return;
        setServerStatus(response.tutorial);
        const persisted = loadTutorialRun(userId);
        if (!persisted && response.tutorial.completedVersion < CURRENT_TUTORIAL_VERSION
&& !hasPendingTutorialCompletion(userId)) {
const fresh = createTutorialRun();
saveTutorialRun(userId, fresh);
setRun(fresh);
        } else {
setRun(persisted);
        }
      } catch {
        if (!cancelled) setServerStatus(null);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [userId]);

  const updateCurrentRun = useCallback((
    expectedStep: TutorialStepId,
    statKey: TutorialStatKey,
    contextPatch: Partial<LocalTutorialRun['context']> = {},
  ) => {
    setRun((current) => {
      if (!current) return current;
      const next = advanceRun(current, expectedStep, statKey, contextPatch);
      if (next !== current) saveTutorialRun(userId, next);
      return next;
    });
  }, [userId]);

  const finishTutorial = useCallback(() => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    clearTutorialRun(userId);
    setRun(null);
    model.notify('经营成长线已完成');

    if ((serverStatus?.completedVersion || 0) >= CURRENT_TUTORIAL_VERSION) {
      finishingRef.current = false;
      return;
    }

    setPendingTutorialCompletion(userId, true);
    void completeTutorial(CURRENT_TUTORIAL_VERSION)
      .then((response) => {
        setServerStatus(response.tutorial);
        setPendingTutorialCompletion(userId, false);
      })
      .catch(() => {
        model.notify('成长线已在本机完成，服务器完成记录将在下次进入时重试');
      })
      .finally(() => {
        finishingRef.current = false;
      });
  }, [model, serverStatus?.completedVersion, userId]);

  useEffect(() => {
    if (!run || run.currentStep !== 'complete-production') return undefined;
    const facilityTypeId = run.context.facilityTypeId;
    const baseline = run.context.productionBaseline;
    if (!facilityTypeId || baseline === undefined) return undefined;
    const confirmProduction = () => {
      const group = model.game.facilityGroups.find((item) => item.facilityTypeId === facilityTypeId);
      if (!group || group.lifetimeOutput <= baseline) return;
      updateCurrentRun('complete-production', 'productionCompletions');
    };
    confirmProduction();
    return subscribeStateAuthoritySlice('player.production', confirmProduction);
  }, [model, run, updateCurrentRun]);

  useEffect(() => {
    if (!run || run.currentStep !== 'review-contracts' || model.tab !== 'contracts') return;
    updateCurrentRun('review-contracts', 'contractReviews');
  }, [model.tab, run, updateCurrentRun]);

  useEffect(() => {
    if (!run || run.currentStep !== 'review-leaderboard' || model.tab !== 'leaderboard') return;
    finishTutorial();
  }, [finishTutorial, model.tab, run]);

  const restart = useCallback(() => {
    const fresh = createTutorialRun();
    persistRun(fresh);
    finishingRef.current = false;
    model.setTab('home');
    model.notify('经营成长线已从第一步重新开始');
  }, [model, persistRun]);

  const hide = useCallback(() => {
    if (!run) return;
    persistRun({ ...run, status: 'hidden', updatedAt: Date.now() });
  }, [persistRun, run]);

  const show = useCallback(() => {
    if (!run) return;
    persistRun({ ...run, status: 'active', updatedAt: Date.now() });
    model.setTab('home');
  }, [model, persistRun, run]);

  const openCurrentTarget = useCallback(() => {
    if (!run) return;
    const definition = tutorialStepDefinition(run.currentStep);
    if (run.currentStep === 'set-auto-sell') {
      const productId = preferredSellProductId(model, run.context.productId);
      requestAutoSellPanel(userId, productId);
      model.setTab('market');
      return;
    }
    model.setTab(definition.targetTab);
  }, [model, run, userId]);

  const recordBuildSubmit = useCallback((facilityTypeId: string) => {
    updateCurrentRun('build-facility', 'buildSubmits', { facilityTypeId });
  }, [updateCurrentRun]);

  const recordFacilityStartClick = useCallback((facilityTypeId: string) => {
    const group = model.game.facilityGroups.find((item) => item.facilityTypeId === facilityTypeId);
    updateCurrentRun('start-facility', 'facilityStartClicks', {
      facilityTypeId,
      productionBaseline: Number(group?.lifetimeOutput || 0),
    });
  }, [model, updateCurrentRun]);

  const recordAutoSellSetting = useCallback((productId: string) => {
    updateCurrentRun('set-auto-sell', 'autoSellSettings', {
      productId,
      autoSellStartedAt: Date.now(),
    });
  }, [updateCurrentRun]);

  const recordAutoSellCompletion = useCallback((productId: string) => {
    setRun((current) => {
      if (
        !current
        || current.currentStep !== 'complete-sale'
        || current.context.productId !== productId
      ) return current;
      const next = advanceRun(current, 'complete-sale', 'saleCompletions');
      if (next !== current) saveTutorialRun(userId, next);
      return next;
    });
  }, [userId]);

  const recordResearchStart = useCallback(() => {
    updateCurrentRun('start-research', 'researchStarts');
  }, [updateCurrentRun]);

  const recordBankDeposit = useCallback(() => {
    updateCurrentRun('make-bank-deposit', 'bankDeposits');
  }, [updateCurrentRun]);

  const currentStep = run ? tutorialStepDefinition(run.currentStep) : null;
  const currentStepIndex = run ? TUTORIAL_STEP_IDS.indexOf(run.currentStep) + 1 : 0;
  const serverCompleted = (serverStatus?.completedVersion || 0) >= CURRENT_TUTORIAL_VERSION
    || hasPendingTutorialCompletion(userId);

  return useMemo(() => ({
    ready,
    run,
    isActive: Boolean(run),
    isVisible: run?.status === 'active',
    isCompleted: !run && serverCompleted,
    currentStep,
    currentStepIndex,
    totalSteps: TUTORIAL_STEPS.length,
    statusLabel: run
      ? `${run.status === 'hidden' ? '已隐藏' : '进行中'} · 步骤 ${currentStepIndex}/${TUTORIAL_STEPS.length}`
      : serverCompleted
        ? '已完成当前版本经营成长线'
        : ready
? '尚未开始'
: '正在读取成长线状态',
    restart,
    hide,
    show,
    openCurrentTarget,
    recordBuildSubmit,
    recordFacilityStartClick,
    recordAutoSellSetting,
    recordAutoSellCompletion,
    recordResearchStart,
    recordBankDeposit,
  }), [
    currentStep,
    currentStepIndex,
    hide,
    openCurrentTarget,
    ready,
    recordAutoSellCompletion,
    recordAutoSellSetting,
    recordBankDeposit,
    recordBuildSubmit,
    recordFacilityStartClick,
    recordResearchStart,
    restart,
    run,
    serverCompleted,
    show,
  ]);
}
