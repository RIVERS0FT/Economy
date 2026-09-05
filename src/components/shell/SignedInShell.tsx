import { useLayoutEffect, useState, type CSSProperties, type ReactNode } from 'react';
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
  const [tooltipBounds, setTooltipBounds] = useState<CSSProperties>({ visibility: 'hidden', width: 0, height: 0 });

  useLayoutEffect(() => {
    if (!floatingLayer) return undefined;
    let frame: number | null = null;
    const measure = () => {
      const bounds = floatingLayer.getBoundingClientRect();
      const viewport = window.visualViewport;
      const left = Math.max(bounds.left, viewport?.offsetLeft ?? 0);
      const top = Math.max(bounds.top, viewport?.offsetTop ?? 0);
      const right = Math.min(bounds.right, (viewport?.offsetLeft ?? 0) + (viewport?.width ?? window.innerWidth));
      const bottom = Math.min(bounds.bottom, (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight));
      const next = { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
      setTooltipBounds((current) => Object.entries(next).every(([key, value]) => current[key as keyof CSSProperties] === value)
        && current.visibility !== 'hidden' ? current : next);
    };
    const schedule = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => { frame = null; measure(); });
    };
    // Keep the existing safe rectangle, but escape the page body's stacking
    // context so library-managed chart tooltips can paint above a mobile Sheet.
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    observer?.observe(floatingLayer);
    if (floatingLayer.parentElement) observer?.observe(floatingLayer.parentElement);
    window.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('scroll', schedule);
    document.addEventListener('scroll', schedule, true);
    return () => {
      observer?.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('scroll', schedule);
      document.removeEventListener('scroll', schedule, true);
    };
  }, [floatingLayer, sidebarCollapsed]);

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
                style={{ position: 'fixed', inset: 'auto', ...tooltipBounds }}
              />
            </div>
          </main>
        </WorkspaceDialogLayerContext.Provider>
      </WorkspaceTooltipLayerContext.Provider>
    </WorkspaceFloatingLayerContext.Provider>
  );
}
