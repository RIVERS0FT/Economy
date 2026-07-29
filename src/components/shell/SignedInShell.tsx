import type { ReactNode } from 'react';
import { ScrollArea } from '../ui/ScrollArea';

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export function SignedInShell({
  rootClassName,
  workspaceClassName = '',
  pageViewportClassName = '',
  pageFrameClassName = '',
  chromeOverlayClassName = '',
  adminChromeLayer = false,
  sidebarCollapsed,
  sidebar,
  chrome,
  children,
}: {
  rootClassName: string;
  workspaceClassName?: string;
  pageViewportClassName?: string;
  pageFrameClassName?: string;
  chromeOverlayClassName?: string;
  adminChromeLayer?: boolean;
  sidebarCollapsed: boolean;
  sidebar: ReactNode;
  chrome: ReactNode;
  children: ReactNode;
}) {
  return (
    <main
      className={classNames(
        rootClassName,
        'signed-in-shell',
        'sidebar-layout',
        sidebarCollapsed && 'sidebar-collapsed',
      )}
    >
      {sidebar}
      <section className={classNames('workspace', workspaceClassName)}>
        <div className="mobile-page-overlay">
          <ScrollArea
            axis="y"
            className="page-scroll-area"
            viewportClassName={classNames('page-scroll', pageViewportClassName)}
            scrollbarVisibility="adaptive"
          >
            {pageFrameClassName ? <div className={pageFrameClassName}>{children}</div> : children}
          </ScrollArea>
        </div>
        <div
          className={classNames('mobile-chrome-overlay', chromeOverlayClassName)}
          data-admin-mobile-chrome={adminChromeLayer ? 'true' : undefined}
        >
          {chrome}
        </div>
      </section>
    </main>
  );
}
