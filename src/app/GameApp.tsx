import { useEffect } from 'react';
import type { AuthUser } from '../types';
import { AssetsIcon, CreditsIcon, RankIcon, WarehouseIcon } from '../components/icons/GameIcons';
import { GemIcon } from '../components/icons/GemIcon';
import { CurrencyAmount, CurrencyText } from '../components/ui/CurrencyAmount';
import { GameShell } from '../components/shell/GameShell';
import type { StatusBarItem } from '../components/shell/StatusBar';
import { PageRouter } from '../pages/PageRouter';
import { formatCompactNumber, formatCurrency, formatNumber, formatRank, setCompactNumbersEnabled } from '../utils/formatters';
import { useGameViewModel } from './gameViewModel';

export function GameApp({ user, onSignedOut }: { user: AuthUser; onSignedOut: () => void }) {
  const viewModel = useGameViewModel(user, onSignedOut);
  const compactNumbers = viewModel.status === 'ready' ? viewModel.model.compactNumbers : false;

  useEffect(() => {
    setCompactNumbersEnabled(compactNumbers);
  }, [compactNumbers]);

  if (viewModel.status === 'loading') return <main className="loading-screen">正在连接权威游戏服务器…</main>;
  if (viewModel.status === 'error') {
    return (
      <main className="loading-screen">
        <div><strong>无法加载游戏状态</strong><p><CurrencyText>{viewModel.message}</CurrencyText></p><button type="button" onClick={viewModel.retry}>重新连接</button></div>
      </main>
    );
  }

  const { model } = viewModel;
  const { game, derived } = model;
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
      detail: <span className={weeklyChange >= 0 ? 'positive' : 'negative'} aria-label={weeklyChangeLabel}>{weeklyTrend} 本周 <CurrencyAmount>{formatCurrency(weeklyMagnitude)}</CurrencyAmount></span>,
      emphasis: 'primary',
      onClick: () => model.setTab('assets'),
    },
    {
      id: 'gems', icon: <GemIcon />, label: '宝石', value: formatNumber(game.gems),
      compactValue: formatCompactNumber(game.gems), detail: <>邀请好友可获得宝石</>,
    },
    {
      id: 'rank', icon: <RankIcon />, label: '排行榜',
      value: <span aria-label={rankLabel}>{formattedRank}</span>,
      compactValue: <>#{currentRank}</>,
      detail: derived.previousRank
        ? <>距上一名 <CurrencyAmount>{formatCurrency(derived.previousRank.totalAssets - derived.totalAssets)}</CurrencyAmount></>
        : <>当前位于榜首</>,
    },
    {
      id: 'warehouse', icon: <WarehouseIcon />, label: '仓库剩余', value: formatNumber(game.warehouseAvailableCapacity),
      compactValue: formatCompactNumber(game.warehouseAvailableCapacity),
      detail: <>已用 {formatNumber(game.warehouseUsedCapacity)}/{formatNumber(game.inventoryCapacity)}{game.warehouseReservedQuantity > 0 ? ` · 买单预占 ${formatNumber(game.warehouseReservedQuantity)}` : ''}</>,
    },
  ];

  return (
    <GameShell model={model} statusItems={statusItems}>
      <PageRouter model={model} />
    </GameShell>
  );
}
