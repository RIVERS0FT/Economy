import { useEffect, useState, type ReactNode } from 'react';
import type { LoadedGameViewModel } from '../../app/gameViewModel';
import { DEFAULT_QQ_GROUP_URL, getCommunityLink } from '../../api/game';
import { CurrencyText } from '../ui/CurrencyAmount';
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
    <main className={sidebarCollapsed ? 'game-shell sidebar-collapsed' : 'game-shell'}>
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
        <div className="page-scroll">{children}</div>
      </section>
      <MobileBottomNavigation
        activeTab={model.tab}
        openOrderCount={model.derived.ownOpenOrders.length}
        onSelect={model.setTab}
      />
    </main>
  );
}
