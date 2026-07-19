import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { LoadedGameViewModel } from '../../app/gameViewModel';
import { DEFAULT_QQ_GROUP_URL, getCommunityLink } from '../../api/game';
import { CurrencyText } from '../ui/CurrencyAmount';
import { DesktopSidebar } from './DesktopSidebar';
import { MobileBottomNavigation } from './MobileBottomNavigation';
import { StatusBar, type StatusBarItem } from './StatusBar';

const PAGE_SCROLLBAR_IDLE_DELAY_MS = 1_200;
const PAGE_SCROLL_ACTIVITY_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'PageUp',
  'PageDown',
  'Home',
  'End',
  ' ',
]);

function isEditableTarget(target: EventTarget | null) {
  return target instanceof HTMLElement
    && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

export function GameShell({ model, statusItems, children }: {
  model: LoadedGameViewModel;
  statusItems: StatusBarItem[];
  children: ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [qqGroupUrl, setQqGroupUrl] = useState(DEFAULT_QQ_GROUP_URL);
  const pageScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    void getCommunityLink(controller.signal)
      .then((config) => setQqGroupUrl(config.qqGroupUrl))
      .catch(() => { /* Keep the bundled default when configuration cannot be loaded. */ });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const scrollport = pageScrollRef.current;
    if (!scrollport) return undefined;

    let hideTimer: number | undefined;
    const hideScrollbar = () => {
      delete scrollport.dataset.scrollbarActive;
      hideTimer = undefined;
    };
    const revealScrollbar = () => {
      scrollport.dataset.scrollbarActive = 'true';
      if (hideTimer !== undefined) window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(hideScrollbar, PAGE_SCROLLBAR_IDLE_DELAY_MS);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!PAGE_SCROLL_ACTIVITY_KEYS.has(event.key) || isEditableTarget(event.target)) return;
      revealScrollbar();
    };

    scrollport.addEventListener('scroll', revealScrollbar, { passive: true });
    scrollport.addEventListener('wheel', revealScrollbar, { passive: true });
    scrollport.addEventListener('pointermove', revealScrollbar, { passive: true });
    scrollport.addEventListener('pointerdown', revealScrollbar, { passive: true });
    scrollport.addEventListener('focusin', revealScrollbar);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      scrollport.removeEventListener('scroll', revealScrollbar);
      scrollport.removeEventListener('wheel', revealScrollbar);
      scrollport.removeEventListener('pointermove', revealScrollbar);
      scrollport.removeEventListener('pointerdown', revealScrollbar);
      scrollport.removeEventListener('focusin', revealScrollbar);
      window.removeEventListener('keydown', handleKeyDown);
      if (hideTimer !== undefined) window.clearTimeout(hideTimer);
      delete scrollport.dataset.scrollbarActive;
    };
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
        <div ref={pageScrollRef} className="page-scroll">{children}</div>
      </section>
      <MobileBottomNavigation
        activeTab={model.tab}
        openOrderCount={model.derived.ownOpenOrders.length}
        onSelect={model.setTab}
      />
    </main>
  );
}
