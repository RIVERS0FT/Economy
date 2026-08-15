import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useGameAuthorityDependencies } from '../../app/gameAuthorityStore';
import type { LoadedGameViewModel } from '../../app/gameViewModel';
import { DEFAULT_QQ_GROUP_URL, getCommunityLink } from '../../api/game';
import { AssetsIcon, CreditsIcon, RankIcon, WarehouseIcon } from '../icons/GameIcons';
import { GemIcon } from '../icons/GemIcon';
import { CurrencyAmount } from '../ui/CurrencyAmount';
import { formatCompactNumber, formatCurrency, formatNumber, formatRank } from '../../utils/formatters';
import { AuctionNewIdsContext, useNavigationBadges } from '../../hooks/useNavigationBadges';
import { useNotificationCenter } from '../../hooks/useNotificationCenter';
import {
  NotificationCenterButton,
  NotificationCenterPanel,
  NotificationToasts,
} from '../notifications/NotificationCenter';
import { DesktopSidebar } from './DesktopSidebar';
import { MobileBottomNavigation } from './MobileBottomNavigation';
import { SignedInShell } from './SignedInShell';
import { StatusBar, type StatusBarItem } from './StatusBar';

export function GameShell({ model, children, offline = false }: {
  model: LoadedGameViewModel;
  statusItems?: StatusBarItem[];
  children: ReactNode;
  offline?: boolean;
}) {
  const authorityGame = useGameAuthorityDependencies(['player.identity', 'player.assets', 'leaderboard']);
  const game = authorityGame ?? model.game;
  const derived = model.derived;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [qqGroupUrl, setQqGroupUrl] = useState(DEFAULT_QQ_GROUP_URL);
  const { badges, auctionNewIds } = useNavigationBadges(model);
  const notificationCenter = useNotificationCenter(model);
  const notificationButtonRef = useRef<HTMLButtonElement>(null);
  const auctionNewIdSet = useMemo(() => new Set(auctionNewIds), [auctionNewIds]);
  const openBank = useCallback(() => model.setTab('bank'), [model.setTab]);

  const weeklyChange = derived.currentRank?.weeklyChange ?? 0;
  const weeklyMagnitude = Math.abs(weeklyChange);
  const currentRank = derived.currentRank?.rank ?? '--';
  const formattedRank = formatRank(derived.currentRank?.rank);
  const rankLabel = derived.currentRank ? `排名第 ${derived.currentRank.rank} 名` : '暂无排名';
  const weeklyTrend = weeklyChange > 0 ? '↑' : weeklyChange < 0 ? '↓' : '→';
  const weeklyChangeLabel = weeklyChange > 0
    ? `本周净资产上升 ${formatCurrency(weeklyMagnitude)}`
    : weeklyChange < 0
      ? `本周净资产下降 ${formatCurrency(weeklyMagnitude)}`
      : '本周净资产无变化';
  const statusItems = useMemo<StatusBarItem[]>(() => [
    {
      id: 'credits', icon: <CreditsIcon />, label: '可用资金', value: <CurrencyAmount>{formatCurrency(game.credits)}</CurrencyAmount>,
      compactValue: formatCompactNumber(game.credits), detail: <>冻结 <CurrencyAmount>{formatCurrency(game.frozenCredits)}</CurrencyAmount></>,
    },
    {
      id: 'assets', icon: <AssetsIcon />, label: '净资产', value: <CurrencyAmount>{formatCurrency(derived.totalAssets)}</CurrencyAmount>,
      compactValue: formatCompactNumber(derived.totalAssets),
      detail: <span className={weeklyChange > 0 ? 'positive' : weeklyChange < 0 ? 'negative' : 'neutral'} aria-label={weeklyChangeLabel}>{weeklyTrend} 本周 <CurrencyAmount>{formatCurrency(weeklyMagnitude)}</CurrencyAmount></span>,
      emphasis: 'primary',
      onClick: openBank,
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
      id: 'warehouse', icon: <WarehouseIcon />, label: '仓库库存', value: formatNumber(game.warehouseStoredQuantity),
      compactValue: formatCompactNumber(game.warehouseStoredQuantity),
      detail: <>无限容量 · 实物库存总量</>,
    },
  ], [
    currentRank,
    derived.currentRank,
    derived.previousRank,
    derived.totalAssets,
    formattedRank,
    game.credits,
    game.frozenCredits,
    game.gems,
    game.warehouseStoredQuantity,
    model.compactNumbers,
    openBank,
    rankLabel,
    weeklyChange,
    weeklyChangeLabel,
    weeklyMagnitude,
    weeklyTrend,
  ]);

  useEffect(() => {
    if (offline) return undefined;
    const controller = new AbortController();
    void getCommunityLink(controller.signal)
      .then((config) => setQqGroupUrl(config.qqGroupUrl))
      .catch(() => { /* Keep the bundled default when configuration cannot be loaded. */ });
    return () => controller.abort();
  }, [offline]);

  useEffect(() => {
    notificationCenter.closePanel();
  }, [model.tab, notificationCenter.closePanel]);

  return (
    <AuctionNewIdsContext.Provider value={auctionNewIdSet}>
      <SignedInShell
        rootClassName="game-shell"
        sidebarCollapsed={sidebarCollapsed}
        sidebar={(
          <DesktopSidebar
            playerName={game.playerName}
            activeTab={model.tab}
            badges={badges}
            collapsed={sidebarCollapsed}
            qqGroupUrl={qqGroupUrl}
            onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
            onSelect={model.setTab}
            onSignOut={() => void model.signOut()}
          />
        )}
        chrome={(
          <>
            <StatusBar
              items={statusItems}
              action={(
                <NotificationCenterButton
                  open={notificationCenter.panelOpen}
                  pendingCount={notificationCenter.pendingCount}
                  unreadCount={notificationCenter.unreadCount}
                  onToggle={notificationCenter.togglePanel}
                  buttonRef={notificationButtonRef}
                />
              )}
            />
            <NotificationToasts
              toasts={notificationCenter.toasts}
              onOpen={notificationCenter.openPanel}
            />
            <NotificationCenterPanel
              open={notificationCenter.panelOpen}
              pendingItems={notificationCenter.pendingItems}
              notifications={notificationCenter.notifications}
              onClose={notificationCenter.closePanel}
              onClearRead={notificationCenter.clearRead}
              onDelete={notificationCenter.deleteOne}
              returnFocusRef={notificationButtonRef}
              onNavigate={(tab) => {
                notificationCenter.closePanel();
                model.setTab(tab);
              }}
            />
            <MobileBottomNavigation
              activeTab={model.tab}
              badges={badges}
              onSelect={model.setTab}
            />
          </>
        )}
      >
        {children}
      </SignedInShell>
    </AuctionNewIdsContext.Provider>
  );
}
