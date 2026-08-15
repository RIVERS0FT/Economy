import { useState, type ReactNode } from 'react';
import { ScrollArea } from '../ui/ScrollArea';
import {
  WorkspaceDialogLayerContext,
  WorkspaceFloatingLayerContext,
} from '../ui/WorkspaceFloatingLayer';

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
  workspaceBackground,
  workspaceChrome,
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
  workspaceBackground?: ReactNode;
  workspaceChrome?: ReactNode;
  children: ReactNode;
}) {
  const [floatingLayer, setFloatingLayer] = useState<HTMLDivElement | null>(null);
  const [dialogLayer, setDialogLayer] = useState<HTMLDivElement | null>(null);

  return (
    <WorkspaceFloatingLayerContext.Provider value={floatingLayer}>
      <WorkspaceDialogLayerContext.Provider value={dialogLayer}>
        <main
          className={classNames(
            rootClassName,
            'signed-in-shell',
            'sidebar-layout',
            sidebarCollapsed && 'sidebar-collapsed',
          )}
        >
          <div className="signed-in-shell__body">
            {sidebar}
            <section className={classNames('workspace', workspaceClassName)}>
              {workspaceBackground ? (
                <div className="workspace-background-layer" data-workspace-background-layer="true">
                  {workspaceBackground}
                </div>
              ) : null}
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
              {workspaceChrome ? (
                <div className="workspace-strategic-chrome" data-workspace-strategic-chrome="true">
                  {workspaceChrome}
                </div>
              ) : null}
              <div
                ref={setFloatingLayer}
                className="workspace-floating-layer"
                data-workspace-floating-layer="true"
              />
            </section>
          </div>
          <div
            className={classNames('mobile-chrome-overlay', 'signed-in-shell__chrome', chromeOverlayClassName)}
            data-admin-mobile-chrome={adminChromeLayer ? 'true' : undefined}
          >
            {chrome}
          </div>
          <div
            ref={setDialogLayer}
            className="workspace-dialog-layer"
            data-workspace-dialog-layer="true"
          />
        </main>
      </WorkspaceDialogLayerContext.Provider>
    </WorkspaceFloatingLayerContext.Provider>
  );
}
