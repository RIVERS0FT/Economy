import { useState, type ReactNode } from 'react';
import type { LoadedGameViewModel } from '../../app/gameViewModel';
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

  return (
    <main className={sidebarCollapsed ? 'game-shell sidebar-collapsed' : 'game-shell'}>
      <DesktopSidebar
        playerName={model.game.playerName}
        activeTab={model.tab}
        openOrderCount={model.derived.ownOpenOrders.length}
        collapsed={sidebarCollapsed}
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
