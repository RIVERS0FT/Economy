import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useGameAuthorityDependencies } from '../../app/gameAuthorityStore';
import type { LoadedGameViewModel } from '../../app/gameViewModel';
import { DEFAULT_QQ_GROUP_URL, getCommunityLink } from '../../api/game';
import { BRAND_NAME } from '../../config/brand';
import { AssetsIcon, ChevronIcon, CreditsIcon, RankIcon, WarehouseIcon } from '../icons/GameIcons';
import { GemIcon } from '../icons/GemIcon';
import { CurrencyAmount } from '../ui/CurrencyAmount';
import { CompactNumber, CompactRank } from '../ui/CompactNumber';
import { MobileWorkspacePageSheet, type MobileWorkspaceSheetRequestClose } from '../ui/MobileWorkspacePageSheet';
import { formatCompactCurrency, formatCompactNumber, formatCurrency, formatRank } from '../../utils/formatters';
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
import {
  appendPlayerPageHistory,
  playerPageLocationForTab,
  playerPageLocationKey,
  tabForPlayerPageLocation,
  type PlayerPageLocation,
} from '../../navigation/playerPageStack';
import { PlayerPageNavigationProvider } from '../ui/PageNavigationContext';
import type { GameTutorialController } from '../../game-guide/useGameTutorial';
import {
  TransportRouteDraftContext,
  type TransportRouteDraft,
  type TransportRouteDraftContextValue,
} from './TransportRouteDraftContext';

const STRATEGIC_PAGE_PRESENTATION = {
  home: 'building',
  map: 'map',
  province: 'building',
  market: 'building',
  buildings: 'building',
  transport: 'building',
  research: 'fullscreen',
  auction: 'fullscreen',
  contracts: 'fullscreen',
  bank: 'fullscreen',
  leaderboard: 'fullscreen',
  'gem-shop': 'fullscreen',
  settings: 'building',
} as const;

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
  const [transportRouteDraft, setTransportRouteDraft] = useState<TransportRouteDraft | null>(null);
  const [transportRoutePicking, setTransportRoutePicking] = useState(false);
  const [highlightedRouteId, setHighlightedRouteId] = useState<string | null>(null);
  const initialPageLocation = playerPageLocationForTab(model.tab);
  const pageHistoryRef = useRef<PlayerPageLocation[]>([]);
  const pageLocationRef = useRef<PlayerPageLocation>(initialPageLocation);
  const [pageLocation, setPageLocation] = useState<PlayerPageLocation>(initialPageLocation);
  const observedTabRef = useRef<TabId>(model.tab);
  const mobilePageCloseRef = useRef<MobileWorkspaceSheetRequestClose | null>(null);
  const mobileSheetOpen = model.tab !== 'map';
  const previousMobileSheetOpenRef = useRef(mobileSheetOpen);
  const [mobileNavigationReturning, setMobileNavigationReturning] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [qqGroupUrl, setQqGroupUrl] = useState(DEFAULT_QQ_GROUP_URL);
  const { badges, auctionNewIds } = useNavigationBadges(model);
  const notificationCenter = useNotificationCenter(model);
  const notificationButtonRef = useRef<HTMLButtonElement>(null);
  const auctionNewIdSet = useMemo(() => new Set(auctionNewIds), [auctionNewIds]);
  const openBank = useCallback(() => {
    model.setTab('bank');
  }, [model.setTab]);
  const pagePresentation = STRATEGIC_PAGE_PRESENTATION[model.tab];
  const sourceTutorial = (model as LoadedGameViewModel & { tutorial?: GameTutorialController }).tutorial;
  const playerName = game.playerName.trim() || '玩家';

  const weeklyChange = derived.currentRank?.weeklyChange ?? 0;
  const weeklyMagnitude = Math.abs(weeklyChange);
  const currentRank = derived.currentRank?.rank ?? '--';
  const formattedRank = formatRank(derived.currentRank?.rank);
  const rankLabel = derived.currentRank ? `排名第 ${derived.currentRank.rank} 名` : '暂无排名';
  const weeklyTrendDirection = weeklyChange > 0 ? 'up' : weeklyChange < 0 ? 'down' : 'right';
  const weeklyChangeLabel = weeklyChange > 0
    ? `本周净资产上升 ${formatCurrency(weeklyMagnitude)}`
    : weeklyChange < 0
      ? `本周净资产下降 ${formatCurrency(weeklyMagnitude)}`
      : '本周净资产无变化';
  const statusItems = useMemo<StatusBarItem[]>(() => [
    {
      id: 'credits', icon: <CreditsIcon />, label: '可用资金', value: <CurrencyAmount>{formatCurrency(game.credits)}</CurrencyAmount>,
      compactValue: formatCompactCurrency(game.credits), detail: <>冻结 <CurrencyAmount>{formatCurrency(game.frozenCredits)}</CurrencyAmount></>,
    },
    {
      id: 'assets', icon: <AssetsIcon />, label: '净资产', value: <CurrencyAmount>{formatCurrency(derived.totalAssets)}</CurrencyAmount>,
      compactValue: formatCompactCurrency(derived.totalAssets),
      detail: <span className={weeklyChange > 0 ? 'positive' : weeklyChange < 0 ? 'negative' : 'neutral'} aria-label={weeklyChangeLabel}><span className="status-weekly-trend"><ChevronIcon direction={weeklyTrendDirection} /> 本周</span> <CurrencyAmount>{formatCurrency(weeklyMagnitude)}</CurrencyAmount></span>,
      emphasis: 'primary',
      onClick: openBank,
    },
    {
      id: 'gems', icon: <GemIcon />, label: '宝石', value: <CompactNumber value={game.gems} /> ,
      compactValue: formatCompactNumber(game.gems), detail: <>邀请好友可获得宝石</>,
    },
    {
      id: 'rank', icon: <RankIcon />, label: '排行榜',
      value: <CompactRank value={derived.currentRank?.rank} ariaLabel={rankLabel} />,
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
      id: 'warehouse', icon: <WarehouseIcon />, label: '仓库库存', value: <CompactNumber value={game.warehouseStoredQuantity} /> ,
      compactValue: formatCompactNumber(game.warehouseStoredQuantity),
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
    openBank,
    rankLabel,
    weeklyChange,
    weeklyChangeLabel,
    weeklyMagnitude,
    weeklyTrendDirection,
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

  useLayoutEffect(() => {
    const wasOpen = previousMobileSheetOpenRef.current;
    previousMobileSheetOpenRef.current = mobileSheetOpen;
    if (mobileSheetOpen) {
      setMobileNavigationReturning(false);
      return;
    }
    if (!wasOpen) return;
    const shouldAnimate = typeof window !== 'undefined'
      && window.matchMedia('(max-width: 720px)').matches
      && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setMobileNavigationReturning(shouldAnimate);
  }, [mobileSheetOpen]);

  const commitPlayerPageLocation = useCallback((location: PlayerPageLocation) => {
    pageLocationRef.current = location;
    setPageLocation(location);
    setCanGoBack(pageHistoryRef.current.length > 0);
  }, []);

  const applyPlayerPageLocation = useCallback((location: PlayerPageLocation) => {
    if ('provinceId' in location && model.selectedProvinceId !== location.provinceId) {
      model.setSelectedProvinceId(location.provinceId);
    }
    if (location.type === 'regional-product') {
      const alreadySelected = model.marketViewMode === 'detail'
        && model.marketAssetKind === 'commodity'
        && model.marketAssetId === location.productId;
      if (!alreadySelected) model.selectMarketAsset('commodity', location.productId, false);
    } else if (
      location.type === 'province'
      && location.section === 'market'
      && model.marketViewMode !== 'catalog'
    ) {
      model.showMarketCatalog();
    }

    const targetTab = tabForPlayerPageLocation(location);
    observedTabRef.current = targetTab;
    if (model.tab !== targetTab) model.setTab(targetTab);
    commitPlayerPageLocation(location);
  }, [
    commitPlayerPageLocation,
    model.marketAssetId,
    model.marketAssetKind,
    model.marketViewMode,
    model.selectedProvinceId,
    model.selectMarketAsset,
    model.setSelectedProvinceId,
    model.setTab,
    model.showMarketCatalog,
    model.tab,
  ]);

  const pushPlayerPage = useCallback((location: PlayerPageLocation) => {
    const current = pageLocationRef.current;
    if (playerPageLocationKey(current) === playerPageLocationKey(location)) return;
    pageHistoryRef.current = appendPlayerPageHistory(pageHistoryRef.current, current);
    applyPlayerPageLocation(location);
  }, [applyPlayerPageLocation]);

  const tutorial = useMemo(() => sourceTutorial ? {
    ...sourceTutorial,
    openCurrentTarget: () => sourceTutorial.targetLocation
      ? pushPlayerPage(sourceTutorial.targetLocation)
      : sourceTutorial.openCurrentTarget(),
  } : undefined, [sourceTutorial, pushPlayerPage]);

  const replacePlayerPage = useCallback((location: PlayerPageLocation) => {
    applyPlayerPageLocation(location);
  }, [applyPlayerPageLocation]);

  useEffect(() => {
    if (observedTabRef.current === model.tab) return;
    observedTabRef.current = model.tab;
    const next = playerPageLocationForTab(model.tab);
    const current = pageLocationRef.current;
    if (playerPageLocationKey(current) !== playerPageLocationKey(next)) {
      pageHistoryRef.current = appendPlayerPageHistory(pageHistoryRef.current, current);
    }
    commitPlayerPageLocation(next);
  }, [commitPlayerPageLocation, model.tab]);

  const returnToPreviousPage = useCallback(() => {
    const currentKey = playerPageLocationKey(pageLocationRef.current);
    let target = pageHistoryRef.current.pop();
    while (target && playerPageLocationKey(target) === currentKey) {
      target = pageHistoryRef.current.pop();
    }
    if (!target) {
      setCanGoBack(false);
      return;
    }
    applyPlayerPageLocation(target);
  }, [applyPlayerPageLocation]);

  const showMap = useCallback(() => {
    pageHistoryRef.current = [];
    applyPlayerPageLocation({ type: 'map' });
  }, [applyPlayerPageLocation]);

  const closeCurrentPage = useCallback(() => {
    const requestClose = mobilePageCloseRef.current;
    if (requestClose && typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches) {
      requestClose();
      return;
    }
    showMap();
  }, [showMap]);

  const selectPlayerTab = useCallback((tab: TabId) => {
    if (tab === 'map' && model.tab !== 'map') {
      const requestClose = mobilePageCloseRef.current;
      if (requestClose) {
        requestClose();
        return;
      }
      showMap();
      return;
    }
    if (tab === 'map') {
      showMap();
      return;
    }
    pushPlayerPage(playerPageLocationForTab(tab));
  }, [model.tab, pushPlayerPage, showMap]);

  const isMobileViewport = useCallback(() => (
    typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches
  ), []);

  const updateTransportRouteDraft = useCallback((patch: Partial<TransportRouteDraft>) => {
    setTransportRouteDraft((current) => (current ? { ...current, ...patch } : current));
  }, []);

  const closeTransportRouteDraft = useCallback(() => {
    setTransportRouteDraft(null);
    setTransportRoutePicking(false);
    setHighlightedRouteId(null);
  }, []);

  const beginTransportRoutePicking = useCallback(() => {
    setTransportRoutePicking(true);
    if (isMobileViewport()) mobilePageCloseRef.current?.();
  }, [isMobileViewport]);

  const returnFromTransportRoutePicking = useCallback(() => {
    setTransportRoutePicking(false);
    if (model.tab === 'map') selectPlayerTab('transport');
  }, [model.tab, selectPlayerTab]);

  const finishTransportRoutePicking = returnFromTransportRoutePicking;
  const cancelTransportRoutePicking = returnFromTransportRoutePicking;

  const closeTransportRouteLoop = useCallback(() => {
    setTransportRouteDraft((current) => {
      if (!current) return current;
      const stopIds = [
        current.sourceProvinceId,
        ...current.viaProvinceIds,
        current.destinationProvinceId,
      ].filter(Boolean);
      if (stopIds.length < 2 || stopIds[0] === stopIds[stopIds.length - 1]) return current;
      const previousDestination = current.destinationProvinceId;
      const firstStopId = stopIds[0];
      const nextViaProvinceIds = previousDestination && previousDestination !== firstStopId
        ? [...current.viaProvinceIds, previousDestination]
        : current.viaProvinceIds;
      return {
        ...current,
        viaProvinceIds: nextViaProvinceIds,
        destinationProvinceId: firstStopId,
      };
    });
  }, []);

  const resetTransportRouteStops = useCallback(() => {
    setTransportRouteDraft((current) => (
      current
        ? { ...current, sourceProvinceId: '', destinationProvinceId: '', viaProvinceIds: [] }
        : current
    ));
  }, []);

  const pickTransportRouteProvince = useCallback((provinceId: string) => {
    const current = transportRouteDraft;
    if (!current) return;
    const availableProvinceIds = new Set(game.provinces.map((province) => province.id));
    if (!availableProvinceIds.has(provinceId)) {
      void model.showResult({ ok: false, message: '州级地区无效，不能加入运输路线' });
      return;
    }
    const stopIds = [
      current.sourceProvinceId,
      ...current.viaProvinceIds,
      current.destinationProvinceId,
    ].filter(Boolean);
    if (stopIds.length === 0) {
      setTransportRouteDraft({ ...current, sourceProvinceId: provinceId });
      return;
    }
    const firstStopId = stopIds[0];
      if (provinceId === firstStopId) {
        if (stopIds.length >= 2 && stopIds[stopIds.length - 1] !== firstStopId) {
          const previousDestination = current.destinationProvinceId;
          const nextViaProvinceIds = previousDestination && previousDestination !== firstStopId
            ? [...current.viaProvinceIds, previousDestination]
            : current.viaProvinceIds;
          setTransportRouteDraft({
            ...current,
            viaProvinceIds: nextViaProvinceIds,
            destinationProvinceId: firstStopId,
          });
          return;
        }
      void model.showResult({ ok: false, message: '起点州已在线路中，请先选择其他站点后再闭环' });
      return;
    }
    if (stopIds.includes(provinceId)) {
      void model.showResult({ ok: false, message: '该州已在线路中' });
      return;
    }
    const closed = stopIds.length >= 3 && stopIds[stopIds.length - 1] === firstStopId;
    const nextStopIds = closed ? [...stopIds.slice(0, -1), provinceId] : [...stopIds, provinceId];
    const [sourceProvinceId, ...remainingStopIds] = nextStopIds;
    setTransportRouteDraft({
      ...current,
      sourceProvinceId,
      viaProvinceIds: remainingStopIds.slice(0, -1),
      destinationProvinceId: remainingStopIds[remainingStopIds.length - 1],
    });
  }, [game.provinces, model, transportRouteDraft]);

  useEffect(() => {
    if (transportRoutePicking && model.tab !== 'transport' && model.tab !== 'map') {
      setTransportRoutePicking(false);
    }
  }, [model.tab, transportRoutePicking]);

  useEffect(() => {
    if (model.tab !== 'transport') setHighlightedRouteId(null);
  }, [model.tab]);

  const transportRouteDraftValue = useMemo<TransportRouteDraftContextValue>(() => ({
    draft: transportRouteDraft,
    setDraft: setTransportRouteDraft,
    updateDraft: updateTransportRouteDraft,
    closeDraft: closeTransportRouteDraft,
    picking: transportRoutePicking,
    beginPicking: beginTransportRoutePicking,
    finishPicking: finishTransportRoutePicking,
    cancelPicking: cancelTransportRoutePicking,
    pickProvince: pickTransportRouteProvince,
    closeLoop: closeTransportRouteLoop,
    resetStops: resetTransportRouteStops,
    highlightedRouteId,
    setHighlightedRouteId,
  }), [
    beginTransportRoutePicking,
    cancelTransportRoutePicking,
    closeTransportRouteDraft,
    closeTransportRouteLoop,
    finishTransportRoutePicking,
    highlightedRouteId,
    pickTransportRouteProvince,
    resetTransportRouteStops,
    transportRouteDraft,
    transportRoutePicking,
    updateTransportRouteDraft,
  ]);

  return (
    <TransportRouteDraftContext.Provider value={transportRouteDraftValue}>
    <AuctionNewIdsContext.Provider value={auctionNewIdSet}>
      <ApplicationMapLayerPortal>
        <StrategicMapStage model={model} lens={mapLens} />
        <StrategicMapLensBar lens={mapLens} onLensChange={setMapLens} />
      </ApplicationMapLayerPortal>
      <SignedInShell
        rootClassName={`game-shell strategic-game-shell strategic-tab-${model.tab}`}
        workspaceClassName="strategic-workspace"
        integratedPrimaryCard
        pageTransitionKey={playerPageLocationKey(pageLocation)}
        sidebarCollapsed={sidebarCollapsed}
        sidebar={(
          <DesktopSidebar
            activeTab={model.tab}
            badges={badges}
            collapsed={sidebarCollapsed}
            qqGroupUrl={qqGroupUrl}
            onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
            onSelect={selectPlayerTab}
          />
        )}
        chrome={(
          <>
            <StatusBar
              items={statusItems}
              identity={{
                playerId: model.user.id,
                title: BRAND_NAME,
                playerName,
                onClick: () => selectPlayerTab('settings'),
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
            {notificationCenter.panelOpen ? null : (
              <NotificationToasts
                surface="mobile"
                toasts={notificationCenter.toasts}
                onOpen={notificationCenter.openPanel}
              />
            )}
            <NotificationCenterPanel
              open={notificationCenter.panelOpen}
              alertsEnabled={notificationCenter.alertsEnabled}
              pendingItems={notificationCenter.pendingItems}
              notifications={notificationCenter.notifications}
              onClose={notificationCenter.closePanel}
              onSetAlertsEnabled={notificationCenter.setAlertsEnabled}
              onClearRead={notificationCenter.clearRead}
              onDelete={notificationCenter.deleteOne}
              returnFocusRef={notificationButtonRef}
              onNavigate={(tab) => {
                notificationCenter.closePanel();
                selectPlayerTab(tab);
              }}
            />
            <MobileBottomNavigation
              activeTab={model.tab}
              badges={badges}
              onSelect={selectPlayerTab}
              workspaceSheetOpen={mobileSheetOpen}
              returning={mobileNavigationReturning}
              onReturnAnimationEnd={() => setMobileNavigationReturning(false)}
            />
          </>
        )}
        workspaceChrome={(
          <>
            <StrategicWorkspaceChrome
              model={model}
              tutorial={tutorial}
              pendingItems={notificationCenter.pendingItems}
            />
            {notificationCenter.panelOpen ? null : (
              <NotificationToasts
                surface="desktop"
                toasts={notificationCenter.toasts}
                onOpen={notificationCenter.openPanel}
              />
            )}
          </>
        )}
      >
        <PlayerPageNavigationProvider
          value={{
            canGoBack,
            currentLocation: pageLocation,
            onBack: returnToPreviousPage,
            onClose: closeCurrentPage,
            pushPage: pushPlayerPage,
            replacePage: replacePlayerPage,
          }}
        >
          <div
            className={`strategic-page-host strategic-page-host--${pagePresentation}`}
            data-strategic-page={model.tab}
            data-strategic-page-location={playerPageLocationKey(pageLocation)}
            data-strategic-presentation={pagePresentation}
            data-map-route-picking={transportRoutePicking ? 'true' : 'false'}
          >
            {model.tab === 'map' ? children : (
              <MobileWorkspacePageSheet
                pageKey={model.tab}
                onClose={showMap}
                requestCloseRef={mobilePageCloseRef}
              >
                {children}
              </MobileWorkspacePageSheet>
            )}
          </div>
        </PlayerPageNavigationProvider>
      </SignedInShell>
    </AuctionNewIdsContext.Provider>
    </TransportRouteDraftContext.Provider>
  );
}
