import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { LoadedGameViewModel } from '../../app/gameViewModel';
import { DEFAULT_QQ_GROUP_URL, getCommunityLink } from '../../api/game';
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

export function GameShell({ model, statusItems, children }: {
  model: LoadedGameViewModel;
  statusItems: StatusBarItem[];
  children: ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [qqGroupUrl, setQqGroupUrl] = useState(DEFAULT_QQ_GROUP_URL);
  const { badges, auctionNewIds } = useNavigationBadges(model);
  const notificationCenter = useNotificationCenter(model);
  const notificationButtonRef = useRef<HTMLButtonElement>(null);
  const auctionNewIdSet = useMemo(() => new Set(auctionNewIds), [auctionNewIds]);

  useEffect(() => {
    const controller = new AbortController();
    void getCommunityLink(controller.signal)
      .then((config) => setQqGroupUrl(config.qqGroupUrl))
      .catch(() => { /* Keep the bundled default when configuration cannot be loaded. */ });
    return () => controller.abort();
  }, []);

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
            playerName={model.game.playerName}
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
