import { useEffect, useState, type ReactNode } from 'react';
import type { LoadedGameViewModel } from '../../app/gameViewModel';
import { DEFAULT_QQ_GROUP_URL, getCommunityLink } from '../../api/game';
import { CurrencyText } from '../ui/CurrencyAmount';
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

  useEffect(() => {
    const controller = new AbortController();
    void getCommunityLink(controller.signal)
      .then((config) => setQqGroupUrl(config.qqGroupUrl))
      .catch(() => { /* Keep the bundled default when configuration cannot be loaded. */ });
    return () => controller.abort();
  }, []);

  return (
    <SignedInShell
      rootClassName="game-shell"
      sidebarCollapsed={sidebarCollapsed}
      sidebar={(
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
      )}
      chrome={(
        <>
          <StatusBar items={statusItems} />
          {model.notice ? (
            <div className="mobile-notice-region">
              <div className="notice-toast" role="status" aria-live="polite" aria-atomic="true">
                <CurrencyText>{model.notice}</CurrencyText>
              </div>
            </div>
          ) : null}
          <MobileBottomNavigation
            activeTab={model.tab}
            openOrderCount={model.derived.ownOpenOrders.length}
            onSelect={model.setTab}
          />
        </>
      )}
    >
      {children}
    </SignedInShell>
  );
}
