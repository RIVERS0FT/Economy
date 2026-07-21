import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  completeTutorial,
  getTutorialStatus,
  type TutorialCompletionState,
} from '../api/game';
import type { LoadedGameViewModel } from '../app/gameViewModel';
import type { AssetKind, OrderSide } from '../types';
import { defaultOrderPrice } from '../utils/defaultOrderPrice';
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
  recordWorkClick: () => void;
  recordBuildSubmit: (facilityTypeId: string) => void;
  recordFacilityStartClick: (facilityTypeId: string) => void;
  recordSellOrderSubmit: (
    assetKind: AssetKind,
    assetId: string,
    side: OrderSide,
  ) => void;
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

function ownCommoditySellOrderIds(model: LoadedGameViewModel) {
  return model.game.orders
    .filter((order) => order.isOwn && order.assetKind === 'commodity' && order.side === 'sell')
    .map((order) => order.id);
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
    model.notify('基础教程已完成');

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
    if (!run || run.currentStep !== 'complete-production') return;
    const facilityTypeId = run.context.facilityTypeId;
    const baseline = run.context.productionBaseline;
    if (!facilityTypeId || baseline === undefined) return;
    const group = model.game.facilityGroups.find((item) => item.facilityTypeId === facilityTypeId);
    if (!group || group.lifetimeOutput <= baseline) return;
    updateCurrentRun('complete-production', 'productionCompletions');
  }, [model.game.facilityGroups, run, updateCurrentRun]);

  useEffect(() => {
    if (!run || run.currentStep !== 'complete-sale') return;
    const baselineIds = new Set(run.context.sellOrderBaselineIds);
    const order = model.game.orders.find((candidate) => (
      candidate.isOwn
      && candidate.assetKind === 'commodity'
      && candidate.side === 'sell'
      && candidate.assetId === run.context.productId
      && !baselineIds.has(candidate.id)
      && (
        (candidate.fills?.length || 0) > 0
        || candidate.remaining < candidate.quantity
      )
    ));
    if (!order) return;
    setRun((current) => {
      if (!current || current.currentStep !== 'complete-sale') return current;
      return {
        ...current,
        completedStepIds: current.completedStepIds.includes('complete-sale')
          ? current.completedStepIds
          : [...current.completedStepIds, 'complete-sale'],
        stats: { ...current.stats, saleCompletions: current.stats.saleCompletions + 1 },
        updatedAt: Date.now(),
      };
    });
    finishTutorial();
  }, [finishTutorial, model.game.orders, run]);

  const restart = useCallback(() => {
    const fresh = createTutorialRun();
    persistRun(fresh);
    finishingRef.current = false;
    model.setTab('home');
    model.notify('基础教程已从第一步重新开始');
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
    if (definition.targetTab !== 'market') {
      model.setTab(definition.targetTab);
      return;
    }
    const productId = preferredSellProductId(model, run.context.productId);
    model.selectOrderSide('sell');
    model.selectMarketAsset('commodity', productId);
    model.setOrderQuantity(1);
    model.setOrderPrice(defaultOrderPrice(model.game.orders, 'commodity', productId, 'sell'));
  }, [model, run]);

  const recordWorkClick = useCallback(() => {
    updateCurrentRun('work', 'workClicks');
  }, [updateCurrentRun]);

  const recordBuildSubmit = useCallback((facilityTypeId: string) => {
    updateCurrentRun('build-facility', 'buildSubmits', { facilityTypeId });
  }, [updateCurrentRun]);

  const recordFacilityStartClick = useCallback((facilityTypeId: string) => {
    const group = model.game.facilityGroups.find((item) => item.facilityTypeId === facilityTypeId);
    updateCurrentRun('start-facility', 'facilityStartClicks', {
      facilityTypeId,
      productionBaseline: Number(group?.lifetimeOutput || 0),
    });
  }, [model.game.facilityGroups, updateCurrentRun]);

  const recordSellOrderSubmit = useCallback((
    assetKind: AssetKind,
    assetId: string,
    side: OrderSide,
  ) => {
    if (assetKind !== 'commodity' || side !== 'sell') return;
    updateCurrentRun('place-sell-order', 'sellOrderSubmits', {
      productId: assetId,
      sellOrderBaselineIds: ownCommoditySellOrderIds(model),
    });
  }, [model, updateCurrentRun]);

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
        ? '已完成当前版本教程'
        : ready
          ? '尚未开始'
          : '正在读取教程状态',
    restart,
    hide,
    show,
    openCurrentTarget,
    recordWorkClick,
    recordBuildSubmit,
    recordFacilityStartClick,
    recordSellOrderSubmit,
  }), [
    currentStep,
    currentStepIndex,
    hide,
    openCurrentTarget,
    ready,
    recordBuildSubmit,
    recordFacilityStartClick,
    recordSellOrderSubmit,
    recordWorkClick,
    restart,
    run,
    serverCompleted,
    show,
  ]);
}
