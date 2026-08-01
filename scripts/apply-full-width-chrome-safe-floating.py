from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding='utf-8').replace('\r\n', '\n')


def write(path: str, content: str) -> None:
    normalized = '\n'.join(line.rstrip() for line in content.replace('\r\n', '\n').split('\n')).rstrip() + '\n'
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(normalized, encoding='utf-8')


def replace_once(content: str, old: str, new: str, label: str) -> str:
    if content.count(old) != 1:
        raise SystemExit(f'{label}: expected one anchor, found {content.count(old)}')
    return content.replace(old, new, 1)


write('src/components/ui/WorkspaceFloatingLayer.tsx', '''import { createContext, useContext } from 'react';

export const WorkspaceFloatingLayerContext = createContext<HTMLElement | null>(null);

export function useWorkspaceFloatingLayer() {
  return useContext(WorkspaceFloatingLayerContext);
}
''')

write('src/components/ui/SafeTooltip.tsx', '''import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useWorkspaceFloatingLayer } from './WorkspaceFloatingLayer';

const SAFE_FLOATING_GAP = 8;

type FloatingPosition = { left: number; top: number; maxWidth: number; maxHeight: number };

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

export function SafeTooltip({
  content,
  children,
  className = '',
}: {
  content: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const floatingLayer = useWorkspaceFloatingLayer();
  const tooltipId = useId();
  const anchorRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<FloatingPosition>({
    left: SAFE_FLOATING_GAP,
    top: SAFE_FLOATING_GAP,
    maxWidth: 320,
    maxHeight: 240,
  });

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    const tooltip = tooltipRef.current;
    if (!floatingLayer || !anchor || !tooltip) return;

    const layerRect = floatingLayer.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const maxWidth = Math.max(1, layerRect.width - SAFE_FLOATING_GAP * 2);
    const maxHeight = Math.max(1, layerRect.height - SAFE_FLOATING_GAP * 2);
    const tooltipWidth = Math.min(tooltipRect.width, maxWidth);
    const tooltipHeight = Math.min(tooltipRect.height, maxHeight);
    const centeredLeft = anchorRect.left + anchorRect.width / 2 - layerRect.left - tooltipWidth / 2;
    const belowTop = anchorRect.bottom - layerRect.top + SAFE_FLOATING_GAP;
    const aboveTop = anchorRect.top - layerRect.top - tooltipHeight - SAFE_FLOATING_GAP;
    const preferredTop = belowTop + tooltipHeight <= layerRect.height - SAFE_FLOATING_GAP
      ? belowTop
      : aboveTop;

    setPosition({
      left: clamp(centeredLeft, SAFE_FLOATING_GAP, layerRect.width - tooltipWidth - SAFE_FLOATING_GAP),
      top: clamp(preferredTop, SAFE_FLOATING_GAP, layerRect.height - tooltipHeight - SAFE_FLOATING_GAP),
      maxWidth,
      maxHeight,
    });
  }, [floatingLayer]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    updatePosition();
    const frame = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(frame);
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return undefined;
    const handleViewportChange = () => updatePosition();
    window.addEventListener('resize', handleViewportChange);
    document.addEventListener('scroll', handleViewportChange, true);
    return () => {
      window.removeEventListener('resize', handleViewportChange);
      document.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [open, updatePosition]);

  const tooltip = open && floatingLayer
    ? createPortal(
      <div
        ref={tooltipRef}
        id={tooltipId}
        className="safe-tooltip"
        role="tooltip"
        style={{
          left: `${position.left}px`,
          top: `${position.top}px`,
          maxWidth: `${position.maxWidth}px`,
          maxHeight: `${position.maxHeight}px`,
        }}
      >
        {content}
      </div>,
      floatingLayer,
    )
    : null;

  return (
    <>
      <span
        ref={anchorRef}
        className={className ? `safe-tooltip-anchor ${className}` : 'safe-tooltip-anchor'}
        aria-describedby={open ? tooltipId : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        {children}
      </span>
      {tooltip}
    </>
  );
}
''')

write('src/components/shell/SignedInShell.tsx', '''import { useState, type ReactNode } from 'react';
import { ScrollArea } from '../ui/ScrollArea';
import { WorkspaceFloatingLayerContext } from '../ui/WorkspaceFloatingLayer';

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
  const [floatingLayer, setFloatingLayer] = useState<HTMLDivElement | null>(null);

  return (
    <WorkspaceFloatingLayerContext.Provider value={floatingLayer}>
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
      </main>
    </WorkspaceFloatingLayerContext.Provider>
  );
}
''')

write('src/components/shell/AdminDesktopBar.tsx', '''import { SafeTooltip } from '../ui/SafeTooltip';
import { LiquidGlassSurface } from '../ui/LiquidGlassSurface';
import { Button } from '../ui/layout';

export function AdminDesktopBar({
  title,
  description,
  email,
  worldVersion,
  apiStatus,
  onRefresh,
}: {
  title: string;
  description: string;
  email: string;
  worldVersion?: number;
  apiStatus?: string;
  onRefresh: () => void;
}) {
  return (
    <header className="asset-bar admin-command-bar" aria-label="管理员工作栏">
      <LiquidGlassSurface variant="desktopStatusBar">
        <div className="admin-command-bar-content">
          <div className="admin-command-bar-copy">
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
          <div className="admin-command-bar-actions">
            <SafeTooltip content={email} className="admin-command-bar-identity">{email}</SafeTooltip>
            <small>
              世界版本 {worldVersion ?? '—'} · API {apiStatus ?? '—'}
            </small>
            <Button variant="secondary" onClick={onRefresh}>刷新当前分区</Button>
          </div>
        </div>
      </LiquidGlassSurface>
    </header>
  );
}
''')

sheet_path = 'src/pages/production/MobileFacilityDetailSheet.tsx'
sheet = read(sheet_path)
sheet = replace_once(
    sheet,
    "import { ScrollArea } from '../../components/ui/ScrollArea';",
    "import { ScrollArea } from '../../components/ui/ScrollArea';\nimport { useWorkspaceFloatingLayer } from '../../components/ui/WorkspaceFloatingLayer';",
    'mobile sheet floating layer import',
)
sheet = replace_once(
    sheet,
    "  const backdropRef = useRef<HTMLDivElement | null>(null);",
    "  const floatingLayer = useWorkspaceFloatingLayer();\n  const backdropRef = useRef<HTMLDivElement | null>(null);",
    'mobile sheet floating layer hook',
)
sheet = replace_once(
    sheet,
    "  if (!isOpen || !entry) return null;",
    "  if (!isOpen || !entry || !floatingLayer) return null;",
    'mobile sheet safe root guard',
)
sheet = replace_once(
    sheet,
    "    document.body,\n  );",
    "    floatingLayer,\n  );",
    'mobile sheet portal target',
)
write(sheet_path, sheet)

write('src/styles/game-shell-layout.css', '''/* Final geometry authority for signed-in game and administrator shells.
 * Desktop chrome spans the full shell width. Sidebar and workspace occupy a
 * separate lower row, while the page scrollport and floating layer remain
 * confined to the workspace. */
:root {
  --desktop-layout-gutter: var(--space-3);
}

@media (min-width: 721px) {
  .signed-in-shell.sidebar-layout {
    --desktop-shell-outer-inset: var(--desktop-layout-gutter);
    --desktop-sidebar-workspace-gap: var(--desktop-layout-gutter);
    --desktop-status-gap: var(--desktop-layout-gutter);
    --layout-gutter: var(--desktop-layout-gutter);
    --desktop-shell-body-top: calc(
      var(--desktop-layout-gutter)
      + var(--desktop-asset-bar-height)
      + var(--desktop-layout-gutter)
    );
    --desktop-page-top-offset: var(--desktop-layout-gutter);

    width: 100%;
    height: 100%;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: var(--desktop-shell-body-top) minmax(0, 1fr);
    gap: 0;
    padding: 0;
  }

  .signed-in-shell__chrome {
    position: relative;
    grid-column: 1;
    grid-row: 1;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    pointer-events: none;
  }

  .signed-in-shell__chrome > * {
    pointer-events: auto;
  }

  .signed-in-shell__body {
    grid-column: 1;
    grid-row: 2;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    display: grid;
    grid-template-columns:
      calc(
        var(--sidebar-column-width)
        + var(--desktop-shell-outer-inset)
        + var(--desktop-sidebar-workspace-gap)
      )
      minmax(0, 1fr);
    gap: 0;
    padding: 0;
  }

  .signed-in-shell .desktop-sidebar {
    width: var(--sidebar-column-width);
    min-width: 0;
    min-height: 0;
    align-self: stretch;
    justify-self: start;
    margin:
      0
      0
      var(--desktop-shell-outer-inset)
      var(--desktop-shell-outer-inset);
  }

  .signed-in-shell .workspace {
    position: relative;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    margin: 0;
    padding: 0;
    overflow: hidden;
  }

  .signed-in-shell .asset-bar {
    position: absolute;
    z-index: auto;
    top: var(--desktop-layout-gutter);
    right: var(--desktop-layout-gutter);
    left: var(--desktop-layout-gutter);
    width: auto;
    height: var(--desktop-asset-bar-height);
    min-width: 0;
    min-height: 0;
    margin: 0;
    padding: 0;
    overflow: visible;
  }

  .signed-in-shell .page-scroll-area,
  .signed-in-shell .page-scroll {
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    margin: 0;
  }

  .signed-in-shell .page-scroll {
    padding-top: 0;
    padding-right: 0;
    padding-left: 0;
    scroll-padding-top: 0;
  }

  .signed-in-shell .page-scroll-area > .ui-scrollbar--vertical {
    right: 0;
  }

  .signed-in-shell .page-scroll-area > .ui-scrollbar--vertical .ui-scrollbar__thumb {
    right: 0;
    left: auto;
  }

  .signed-in-shell .page-content {
    width: 100%;
    max-width: none;
    min-width: 0;
    margin: 0;
    padding: 0 var(--desktop-layout-gutter) var(--desktop-layout-gutter) 0;
  }

  .signed-in-shell .page-heading {
    padding: var(--space-3) var(--space-4) var(--space-4);
  }

  .workspace-floating-layer {
    position: absolute;
    inset: 0;
    z-index: 8;
    min-width: 0;
    min-height: 0;
    overflow: clip;
    pointer-events: none;
  }

  .workspace-floating-layer > * {
    pointer-events: auto;
  }
}

@media (max-width: 960px) and (min-width: 721px) {
  .signed-in-shell.sidebar-layout {
    --desktop-layout-gutter: var(--space-2);
  }
}

@media (max-height: 760px) and (min-width: 721px) {
  .signed-in-shell.sidebar-layout {
    --desktop-layout-gutter: var(--space-2);
    gap: 0;
    padding: 0;
  }
}
''')

sidebar_path = 'src/styles/desktop-sidebar.css'
sidebar = read(sidebar_path)
sidebar = replace_once(
    sidebar,
    '''.sidebar-layout {
  --sidebar-column-width: var(--desktop-sidebar-expanded-width);
  grid-template-columns: var(--sidebar-column-width) minmax(0, 1fr);
  transition: grid-template-columns var(--desktop-sidebar-motion);
}
''',
    '''.sidebar-layout {
  --sidebar-column-width: var(--desktop-sidebar-expanded-width);
}

.signed-in-shell__body {
  transition: grid-template-columns var(--desktop-sidebar-motion);
}
''',
    'desktop sidebar lower body transition',
)
sidebar = replace_once(
    sidebar,
    '''  .sidebar-layout,
  .sidebar-layout.sidebar-collapsed {
    --sidebar-column-width: 86px;
    transition: none;
  }
''',
    '''  .sidebar-layout,
  .sidebar-layout.sidebar-collapsed {
    --sidebar-column-width: 86px;
  }

  .signed-in-shell__body {
    transition: none;
  }
''',
    'compact sidebar lower body transition',
)
sidebar = replace_once(
    sidebar,
    '''  .sidebar-layout,
  .sidebar-brand-copy,''',
    '''  .signed-in-shell__body,
  .sidebar-brand-copy,''',
    'reduced motion body transition',
)
write(sidebar_path, sidebar)

viewport_path = 'src/styles/viewport.css'
viewport = read(viewport_path)
viewport = replace_once(
    viewport,
    '''.signed-in-shell,
.workspace,
.mobile-page-overlay,
.mobile-chrome-overlay,
.page-scroll-area,
.page-scroll {''',
    '''.signed-in-shell,
.signed-in-shell__body,
.signed-in-shell__chrome,
.workspace,
.mobile-page-overlay,
.mobile-chrome-overlay,
.workspace-floating-layer,
.page-scroll-area,
.page-scroll {''',
    'open glass sampling chain wrappers',
)
viewport = replace_once(
    viewport,
    '''.mobile-page-overlay,
.mobile-chrome-overlay {
  display: contents;
}
''',
    '''.signed-in-shell__body,
.signed-in-shell__chrome {
  min-width: 0;
  min-height: 0;
}

.mobile-page-overlay,
.mobile-chrome-overlay {
  display: contents;
}

.workspace-floating-layer {
  pointer-events: none;
}
''',
    'base shell wrappers',
)
mobile_start = viewport.index('@media (max-width: 720px) {')
viewport = viewport[:mobile_start] + '''@media (max-width: 720px) {
  .signed-in-shell {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr);
    padding: 0;
  }

  .signed-in-shell__body,
  .signed-in-shell__chrome {
    grid-column: 1;
    grid-row: 1;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
  }

  .signed-in-shell__body {
    order: 1;
    display: block;
  }

  .signed-in-shell__chrome {
    position: relative;
    order: 2;
    overflow: visible;
    pointer-events: none;
  }

  .workspace {
    --layout-gutter: var(--mobile-primary-surface-gap);

    position: relative;
    isolation: auto;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr);
    padding-inline-start: max(var(--mobile-workspace-gutter), env(safe-area-inset-left));
    padding-inline-end: max(var(--mobile-workspace-gutter), env(safe-area-inset-right));
    overflow: hidden;
  }

  .mobile-page-overlay,
  .workspace-floating-layer {
    grid-column: 1;
    grid-row: 1;
    min-width: 0;
    min-height: 0;
    display: block;
  }

  .mobile-page-overlay {
    position: relative;
    order: 1;
    overflow: visible;
  }

  .mobile-chrome-overlay {
    display: block;
    pointer-events: none;
  }

  .workspace-floating-layer {
    position: absolute;
    z-index: auto;
    top: calc(
      max(var(--mobile-chrome-block-inset), env(safe-area-inset-top))
      + var(--mobile-asset-bar-height)
      + var(--mobile-content-gap)
    );
    right: 0;
    bottom: calc(
      var(--mobile-nav-height)
      + var(--mobile-nav-gap)
      + max(var(--mobile-chrome-block-inset), env(safe-area-inset-bottom))
    );
    left: 0;
    overflow: clip;
    pointer-events: none;
  }

  .workspace-floating-layer > * {
    pointer-events: auto;
  }

  .page-scroll {
    position: relative;
    z-index: auto;
    width: 100%;
    height: 100%;
    padding-top: calc(
      max(var(--mobile-chrome-block-inset), env(safe-area-inset-top))
      + var(--mobile-asset-bar-height)
      + var(--mobile-content-gap)
    );
    padding-right: 0;
    padding-bottom: calc(
      var(--mobile-nav-height)
      + var(--mobile-nav-gap)
      + max(var(--mobile-chrome-block-inset), env(safe-area-inset-bottom))
    );
    padding-left: 0;
    scroll-padding-top: calc(
      max(var(--mobile-chrome-block-inset), env(safe-area-inset-top))
      + var(--mobile-asset-bar-height)
      + var(--mobile-content-gap)
    );
    scroll-padding-bottom: calc(
      var(--mobile-nav-height)
      + var(--mobile-nav-gap)
      + max(var(--mobile-chrome-block-inset), env(safe-area-inset-bottom))
    );
  }

  .page-content {
    width: 100%;
    max-width: none;
    margin: 0;
    padding-right: 0;
    padding-left: 0;
  }

  .page-heading {
    padding-right: 0;
    padding-left: 0;
  }

  .asset-bar {
    position: absolute;
    z-index: auto;
    top: max(var(--mobile-chrome-block-inset), env(safe-area-inset-top));
    right: max(var(--mobile-workspace-gutter), env(safe-area-inset-right));
    left: max(var(--mobile-workspace-gutter), env(safe-area-inset-left));
    width: auto;
    height: var(--mobile-asset-bar-height);
    min-height: var(--mobile-asset-bar-height);
    max-height: var(--mobile-asset-bar-height);
    overflow: visible;
    pointer-events: auto;
  }

  .mobile-bottom-navigation {
    position: absolute;
    z-index: auto;
    right: max(var(--mobile-workspace-gutter), env(safe-area-inset-right));
    bottom: max(var(--mobile-chrome-block-inset), env(safe-area-inset-bottom));
    left: max(var(--mobile-workspace-gutter), env(safe-area-inset-left));
    width: auto;
    height: var(--mobile-nav-height);
    min-height: var(--mobile-nav-height);
    max-height: var(--mobile-nav-height);
    pointer-events: auto;
  }
}
'''
write(viewport_path, viewport)

facility_css_path = 'src/styles/facility-detail-sheet.css'
facility_css = read(facility_css_path)
facility_css = facility_css.replace('fixed header/footer', 'safe-area header/footer')
facility_css += '''

@media (max-width: 720px) {
  .workspace-floating-layer > .facility-detail-sheet-backdrop {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    display: grid;
    align-items: end;
    overflow: hidden;
    pointer-events: auto;
  }

  .workspace-floating-layer > .facility-detail-sheet-backdrop > .facility-detail-sheet {
    width: 100%;
    max-width: 100%;
    max-height: 100%;
  }
}
'''
write(facility_css_path, facility_css)

write('src/styles/safe-floating.css', '''.safe-tooltip-anchor {
  min-width: 0;
  display: inline-flex;
  align-items: center;
}

.safe-tooltip {
  position: absolute;
  z-index: 1;
  box-sizing: border-box;
  overflow: auto;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-control);
  padding: var(--space-2) var(--space-3);
  color: var(--color-text-primary);
  background: rgba(7, 20, 15, 0.98);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.32);
  font-size: var(--font-size-xs);
  line-height: 1.4;
  overflow-wrap: anywhere;
  pointer-events: none !important;
}
''')

main_path = 'src/main.tsx'
main = read(main_path)
main = replace_once(
    main,
    "import './styles/game-shell-layout.css';",
    "import './styles/game-shell-layout.css';\nimport './styles/safe-floating.css';",
    'safe floating stylesheet import',
)
write(main_path, main)

admin_css_path = 'src/styles/admin-navigation.css'
admin_css = read(admin_css_path)
admin_css = admin_css.replace('.admin-command-bar-actions > span {', '.admin-command-bar-actions > .admin-command-bar-identity {')
admin_css = admin_css.replace('top: var(--desktop-page-top-offset);', 'top: var(--desktop-page-top-offset);')
admin_css += '''

@media (min-width: 721px) {
  .admin-command-bar-identity {
    grid-area: identity;
    max-width: 280px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
'''
write(admin_css_path, admin_css)

chart_options_path = 'src/components/charts/chartOptions.ts'
chart_options = read(chart_options_path)
if 'appendToBody: false' not in chart_options or 'confine: true' not in chart_options:
    raise SystemExit('ECharts commonTooltip must remain confined before shell migration')

# Browser shell geometry: add lower body/chrome/floating-layer measurements and replace desktop expectations.
spec_path = 'tests/browser/game-shell-layout.spec.ts'
spec = read(spec_path)
spec = replace_once(
    spec,
    '''  shell: { left: number; top: number; right: number; bottom: number };
  sidebar: { left: number; top: number; right: number; bottom: number };''',
    '''  shell: { left: number; top: number; right: number; bottom: number };
  body: { left: number; top: number; right: number; bottom: number };
  chrome: { left: number; top: number; right: number; bottom: number };
  floatingLayer: { left: number; top: number; right: number; bottom: number };
  sidebar: { left: number; top: number; right: number; bottom: number };''',
    'shell geometry type',
)
spec = replace_once(
    spec,
    '''    const shell = document.querySelector<HTMLElement>('.game-shell');
    const sidebar = document.querySelector<HTMLElement>('.desktop-sidebar');''',
    '''    const shell = document.querySelector<HTMLElement>('.game-shell');
    const body = document.querySelector<HTMLElement>('.signed-in-shell__body');
    const chrome = document.querySelector<HTMLElement>('.signed-in-shell__chrome');
    const floatingLayer = document.querySelector<HTMLElement>('.workspace-floating-layer');
    const sidebar = document.querySelector<HTMLElement>('.desktop-sidebar');''',
    'shell geometry selectors',
)
spec = replace_once(
    spec,
    '''      !shell
      || !sidebar''',
    '''      !shell
      || !body
      || !chrome
      || !floatingLayer
      || !sidebar''',
    'shell geometry fixture',
)
spec = replace_once(
    spec,
    '''      shell: rect(shell),
      sidebar: rect(sidebar),''',
    '''      shell: rect(shell),
      body: rect(body),
      chrome: rect(chrome),
      floatingLayer: rect(floatingLayer),
      sidebar: rect(sidebar),''',
    'shell geometry return',
)
helper_start = spec.index('function expectUnifiedDesktopGutter')
helper_end = spec.index("\ntest.describe('full-width signed-in game shell'", helper_start)
new_helper = '''function expectUnifiedDesktopGutter(layout: ShellGeometry, gutter: number) {
  expect(layout.shell.left).toBeCloseTo(0, 0);
  expect(layout.shell.top).toBeCloseTo(0, 0);
  expect(layout.shell.right).toBeCloseTo(layout.viewportWidth, 0);
  expect(layout.shell.bottom).toBeCloseTo(layout.viewportHeight, 0);
  expect(layout.shellGap).toBe('0px');
  expect(layout.shellPadding).toEqual(['0px', '0px', '0px', '0px']);

  expect(layout.chrome.left).toBeCloseTo(0, 0);
  expect(layout.chrome.top).toBeCloseTo(0, 0);
  expect(layout.chrome.right).toBeCloseTo(layout.viewportWidth, 0);
  expect(layout.body.left).toBeCloseTo(0, 0);
  expect(layout.body.right).toBeCloseTo(layout.viewportWidth, 0);
  expect(layout.body.top).toBeCloseTo(layout.chrome.bottom, 0);
  expect(layout.body.bottom).toBeCloseTo(layout.viewportHeight, 0);

  expect(layout.assetBar.left).toBeCloseTo(gutter, 0);
  expect(layout.assetBar.top).toBeCloseTo(gutter, 0);
  expect(layout.viewportWidth - layout.assetBar.right).toBeCloseTo(gutter, 0);
  expect(layout.body.top - layout.assetBar.bottom).toBeCloseTo(gutter, 0);

  expect(layout.sidebar.left).toBeCloseTo(gutter, 0);
  expect(layout.sidebar.top).toBeCloseTo(layout.body.top, 0);
  expect(layout.viewportHeight - layout.sidebar.bottom).toBeCloseTo(gutter, 0);
  expect(layout.workspace.left - layout.sidebar.right).toBeCloseTo(gutter, 0);

  expect(layout.workspace.top).toBeCloseTo(layout.body.top, 0);
  expect(layout.workspace.right).toBeCloseTo(layout.viewportWidth, 0);
  expect(layout.workspace.bottom).toBeCloseTo(layout.viewportHeight, 0);
  expect(layout.workspaceMargin).toEqual(['0px', '0px', '0px', '0px']);

  expect(layout.pageScroll.left).toBeCloseTo(layout.workspace.left, 0);
  expect(layout.pageScroll.top).toBeCloseTo(layout.workspace.top, 0);
  expect(layout.pageScroll.right).toBeCloseTo(layout.workspace.right, 0);
  expect(layout.pageScroll.bottom).toBeCloseTo(layout.workspace.bottom, 0);
  expect(layout.floatingLayer.left).toBeCloseTo(layout.workspace.left, 0);
  expect(layout.floatingLayer.top).toBeCloseTo(layout.workspace.top, 0);
  expect(layout.floatingLayer.right).toBeCloseTo(layout.workspace.right, 0);
  expect(layout.floatingLayer.bottom).toBeCloseTo(layout.workspace.bottom, 0);

  expect(layout.pageContent.left).toBeCloseTo(layout.pageScroll.left, 0);
  expect(layout.pageContent.width).toBeCloseTo(layout.pageScrollClientWidth, 0);
  expect(layout.pageContent.right).toBeLessThanOrEqual(layout.pageScroll.right + 1);
  expect(layout.pageContent.contentRight).toBeCloseTo(layout.assetBar.right, 0);
  expect(layout.contentGrid.left).toBeCloseTo(layout.workspace.left, 0);
  expect(layout.contentGrid.right).toBeCloseTo(layout.assetBar.right, 0);
  expect(layout.primaryCardGap).toBeCloseTo(gutter, 0);
  expect(layout.pageContentMaxWidth).toBe('none');
  expect(layout.pageContentMargin).toEqual(['0px', '0px']);
  expect(layout.pageContentPadding).toEqual(['0px', `${gutter}px`, `${gutter}px`]);
  expect(layout.pageScrollHasHorizontalOverflow).toBe(false);

  expect(layout.pageScrollbar.railRight).toBeCloseTo(layout.viewportWidth, 0);
  expect(layout.pageScrollbar.thumbRight).toBeCloseTo(layout.viewportWidth, 0);
}
'''
spec = spec[:helper_start] + new_helper + spec[helper_end:]
spec = spec.replace(
    'desktop shell uses one 12px gutter for sidebar, status bar, cards and page edges',
    'desktop shell uses one 12px gutter for full-width status bar, lower sidebar, cards and page edges',
)
spec = spec.replace(
    'compact desktop width uses the same 8px gutter everywhere',
    'compact desktop width keeps the full-width status bar and lower shell on the same 8px gutter',
)
spec = spec.replace(
    'short desktop height uses the same 8px gutter everywhere',
    'short desktop height keeps the full-width status bar and lower shell on the same 8px gutter',
)
spec = spec.replace(
    'sidebar collapse keeps the inset status bar and page on the same workspace track',
    'sidebar collapse leaves the full-width status bar fixed and only expands the lower workspace',
)
spec = replace_once(
    spec,
    '''    expect(expanded.sidebar.left).toBeCloseTo(collapsed.sidebar.left, 0);
    expect(expanded.workspace.left - collapsed.workspace.left).toBeCloseTo(146, 0);
    expect(expanded.assetBar.left - collapsed.assetBar.left).toBeCloseTo(146, 0);
    expect(expanded.pageScroll.left - collapsed.pageScroll.left).toBeCloseTo(146, 0);
    expect(expanded.pageContent.left - collapsed.pageContent.left).toBeCloseTo(146, 0);
    expect(expanded.contentGrid.left - collapsed.contentGrid.left).toBeCloseTo(146, 0);''',
    '''    expect(expanded.sidebar.left).toBeCloseTo(collapsed.sidebar.left, 0);
    expect(expanded.assetBar.left).toBeCloseTo(collapsed.assetBar.left, 0);
    expect(expanded.assetBar.right).toBeCloseTo(collapsed.assetBar.right, 0);
    expect(expanded.assetBar.top).toBeCloseTo(collapsed.assetBar.top, 0);
    expect(expanded.workspace.left - collapsed.workspace.left).toBeCloseTo(146, 0);
    expect(expanded.pageScroll.left - collapsed.pageScroll.left).toBeCloseTo(146, 0);
    expect(expanded.pageContent.left - collapsed.pageContent.left).toBeCloseTo(146, 0);
    expect(expanded.contentGrid.left - collapsed.contentGrid.left).toBeCloseTo(146, 0);''',
    'collapsed full width status assertions',
)
write(spec_path, spec)

# Liquid glass desktop geometry now compares the bar to the viewport and lower workspace row.
liquid_spec_path = 'tests/browser/liquid-glass-layout.spec.ts'
liquid_spec = read(liquid_spec_path)
liquid_spec = replace_once(
    liquid_spec,
    '''        workspaceWidth: workspaceRect.width,
        assetBarAreaWidth: assetBarAreaRect.width,
        assetBarWidth: assetBarRect.width,
        surfaceWidth: surfaceRect.width,
        assetBarTopInset: assetBarAreaRect.top - workspaceRect.top,
        assetBarRightInset: workspaceRect.right - assetBarAreaRect.right,
        assetBarBottom: assetBarAreaRect.bottom,
        headingTop: headingRect.top,''',
    '''        viewportWidth: document.documentElement.clientWidth,
        workspaceWidth: workspaceRect.width,
        workspaceTop: workspaceRect.top,
        assetBarAreaWidth: assetBarAreaRect.width,
        assetBarWidth: assetBarRect.width,
        surfaceWidth: surfaceRect.width,
        assetBarLeft: assetBarAreaRect.left,
        assetBarTop: assetBarAreaRect.top,
        assetBarRightGap: document.documentElement.clientWidth - assetBarAreaRect.right,
        assetBarBottom: assetBarAreaRect.bottom,
        headingTop: headingRect.top,''',
    'liquid glass desktop geometry return',
)
liquid_spec = replace_once(
    liquid_spec,
    '''    expect(Math.abs(layout.workspaceWidth - layout.assetBarAreaWidth - 12)).toBeLessThanOrEqual(1);
    expect(Math.abs(layout.assetBarWidth - layout.assetBarAreaWidth)).toBeLessThanOrEqual(1);
    expect(Math.abs(layout.surfaceWidth - layout.assetBarWidth)).toBeLessThanOrEqual(1);
    expect(layout.assetBarTopInset).toBeCloseTo(12, 0);
    expect(layout.assetBarRightInset).toBeCloseTo(12, 0);''',
    '''    expect(layout.assetBarAreaWidth).toBeCloseTo(layout.viewportWidth - 24, 0);
    expect(Math.abs(layout.assetBarWidth - layout.assetBarAreaWidth)).toBeLessThanOrEqual(1);
    expect(Math.abs(layout.surfaceWidth - layout.assetBarWidth)).toBeLessThanOrEqual(1);
    expect(layout.assetBarLeft).toBeCloseTo(12, 0);
    expect(layout.assetBarTop).toBeCloseTo(12, 0);
    expect(layout.assetBarRightGap).toBeCloseTo(12, 0);
    expect(layout.workspaceTop - layout.assetBarBottom).toBeCloseTo(12, 0);''',
    'liquid glass desktop assertions',
)
write(liquid_spec_path, liquid_spec)

# Admin desktop geometry and safe tooltip.
admin_spec_path = 'tests/browser/admin-runtime.spec.ts'
admin_spec = read(admin_spec_path)
admin_spec = replace_once(
    admin_spec,
    '''      sidebarLeft: sidebarRect.left,
      sidebarWorkspaceGap: workspaceRect.left - sidebarRect.right,
      commandTop: commandRect.top,
      commandRightGap: window.innerWidth - commandRect.right,''',
    '''      sidebarLeft: sidebarRect.left,
      sidebarWorkspaceGap: workspaceRect.left - sidebarRect.right,
      sidebarTopGap: sidebarRect.top - commandRect.bottom,
      workspaceTopGap: workspaceRect.top - commandRect.bottom,
      commandLeft: commandRect.left,
      commandTop: commandRect.top,
      commandRightGap: window.innerWidth - commandRect.right,''',
    'admin geometry return',
)
admin_spec = replace_once(
    admin_spec,
    '''  expect(geometry.sidebarLeft).toBeCloseTo(12, 0);
  expect(geometry.sidebarWorkspaceGap).toBeCloseTo(12, 0);
  expect(geometry.commandTop).toBeCloseTo(12, 0);
  expect(geometry.commandRightGap).toBeCloseTo(12, 0);''',
    '''  expect(geometry.commandLeft).toBeCloseTo(12, 0);
  expect(geometry.commandTop).toBeCloseTo(12, 0);
  expect(geometry.commandRightGap).toBeCloseTo(12, 0);
  expect(geometry.sidebarLeft).toBeCloseTo(12, 0);
  expect(geometry.sidebarWorkspaceGap).toBeCloseTo(12, 0);
  expect(geometry.sidebarTopGap).toBeCloseTo(12, 0);
  expect(geometry.workspaceTopGap).toBeCloseTo(12, 0);''',
    'admin full width chrome assertions',
)
admin_spec = replace_once(
    admin_spec,
    '''  expect(geometry.thumbRight).toBeCloseTo(geometry.viewportWidth, 0);
  const metricColumns = await page.locator('.admin-summary-grid').evaluate''',
    '''  expect(geometry.thumbRight).toBeCloseTo(geometry.viewportWidth, 0);

  const identity = page.locator('.admin-command-bar-identity');
  await identity.hover();
  const tooltip = page.getByRole('tooltip');
  await expect(tooltip).toBeVisible();
  const floatingGeometry = await page.evaluate(() => {
    const workspace = document.querySelector<HTMLElement>('.admin-workspace');
    const sidebar = document.querySelector<HTMLElement>('.admin-sidebar');
    const command = document.querySelector<HTMLElement>('.admin-command-bar');
    const layer = document.querySelector<HTMLElement>('.workspace-floating-layer');
    const tooltip = document.querySelector<HTMLElement>('[role="tooltip"]');
    if (!workspace || !sidebar || !command || !layer || !tooltip) throw new Error('管理员安全悬浮层缺失');
    const box = (element: HTMLElement) => element.getBoundingClientRect();
    const intersects = (a: DOMRect, b: DOMRect) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
      * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    const workspaceRect = box(workspace);
    const tooltipRect = box(tooltip);
    return {
      layerMatchesWorkspace: Math.abs(box(layer).left - workspaceRect.left) <= 1
        && Math.abs(box(layer).top - workspaceRect.top) <= 1
        && Math.abs(box(layer).right - workspaceRect.right) <= 1
        && Math.abs(box(layer).bottom - workspaceRect.bottom) <= 1,
      tooltipInsideWorkspace: tooltipRect.left >= workspaceRect.left - 1
        && tooltipRect.top >= workspaceRect.top - 1
        && tooltipRect.right <= workspaceRect.right + 1
        && tooltipRect.bottom <= workspaceRect.bottom + 1,
      statusIntersection: intersects(tooltipRect, box(command)),
      sidebarIntersection: intersects(tooltipRect, box(sidebar)),
    };
  });
  expect(floatingGeometry.layerMatchesWorkspace).toBe(true);
  expect(floatingGeometry.tooltipInsideWorkspace).toBe(true);
  expect(floatingGeometry.statusIntersection).toBe(0);
  expect(floatingGeometry.sidebarIntersection).toBe(0);

  const metricColumns = await page.locator('.admin-summary-grid').evaluate''',
    'admin safe tooltip regression',
)
admin_spec = admin_spec.replace(
    'chromeLayerInsideWorkspace: workspace.contains(layer),',
    "chromeLayerInsideWorkspace: workspace.contains(layer),\n      chromeLayerInsideShell: Boolean(document.querySelector('.admin-shell')?.contains(layer)),\n      bodyOrder: Number.parseInt(getComputedStyle(document.querySelector<HTMLElement>('.signed-in-shell__body')!).order, 10),",
)
admin_spec = admin_spec.replace(
    'expect(geometry.chromeLayerInsideWorkspace).toBe(true);',
    'expect(geometry.chromeLayerInsideWorkspace).toBe(false);\n  expect(geometry.chromeLayerInsideShell).toBe(true);',
)
admin_spec = admin_spec.replace(
    'expect(geometry.chromeLayerOrder).toBeGreaterThan(geometry.pageLayerOrder);',
    'expect(geometry.chromeLayerOrder).toBeGreaterThan(geometry.bodyOrder);',
)
write(admin_spec_path, admin_spec)

write('tests/browser/shell-floating-safe-zone.spec.ts', '''import { expect, test } from '@playwright/test';

function intersectionArea(a: { left: number; top: number; right: number; bottom: number }, b: { left: number; top: number; right: number; bottom: number }) {
  return Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
    * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
}

test('game ECharts tooltip remains inside the lower workspace and never covers shell chrome', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('runtime-test.html?view=market&scenario=activity');

  const chart = page.locator('.market-history-chart');
  await expect(chart.locator('[data-echarts-ready="true"]')).toBeVisible();
  const box = await chart.boundingBox();
  if (!box) throw new Error('市场行情图几何缺失');
  await page.mouse.move(box.x + box.width * 0.62, box.y + box.height * 0.38);

  const tooltip = page.locator('.economy-chart-tooltip');
  await expect(tooltip).toBeVisible();
  const geometry = await page.evaluate(() => {
    const workspace = document.querySelector<HTMLElement>('.workspace');
    const status = document.querySelector<HTMLElement>('.asset-bar');
    const sidebar = document.querySelector<HTMLElement>('.desktop-sidebar');
    const tooltip = document.querySelector<HTMLElement>('.economy-chart-tooltip');
    if (!workspace || !status || !sidebar || !tooltip) throw new Error('游戏浮层安全区结构缺失');
    const rect = (element: HTMLElement) => {
      const box = element.getBoundingClientRect();
      return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
    };
    return {
      workspace: rect(workspace),
      status: rect(status),
      sidebar: rect(sidebar),
      tooltip: rect(tooltip),
    };
  });

  expect(geometry.tooltip.left).toBeGreaterThanOrEqual(geometry.workspace.left - 1);
  expect(geometry.tooltip.top).toBeGreaterThanOrEqual(geometry.workspace.top - 1);
  expect(geometry.tooltip.right).toBeLessThanOrEqual(geometry.workspace.right + 1);
  expect(geometry.tooltip.bottom).toBeLessThanOrEqual(geometry.workspace.bottom + 1);
  expect(intersectionArea(geometry.tooltip, geometry.status)).toBe(0);
  expect(intersectionArea(geometry.tooltip, geometry.sidebar)).toBe(0);
});

test('mobile workspace floating layer excludes the top status bar and bottom navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('runtime-test.html?view=overview&scenario=activity');

  const geometry = await page.evaluate(() => {
    const layer = document.querySelector<HTMLElement>('.workspace-floating-layer');
    const status = document.querySelector<HTMLElement>('.asset-bar');
    const navigation = document.querySelector<HTMLElement>('.mobile-bottom-navigation');
    if (!layer || !status || !navigation) throw new Error('移动浮层安全区结构缺失');
    const rect = (element: HTMLElement) => {
      const box = element.getBoundingClientRect();
      return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
    };
    return { layer: rect(layer), status: rect(status), navigation: rect(navigation) };
  });

  expect(geometry.layer.top).toBeGreaterThanOrEqual(geometry.status.bottom);
  expect(geometry.layer.bottom).toBeLessThanOrEqual(geometry.navigation.top);
  expect(intersectionArea(geometry.layer, geometry.status)).toBe(0);
  expect(intersectionArea(geometry.layer, geometry.navigation)).toBe(0);
});
''')

# Update the authoritative desktop shell section without retaining the old right-workspace-only rule.
design_path = 'docs/LIQUID_GLASS_CHROME_DESIGN.md'
design = read(design_path)
section_start = design.index('## 5. 登录后桌面应用外壳几何')
section_end = design.index('\n## 6.', section_start)
new_section = '''## 5. 登录后桌面应用外壳几何

大于 `720px` 时，游戏端和管理员端都必须由 `SignedInShell` 渲染同一个两行根结构：

- `.signed-in-shell` 固定覆盖视口，最终 `padding` 和 `gap` 都为 `0`；第一行是跨越全部桌面列的 `.signed-in-shell__chrome`，第二行是包含侧栏与工作区的 `.signed-in-shell__body`。
- `--desktop-layout-gutter` 是顶部工作栏外距、工作栏到下方主体、侧栏左／下外距、侧栏到工作区、页面右／下留白和一级内容 gap 的唯一权威；普通桌面使用 `12px`，宽度 `721px–960px` 或高度不大于 `760px` 的紧凑桌面使用 `8px`。
- 玩家状态栏与管理员桌面工作栏都必须从视口左侧沟槽延伸到右侧沟槽，横跨侧栏列和工作区列。侧栏展开、折叠或紧凑化不得改变顶部工作栏的 `left`、`right`、`top` 或宽度。
- `.signed-in-shell__body` 的顶部固定为“沟槽 + 工作栏高度 + 沟槽”；侧栏与 `.workspace` 的顶部必须与主体顶部共线，侧栏不得再从视口顶部开始或与工作栏并排顶头。
- 下方主体第一列由侧栏左侧外距、侧栏宽度和侧栏到工作区间隔组成；第二列 `.workspace` 使用全部剩余宽度并继续铺满视口右边缘。侧栏展开宽度为 `224px`，折叠宽度为 `78px`，只能改变下方工作区起点。
- 桌面工作栏高度保持 `76px`，实际玻璃圆角为 `24px`；工作栏仍使用单一 `desktopStatusBar` 玻璃实例。
- `.page-scroll-area` 与 `.page-scroll` 直接铺满下方工作区，不得再使用“工作栏高度 + 双沟槽”的顶部 padding 模拟避让；页面 sticky 内容只允许使用工作区内部沟槽作为偏移。
- 页面主滚动条只覆盖下方工作区的纵向范围，右边缘继续贴合视口；不得穿过顶部工作栏，也不得因显隐改变页面 `clientWidth`。
- 桌面侧栏导航必须从侧栏内部顶部按固有行高排列，不能把导航按钮平均拉伸到整列高度。
- 玩家端和管理员端必须共享这套 DOM、CSS 变量、折叠行为和浏览器几何测试，不得分别创建第二套根外壳。

### 5.1 工作区浮层安全区

- `SignedInShell` 必须在 `.workspace` 内提供唯一 `.workspace-floating-layer`，其桌面几何与工作区完全一致；移动端顶部必须位于状态栏下方，底部必须位于移动导航上方。
- Tooltip、Popover、菜单、确认框、页面 Dialog、移动工厂详情 Sheet 和其他登录后业务浮层只能渲染到工作区浮层根，或像 ECharts Tooltip 一样由业务容器内部 `confine`；不得追加到 `document.body` 后覆盖顶部工作栏、侧栏或移动底栏。
- 工作区浮层根必须使用 `overflow: clip`，自身不拦截指针，只有实际浮层恢复指针事件。定位算法必须以浮层根真实 `getBoundingClientRect()` 为边界，并保留至少 `8px` 内部安全间距。
- 顶部工作栏和侧栏中的提示必须向工作区内部翻转和收敛；不得使用浏览器原生 `title` 承担必须可见的完整信息。
- ECharts `commonTooltip` 必须继续保持 `appendToBody: false` 与 `confine: true`，不得为了避免裁切改成全局 Portal。
- 移动工厂详情必须 Portal 到工作区浮层根，背景和 Sheet 都只能覆盖状态栏与移动导航之间的安全区域；焦点陷阱、Escape、拖动关闭和页面滚动锁保持不变。
'''
design = design[:section_start] + new_section + design[section_end:]
design = design.replace('> 更新时间：2026-07-31', '> 更新时间：2026-08-01')
write(design_path, design)

ui_design_path = 'docs/UI_DESIGN_SYSTEM.md'
ui_design = read(ui_design_path)
ui_design = ui_design.replace(
    '| `src/styles/charts.css` | 共享 ECharts 容器、Tooltip、无障碍摘要、市场底部安全区、管理员图表与资产圆环布局 |',
    '| `src/styles/charts.css` | 共享 ECharts 容器、Tooltip、无障碍摘要、市场底部安全区、管理员图表与资产圆环布局 |\n| `src/styles/safe-floating.css` | 工作区安全 Tooltip 的容器内定位、尺寸、滚动与视觉；不得承担外壳几何 |',
)
ui_design += '''

## 登录后浮层安全区

- 游戏端与管理员端的 Tooltip、Popover、下拉菜单、上下文菜单、确认框和页面 Dialog 必须使用 `SignedInShell` 提供的 `.workspace-floating-layer`，或由业务容器在自身边界内完成 `confine`。
- 任一浮层都不得与桌面顶部状态栏／管理员工作栏、桌面侧栏、移动顶部状态栏或移动底栏相交；浮层的四条边必须落在工作区浮层根的真实矩形内。
- `SafeTooltip` 是状态栏、管理员工作栏和侧栏中需要完整提示时的共享入口。其定位必须根据工作区浮层根计算、自动上下翻转、水平收敛并保留 `8px` 安全间距。
- 登录后界面不得使用原生 `title` 承担被截断文本、操作说明或其他必须可访问的信息；原生 `title` 只允许保留非必要补充说明。
- 模态浮层的遮罩也只能覆盖工作区；即使视觉上不覆盖状态栏和侧栏，打开期间仍必须通过焦点陷阱、`inert` 或共享交互锁阻止背景误操作。
- 浏览器回归必须分别验证玩家图表 Tooltip、管理员工作栏 Tooltip、侧栏展开／折叠、移动安全区和 `125%` 根字号；只检查 `z-index` 或 Option 字符串不能证明安全区有效。
'''
write(ui_design_path, ui_design)

index_path = 'docs/README.md'
index = read(index_path)
index = index.replace(
    '| `UI_DESIGN_SYSTEM.md` | 设计令牌、共享组件、统一表单控件、统一 SVG 图标、统一导航角标视觉、商品与工厂场景插画主视觉、覆盖式滚动条、订单成交表、桌面导航行高、中文界面、响应式、移动触摸反馈与可访问性 |',
    '| `UI_DESIGN_SYSTEM.md` | 设计令牌、共享组件、工作区浮层安全区、统一表单控件、统一 SVG 图标、统一导航角标视觉、商品与工厂场景插画主视觉、覆盖式滚动条、订单成交表、桌面导航行高、中文界面、响应式、移动触摸反馈与可访问性 |',
)
index = index.replace(
    '| `LIQUID_GLASS_CHROME_DESIGN.md` | 认证卡片、游戏与管理员共享桌面外壳、统一布局沟槽、侧栏与悬浮工作栏几何、桌面贴边页面滚动条、移动工作区与 Overlay、登录态根视口下拉刷新边界、移动操作结果通知、移动底栏和唯一液态玻璃材质 |',
    '| `LIQUID_GLASS_CHROME_DESIGN.md` | 认证卡片、游戏与管理员共享桌面外壳、全宽顶部工作栏、下方侧栏与工作区、浮层安全根、桌面贴边页面滚动条、移动工作区与 Overlay、登录态根视口下拉刷新边界、移动操作结果通知、移动底栏和唯一液态玻璃材质 |',
)
index += '''

- 游戏端与管理员端桌面顶部工作栏必须横跨侧栏列与内容列；侧栏和工作区从其下方开始。所有登录后业务浮层必须限制在工作区安全根内，并由 `scripts/verify-game-shell-layout.mjs` 与 `tests/browser/shell-floating-safe-zone.spec.ts` 防回退。
'''
write(index_path, index)

write('scripts/verify-game-shell-layout.mjs', '''import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const failures = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const check = (path, values) => {
  if (!existsSync(resolve(root, path))) {
    failures.push(`缺少文件: ${path}`);
    return;
  }
  const content = read(path);
  for (const value of values) if (!content.includes(value)) failures.push(`${path} 缺少: ${value}`);
};
const forbid = (path, values) => {
  const content = read(path);
  for (const value of values) if (content.includes(value)) failures.push(`${path} 不应包含: ${value}`);
};

check('src/main.tsx', [
  "import './styles/viewport.css';",
  "import './styles/scrollbars.css';",
  "import './styles/game-shell-layout.css';",
  "import './styles/safe-floating.css';",
]);
check('src/components/shell/SignedInShell.tsx', [
  "import { ScrollArea } from '../ui/ScrollArea'",
  'WorkspaceFloatingLayerContext.Provider',
  'className="signed-in-shell__body"',
  "'signed-in-shell__chrome'",
  'className="mobile-page-overlay"',
  'className="workspace-floating-layer"',
  'data-workspace-floating-layer="true"',
  'className="page-scroll-area"',
  "'page-scroll'",
]);
const sharedShell = read('src/components/shell/SignedInShell.tsx');
if (sharedShell.indexOf('className="signed-in-shell__body"') >= sharedShell.indexOf("'signed-in-shell__chrome'")) {
  failures.push('SignedInShell 必须先渲染页面主体、再渲染 Chrome，保持移动玻璃采样顺序');
}
check('src/components/ui/WorkspaceFloatingLayer.tsx', [
  'WorkspaceFloatingLayerContext', 'useWorkspaceFloatingLayer',
]);
check('src/components/ui/SafeTooltip.tsx', [
  'createPortal', 'useWorkspaceFloatingLayer', 'SAFE_FLOATING_GAP = 8',
  "role=\"tooltip\"", 'floatingLayer.getBoundingClientRect()',
]);
check('src/components/shell/AdminDesktopBar.tsx', [
  "import { SafeTooltip } from '../ui/SafeTooltip'",
  'className="admin-command-bar-identity"',
]);
forbid('src/components/shell/AdminDesktopBar.tsx', ['title={email}']);
check('src/pages/production/MobileFacilityDetailSheet.tsx', [
  'useWorkspaceFloatingLayer', '!floatingLayer', 'floatingLayer,',
]);
forbid('src/pages/production/MobileFacilityDetailSheet.tsx', ['document.body,']);

check('src/styles/game-shell-layout.css', [
  '--desktop-layout-gutter: var(--space-3);',
  '--desktop-shell-body-top:',
  'grid-template-rows: var(--desktop-shell-body-top) minmax(0, 1fr);',
  '.signed-in-shell__chrome {',
  '.signed-in-shell__body {',
  'left: var(--desktop-layout-gutter);',
  'right: var(--desktop-layout-gutter);',
  'padding-top: 0;',
  'scroll-padding-top: 0;',
  '.workspace-floating-layer {',
  'overflow: clip;',
]);
forbid('src/styles/game-shell-layout.css', [
  'left: 0;\n    width: auto;\n    height: var(--desktop-asset-bar-height);',
  '--desktop-page-top-offset: calc(',
]);
check('src/styles/desktop-sidebar.css', [
  '.signed-in-shell__body {',
  'transition: grid-template-columns var(--desktop-sidebar-motion);',
]);
check('src/styles/viewport.css', [
  '.signed-in-shell__body,', '.signed-in-shell__chrome,', '.workspace-floating-layer,',
  'grid-template-rows: minmax(0, 1fr);',
  'top: calc(', 'bottom: calc(', 'overflow: clip;',
]);
check('src/styles/facility-detail-sheet.css', [
  '.workspace-floating-layer > .facility-detail-sheet-backdrop',
  'position: absolute;', 'align-items: end;',
]);
check('src/styles/safe-floating.css', ['.safe-tooltip {', 'position: absolute;', 'pointer-events: none !important;']);
check('src/components/charts/chartOptions.ts', ['appendToBody: false', 'confine: true']);

check('tests/browser/game-shell-layout.spec.ts', [
  'desktop shell uses one 12px gutter for full-width status bar, lower sidebar, cards and page edges',
  'sidebar collapse leaves the full-width status bar fixed and only expands the lower workspace',
  'expect(expanded.assetBar.left).toBeCloseTo(collapsed.assetBar.left, 0)',
  'expect(layout.sidebar.top).toBeCloseTo(layout.body.top, 0)',
  'expect(layout.floatingLayer.top).toBeCloseTo(layout.workspace.top, 0)',
]);
check('tests/browser/admin-runtime.spec.ts', [
  'sidebarTopGap', 'workspaceTopGap', 'admin-command-bar-identity',
  '管理员安全悬浮层缺失', 'tooltipInsideWorkspace',
  'expect(geometry.chromeLayerInsideWorkspace).toBe(false)',
]);
check('tests/browser/shell-floating-safe-zone.spec.ts', [
  'game ECharts tooltip remains inside the lower workspace and never covers shell chrome',
  'mobile workspace floating layer excludes the top status bar and bottom navigation',
  'intersectionArea',
]);
check('tests/browser/liquid-glass-layout.spec.ts', [
  'assetBarAreaWidth).toBeCloseTo(layout.viewportWidth - 24',
  'workspaceTop - layout.assetBarBottom',
]);

check('docs/LIQUID_GLASS_CHROME_DESIGN.md', [
  '跨越全部桌面列', '侧栏不得再从视口顶部开始',
  '工作区浮层安全区', '不得追加到 `document.body`',
  '`appendToBody: false`', '`confine: true`',
]);
check('docs/UI_DESIGN_SYSTEM.md', [
  '登录后浮层安全区', '`SafeTooltip`',
  '不得与桌面顶部状态栏／管理员工作栏、桌面侧栏',
]);
check('docs/README.md', [
  '全宽顶部工作栏', '浮层安全根', 'shell-floating-safe-zone.spec.ts',
]);

if (failures.length) {
  console.error(`游戏与管理员共享外壳验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('游戏与管理员共享外壳验证通过：全宽顶部工作栏、下方侧栏与工作区、贴边滚动条和浮层安全根均已锁定。');
''')

# Align existing liquid-glass verifier with the new shared wrappers and design language.
liquid_verify_path = 'scripts/verify-liquid-glass-chrome.mjs'
liquid_verify = read(liquid_verify_path)
liquid_verify = replace_once(
    liquid_verify,
    '''    'className="mobile-page-overlay"',
    "'mobile-chrome-overlay'",
    'className="page-scroll-area"',''',
    '''    'className="signed-in-shell__body"',
    "'signed-in-shell__chrome'",
    'className="mobile-page-overlay"',
    'className="workspace-floating-layer"',
    'className="page-scroll-area"',''',
    'liquid verifier shell wrappers',
)
write(liquid_verify_path, liquid_verify)

# ECharts tooltip must remain chart-confined as part of the safe floating contract.
echarts_verify_path = 'scripts/verify-echarts-adoption.mjs'
echarts_verify = read(echarts_verify_path)
echarts_verify = replace_once(
    echarts_verify,
    "requireText('src/components/charts/chartOptions.ts', ['export const PIE_PAD_ANGLE = 5;']);",
    "requireText('src/components/charts/chartOptions.ts', ['export const PIE_PAD_ANGLE = 5;', 'appendToBody: false', 'confine: true']);",
    'ECharts confined tooltip verifier',
)
write(echarts_verify_path, echarts_verify)

portal_files = sorted(
    str(path).replace('\\\\', '/')
    for path in Path('src').rglob('*.tsx')
    if 'createPortal' in path.read_text(encoding='utf-8')
)
expected_portals = [
    'src/components/ui/SafeTooltip.tsx',
    'src/pages/production/MobileFacilityDetailSheet.tsx',
]
if portal_files != expected_portals:
    raise SystemExit(f'Unexpected createPortal files after migration: {portal_files}')

print('Applied full-width desktop chrome, lower sidebar/workspace geometry, safe floating root, portals, docs and browser regressions.')
