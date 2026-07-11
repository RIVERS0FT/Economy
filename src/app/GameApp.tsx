import type { AuthUser } from '../types';
import { GameShell } from '../components/shell/GameShell';
import type { StatusBarItem } from '../components/shell/StatusBar';
import { PageRouter } from '../pages/PageRouter';
import { formatCurrency } from '../utils/formatters';
import { useGameViewModel } from './gameViewModel';

export function GameApp({ user, onSignedOut }: { user: AuthUser; onSignedOut: () => void }) {
  const viewModel = useGameViewModel(user, onSignedOut);

  if (viewModel.status === 'loading') {
    return <main className="loading-screen">正在连接权威游戏服务器…</main>;
  }

  if (viewModel.status === 'error') {
    return (
      <main className="loading-screen">
        <div>
          <strong>无法加载游戏状态</strong>
          <p>{viewModel.message}</p>
          <button type="button" onClick={viewModel.retry}>重新连接</button>
        </div>
      </main>
    );
  }

  const { model } = viewModel;
  const { game, derived, inventoryUsed } = model;
  const weeklyChange = derived.currentRank?.weeklyChange ?? 0;
  const statusItems: StatusBarItem[] = [
    {
      id: 'credits',
      icon: '¤',
      label: '可用资金',
      value: <>¤ {formatCurrency(game.credits)}</>,
      compactValue: formatCurrency(game.credits),
      detail: <>冻结 ¤ {formatCurrency(game.frozenCredits)}</>,
    },
    {
      id: 'assets',
      icon: '◆',
      label: '总资产',
      value: <>¤ {formatCurrency(derived.totalAssets)}</>,
      compactValue: formatCurrency(derived.totalAssets),
      detail: <span className={weeklyChange >= 0 ? 'positive' : 'negative'}>本周 {weeklyChange >= 0 ? '+' : ''}¤ {formatCurrency(weeklyChange)}</span>,
      emphasis: 'primary',
    },
    {
      id: 'rank',
      icon: '♛',
      label: '排行榜',
      value: <>第 {derived.currentRank?.rank ?? '--'} 名</>,
      detail: derived.previousRank
        ? <>距上一名 ¤ {formatCurrency(derived.previousRank.totalAssets - derived.totalAssets)}</>
        : <>当前位于榜首</>,
    },
    {
      id: 'inventory',
      icon: '▣',
      label: game.commodityName,
      value: game.inventory,
      detail: <>冻结 {game.frozenInventory} · 容量 {inventoryUsed}/{game.inventoryCapacity}</>,
    },
    {
      id: 'market',
      icon: '↕',
      label: '最近成交',
      value: <>¤ {game.marketPrice}</>,
      compactValue: game.marketPrice,
      detail: <span className={derived.marketTrend >= 0 ? 'positive' : 'negative'}>{derived.marketTrend >= 0 ? '▲' : '▼'} {Math.abs(derived.marketTrend)}</span>,
      emphasis: 'market',
    },
  ];

  return (
    <GameShell model={model} statusItems={statusItems}>
      <PageRouter model={model} />
    </GameShell>
  );
}
