import { useEffect, useState, type ReactNode } from 'react';
import type { LoadedGameViewModel } from '../../app/gameViewModel';
import { DEFAULT_QQ_GROUP_URL, getCommunityLink } from '../../api/game';
import { CurrencyText } from '../ui/CurrencyAmount';
import { ScrollArea } from '../ui/ScrollArea';
import { DesktopSidebar } from './DesktopSidebar';
import { MobileBottomNavigation } from './MobileBottomNavigation';
import { StatusBar, type StatusBarItem } from './StatusBar';

export function GameShell({ model, statusItems, children }: {
  model: LoadedGameViewModel;
  statusItems: StatusBarItem[];
  children: ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [qqGroupUrl, setQqGroupUrl] = useState(DEFAULT_QQ_GROUP_URL);

  useEffect(() => {
    const controller = new AbortController();
    void getCommunityLink(controller.signal)
      .then((config) => setQqGroupUrl(config.qqGroupUrl))
      .catch(() => { /* Keep the bundled default when configuration cannot be loaded. */ });
    return () => controller.abort();
  }, []);

  return (
    <main className={sidebarCollapsed ? 'game-shell sidebar-layout sidebar-collapsed' : 'game-shell sidebar-layout'}>
      <DesktopSidebar
        playerName={model.game.playerName}
        activeTab={model.tab}
        openOrderCount={model.derived.ownOpenOrders.length}
        collapsed={sidebarCollapsed}
        qqGroupUrl={qqGroupUrl}
        onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
        onSelect={model.setTab}
        onSignOut={() => void model.signOut()}
      />
      <section className="workspace">
        <StatusBar items={statusItems} />
        {model.notice ? <div className="notice-toast"><CurrencyText>{model.notice}</CurrencyText></div> : null}
        <ScrollArea
          axis="y"
          className="page-scroll-area"
          viewportClassName="page-scroll"
          verticalAutoHide
          idleDelay={1_200}
        >
          {children}
        </ScrollArea>
      </section>
      <MobileBottomNavigation
        activeTab={model.tab}
        openOrderCount={model.derived.ownOpenOrders.length}
        onSelect={model.setTab}
      />
    </main>
  );
}
