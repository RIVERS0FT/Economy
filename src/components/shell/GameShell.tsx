import type { ReactNode } from 'react';
import type { LoadedGameViewModel } from '../../app/gameViewModel';
import { DesktopSidebar } from './DesktopSidebar';
import { MobileBottomNavigation } from './MobileBottomNavigation';
import { StatusBar, type StatusBarItem } from './StatusBar';

export function GameShell({ model, statusItems, children }: {
  model: LoadedGameViewModel;
  statusItems: StatusBarItem[];
  children: ReactNode;
}) {
  return (
    <main className="game-shell">
      <DesktopSidebar
        playerName={model.game.playerName}
        activeTab={model.tab}
        openOrderCount={model.derived.ownOpenOrders.length}
        onSelect={model.setTab}
        onSignOut={() => void model.signOut()}
      />
      <section className="workspace">
        <StatusBar items={statusItems} />
        {model.notice ? <div className="notice-toast">{model.notice}</div> : null}
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
