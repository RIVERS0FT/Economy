import { readFileSync, writeFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const write = (path, content) => writeFileSync(path, content);

function replaceOnce(content, before, after, label) {
  const index = content.indexOf(before);
  if (index < 0) throw new Error(`Missing replacement target: ${label}`);
  if (content.indexOf(before, index + before.length) >= 0) {
    throw new Error(`Replacement target is not unique: ${label}`);
  }
  return content.slice(0, index) + after + content.slice(index + before.length);
}

function update(path, transform) {
  const before = read(path);
  const after = transform(before);
  if (after === before) throw new Error(`No changes produced for ${path}`);
  write(path, after);
}

write('src/components/shell/StatusBar.tsx', `import { useEffect, useState, type ReactNode } from 'react';
import { LiquidGlassSurface, type LiquidGlassSurfaceVariant } from '../ui/LiquidGlassSurface';

export interface StatusBarItem {
  id: string;
  icon: ReactNode;
  label: string;
  value: ReactNode;
  compactValue?: ReactNode;
  detail?: ReactNode;
  emphasis?: 'primary' | 'market';
  onClick?: () => void;
}

const MOBILE_STATUS_MEDIA_QUERY = '(max-width: 720px)';
type StatusBarSurfaceVariant = Extract<LiquidGlassSurfaceVariant, 'desktopStatusBar' | 'mobileStatusBar'>;

function resolveStatusBarSurfaceVariant(): StatusBarSurfaceVariant {
  if (typeof window === 'undefined') return 'desktopStatusBar';
  return window.matchMedia(MOBILE_STATUS_MEDIA_QUERY).matches ? 'mobileStatusBar' : 'desktopStatusBar';
}

function useStatusBarSurfaceVariant() {
  const [variant, setVariant] = useState<StatusBarSurfaceVariant>(resolveStatusBarSurfaceVariant);

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_STATUS_MEDIA_QUERY);
    const updateVariant = () => setVariant(mediaQuery.matches ? 'mobileStatusBar' : 'desktopStatusBar');
    updateVariant();
    mediaQuery.addEventListener('change', updateVariant);
    return () => mediaQuery.removeEventListener('change', updateVariant);
  }, []);

  return variant;
}

export function StatusBar({ items }: { items: StatusBarItem[] }) {
  const surfaceVariant = useStatusBarSurfaceVariant();

  return (
    <header className="asset-bar" aria-label="玩家状态">
      <LiquidGlassSurface variant={surfaceVariant}>
        <div className="asset-bar-content">
          {items.map((item) => {
            const classNames = ['asset-bar-item'];
            if (item.emphasis === 'primary') classNames.push('primary');
            if (item.emphasis === 'market') classNames.push('market-ticker');
            if (item.onClick) classNames.push('asset-bar-item--interactive');
            const content = (
              <>
                <span className="asset-bar-item-icon" aria-hidden="true">{item.icon}</span>
                <span className="asset-bar-item-label">{item.label}</span>
                <strong className="asset-bar-item-value">
                  <span className="asset-bar-item-value-full">{item.value}</span>
                  <span className="asset-bar-item-value-compact">{item.compactValue ?? item.value}</span>
                </strong>
                {item.detail ? <small>{item.detail}</small> : null}
              </>
            );

            return item.onClick ? (
              <button
                type="button"
                className={classNames.join(' ')}
                key={item.id}
                aria-label={\`${'${item.label}'}，打开详情\`}
                onClick={item.onClick}
              >
                {content}
              </button>
            ) : (
              <div
                className={classNames.join(' ')}
                key={item.id}
                role="group"
                aria-label={item.label}
              >
                {content}
              </div>
            );
          })}
        </div>
      </LiquidGlassSurface>
    </header>
  );
}
`);

update('src/styles/viewport.css', (content) => {
  content = replaceOnce(content, `.asset-bar-scroll-area {
  position: absolute;
  z-index: 3;
  top: 0;
  right: 0;
  left: 0;
  height: var(--desktop-asset-bar-height);
  min-width: 0;
  min-height: 0;
}

.asset-bar-scroll-track,
.asset-bar {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.asset-bar {
  position: relative;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
}
`, `.asset-bar {
  position: absolute;
  z-index: 3;
  top: 0;
  right: 0;
  left: 0;
  width: auto;
  height: var(--desktop-asset-bar-height);
  min-width: 0;
  min-height: 0;
  overflow: visible;
}
`, 'desktop status host');
  content = replaceOnce(content, `  .asset-bar-scroll-area {
    position: absolute;
    z-index: auto;
    top: max(var(--mobile-chrome-block-inset), env(safe-area-inset-top));
    right: 0;
    left: 0;
    width: auto;
    height: var(--mobile-asset-bar-height);
    min-height: var(--mobile-asset-bar-height);
    max-height: var(--mobile-asset-bar-height);
    pointer-events: auto;
  }
`, `  .asset-bar {
    position: absolute;
    z-index: auto;
    top: max(var(--mobile-chrome-block-inset), env(safe-area-inset-top));
    right: 0;
    left: 0;
    width: auto;
    height: var(--mobile-asset-bar-height);
    min-height: var(--mobile-asset-bar-height);
    max-height: var(--mobile-asset-bar-height);
    overflow: visible;
    pointer-events: auto;
  }
`, 'mobile status host');
  return content;
});

update('src/styles/game-shell-layout.css', (content) => replaceOnce(content, `  html[data-app-surface="game"] .asset-bar-scroll-area {
    position: absolute;
    z-index: 3;
    top: var(--desktop-shell-outer-inset);
    right: var(--desktop-shell-outer-inset);
    left: 0;
    width: auto;
    height: var(--desktop-asset-bar-height);
    margin: 0;
    padding: 0;
  }

  html[data-app-surface="game"] .asset-bar-scroll-track,
  html[data-app-surface="game"] .asset-bar {
    width: 100%;
    height: 100%;
    min-width: 0;
    margin: 0;
    padding: 0;
  }

  html[data-app-surface="game"] .asset-bar {
    position: relative;
    inset: auto;
  }
`, `  html[data-app-surface="game"] .asset-bar {
    position: absolute;
    z-index: 3;
    top: var(--desktop-shell-outer-inset);
    right: var(--desktop-shell-outer-inset);
    left: 0;
    width: auto;
    height: var(--desktop-asset-bar-height);
    min-width: 0;
    min-height: 0;
    margin: 0;
    padding: 0;
    overflow: visible;
  }
`, 'desktop final status geometry'));

update('src/styles/liquid-glass-surfaces.css', (content) => {
  content = content.replace('minimum contrast and one\n * non-material structural border.', 'minimum contrast and one\n * top-layer structural outline.');
  content = content.replaceAll('.asset-bar .liquid-glass-surface--desktopStatusBar', '.asset-bar > .liquid-glass-surface--desktopStatusBar');
  content = content.replaceAll('.asset-bar .liquid-glass-surface--mobileStatusBar', '.asset-bar > .liquid-glass-surface--mobileStatusBar');
  content = replaceOnce(content, `/* All chrome hosts keep one deterministic structural outline. Desktop and
 * mobile status bars intentionally suppress every upstream border/highlight
 * sibling so the status bar cannot render as nested or duplicated capsules. */
.liquid-glass-surface--desktopStatusBar,
.liquid-glass-surface--mobileStatusBar,
.liquid-glass-surface--mobileNavigation {
  box-sizing: border-box;
  border: 1px solid var(--liquid-glass-structure-border);
  background: var(--liquid-glass-contrast);
}
`, `/* Chrome hosts keep one deterministic structural outline. Status bars draw
 * that outline above the glass effect so sampled page edges cannot erase it;
 * mobile navigation keeps its existing host border and low-intensity highlight. */
.liquid-glass-surface--desktopStatusBar,
.liquid-glass-surface--mobileStatusBar,
.liquid-glass-surface--mobileNavigation {
  box-sizing: border-box;
  background: var(--liquid-glass-contrast);
}

.liquid-glass-surface--desktopStatusBar,
.liquid-glass-surface--mobileStatusBar {
  border: 0;
}

.liquid-glass-surface--mobileNavigation {
  border: 1px solid var(--liquid-glass-structure-border);
}

.liquid-glass-surface--desktopStatusBar::after,
.liquid-glass-surface--mobileStatusBar::after {
  content: "";
  position: absolute;
  z-index: 2;
  inset: 0;
  box-sizing: border-box;
  border: 1px solid var(--liquid-glass-structure-border);
  border-radius: inherit;
  pointer-events: none;
}
`, 'top-layer status outline');
  content = replaceOnce(content, `.asset-bar .liquid-glass-surface {
  width: max(100%, 675px);
  min-width: 675px;
}

.asset-bar-content {
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-columns: repeat(5, minmax(135px, 1fr));
  align-items: stretch;
  gap: 0;
  padding: var(--space-1);
}
`, `.asset-bar > .liquid-glass-surface {
  width: 100%;
  height: 100%;
  min-width: 0;
}

.asset-bar-content {
  width: 100%;
  height: 100%;
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  align-items: stretch;
  gap: 0;
  padding: var(--space-1);
  overflow: visible;
}
`, 'fixed status columns');
  content = replaceOnce(content, `@media (max-width: 960px) and (min-width: 721px) {
  .asset-bar .liquid-glass-surface {
    width: max(100%, 725px);
    min-width: 725px;
  }

  .asset-bar-content {
    grid-template-columns: repeat(5, minmax(145px, 1fr));
  }
}
`, `@media (max-width: 960px) and (min-width: 721px) {
  .asset-bar-content {
    grid-template-columns: repeat(5, minmax(0, 1fr));
    padding: .25rem;
  }

  .asset-bar-item {
    padding-inline: .35rem;
  }

  .asset-bar-item-label,
  .asset-bar-item > small {
    display: none;
  }
}
`, 'medium status compression');
  content = replaceOnce(content, `@media (max-width: 720px) {
  .asset-bar .liquid-glass-surface,
  .asset-bar .liquid-glass-surface > *,
  .asset-bar .liquid-glass-surface__effect > .glass {
    width: 100%;
    min-width: 0;
  }

  .asset-bar-content {
    display: flex;
    align-items: center;
    justify-content: space-evenly;
    gap: 0;
    padding: .25rem .8rem;
    overflow: hidden;
  }

  /* This is the only vertical padding owner for the 68px mobile capsule. */
`, `@media (max-width: 720px) {
  .asset-bar > .liquid-glass-surface,
  .asset-bar > .liquid-glass-surface > *,
  .asset-bar > .liquid-glass-surface .liquid-glass-surface__effect > .glass {
    width: 100%;
    min-width: 0;
  }

  /* This is the only vertical padding owner for the 68px mobile capsule. */
`, 'mobile fixed status surface');
  return content;
});

update('src/styles/mobile-status-navigation.css', (content) => {
  content = content.replace(`.asset-bar,
.sidebar-nav,`, `.sidebar-nav,`);
  content = replaceOnce(content, `  .asset-bar {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0;
    scroll-padding-inline: 0;
    scrollbar-width: none;
  }

  .asset-bar::-webkit-scrollbar,
  .mobile-bottom-navigation__viewport::-webkit-scrollbar {
`, `  .mobile-bottom-navigation__viewport::-webkit-scrollbar {
`, 'remove status scrolling from mobile navigation styles');
  return content;
});

write('src/styles/mobile-status-layout.css', `@media (max-width: 720px) {
  :root {
    --mobile-status-top-inset: max(var(--mobile-chrome-block-inset), env(safe-area-inset-top));
  }

  .asset-bar {
    top: var(--mobile-status-top-inset);
    right: 0;
    left: 0;
    width: auto;
    height: var(--mobile-asset-bar-height);
    min-height: var(--mobile-asset-bar-height);
    max-height: var(--mobile-asset-bar-height);
    max-width: none;
    display: block;
    border-radius: 999px;
    padding: 0;
    overflow: visible;
    transform: none;
    touch-action: auto;
    white-space: normal;
  }

  .asset-bar > .liquid-glass-surface {
    width: 100%;
    height: 100%;
    min-width: 0;
    border-radius: inherit;
  }

  .asset-bar-content {
    width: 100%;
    height: 100%;
    min-width: 0;
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    align-items: center;
    gap: 0;
    padding: .25rem .4rem;
    overflow: visible;
  }

  .asset-bar-item,
  .asset-bar-item:last-child {
    width: 100%;
    min-width: 0;
    height: 100%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: clamp(.1rem, 1vw, .25rem);
    border: 0;
    padding: 0;
    overflow: visible;
  }

  .asset-bar-item-icon {
    flex: 0 0 auto;
    width: clamp(1.05rem, 4.6vw, 1.3rem);
    height: clamp(1.05rem, 4.6vw, 1.3rem);
    display: grid;
    place-items: center;
    font-size: inherit;
  }

  .asset-bar-item-icon > svg {
    width: 100%;
    height: 100%;
    display: block;
  }

  .asset-bar-item-value {
    min-width: 0;
    overflow: hidden;
    font-size: clamp(.7rem, 3.45vw, .95rem);
    font-variant-numeric: tabular-nums;
    text-overflow: clip;
    white-space: nowrap;
  }

  .asset-bar-item-value > span {
    color: inherit;
    font-size: inherit;
  }
}
`);

write('src/styles/mobile-pages.css', `/* Mobile page-level responsive rules live outside the application shell styles. */

.asset-bar-item-value-compact {
  display: none;
}

@media (max-width: 960px) {
  .asset-bar-item-value-full {
    display: none;
  }

  .asset-bar-item-value-compact {
    display: inline;
  }
}

@media (max-width: 720px) {
  .production-grid {
    width: 100%;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--layout-gutter);
  }

  .production-grid > *,
  .facility-list,
  .facility-card {
    min-width: 0;
    width: 100%;
  }

  .build-card {
    position: static;
    top: auto;
  }
}
`);

update('src/styles/scrollbars.css', (content) => replaceOnce(content, `.asset-bar-scroll-track {
  width: 100%;
  height: 100%;
}

`, '', 'obsolete status scroll track'));

for (const path of [
  'tests/browser/game-shell-layout.spec.ts',
  'tests/browser/mobile-workspace-overlay.spec.ts',
  'tests/browser/market-runtime.spec.ts',
  'tests/browser/liquid-glass-layout.spec.ts',
]) {
  update(path, (content) => content.replaceAll('.asset-bar-scroll-area', '.asset-bar'));
}

update('tests/browser/liquid-glass-layout.spec.ts', (content) => {
  content = replaceOnce(content, `      const surfaceStyle = getComputedStyle(surface);
      const glassStyle = getComputedStyle(glass);
`, `      const surfaceStyle = getComputedStyle(surface);
      const outlineStyle = getComputedStyle(surface, '::after');
      const contentElement = surface.querySelector<HTMLElement>('.asset-bar-content');
      const glassStyle = getComputedStyle(glass);
`, 'desktop outline style');
  content = replaceOnce(content, `        surfaceBorderWidth: surfaceStyle.borderTopWidth,
        surfaceBorderStyle: surfaceStyle.borderTopStyle,
`, `        surfaceBorderWidth: surfaceStyle.borderTopWidth,
        surfaceBorderStyle: surfaceStyle.borderTopStyle,
        outlineBorderWidth: outlineStyle.borderTopWidth,
        outlineBorderStyle: outlineStyle.borderTopStyle,
        outlineZIndex: outlineStyle.zIndex,
        outlinePointerEvents: outlineStyle.pointerEvents,
        statusScrollAreaCount: assetBar.querySelectorAll('.ui-scroll-area').length,
        contentHasHorizontalOverflow: Boolean(contentElement && contentElement.scrollWidth > contentElement.clientWidth + 1),
`, 'desktop outline measurements');
  content = replaceOnce(content, `    expect(layout.surfaceBorderWidth).toBe('1px');
    expect(layout.surfaceBorderStyle).toBe('solid');
`, `    expect(layout.surfaceBorderWidth).toBe('0px');
    expect(layout.surfaceBorderStyle).toBe('none');
    expect(layout.outlineBorderWidth).toBe('1px');
    expect(layout.outlineBorderStyle).toBe('solid');
    expect(layout.outlineZIndex).toBe('2');
    expect(layout.outlinePointerEvents).toBe('none');
    expect(layout.statusScrollAreaCount).toBe(0);
    expect(layout.contentHasHorizontalOverflow).toBe(false);
`, 'desktop outline assertions');
  content = replaceOnce(content, `  });
});

test.describe('mobile liquid glass host geometry', () => {
`, `  });

  test('status bar keeps five fixed columns without an internal scroll area', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 900 });
    await page.goto('runtime-test.html?view=overview&scenario=activity');

    for (const width of [900, 720, 430, 390, 375, 360, 320]) {
      await page.setViewportSize({ width, height: 900 });
      const status = page.locator('header.asset-bar');
      const surface = status.locator('.liquid-glass-surface');
      const contentElement = status.locator('.asset-bar-content');
      const items = contentElement.locator('.asset-bar-item');
      await expect(status).toBeVisible();
      await expect(status.locator('.ui-scroll-area')).toHaveCount(0);
      await expect(items).toHaveCount(5);
      await expect(surface).toHaveAttribute(
        'data-liquid-glass-variant',
        width <= 720 ? 'mobileStatusBar' : 'desktopStatusBar',
      );

      const state = await contentElement.evaluate((element) => {
        const contentRect = element.getBoundingClientRect();
        const itemRects = [...element.querySelectorAll<HTMLElement>('.asset-bar-item')]
          .map((item) => item.getBoundingClientRect());
        const host = element.closest<HTMLElement>('.asset-bar');
        return {
          contentOverflow: element.scrollWidth > element.clientWidth + 1,
          hostOverflow: Boolean(host && host.scrollWidth > host.clientWidth + 1),
          itemsInside: itemRects.every((rect) => (
            rect.left >= contentRect.left - 1 && rect.right <= contentRect.right + 1
          )),
        };
      });

      expect(state.contentOverflow, `状态栏内容在 ${width}px 发生横向溢出`).toBe(false);
      expect(state.hostOverflow, `状态栏宿主在 ${width}px 发生横向溢出`).toBe(false);
      expect(state.itemsInside, `状态项在 ${width}px 超出固定五列`).toBe(true);
    }
  });
});

test.describe('mobile liquid glass host geometry', () => {
`, 'responsive fixed status test');
  content = replaceOnce(content, `      const statusSurfaceStyle = getComputedStyle(statusSurfaceElement);
      const navigationSurfaceStyle = getComputedStyle(navigationSurfaceElement);
`, `      const statusSurfaceStyle = getComputedStyle(statusSurfaceElement);
      const statusOutlineStyle = getComputedStyle(statusSurfaceElement, '::after');
      const statusContentElement = statusSurfaceElement.querySelector<HTMLElement>('.asset-bar-content');
      const navigationSurfaceStyle = getComputedStyle(navigationSurfaceElement);
`, 'mobile outline style');
  content = replaceOnce(content, `        statusGlassSurfaceCount: statusHostElement.querySelectorAll('.liquid-glass-surface').length,
`, `        statusGlassSurfaceCount: statusHostElement.querySelectorAll('.liquid-glass-surface').length,
        statusScrollAreaCount: statusHostElement.querySelectorAll('.ui-scroll-area').length,
        statusContentOverflow: Boolean(statusContentElement && statusContentElement.scrollWidth > statusContentElement.clientWidth + 1),
        statusOutlineBorderWidth: statusOutlineStyle.borderTopWidth,
        statusOutlineZIndex: statusOutlineStyle.zIndex,
        statusOutlinePointerEvents: statusOutlineStyle.pointerEvents,
`, 'mobile outline measurements');
  content = replaceOnce(content, `    expect(geometry.statusGlassSurfaceCount).toBe(1);
`, `    expect(geometry.statusGlassSurfaceCount).toBe(1);
    expect(geometry.statusScrollAreaCount).toBe(0);
    expect(geometry.statusContentOverflow).toBe(false);
    expect(geometry.statusOutlineBorderWidth).toBe('1px');
    expect(geometry.statusOutlineZIndex).toBe('2');
    expect(geometry.statusOutlinePointerEvents).toBe('none');
`, 'mobile outline assertions');
  return content;
});

update('scripts/verify-overlay-scrollbars.mjs', (content) => {
  content = content.replace(`    [paths.status, ['className="asset-bar-scroll-track"', 'viewportClassName="asset-bar"', 'horizontalVisibility="always"']],
`, '');
  content = replaceOnce(content, `  for (const text of [
    'className="sidebar mobile-bottom-navigation"',
`, `  for (const text of [
    "import { ScrollArea }",
    '<ScrollArea',
    'asset-bar-scroll-area',
    'asset-bar-scroll-track',
  ]) forbidText(paths.status, text);

  for (const text of [
    'className="asset-bar"',
    '<LiquidGlassSurface variant={surfaceVariant}>',
    'className="asset-bar-content"',
  ]) requireText(paths.status, text);

  for (const text of [
    'className="sidebar mobile-bottom-navigation"',
`, 'status no-scroll verification');
  content = content.replace('统一覆盖式滚动条、移动导航原生滚动视口与订单成交表验证失败', '统一覆盖式滚动条、固定状态栏、移动导航原生滚动视口与订单成交表验证失败');
  content = content.replace('统一覆盖式滚动条、移动底栏单一原生滚动视口、纵向优先', '统一覆盖式滚动条、无活动区状态栏、移动底栏单一原生滚动视口、纵向优先');
  return content;
});

update('scripts/verify-game-shell-layout.mjs', (content) => {
  content = content.replace(`  'scroll-padding-inline: 0;',
`, `  'display: block;',
  'overflow: visible;',
`);
  content = replaceOnce(content, `forbid('src/styles/scrollbars.css', [
  '.asset-bar-scroll-area,',
  'translateX(var(--mobile-scrollbar-edge-escape))',
]);
`, `forbid('src/styles/scrollbars.css', [
  'asset-bar-scroll-area',
  'asset-bar-scroll-track',
  'translateX(var(--mobile-scrollbar-edge-escape))',
]);
forbid('src/components/shell/StatusBar.tsx', [
  "import { ScrollArea }",
  '<ScrollArea',
  'asset-bar-scroll-area',
  'asset-bar-scroll-track',
]);
forbid('src/styles/viewport.css', ['asset-bar-scroll-area', 'asset-bar-scroll-track']);
forbid('src/styles/game-shell-layout.css', ['asset-bar-scroll-area', 'asset-bar-scroll-track']);
`, 'shell no-scroll guards');
  content = content.replace(`  '两者使用同一 \`40px\` 胶囊圆角',
`, `  '两者使用同一 \`40px\` 胶囊圆角',
  '顶部状态栏不得包含 \`ScrollArea\`',
`);
  content = content.replace('游戏外壳桌面导航、移动双层 Overlay、玻璃共线', '游戏外壳桌面导航、固定状态栏、移动双层 Overlay、玻璃共线');
  return content;
});

update('scripts/verify-desktop-primary-surfaces.mjs', (content) => {
  content = content.replace(`    '.asset-bar .liquid-glass-surface--desktopStatusBar,',`, `    '.asset-bar > .liquid-glass-surface--desktopStatusBar,',`);
  content = content.replace(`    '.liquid-glass-surface--desktopStatusBar,',
    'border: 1px solid var(--liquid-glass-structure-border);',`, `    '.liquid-glass-surface--desktopStatusBar::after,',
    'z-index: 2;',
    'border: 1px solid var(--liquid-glass-structure-border);',`);
  content = content.replace(`    '.asset-bar .liquid-glass-surface--desktopStatusBar .liquid-glass-surface__effect > .glass,',`, `    '.asset-bar > .liquid-glass-surface--desktopStatusBar .liquid-glass-surface__effect > .glass,',`);
  content = content.replace(`    "expect(layout.surfaceBorderWidth).toBe('1px')",`, `    "expect(layout.surfaceBorderWidth).toBe('0px')",
    "expect(layout.outlineBorderWidth).toBe('1px')",
    "expect(layout.outlineZIndex).toBe('2')",`);
  content = content.replace('单层结构边框', '顶层连续结构描边');
  return content;
});

update('scripts/verify-liquid-glass-chrome.mjs', (content) => {
  content = content.replace(`    'className="asset-bar-scroll-area"',
    'viewportClassName="asset-bar"',
`, `    'className="asset-bar"',
`);
  content = replaceOnce(content, `  for (const text of [
    '<LiquidGlassSurface variant="statusBar">',
`, `  for (const text of [
    "import { ScrollArea }",
    '<ScrollArea',
    'asset-bar-scroll-area',
    'asset-bar-scroll-track',
  ]) forbidText(files.status, text);
  for (const text of [
    '<LiquidGlassSurface variant="statusBar">',
`, 'status forbidden scroll area');
  content = content.replaceAll(`'.asset-bar .liquid-glass-surface--desktopStatusBar,'`, `'.asset-bar > .liquid-glass-surface--desktopStatusBar,'`);
  content = content.replaceAll(`'.asset-bar .liquid-glass-surface--mobileStatusBar,'`, `'.asset-bar > .liquid-glass-surface--mobileStatusBar,'`);
  content = content.replaceAll(`'.asset-bar .liquid-glass-surface--desktopStatusBar .liquid-glass-surface__effect > .glass,'`, `'.asset-bar > .liquid-glass-surface--desktopStatusBar .liquid-glass-surface__effect > .glass,'`);
  content = content.replaceAll(`'.asset-bar .liquid-glass-surface--mobileStatusBar .liquid-glass-surface__effect > .glass {'`, `'.asset-bar > .liquid-glass-surface--mobileStatusBar .liquid-glass-surface__effect > .glass {'`);
  content = content.replace(`    'border: 1px solid var(--liquid-glass-structure-border);',
`, `    '.liquid-glass-surface--desktopStatusBar::after,',
    '.liquid-glass-surface--mobileStatusBar::after {',
    'content: "";',
    'z-index: 2;',
    'border: 1px solid var(--liquid-glass-structure-border);',
    'pointer-events: none;',
`);
  content = content.replace(`    'width: max(100%, 675px);',
    'padding: .25rem .8rem;',
`, `    '.asset-bar > .liquid-glass-surface {',
    'grid-template-columns: repeat(5, minmax(0, 1fr));',
    'overflow: visible;',
`);
  content = content.replace(`    '.asset-bar {',
    'padding: 0;',
    'scroll-padding-inline: 0;',
`, `    '.asset-bar {',
    'display: block;',
    'padding: 0;',
    'overflow: visible;',
    'grid-template-columns: repeat(5, minmax(0, 1fr));',
`);
  content = content.replace(`    '.asset-bar-scroll-area,',
`, `    'asset-bar-scroll-area',
    'asset-bar-scroll-track',
`);
  content = content.replace(`    '不得给 \`.asset-bar-scroll-area\` 设置 \`height: 100%\`',
`, `    '顶部状态栏不得包含 \`ScrollArea\`',
    '固定五列布局',
    '最上层连续结构描边',
`);
  content = content.replace(`    "expect(layout.surfaceBorderWidth).toBe('1px')",
`, `    "expect(layout.surfaceBorderWidth).toBe('0px')",
    "expect(layout.outlineBorderWidth).toBe('1px')",
    "expect(layout.outlineZIndex).toBe('2')",
    'status bar keeps five fixed columns without an internal scroll area',
`);
  content = content.replace('状态栏单壳结构、移动底栏单一原生滚动视口', '状态栏固定五列单壳结构、顶层连续描边、移动底栏单一原生滚动视口');
  return content;
});

update('docs/LIQUID_GLASS_CHROME_DESIGN.md', (content) => {
  content = content.replace('更新时间：2026-07-20', '更新时间：2026-07-21');
  content = content.replace('`StatusBar.tsx` 通过 `(max-width: 720px)` 媒体查询在 `desktopStatusBar` 与 `mobileStatusBar` 之间切换；任一时刻只能渲染一个状态栏玻璃实例，不得通过同时渲染两套后再用 CSS 隐藏。', '`StatusBar.tsx` 通过 `(max-width: 720px)` 媒体查询在 `desktopStatusBar` 与 `mobileStatusBar` 之间切换；任一时刻只能渲染一个状态栏玻璃实例，不得通过同时渲染两套后再用 CSS 隐藏。顶部状态栏不得包含 `ScrollArea`、原生滚动视口或项目自绘滚动条。');
  content = content.replace('| `StatusBar.tsx` | 保持单一状态栏实例，并按 `720px` 断点选择桌面／移动状态栏预设 |', '| `StatusBar.tsx` | 保持单一状态栏实例，按 `720px` 断点选择预设，并直接承载固定五列状态内容；不得引入 `ScrollArea` |');
  content = content.replace('| `liquid-glass-surfaces.css` | 玻璃宿主、第三方 DOM 尺寸、开放背景采样链、平台圆角、透明染色、状态栏单壳层级、移动底栏单层高光、结构描边、底栏唯一垂直留白和 WebKit 兼容别名 |', '| `liquid-glass-surfaces.css` | 玻璃宿主、第三方 DOM 尺寸、开放背景采样链、平台圆角、透明染色、状态栏单壳层级、状态栏最上层连续结构描边、移动底栏单层高光、底栏唯一垂直留白和 WebKit 兼容别名 |');
  content = content.replaceAll('`.asset-bar-scroll-area`', '`.asset-bar`');
  content = content.replace('- `.asset-bar` 不得用水平 padding 缩窄实际玻璃，状态项留白放入 `.asset-bar-content`；', '- `.asset-bar` 是固定定位宿主并直接包含唯一 `LiquidGlassSurface`；不得用水平 padding 缩窄实际玻璃，状态项留白放入 `.asset-bar-content`；\n- `.asset-bar-content` 固定使用五列 `repeat(5, minmax(0, 1fr))`，不得通过横向滚动解决空间不足；`721px–960px` 隐藏标签与说明并切换紧凑数值，不大于 `720px` 时继续使用紧凑数值与自适应字号；');
  content = content.replace('- 三种宿主都只保留一条低强度 `1px` 结构描边；桌面状态栏圆角为 `24px`，移动状态栏和底栏圆角为 `40px`；', '- 三种宿主都只保留一条低强度 `1px` 结构描边；桌面与移动状态栏使用 `::after` 在玻璃效果与内容上方绘制连续内描边，移动底栏继续使用宿主边框；桌面状态栏圆角为 `24px`，移动状态栏和底栏圆角为 `40px`；');
  content = replaceOnce(content, `## 9. 性能与可访问性
`, `### 8.1 顶部状态栏固定内容规则

- DOM 固定为 \`header.asset-bar → LiquidGlassSurface → .liquid-glass-surface__content → .asset-bar-content → 五个状态项\`；状态栏范围内不得出现 \`.ui-scroll-area\`、\`.ui-scroll-area__viewport\`、\`.ui-scrollbar\`、\`.asset-bar-scroll-area\` 或 \`.asset-bar-scroll-track\`。
- 状态栏玻璃宽度始终等于宿主可视宽度，内容不得扩大玻璃最小宽度；所有受支持宽度下 \`.asset-bar-content.scrollWidth <= clientWidth + 1\`。
- 顶部状态栏的结构描边必须位于玻璃效果和状态内容之上，使用 \`z-index: 2\`、\`pointer-events: none\` 的 \`::after\` 内描边；玻璃宿主继续负责唯一圆角裁切。
- 页面滚动到卡片、卡片边框或深色表面后方时，状态栏顶部、底部与两端圆角描边必须保持连续，不能依赖第三方高光补边。

## 9. 性能与可访问性
`, 'fixed status design section');
  content = content.replace('1. 桌面状态栏使用', '1. 顶部状态栏不包含任何内部活动区域或滚动条，五个状态项在 900px、720px、430px、390px、375px、360px 和 320px 下均完整位于固定五列内；桌面状态栏使用');
  return content;
});

update('README.md', (content) => replaceOnce(content, '- 状态栏、导航、商品和工厂资产使用统一内联 SVG；工厂厂房图标与机械商品齿轮图标保持独立。', '- 顶部状态栏直接由固定玻璃胶囊承载五列状态内容，不包含 `ScrollArea`、内部滚动视口或自绘滚动条；窄桌面和移动端使用紧凑数值与自适应字号，状态栏最上层 `::after` 内描边必须在卡片后方滚动时保持连续。\n- 状态栏、导航、商品和工厂资产使用统一内联 SVG；工厂厂房图标与机械商品齿轮图标保持独立。', 'README status rule'));

for (const [path, forbidden] of [
  ['src/components/shell/StatusBar.tsx', ['ScrollArea', 'asset-bar-scroll-area', 'asset-bar-scroll-track']],
  ['src/styles/viewport.css', ['asset-bar-scroll-area', 'asset-bar-scroll-track']],
  ['src/styles/game-shell-layout.css', ['asset-bar-scroll-area', 'asset-bar-scroll-track']],
  ['src/styles/mobile-status-layout.css', ['asset-bar-scroll-area', 'asset-bar-scroll-track', 'overflow-x: auto']],
  ['src/styles/scrollbars.css', ['asset-bar-scroll-track']],
]) {
  const content = read(path);
  for (const value of forbidden) {
    if (content.includes(value)) throw new Error(`${path} still contains forbidden ${value}`);
  }
}

console.log('Static fixed-column status bar migration applied.');
