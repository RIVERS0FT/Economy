import { useLayoutEffect, useState, type ReactNode } from 'react';
import { FrostedGlassSurface } from '../ui/FrostedGlassSurface';
import { ScrollArea } from '../ui/ScrollArea';
import {
  WorkspaceDialogLayerContext,
  WorkspaceFloatingLayerContext,
  WorkspaceTooltipLayerContext,
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
  integratedPrimaryCard = false,
  pageTransitionKey,
  sidebarCollapsed,
  sidebar,
  chrome,
  workspaceChrome,
  children,
}: {
  rootClassName: string;
  workspaceClassName?: string;
  pageViewportClassName?: string;
  pageFrameClassName?: string;
  chromeOverlayClassName?: string;
  adminChromeLayer?: boolean;
  integratedPrimaryCard?: boolean;
  pageTransitionKey?: string;
  sidebarCollapsed: boolean;
  sidebar: ReactNode;
  chrome: ReactNode;
  workspaceChrome?: ReactNode;
  children: ReactNode;
}) {
  const [floatingLayer, setFloatingLayer] = useState<HTMLDivElement | null>(null);
  const [tooltipLayer, setTooltipLayer] = useState<HTMLDivElement | null>(null);
  const [dialogLayer, setDialogLayer] = useState<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!floatingLayer || !tooltipLayer) return undefined;
    // DOM ownership and safe geometry are separate: ECharts owns its HTML node,
    // so its stable host must clear the Sheet without entering the top layer.
    // Copy the existing safe rectangle rather than duplicating Chrome insets.
    let frame: number | null = null;
    const update = () => {
      const rect = floatingLayer.getBoundingClientRect();
      const viewport = window.visualViewport;
      const left = Math.max(rect.left, viewport?.offsetLeft ?? 0);
      const top = Math.max(rect.top, viewport?.offsetTop ?? 0);
      const right = Math.min(rect.right, (viewport?.offsetLeft ?? 0) + (viewport?.width ?? window.innerWidth));
      const bottom = Math.min(rect.bottom, (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight));
      Object.assign(tooltipLayer.style, {
        left: `${left}px`, top: `${top}px`,
        width: `${Math.max(0, right - left)}px`, height: `${Math.max(0, bottom - top)}px`,
      });
    };
    const schedule = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => { frame = null; update(); });
    };
    update();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    observer?.observe(floatingLayer);
    window.addEventListener('resize', schedule);
    document.addEventListener('scroll', schedule, true);
    window.visualViewport?.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('scroll', schedule);
    return () => {
      observer?.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
      document.removeEventListener('scroll', schedule, true);
      window.visualViewport?.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('scroll', schedule);
    };
  }, [floatingLayer, tooltipLayer, sidebarCollapsed]);

  const pageContent = pageFrameClassName ? <div className={pageFrameClassName}>{children}</div> : children;
  const pageLayer = (
    <div className="mobile-page-overlay">
      <ScrollArea
        axis="y"
        className="page-scroll-area"
        viewportClassName={classNames('page-scroll', pageViewportClassName)}
        scrollbarVisibility="adaptive"
      >
        {pageTransitionKey ? (
          <div className="signed-in-shell__page-reveal" data-page-transition-key={pageTransitionKey}>
            <div className="signed-in-shell__page-reveal-inner">
              {pageContent}
            </div>
          </div>
        ) : pageContent}
      </ScrollArea>
    </div>
  );
  const workspaceLayers = (
    <>
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
    </>
  );

  return (
    <WorkspaceFloatingLayerContext.Provider value={floatingLayer}>
      <WorkspaceTooltipLayerContext.Provider value={tooltipLayer}>
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
              {integratedPrimaryCard ? (
                <section className={classNames('workspace', workspaceClassName)}>
                  <FrostedGlassSurface variant="workspaceCard" className="signed-in-shell__primary-card">
                    {sidebar}
                    <div className="signed-in-shell__primary-page">
                      {pageLayer}
                    </div>
                  </FrostedGlassSurface>
                  {workspaceLayers}
                </section>
              ) : (
                <>
                  {sidebar}
                  <section className={classNames('workspace', workspaceClassName)}>
                    {pageLayer}
                    {workspaceLayers}
                  </section>
                </>
              )}
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
            >
              <div
                ref={setTooltipLayer}
                className="workspace-tooltip-layer"
                data-workspace-tooltip-layer="true"
              />
            </div>
          </main>
        </WorkspaceDialogLayerContext.Provider>
      </WorkspaceTooltipLayerContext.Provider>
    </WorkspaceFloatingLayerContext.Provider>
  );
}
