import type { AuthUser } from '../types';
import { AssetsIcon, CreditsIcon, RankIcon, WarehouseIcon } from '../components/icons/GameIcons';
import { GameShell } from '../components/shell/GameShell';
import type { StatusBarItem } from '../components/shell/StatusBar';
import { PageRouter } from '../pages/PageRouter';
import { formatCompactNumber, formatCurrency, setCompactNumbersEnabled } from '../utils/formatters';
import { useGameViewModel } from './gameViewModel';

export function GameApp({ user, onSignedOut }: { user: AuthUser; onSignedOut: () => void }) {
  const viewModel = useGameViewModel(user, onSignedOut);

  if (viewModel.status === 'loading') return <main className="loading-screen">正在连接权威游戏服务器…</main>;
  if (viewModel.status === 'error') {
    return (
      <main className="loading-screen">
        <div><strong>无法加载游戏状态</strong><p>{viewModel.message}</p><button type="button" onClick={viewModel.retry}>重新连接</button></div>
      </main>
    );
  }

  const { model } = viewModel;
  const { game, derived } = model;
  setCompactNumbersEnabled(model.compactNumbers);
  const weeklyChange = derived.currentRank?.weeklyChange ?? 0;
  const currentRank = derived.currentRank?.rank ?? '--';
  const statusItems: StatusBarItem[] = [
    {
      id: 'credits', icon: <CreditsIcon />, label: '可用资金', value: <>¤ {formatCurrency(game.credits)}</>,
      compactValue: formatCompactNumber(game.credits), detail: <>冻结 ¤ {formatCurrency(game.frozenCredits)}</>,
    },
    {
      id: 'assets', icon: <AssetsIcon />, label: '总资产', value: <>¤ {formatCurrency(derived.totalAssets)}</>,
      compactValue: formatCompactNumber(derived.totalAssets),
      detail: <span className={weeklyChange >= 0 ? 'positive' : 'negative'}>本周 {weeklyChange >= 0 ? '+' : ''}¤ {formatCurrency(weeklyChange)}</span>,
      emphasis: 'primary',
    },
    {
      id: 'rank', icon: <RankIcon />, label: '排行榜', value: <>第 {currentRank} 名</>,
      compactValue: <>#{currentRank}</>,
      detail: derived.previousRank
        ? <>距上一名 ¤ {formatCurrency(derived.previousRank.totalAssets - derived.totalAssets)}</>
        : <>当前位于榜首</>,
    },
    {
      id: 'warehouse', icon: <WarehouseIcon />, label: '仓库剩余', value: game.warehouseAvailableCapacity,
      compactValue: formatCompactNumber(game.warehouseAvailableCapacity),
      detail: <>已用 {game.warehouseUsedCapacity}/{game.inventoryCapacity}{game.warehouseReservedQuantity > 0 ? ` · 买单预占 ${game.warehouseReservedQuantity}` : ''}</>,
    },
  ];

  return (
    <GameShell model={model} statusItems={statusItems}>
      <PageRouter model={model} />
    </GameShell>
  );
}
