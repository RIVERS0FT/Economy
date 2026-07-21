import { useEffect, useMemo } from 'react';
import type { AuthUser } from '../types';
import { AssetsIcon, CreditsIcon, RankIcon, WarehouseIcon } from '../components/icons/GameIcons';
import { GemIcon } from '../components/icons/GemIcon';
import { CurrencyAmount, CurrencyText } from '../components/ui/CurrencyAmount';
import { GameShell } from '../components/shell/GameShell';
import type { StatusBarItem } from '../components/shell/StatusBar';
import { AuthoritativeCountdownRefresh } from '../components/system/AuthoritativeCountdownRefresh';
import { PageRouter } from '../pages/PageRouter';
import { formatCompactNumber, formatCurrency, formatNumber, formatRank, setCompactNumbersEnabled } from '../utils/formatters';
import { useGameViewModel, type LoadedGameViewModel } from './gameViewModel';
import { useGameTutorial, type TutorialAwareGameViewModel } from '../game-guide/useGameTutorial';
import '../styles/game-guide.css';

function ReadyGameApp({ model }: { model: LoadedGameViewModel }) {
  const tutorial = useGameTutorial(model);
  const tutorialModel = useMemo<TutorialAwareGameViewModel>(() => ({
    ...model,
    tutorial,
    work: () => {
      tutorial.recordWorkClick();
      return model.work();
    },
    buildFacility: (facilityTypeId = model.selectedFacilityTypeId) => {
      tutorial.recordBuildSubmit(facilityTypeId);
      return model.buildFacility(facilityTypeId);
    },
    startFacility: (facilityTypeId) => {
      tutorial.recordFacilityStartClick(facilityTypeId);
      return model.startFacility(facilityTypeId);
    },
    placeAssetOrder: (assetKind, assetId, side, quantity, price) => {
      tutorial.recordSellOrderSubmit(assetKind, assetId, side);
      return model.placeAssetOrder(assetKind, assetId, side, quantity, price);
    },
  }), [model, tutorial]);
  const compactNumbers = tutorialModel.compactNumbers;

  useEffect(() => {
    setCompactNumbersEnabled(compactNumbers);
  }, [compactNumbers]);

  const { game, derived } = tutorialModel;
  const weeklyChange = derived.currentRank?.weeklyChange ?? 0;
  const weeklyMagnitude = Math.abs(weeklyChange);
  const currentRank = derived.currentRank?.rank ?? '--';
  const formattedRank = formatRank(derived.currentRank?.rank);
  const rankLabel = derived.currentRank ? `排名第 ${derived.currentRank.rank} 名` : '暂无排名';
  const weeklyTrend = weeklyChange > 0 ? '↑' : weeklyChange < 0 ? '↓' : '→';
  const weeklyChangeLabel = weeklyChange > 0
    ? `本周资产上升 ${formatCurrency(weeklyMagnitude)}`
    : weeklyChange < 0
      ? `本周资产下降 ${formatCurrency(weeklyMagnitude)}`
      : '本周资产无变化';
  const statusItems: StatusBarItem[] = [
    {
      id: 'credits', icon: <CreditsIcon />, label: '可用资金', value: <CurrencyAmount>{formatCurrency(game.credits)}</CurrencyAmount>,
      compactValue: formatCompactNumber(game.credits), detail: <>冻结 <CurrencyAmount>{formatCurrency(game.frozenCredits)}</CurrencyAmount></>,
    },
    {
      id: 'assets', icon: <AssetsIcon />, label: '总资产', value: <CurrencyAmount>{formatCurrency(derived.totalAssets)}</CurrencyAmount>,
      compactValue: formatCompactNumber(derived.totalAssets),
      detail: <span className={weeklyChange > 0 ? 'positive' : weeklyChange < 0 ? 'negative' : 'neutral'} aria-label={weeklyChangeLabel}>{weeklyTrend} 本周 <CurrencyAmount>{formatCurrency(weeklyMagnitude)}</CurrencyAmount></span>,
      emphasis: 'primary',
      onClick: () => tutorialModel.setTab('assets'),
    },
    {
      id: 'gems', icon: <GemIcon />, label: '宝石', value: formatNumber(game.gems),
      compactValue: formatCompactNumber(game.gems), detail: <>邀请好友可获得宝石</>,
    },
    {
      id: 'rank', icon: <RankIcon />, label: '排行榜',
      value: <span aria-label={rankLabel}>{formattedRank}</span>,
      compactValue: <>#{currentRank}</>,
      detail: !derived.currentRank
        ? <>暂无排名数据</>
        : derived.currentRank.rank === 1
          ? <>当前位于榜首</>
          : derived.previousRank
            ? <>距上一名 <CurrencyAmount>{formatCurrency(derived.previousRank.totalAssets - derived.totalAssets)}</CurrencyAmount></>
            : <>暂无上一名数据</>,
    },
    {
      id: 'warehouse', icon: <WarehouseIcon />, label: '仓库剩余', value: formatNumber(game.warehouseAvailableCapacity),
      compactValue: formatCompactNumber(game.warehouseAvailableCapacity),
      detail: <>已用 {formatNumber(game.warehouseUsedCapacity)}/{formatNumber(game.inventoryCapacity)}{game.warehouseReservedQuantity > 0 ? ` · 买单预占 ${formatNumber(game.warehouseReservedQuantity)}` : ''}</>,
    },
  ];

  return (
    <>
      <AuthoritativeCountdownRefresh game={game} refresh={tutorialModel.refresh} />
      <GameShell model={tutorialModel} statusItems={statusItems}>
        <PageRouter model={tutorialModel} />
      </GameShell>
    </>
  );
}

export function GameApp({ user, onSignedOut }: { user: AuthUser; onSignedOut: () => void }) {
  const viewModel = useGameViewModel(user, onSignedOut);

  if (viewModel.status === 'loading') return <main className="loading-screen">正在连接权威游戏服务器…</main>;
  if (viewModel.status === 'error') {
    return (
      <main className="loading-screen">
        <div><strong>无法加载游戏状态</strong><p><CurrencyText>{viewModel.message}</CurrencyText></p><button type="button" onClick={viewModel.retry}>重新连接</button></div>
      </main>
    );
  }

  return <ReadyGameApp model={viewModel.model} />;
}
