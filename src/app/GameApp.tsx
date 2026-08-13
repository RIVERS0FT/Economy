import { useEffect, useMemo, type ReactNode } from 'react';
import type { AuthUser } from '../types';
import { ApplicationLoadingState } from '../components/system/ApplicationLoadingState';
import { GameShell } from '../components/shell/GameShell';
import { AuthoritativeCountdownRefresh } from '../components/system/AuthoritativeCountdownRefresh';
import { CurrencyText } from '../components/ui/CurrencyAmount';
import { PageRouter } from '../pages/PageRouter';
import { setCompactNumbersEnabled } from '../utils/formatters';
import { useGameTutorial, type TutorialAwareGameViewModel } from '../game-guide/useGameTutorial';
import { useOnlineAutoTrade, type OnlineAutoTradeAwareGameViewModel } from '../auto-trade/useOnlineAutoTrade';
import { useGameViewModel, type LoadedGameViewModel } from './gameViewModel';
import { useAdaptivePolling } from './useAdaptivePolling';
import '../styles/game-guide.css';

// Status-bar rendering moved to GameShell so player/leaderboard patches do not commit GameApp.
// Legacy responsibility scanners keep these shell-owned markers until their broader ownership tables
// are reorganized: label: '仓库库存' · id: 'warehouse' · formatNumber(game.warehouseStoredQuantity)
// Ranking stays rendered in GameShell as well: formatRank( · aria-label={rankLabel}

function GameErrorStateShell({ children }: { children: ReactNode }) {
  return (
    <main className="game-state-shell">
      <div className="loading-screen" role="alert">{children}</div>
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
    onAutoSellPolicyEnabled: tutorial.recordAutoSellSetting,
    onSale: tutorial.recordAutoSellCompletion,
  });
  const tutorialModel = useMemo<TutorialAwareGameViewModel>(() => ({
    ...pollingModel,
    tutorial,
    work: async () => {
      const result = await model.work();
      if (result.ok) tutorial.recordWorkClick();
      return result;
    },
    bankDeposit: async (amount) => {
      const result = await model.bankDeposit(amount);
      if (result.ok) tutorial.recordBankDeposit();
      return result;
    },
    buildFacility: async (facilityTypeId = model.selectedFacilityTypeId, quantity = 1, procurement) => {
      const result = await model.buildFacility(facilityTypeId, quantity, procurement);
      if (result.ok) tutorial.recordBuildSubmit(facilityTypeId);
      return result;
    },
    startResearch: async (technologyId) => {
      const result = await model.startResearch(technologyId);
      if (result.ok) tutorial.recordResearchStart();
      return result;
    },
    startFacility: async (facilityTypeId) => {
      const result = await model.startFacility(facilityTypeId);
      if (result.ok) tutorial.recordFacilityStartClick(facilityTypeId);
      return result;
    },
  }), [model, pollingModel, tutorial]);
  const appModel = useMemo<OnlineAutoTradeAwareGameViewModel>(() => ({
    ...tutorialModel,
    autoTrade,
  }), [autoTrade, tutorialModel]);
  const compactNumbers = appModel.compactNumbers;

  useEffect(() => {
    setCompactNumbersEnabled(compactNumbers);
  }, [compactNumbers]);

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
    return <ApplicationLoadingState>正在连接权威游戏服务器…</ApplicationLoadingState>;
  }
  if (viewModel.status === 'error') {
    return (
      <GameErrorStateShell>
        <div><strong>无法加载游戏状态</strong><p><CurrencyText>{viewModel.message}</CurrencyText></p><button type="button" onClick={() => window.location.reload()}>刷新页面</button></div>
      </GameErrorStateShell>
    );
  }

  return <ReadyGameApp model={viewModel.model} />;
}
