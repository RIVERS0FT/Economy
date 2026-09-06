import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  completeTutorial,
  getTutorialStatus,
  type TutorialCompletionState,
} from '../api/game';
import type { LoadedGameViewModel } from '../app/gameViewModel';
import { tutorialFacility, tutorialTargetLocation } from './tutorialContext';
import type { PlayerPageLocation } from '../navigation/playerPageStack';
import { getStateAuthoritySnapshot, subscribeStateAuthoritySlice } from '../app/stateDelivery.js';
import { tutorialStepDefinition, TUTORIAL_STEPS } from './tutorialDefinition';
import {
  FACTORY_AUTO_OPERATION_SAVED_EVENT,
  type FactoryAutoOperationSavedDetail,
} from './tutorialEvents';
import {
  clearTutorialRun,
  createTutorialRun,
  CURRENT_TUTORIAL_VERSION,
  hasPendingTutorialCompletion,
  isTutorialSkipped,
  loadTutorialRun,
  saveTutorialRun,
  setPendingTutorialCompletion,
  setTutorialSkipped,
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
  isSkipped?: boolean;
  currentStep: ReturnType<typeof tutorialStepDefinition> | null;
  currentStepIndex: number;
  totalSteps: number;
  statusLabel: string;
  restart: () => void;
  skip?: () => void;
  /** @deprecated Compatibility alias. Skipping is the only supported hide behavior. */
  hide: () => void;
  /** @deprecated Compatibility alias. Restarting is the only supported way to show a skipped tutorial. */
  show: () => void;
  targetLocation?: PlayerPageLocation;
  openCurrentTarget: () => void;
  recordBuildSubmit: (facilityTypeId: string, provinceId?: string, productionBaseline?: number) => void;
  recordFacilityStartClick: (facilityTypeId: string, provinceId?: string) => void;
  recordAutoSellCompletion: (productId: string, provinceId?: string) => void;
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

function facilityOutputProductId(model: LoadedGameViewModel, facilityTypeId: string, provinceId: string) {
  const snapshot = getStateAuthoritySnapshot().state;
  const game = snapshot?.userId === model.user.id ? snapshot : model.game;
  const group = tutorialFacility(game, { facilityTypeId, provinceId });
  const type = game.facilityTypes.find((candidate) => candidate.id === facilityTypeId);
  if (!group || !type) return null;
  const directRecipe = type.recipes.find((recipe) => recipe.id === group.activeRecipeId);
  if (directRecipe) return directRecipe.output.productId;
  for (const methodGroup of type.productionMethodGroups ?? []) {
    for (const method of methodGroup.methods) {
      for (const plan of Object.values(method.plansByRecipeId)) {
        if (plan.recipeId === group.activeRecipeId) return plan.output.productId;
      }
    }
  }
  return type.output.productId;
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
        if (
          !persisted
          && response.tutorial.completedVersion < CURRENT_TUTORIAL_VERSION
          && !hasPendingTutorialCompletion(userId)
          && !isTutorialSkipped(userId)
        ) {
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
    setTutorialSkipped(userId, false);
    setRun(null);
    model.notify('教程已完成');

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
        model.notify('教程已在本机完成，服务器完成记录将在下次进入时重试');
      })
      .finally(() => {
        finishingRef.current = false;
      });
  }, [model, serverStatus?.completedVersion, userId]);

  useEffect(() => {
    if (!run || !['start-facility', 'complete-production'].includes(run.currentStep)) return undefined;
    const confirmProduction = () => {
      const snapshot = getStateAuthoritySnapshot().state;
      const game = snapshot?.userId === userId ? snapshot : model.game;
      const group = tutorialFacility(game, run.context);
      if (!group) return;
      const baseline = run.context.productionBaseline;
      if (run.currentStep === 'start-facility') {
        const completedCycle = baseline !== undefined && group.lifetimeOutput > baseline;
        if (!completedCycle && (group.status !== 'running' || group.participatingCount <= 0)) return;
        updateCurrentRun('start-facility', 'facilityStartClicks', {
          provinceId: group.provinceId,
          productionBaseline: baseline ?? group.lifetimeOutput,
        });
        return;
      }
      if (baseline === undefined || group.lifetimeOutput <= baseline) return;
      updateCurrentRun('complete-production', 'productionCompletions', { provinceId: group.provinceId });
    };
    confirmProduction();
    return subscribeStateAuthoritySlice('player.production', confirmProduction);
  }, [model, run, updateCurrentRun, userId]);

  useEffect(() => {
    if (!run || run.currentStep !== 'review-contracts' || model.tab !== 'contracts') return;
    updateCurrentRun('review-contracts', 'contractReviews');
  }, [model.tab, run, updateCurrentRun]);

  useEffect(() => {
    if (!run || run.currentStep !== 'review-leaderboard' || model.tab !== 'leaderboard') return;
    finishTutorial();
  }, [finishTutorial, model.tab, run]);

  const restart = useCallback(() => {
    setTutorialSkipped(userId, false);
    const fresh = createTutorialRun();
    persistRun(fresh);
    finishingRef.current = false;
    model.setTab('home');
    model.notify('教程已从第一步重新开始');
  }, [model, persistRun, userId]);

  const skip = useCallback(() => {
    if (!run) return;
    clearTutorialRun(userId);
    setTutorialSkipped(userId, true);
    setRun(null);
    finishingRef.current = false;
    model.notify('已跳过教程，可在设置中重新开始');
  }, [model, run, userId]);

  const openCurrentTarget = useCallback(() => {
    if (!run) return;
    model.setTab(tutorialStepDefinition(run.currentStep).targetTab);
  }, [model, run]);

  const recordBuildSubmit = useCallback((facilityTypeId: string, provinceId = model.selectedProvinceId, productionBaseline = 0) => {
    updateCurrentRun('build-facility', 'buildSubmits', { facilityTypeId, provinceId, productionBaseline });
  }, [model.selectedProvinceId, updateCurrentRun]);

  const recordFacilityStartClick = useCallback((facilityTypeId: string, provinceId = model.selectedProvinceId) => {
    if (run?.context.facilityTypeId !== facilityTypeId || (run.context.provinceId && run.context.provinceId !== provinceId)) return;
    const snapshot = getStateAuthoritySnapshot().state;
    const group = tutorialFacility(snapshot?.userId === userId ? snapshot : model.game, { facilityTypeId, provinceId });
    updateCurrentRun('start-facility', 'facilityStartClicks', {
      facilityTypeId,
      provinceId,
      productionBaseline: run.context.productionBaseline ?? Number(group?.lifetimeOutput || 0),
    });
  }, [model, run, updateCurrentRun, userId]);

  useEffect(() => {
    if (!run || run.currentStep !== 'set-auto-sell') return undefined;
    const handleSaved = (event: Event) => {
      const detail = (event as CustomEvent<FactoryAutoOperationSavedDetail>).detail;
      if (Number(detail?.userId) !== Number(userId) || !detail?.facilityTypeId) return;
      if (run.context.facilityTypeId !== detail.facilityTypeId
        || (run.context.provinceId && run.context.provinceId !== detail.provinceId)) return;
      const snapshot = getStateAuthoritySnapshot().state;
      if (snapshot?.userId !== userId
        || (snapshot as { factoryAutoOperationPolicies?: Record<string, { enabled: boolean }> }).factoryAutoOperationPolicies?.[`${detail.provinceId}:${detail.facilityTypeId}`]?.enabled === false) return;
      const productId = facilityOutputProductId(model, detail.facilityTypeId, detail.provinceId);
      if (!productId) return;
      updateCurrentRun('set-auto-sell', 'autoSellSettings', {
        facilityTypeId: detail.facilityTypeId,
        provinceId: detail.provinceId,
        productId,
        autoSellStartedAt: Date.now(),
      });
    };
    window.addEventListener(FACTORY_AUTO_OPERATION_SAVED_EVENT, handleSaved);
    return () => window.removeEventListener(FACTORY_AUTO_OPERATION_SAVED_EVENT, handleSaved);
  }, [model, run, updateCurrentRun, userId]);

  const recordAutoSellCompletion = useCallback((productId: string, provinceId?: string) => {
    setRun((current) => {
      const targetProvince = current?.context.provinceId ?? (current ? tutorialFacility(model.game, current.context)?.provinceId : undefined);
      if (
        !current
        || !targetProvince || targetProvince !== provinceId
        || current.currentStep !== 'complete-sale'
        || current.context.productId !== productId
        || (current.context.provinceId && current.context.provinceId !== provinceId)
      ) return current;
      const next = advanceRun(current, 'complete-sale', 'saleCompletions');
      if (next !== current) saveTutorialRun(userId, next);
      return next;
    });
  }, [model.game, userId]);

  const recordResearchStart = useCallback(() => {
    updateCurrentRun('start-research', 'researchStarts');
  }, [updateCurrentRun]);

  const recordBankDeposit = useCallback(() => {
    updateCurrentRun('make-bank-deposit', 'bankDeposits');
  }, [updateCurrentRun]);

  const targetLocation = run ? tutorialTargetLocation(run.currentStep, run.context, model.selectedProvinceId) : undefined;
  const currentStep = run ? tutorialStepDefinition(run.currentStep) : null;
  const currentStepIndex = run ? TUTORIAL_STEP_IDS.indexOf(run.currentStep) + 1 : 0;
  const serverCompleted = (serverStatus?.completedVersion || 0) >= CURRENT_TUTORIAL_VERSION
    || hasPendingTutorialCompletion(userId);
  const skipped = !run && isTutorialSkipped(userId);

  return useMemo(() => ({
    ready,
    run,
    isActive: Boolean(run),
    isVisible: Boolean(run),
    isCompleted: !run && !skipped && serverCompleted,
    isSkipped: skipped,
    currentStep,
    currentStepIndex,
    totalSteps: TUTORIAL_STEPS.length,
    statusLabel: run
      ? `进行中 · 步骤 ${currentStepIndex}/${TUTORIAL_STEPS.length}`
      : skipped
        ? '已跳过'
        : serverCompleted
          ? '已完成当前版本教程'
          : ready
            ? '尚未开始'
            : '正在读取教程状态',
    restart,
    skip,
    hide: skip,
    show: restart,
    openCurrentTarget,
    targetLocation,
    recordBuildSubmit,
    recordFacilityStartClick,
    recordAutoSellCompletion,
    recordResearchStart,
    recordBankDeposit,
  }), [
    currentStep,
    currentStepIndex,
    targetLocation,
    openCurrentTarget,
    ready,
    recordAutoSellCompletion,
    recordBankDeposit,
    recordBuildSubmit,
    recordFacilityStartClick,
    recordResearchStart,
    restart,
    run,
    serverCompleted,
    skip,
    skipped,
  ]);
}
