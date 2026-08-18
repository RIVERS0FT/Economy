import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useGameAuthorityDependencies } from '../../app/gameAuthorityStore';
import type { LoadedGameViewModel } from '../../app/gameViewModel';
import { DEFAULT_QQ_GROUP_URL, getCommunityLink } from '../../api/game';
import { BRAND_LOGO_URL, BRAND_NAME } from '../../config/brand';
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
import { ApplicationMapLayerPortal } from '../visual/ApplicationLayerRoot';
import {
  StrategicMapLensBar,
  StrategicMapStage,
  StrategicWorkspaceChrome,
} from './StrategicWorkspace';
import type { ProvinceMapLens } from '../provinces/UsMainlandMap';
import type { TabId } from '../../config/navigation';
import { PlayerPageNavigationProvider } from '../ui/PageNavigationContext';
import type { GameTutorialController } from '../../game-guide/useGameTutorial';

const STRATEGIC_PAGE_PRESENTATION = {
  home: 'building',
  map: 'map',
  province: 'building',
  market: 'building',
  buildings: 'building',
  research: 'fullscreen',
  auction: 'fullscreen',
  contracts: 'fullscreen',
  bank: 'fullscreen',
  leaderboard: 'fullscreen',
  'gem-shop': 'fullscreen',
  settings: 'building',
} as const;

const HIDDEN_EVENT_RAIL_TABS = new Set<TabId>([
  'research',
  'auction',
  'contracts',
  'bank',
  'leaderboard',
  'gem-shop',
]);

export function GameShell({ model, children, offline = false }: {
  model: LoadedGameViewModel;
  statusItems?: StatusBarItem[];
  children: ReactNode;
  offline?: boolean;
}) {
  const authorityGame = useGameAuthorityDependencies(['player.identity', 'player.assets', 'leaderboard']);
  const game = authorityGame ?? model.game;
  const derived = model.derived;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [mapLens, setMapLens] = useState<ProvinceMapLens>('assets');
  const pageHistoryRef = useRef<TabId[]>([]);
  const observedTabRef = useRef<TabId>(model.tab);
  const skipNextHistoryRef = useRef(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [qqGroupUrl, setQqGroupUrl] = useState(DEFAULT_QQ_GROUP_URL);
  const { badges, auctionNewIds } = useNavigationBadges(model);
  const notificationCenter = useNotificationCenter(model);
  const notificationButtonRef = useRef<HTMLButtonElement>(null);
  const auctionNewIdSet = useMemo(() => new Set(auctionNewIds), [auctionNewIds]);
  const openBank = useCallback(() => model.setTab('bank'), [model.setTab]);
  const pagePresentation = STRATEGIC_PAGE_PRESENTATION[model.tab];
  const tutorial = (model as LoadedGameViewModel & { tutorial?: GameTutorialController }).tutorial;
  const playerName = game.playerName.trim() || '玩家';

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

  useEffect(() => {
    const previousTab = observedTabRef.current;
    if (previousTab === model.tab) return;
    if (skipNextHistoryRef.current) {
      skipNextHistoryRef.current = false;
    } else if (previousTab !== 'map' && previousTab !== 'province') {
      pageHistoryRef.current = [...pageHistoryRef.current, previousTab].slice(-20);
    }
    observedTabRef.current = model.tab;
    setCanGoBack(pageHistoryRef.current.length > 0);
  }, [model.tab]);

  const returnToPreviousPage = useCallback(() => {
    let target = pageHistoryRef.current.pop();
    while (target === model.tab) target = pageHistoryRef.current.pop();
    setCanGoBack(pageHistoryRef.current.length > 0);
    if (!target) return;
    skipNextHistoryRef.current = true;
    model.setTab(target);
  }, [model.setTab, model.tab]);

  const closeCurrentPage = useCallback(() => {
    model.setTab('map');
  }, [model.setTab]);

  return (
    <AuctionNewIdsContext.Provider value={auctionNewIdSet}>
      <ApplicationMapLayerPortal>
        <StrategicMapStage model={model} lens={mapLens} />
        <StrategicMapLensBar lens={mapLens} onLensChange={setMapLens} />
      </ApplicationMapLayerPortal>
      <SignedInShell
        rootClassName={`game-shell strategic-game-shell strategic-tab-${model.tab}`}
        workspaceClassName="strategic-workspace"
        integratedPrimaryCard
        pageTransitionKey={model.tab}
        sidebarCollapsed={sidebarCollapsed}
        sidebar={(
          <DesktopSidebar
            activeTab={model.tab}
            badges={badges}
            collapsed={sidebarCollapsed}
            qqGroupUrl={qqGroupUrl}
            onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
            onSelect={model.setTab}
          />
        )}
        chrome={(
          <>
            <StatusBar
              items={statusItems}
              identity={{
                logoSrc: BRAND_LOGO_URL,
                title: BRAND_NAME,
                playerName,
              }}
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
        workspaceChrome={(
          <StrategicWorkspaceChrome
            model={model}
            tutorial={tutorial}
            showEventRail={!HIDDEN_EVENT_RAIL_TABS.has(model.tab)}
          />
        )}
      >
        <PlayerPageNavigationProvider
          value={{
            canGoBack,
            onBack: returnToPreviousPage,
            onClose: closeCurrentPage,
          }}
        >
          <div
            className={`strategic-page-host strategic-page-host--${pagePresentation}`}
            data-strategic-page={model.tab}
            data-strategic-presentation={pagePresentation}
          >
            {children}
          </div>
        </PlayerPageNavigationProvider>
      </SignedInShell>
      {!game.startingProvinceChosen ? (
        <div className="starting-province-overlay" role="dialog" aria-modal="true" aria-label="选择起始州">
          <section className="starting-province-panel">
            <h2>选择起始州</h2>
            <p>新玩家需要选择一块起始地块，选定后永久绑定，之后可以解锁其他州并使用市场、工厂与仓库。</p>
            <div className="starting-province-grid">
              {game.provinces.map((province) => (
                <button
                  type="button"
                  key={province.id}
                  className="starting-province-option"
                  data-ui-interactive="surface"
                  onClick={() => void model.showResult(model.chooseStartingProvince(province.id))}
                >
                  <strong>{province.name}</strong>
                  <small>{province.shortName}</small>
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </AuctionNewIdsContext.Provider>
  );
}
