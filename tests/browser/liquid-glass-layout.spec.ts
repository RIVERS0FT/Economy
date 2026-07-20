import { expect, test } from '@playwright/test';

test.describe('liquid glass shell geometry', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('desktop status bar uses enhanced refraction, shared inset and one visible highlight', async ({ page }) => {
    await page.goto('runtime-test.html?view=overview&scenario=activity');
    await expect(page.locator('.asset-bar-scroll-area')).toBeVisible();
    const glassSurface = page.locator('.asset-bar .liquid-glass-surface');
    await expect(glassSurface).toBeVisible();
    await expect(glassSurface).toHaveAttribute('data-liquid-glass-mode', 'prominent');
    await expect(page.locator('.overview-today-panel')).toBeVisible();

    const layout = await page.evaluate(() => {
      const workspace = document.querySelector<HTMLElement>('.workspace');
      const assetBarArea = document.querySelector<HTMLElement>('.asset-bar-scroll-area');
      const assetBar = document.querySelector<HTMLElement>('.asset-bar');
      const surface = document.querySelector<HTMLElement>('.asset-bar .liquid-glass-surface');
      const warp = document.querySelector<HTMLElement>('.asset-bar .glass__warp');
      const heading = document.querySelector<HTMLElement>('.page-heading');
      const primaryPanel = document.querySelector<HTMLElement>('.overview-today-panel');
      if (!workspace || !assetBarArea || !assetBar || !surface || !warp || !heading || !primaryPanel) {
        throw new Error('status bar geometry fixture is incomplete');
      }

      const workspaceRect = workspace.getBoundingClientRect();
      const assetBarAreaRect = assetBarArea.getBoundingClientRect();
      const assetBarRect = assetBar.getBoundingClientRect();
      const surfaceRect = surface.getBoundingClientRect();
      const headingRect = heading.getBoundingClientRect();
      const assetBarStyle = getComputedStyle(assetBar);
      const surfaceStyle = getComputedStyle(surface);
      const warpStyle = getComputedStyle(warp) as CSSStyleDeclaration & { webkitBackdropFilter?: string };
      const primaryPanelStyle = getComputedStyle(primaryPanel);
      const directDecorationSpans = Array.from(surface.children)
        .filter((element) => element.tagName === 'SPAN') as HTMLElement[];

      return {
        workspaceWidth: workspaceRect.width,
        assetBarAreaWidth: assetBarAreaRect.width,
        assetBarWidth: assetBarRect.width,
        surfaceWidth: surfaceRect.width,
        assetBarTopInset: assetBarAreaRect.top - workspaceRect.top,
        assetBarRightInset: workspaceRect.right - assetBarAreaRect.right,
        assetBarBottom: assetBarAreaRect.bottom,
        headingTop: headingRect.top,
        assetBarDisplay: assetBarStyle.display,
        surfaceOverflowX: surfaceStyle.overflowX,
        surfaceContain: surfaceStyle.contain,
        surfaceIsolation: surfaceStyle.isolation,
        surfaceRadius: [
          surfaceStyle.borderTopLeftRadius,
          surfaceStyle.borderTopRightRadius,
          surfaceStyle.borderBottomRightRadius,
          surfaceStyle.borderBottomLeftRadius,
        ],
        panelRadius: primaryPanelStyle.borderTopLeftRadius,
        surfaceBorderWidth: surfaceStyle.borderTopWidth,
        surfaceBorderStyle: surfaceStyle.borderTopStyle,
        surfaceBackgroundColor: surfaceStyle.backgroundColor,
        glassMode: surface.dataset.liquidGlassMode,
        warpBackdropFilter: warpStyle.backdropFilter || warpStyle.webkitBackdropFilter || '',
        warpFilter: warpStyle.filter,
        directDecorationSpanCount: directDecorationSpans.length,
        visibleDecorationSpanCount: directDecorationSpans
          .filter((element) => Number.parseFloat(getComputedStyle(element).opacity) > 0).length,
        hasPanelClass: assetBar.classList.contains('panel'),
        glassSurfaceCount: assetBar.querySelectorAll('.liquid-glass-surface').length,
      };
    });

    expect(Math.abs(layout.workspaceWidth - layout.assetBarAreaWidth - 12)).toBeLessThanOrEqual(1);
    expect(Math.abs(layout.assetBarWidth - layout.assetBarAreaWidth)).toBeLessThanOrEqual(1);
    expect(Math.abs(layout.surfaceWidth - layout.assetBarWidth)).toBeLessThanOrEqual(1);
    expect(layout.assetBarTopInset).toBeCloseTo(12, 0);
    expect(layout.assetBarRightInset).toBeCloseTo(12, 0);
    expect(layout.assetBarDisplay).not.toBe('grid');
    expect(layout.surfaceOverflowX).toBe('hidden');
    expect(layout.surfaceContain).toBe('none');
    expect(layout.surfaceIsolation).toBe('auto');
    expect(layout.surfaceRadius).toEqual([
      layout.panelRadius,
      layout.panelRadius,
      layout.panelRadius,
      layout.panelRadius,
    ]);
    expect(layout.panelRadius).toBe('24px');
    expect(layout.surfaceBorderWidth).toBe('1px');
    expect(layout.surfaceBorderStyle).toBe('solid');
    expect(layout.surfaceBackgroundColor).toBe('rgba(0, 0, 0, 0)');
    expect(layout.glassMode).toBe('prominent');
    expect(layout.warpBackdropFilter).not.toBe('none');
    expect(layout.warpFilter).toContain('url(');
    expect(layout.directDecorationSpanCount).toBeGreaterThanOrEqual(2);
    expect(layout.visibleDecorationSpanCount).toBe(1);
    expect(layout.hasPanelClass).toBe(false);
    expect(layout.glassSurfaceCount).toBe(1);
    expect(layout.headingTop).toBeGreaterThanOrEqual(layout.assetBarBottom);
  });
});

test.describe('mobile liquid glass host geometry', () => {
  test('mobile chrome shares the workspace gutter and fixed glass heights', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('runtime-test.html?view=overview&scenario=activity');

    const chromeOverlay = page.locator('.mobile-chrome-overlay');
    const statusHost = page.locator('.asset-bar-scroll-area');
    const statusSurface = page.locator('.asset-bar .liquid-glass-surface');
    const navigationHost = page.locator('.mobile-bottom-navigation');
    const navigationSurface = page.locator('.mobile-bottom-navigation .liquid-glass-surface');
    const primaryPanel = page.locator('.overview-today-panel');
    await expect(chromeOverlay).toBeVisible();
    await expect(statusHost).toBeVisible();
    await expect(statusSurface).toBeVisible();
    await expect(navigationHost).toBeVisible();
    await expect(navigationSurface).toBeVisible();
    await expect(primaryPanel).toBeVisible();
    await expect(statusHost).toHaveCSS('height', '48px');
    await expect(statusSurface).toHaveCSS('height', '48px');
    await expect(navigationHost).toHaveCSS('height', '68px');

    const geometry = await page.evaluate(() => {
      const workspaceElement = document.querySelector<HTMLElement>('.workspace');
      const pageOverlayElement = document.querySelector<HTMLElement>('.mobile-page-overlay');
      const chromeOverlayElement = document.querySelector<HTMLElement>('.mobile-chrome-overlay');
      const pageScrollElement = document.querySelector<HTMLElement>('.page-scroll');
      const statusHostElement = document.querySelector<HTMLElement>('.asset-bar-scroll-area');
      const navigationHostElement = document.querySelector<HTMLElement>('.mobile-bottom-navigation');
      const statusSurfaceElement = document.querySelector<HTMLElement>('.asset-bar .liquid-glass-surface');
      const navigationSurfaceElement = document.querySelector<HTMLElement>(
        '.mobile-bottom-navigation .liquid-glass-surface',
      );
      const statusWarpElement = document.querySelector<HTMLElement>('.asset-bar .glass__warp');
      const navigationWarpElement = document.querySelector<HTMLElement>(
        '.mobile-bottom-navigation .glass__warp',
      );
      const primaryPanelElement = document.querySelector<HTMLElement>('.overview-today-panel');
      if (!workspaceElement || !pageOverlayElement || !chromeOverlayElement || !pageScrollElement
        || !statusHostElement || !navigationHostElement || !statusSurfaceElement
        || !navigationSurfaceElement || !statusWarpElement || !navigationWarpElement
        || !primaryPanelElement) {
        throw new Error('mobile liquid glass geometry fixture is incomplete');
      }
      const rect = (element: HTMLElement) => {
        const box = element.getBoundingClientRect();
        return { left: box.left, right: box.right, width: box.width, height: box.height };
      };
      const backdropFilter = (element: HTMLElement) => {
        const style = getComputedStyle(element) as CSSStyleDeclaration & { webkitBackdropFilter?: string };
        return style.backdropFilter || style.webkitBackdropFilter || '';
      };
      const hasSvgFilterTarget = (element: HTMLElement) => {
        const match = element.style.filter.match(/url\(["']?#([^"')]+)["']?\)/);
        return Boolean(match?.[1] && document.getElementById(match[1]));
      };
      const statusSurfaceStyle = getComputedStyle(statusSurfaceElement);
      const navigationSurfaceStyle = getComputedStyle(navigationSurfaceElement);
      return {
        statusSurface: rect(statusSurfaceElement),
        navigationSurface: rect(navigationSurfaceElement),
        primaryPanel: rect(primaryPanelElement),
        navigationRadius: navigationSurfaceStyle.borderTopLeftRadius,
        primaryPanelRadius: getComputedStyle(primaryPanelElement).borderTopLeftRadius,
        statusContain: statusSurfaceStyle.contain,
        navigationContain: navigationSurfaceStyle.contain,
        statusIsolation: statusSurfaceStyle.isolation,
        navigationIsolation: navigationSurfaceStyle.isolation,
        statusOverflow: statusSurfaceStyle.overflow,
        navigationOverflow: navigationSurfaceStyle.overflow,
        statusBackdropFilter: backdropFilter(statusWarpElement),
        navigationBackdropFilter: backdropFilter(navigationWarpElement),
        statusFilterTargetExists: hasSvgFilterTarget(statusWarpElement),
        navigationFilterTargetExists: hasSvgFilterTarget(navigationWarpElement),
        workspaceIsolation: getComputedStyle(workspaceElement).isolation,
        pageOverlayZIndex: getComputedStyle(pageOverlayElement).zIndex,
        chromeOverlayZIndex: getComputedStyle(chromeOverlayElement).zIndex,
        pageScrollZIndex: getComputedStyle(pageScrollElement).zIndex,
        statusHostZIndex: getComputedStyle(statusHostElement).zIndex,
        navigationHostZIndex: getComputedStyle(navigationHostElement).zIndex,
      };
    });

    expect(geometry.statusSurface.left).toBeCloseTo(geometry.primaryPanel.left, 0);
    expect(geometry.statusSurface.right).toBeCloseTo(geometry.primaryPanel.right, 0);
    expect(geometry.navigationSurface.left).toBeCloseTo(geometry.primaryPanel.left, 0);
    expect(geometry.navigationSurface.right).toBeCloseTo(geometry.primaryPanel.right, 0);
    expect(geometry.navigationRadius).toBe(geometry.primaryPanelRadius);
    expect(geometry.navigationRadius).toBe('40px');
    expect(geometry.statusContain).toBe('none');
    expect(geometry.navigationContain).toBe('none');
    expect(geometry.statusIsolation).toBe('auto');
    expect(geometry.navigationIsolation).toBe('auto');
    expect(geometry.statusOverflow).toBe('hidden');
    expect(geometry.navigationOverflow).toBe('hidden');
    expect(geometry.statusBackdropFilter).not.toBe('none');
    expect(geometry.navigationBackdropFilter).not.toBe('none');
    expect(geometry.statusFilterTargetExists).toBe(true);
    expect(geometry.navigationFilterTargetExists).toBe(true);
    expect(geometry.workspaceIsolation).toBe('auto');
    expect(geometry.pageOverlayZIndex).toBe('auto');
    expect(geometry.chromeOverlayZIndex).toBe('auto');
    expect(geometry.pageScrollZIndex).toBe('auto');
    expect(geometry.statusHostZIndex).toBe('auto');
    expect(geometry.navigationHostZIndex).toBe('auto');
  });
});
