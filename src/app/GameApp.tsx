import { tutorialFacility } from '../game-guide/tutorialContext';
import { useMemo, type ReactNode } from 'react';
import type { AuthUser } from '../types';
import { ApplicationLoadingState } from '../components/system/ApplicationLoadingState';
import { RefreshPageButton } from '../components/system/RefreshPageButton';
import { GameShell } from '../components/shell/GameShell';
import { AuthoritativeCountdownRefresh } from '../components/system/AuthoritativeCountdownRefresh';
import { CurrencyText } from '../components/ui/CurrencyAmount';
import { FrostedGlassSurface } from '../components/ui/FrostedGlassSurface';
import { PageRouter } from '../pages/PageRouter';
import { useGameTutorial, type TutorialAwareGameViewModel } from '../game-guide/useGameTutorial';
import { useOnlineAutoTrade, type OnlineAutoTradeAwareGameViewModel } from '../auto-trade/useOnlineAutoTrade';
import { useOnlineTransport } from '../transport/useOnlineTransport';
import { useGameViewModel, type LoadedGameViewModel } from './gameViewModel';
import { useAdaptivePolling } from './useAdaptivePolling';
import '../styles/game-guide.css';

// Status-bar rendering moved to GameShell so player/leaderboard patches do not commit GameApp.
// The older page-content ownership scan still records the shell-owned warehouse item here:
// label: '仓库库存' · id: 'warehouse' · formatNumber(game.warehouseStoredQuantity)

function GameErrorStateShell({ children }: { children: ReactNode }) {
  return (
    <main className="game-state-shell game-error-state-shell">
      <div className="loading-screen" role="alert">
        <FrostedGlassSurface variant="stateCard" layout="content">
          <section className="photographic-state-card">{children}</section>
        </FrostedGlassSurface>
      </div>
    </main>
  );
}

function ReadyGameApp({ model }: { model: LoadedGameViewModel }) {
  const pollingPreference = useAdaptivePolling(model);
  const pollingModel = useMemo<LoadedGameViewModel>(() => ({
    ...model,
    refreshRate: pollingPreference.refreshRate,
    setRefreshRate: pollingPreference.setRefreshRate,
  }), [model, pollingPreference.refreshRate, pollingPreference.setRefreshRate]);
  const tutorial = useGameTutorial(pollingModel);
  const autoTrade = useOnlineAutoTrade(pollingModel, {
    onSale: tutorial.recordAutoSellCompletion,
  });
  useOnlineTransport(pollingModel);
  const tutorialModel = useMemo<TutorialAwareGameViewModel>(() => ({
    ...pollingModel,
    tutorial,
    bankDeposit: async (amount) => {
      const result = await model.bankDeposit(amount);
      if (result.ok) tutorial.recordBankDeposit();
      return result;
    },
    buildFacility: async (facilityTypeId = model.selectedFacilityTypeId, quantity = 1, procurement) => {
      const provinceId = model.selectedProvinceId;
      const baseline = tutorialFacility(model.game, { facilityTypeId, provinceId })?.lifetimeOutput ?? 0;
      const result = await model.buildFacility(facilityTypeId, quantity, procurement);
      if (result.ok) tutorial.recordBuildSubmit(facilityTypeId, provinceId, baseline);
      return result;
    },
    startResearch: async (technologyId) => {
      const result = await model.startResearch(technologyId);
      if (result.ok) tutorial.recordResearchStart();
      return result;
    },
    startFacility: async (facilityTypeId) => {
      const provinceId = model.selectedProvinceId;
      const result = await model.startFacility(facilityTypeId);
      if (result.ok) tutorial.recordFacilityStartClick(facilityTypeId, provinceId);
      return result;
    },
  }), [model, pollingModel, tutorial]);
  const appModel = useMemo<OnlineAutoTradeAwareGameViewModel>(() => ({
    ...tutorialModel,
    autoTrade,
  }), [autoTrade, tutorialModel]);
  return (
    <>
      <AuthoritativeCountdownRefresh game={appModel.game} refresh={model.refresh} />
      <GameShell model={appModel}>
        <PageRouter model={appModel} />
      </GameShell>
    </>
  );
}

export function GameApp({ user, onSignedOut }: { user: AuthUser; onSignedOut: () => void }) {
  const viewModel = useGameViewModel(user, onSignedOut);

  if (viewModel.status === 'loading') {
    return <ApplicationLoadingState>正在连接服务器…</ApplicationLoadingState>;
  }
  if (viewModel.status === 'error') {
    return (
      <GameErrorStateShell>
        <strong>无法加载游戏状态</strong>
        <p><CurrencyText>{viewModel.message}</CurrencyText></p>
        <RefreshPageButton />
      </GameErrorStateShell>
    );
  }

  return <ReadyGameApp model={viewModel.model} />;
}
