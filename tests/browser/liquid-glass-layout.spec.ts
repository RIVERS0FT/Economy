import { expect, test } from '@playwright/test';

test.describe('liquid glass shell geometry', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('desktop status bar uses its dedicated single-shell glass preset and shell inset', async ({ page }) => {
    await page.goto('runtime-test.html?view=overview&scenario=activity');
    await expect(page.locator('.asset-bar')).toBeVisible();
    const glassSurface = page.locator('.asset-bar .liquid-glass-surface');
    await expect(glassSurface).toBeVisible();
    await expect(glassSurface).toHaveAttribute('data-liquid-glass-variant', 'desktopStatusBar');
    await expect(glassSurface).toHaveAttribute('data-liquid-glass-mode', 'standard');
    await expect(page.locator('.overview-today-panel')).toBeVisible();

    const layout = await page.evaluate(() => {
      const workspace = document.querySelector<HTMLElement>('.workspace');
      const assetBarArea = document.querySelector<HTMLElement>('.asset-bar');
      const assetBar = document.querySelector<HTMLElement>('.asset-bar');
      const surface = document.querySelector<HTMLElement>('.asset-bar .liquid-glass-surface');
      const warp = document.querySelector<HTMLElement>('.asset-bar .glass__warp');
      const glass = document.querySelector<HTMLElement>('.asset-bar .liquid-glass-surface__effect > .glass');
      const heading = document.querySelector<HTMLElement>('.page-heading');
      const primaryPanel = document.querySelector<HTMLElement>('.overview-today-panel');
      if (!workspace || !assetBarArea || !assetBar || !surface || !warp || !glass || !heading || !primaryPanel) {
        throw new Error('status bar geometry fixture is incomplete');
      }

      const workspaceRect = workspace.getBoundingClientRect();
      const assetBarAreaRect = assetBarArea.getBoundingClientRect();
      const assetBarRect = assetBar.getBoundingClientRect();
      const surfaceRect = surface.getBoundingClientRect();
      const headingRect = heading.getBoundingClientRect();
      const assetBarStyle = getComputedStyle(assetBar);
      const surfaceStyle = getComputedStyle(surface);
      const outlineStyle = getComputedStyle(surface, '::after');
      const contentElement = surface.querySelector<HTMLElement>('.asset-bar-content');
      const glassStyle = getComputedStyle(glass);
      const warpStyle = getComputedStyle(warp) as CSSStyleDeclaration & { webkitBackdropFilter?: string };
      const primaryPanelStyle = getComputedStyle(primaryPanel);
      const directDecorationSpans = Array.from(surface.children)
        .filter((element) => element.tagName === 'SPAN') as HTMLElement[];
      const directAuxiliaryDivs = Array.from(surface.children)
        .filter((element) => element.tagName === 'DIV' && !element.classList.contains('liquid-glass-surface__effect')) as HTMLElement[];
      const isVisible = (element: HTMLElement) => {
        const style = getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden' && Number.parseFloat(style.opacity) > 0;
      };

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
        outlineBorderWidth: outlineStyle.borderTopWidth,
        outlineBorderStyle: outlineStyle.borderTopStyle,
        outlineZIndex: outlineStyle.zIndex,
        outlinePointerEvents: outlineStyle.pointerEvents,
        statusScrollAreaCount: assetBar.querySelectorAll('.ui-scroll-area').length,
        contentHasHorizontalOverflow: Boolean(contentElement && contentElement.scrollWidth > contentElement.clientWidth + 1),
        surfaceBackgroundColor: surfaceStyle.backgroundColor,
        glassMode: surface.dataset.liquidGlassMode,
        glassVariant: surface.dataset.liquidGlassVariant,
        glassBoxShadow: glassStyle.boxShadow,
        warpBackdropFilter: warpStyle.backdropFilter || warpStyle.webkitBackdropFilter || '',
        warpFilter: warpStyle.filter,
        directDecorationSpanCount: directDecorationSpans.length,
        visibleDecorationSpanCount: directDecorationSpans.filter(isVisible).length,
        directAuxiliaryDivCount: directAuxiliaryDivs.length,
        visibleAuxiliaryDivCount: directAuxiliaryDivs.filter(isVisible).length,
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
    expect(layout.surfaceRadius).toEqual(['24px', '24px', '24px', '24px']);
    expect(layout.panelRadius).toBe('24px');
    expect(layout.surfaceBorderWidth).toBe('0px');
    expect(layout.surfaceBorderStyle).toBe('none');
    expect(layout.outlineBorderWidth).toBe('1px');
    expect(layout.outlineBorderStyle).toBe('solid');
    expect(layout.outlineZIndex).toBe('2');
    expect(layout.outlinePointerEvents).toBe('none');
    expect(layout.statusScrollAreaCount).toBe(0);
    expect(layout.contentHasHorizontalOverflow).toBe(false);
    expect(layout.surfaceBackgroundColor).toBe('rgba(194, 231, 214, 0.06)');
    expect(layout.glassMode).toBe('standard');
    expect(layout.glassVariant).toBe('desktopStatusBar');
    expect(layout.glassBoxShadow).toBe('none');
    expect(layout.warpBackdropFilter).toContain('blur(6px)');
    expect(layout.warpBackdropFilter).toMatch(/saturate\((?:120%|1\.2)\)/);
    expect(layout.warpFilter).toContain('url(');
    expect(layout.directDecorationSpanCount).toBeGreaterThanOrEqual(2);
    expect(layout.visibleDecorationSpanCount).toBe(0);
    expect(layout.directAuxiliaryDivCount).toBeGreaterThanOrEqual(1);
    expect(layout.visibleAuxiliaryDivCount).toBe(0);
    expect(layout.hasPanelClass).toBe(false);
    expect(layout.glassSurfaceCount).toBe(1);
    expect(layout.headingTop).toBeGreaterThanOrEqual(layout.assetBarBottom);
  });

  test('status bar changes platform preset in place without rendering duplicate glass hosts', async ({ page }) => {
    await page.goto('runtime-test.html?view=overview&scenario=activity');
    const statusSurface = page.locator('.asset-bar .liquid-glass-surface');
    await expect(statusSurface).toHaveCount(1);
    await expect(statusSurface).toHaveAttribute('data-liquid-glass-variant', 'desktopStatusBar');
    await statusSurface.evaluate((element) => {
      (element as HTMLElement).dataset.instanceProbe = 'single-host';
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(statusSurface).toHaveCount(1);
    await expect(statusSurface).toHaveAttribute('data-liquid-glass-variant', 'mobileStatusBar');
    await expect(statusSurface).toHaveAttribute('data-instance-probe', 'single-host');

    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(statusSurface).toHaveCount(1);
    await expect(statusSurface).toHaveAttribute('data-liquid-glass-variant', 'desktopStatusBar');
    await expect(statusSurface).toHaveAttribute('data-instance-probe', 'single-host');
  });

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
  test('mobile status and navigation share the mobile chrome preset while status remains single-shell', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('runtime-test.html?view=overview&scenario=activity');

    const chromeOverlay = page.locator('.mobile-chrome-overlay');
    const statusHost = page.locator('.asset-bar');
    const statusSurface = page.locator('.asset-bar .liquid-glass-surface');
    const navigationHost = page.locator('.mobile-bottom-navigation');
    const navigationSurface = page.locator('.mobile-bottom-navigation .liquid-glass-surface');
    const primaryPanel = page.locator('.overview-today-panel');
    await expect(chromeOverlay).toBeVisible();
    await expect(statusHost).toBeVisible();
    await expect(statusSurface).toHaveCount(1);
    await expect(statusSurface).toBeVisible();
    await expect(statusSurface).toHaveAttribute('data-liquid-glass-variant', 'mobileStatusBar');
    await expect(statusSurface).toHaveAttribute('data-liquid-glass-mode', 'standard');
    await expect(navigationHost).toBeVisible();
    await expect(navigationSurface).toBeVisible();
    await expect(navigationSurface).toHaveAttribute('data-liquid-glass-variant', 'mobileNavigation');
    await expect(navigationSurface).toHaveAttribute('data-liquid-glass-mode', 'standard');
    await expect(primaryPanel).toBeVisible();
    await expect(statusHost).toHaveCSS('height', '48px');
    await expect(statusSurface).toHaveCSS('height', '48px');
    await expect(navigationHost).toHaveCSS('height', '68px');

    const geometry = await page.evaluate(() => {
      const workspaceElement = document.querySelector<HTMLElement>('.workspace');
      const pageOverlayElement = document.querySelector<HTMLElement>('.mobile-page-overlay');
      const chromeOverlayElement = document.querySelector<HTMLElement>('.mobile-chrome-overlay');
      const pageScrollElement = document.querySelector<HTMLElement>('.page-scroll');
      const statusHostElement = document.querySelector<HTMLElement>('.asset-bar');
      const navigationHostElement = document.querySelector<HTMLElement>('.mobile-bottom-navigation');
      const statusSurfaceElement = document.querySelector<HTMLElement>('.asset-bar .liquid-glass-surface');
      const navigationSurfaceElement = document.querySelector<HTMLElement>(
        '.mobile-bottom-navigation .liquid-glass-surface',
      );
      const statusWarpElement = document.querySelector<HTMLElement>('.asset-bar .glass__warp');
      const navigationWarpElement = document.querySelector<HTMLElement>(
        '.mobile-bottom-navigation .glass__warp',
      );
      const statusGlassElement = document.querySelector<HTMLElement>(
        '.asset-bar .liquid-glass-surface__effect > .glass',
      );
      const primaryPanelElement = document.querySelector<HTMLElement>('.overview-today-panel');
      if (!workspaceElement || !pageOverlayElement || !chromeOverlayElement || !pageScrollElement
        || !statusHostElement || !navigationHostElement || !statusSurfaceElement
        || !navigationSurfaceElement || !statusWarpElement || !navigationWarpElement
        || !statusGlassElement || !primaryPanelElement) {
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
      const visibleDirectSpanCount = (surface: HTMLElement) => Array.from(surface.children)
        .filter((element): element is HTMLElement => element instanceof HTMLElement && element.tagName === 'SPAN')
        .filter((element) => {
          const style = getComputedStyle(element);
          return style.display !== 'none' && style.visibility !== 'hidden' && Number.parseFloat(style.opacity) > 0;
        }).length;
      const statusSurfaceStyle = getComputedStyle(statusSurfaceElement);
      const statusOutlineStyle = getComputedStyle(statusSurfaceElement, '::after');
      const statusContentElement = statusSurfaceElement.querySelector<HTMLElement>('.asset-bar-content');
      const navigationSurfaceStyle = getComputedStyle(navigationSurfaceElement);
      return {
        statusSurface: rect(statusSurfaceElement),
        navigationSurface: rect(navigationSurfaceElement),
        primaryPanel: rect(primaryPanelElement),
        statusRadius: statusSurfaceStyle.borderTopLeftRadius,
        navigationRadius: navigationSurfaceStyle.borderTopLeftRadius,
        primaryPanelRadius: getComputedStyle(primaryPanelElement).borderTopLeftRadius,
        statusMode: statusSurfaceElement.dataset.liquidGlassMode,
        navigationMode: navigationSurfaceElement.dataset.liquidGlassMode,
        statusVariant: statusSurfaceElement.dataset.liquidGlassVariant,
        navigationVariant: navigationSurfaceElement.dataset.liquidGlassVariant,
        statusBackground: statusSurfaceStyle.backgroundColor,
        navigationBackground: navigationSurfaceStyle.backgroundColor,
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
        statusVisibleDecorationSpanCount: visibleDirectSpanCount(statusSurfaceElement),
        navigationVisibleDecorationSpanCount: visibleDirectSpanCount(navigationSurfaceElement),
        statusGlassBoxShadow: getComputedStyle(statusGlassElement).boxShadow,
        statusGlassSurfaceCount: statusHostElement.querySelectorAll('.liquid-glass-surface').length,
        statusScrollAreaCount: statusHostElement.querySelectorAll('.ui-scroll-area').length,
        statusContentOverflow: Boolean(statusContentElement && statusContentElement.scrollWidth > statusContentElement.clientWidth + 1),
        statusOutlineBorderWidth: statusOutlineStyle.borderTopWidth,
        statusOutlineZIndex: statusOutlineStyle.zIndex,
        statusOutlinePointerEvents: statusOutlineStyle.pointerEvents,
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
    expect(geometry.statusRadius).toBe('40px');
    expect(geometry.navigationRadius).toBe('40px');
    expect(geometry.primaryPanelRadius).toBe('40px');
    expect(geometry.statusMode).toBe('standard');
    expect(geometry.navigationMode).toBe('standard');
    expect(geometry.statusVariant).toBe('mobileStatusBar');
    expect(geometry.navigationVariant).toBe('mobileNavigation');
    expect(geometry.statusBackground).toBe(geometry.navigationBackground);
    expect(geometry.statusBackground).toBe('rgba(194, 231, 214, 0.06)');
    expect(geometry.statusContain).toBe('none');
    expect(geometry.navigationContain).toBe('none');
    expect(geometry.statusIsolation).toBe('auto');
    expect(geometry.navigationIsolation).toBe('auto');
    expect(geometry.statusOverflow).toBe('hidden');
    expect(geometry.navigationOverflow).toBe('hidden');
    expect(geometry.statusBackdropFilter).not.toBe('none');
    expect(geometry.navigationBackdropFilter).not.toBe('none');
    expect(geometry.statusBackdropFilter).toBe(geometry.navigationBackdropFilter);
    expect(geometry.statusBackdropFilter).toContain('blur(7.2px)');
    expect(geometry.statusBackdropFilter).toMatch(/saturate\((?:125%|1\.25)\)/);
    expect(geometry.statusFilterTargetExists).toBe(true);
    expect(geometry.navigationFilterTargetExists).toBe(true);
    expect(geometry.statusVisibleDecorationSpanCount).toBe(0);
    expect(geometry.navigationVisibleDecorationSpanCount).toBe(1);
    expect(geometry.statusGlassBoxShadow).toBe('none');
    expect(geometry.statusGlassSurfaceCount).toBe(1);
    expect(geometry.statusScrollAreaCount).toBe(0);
    expect(geometry.statusContentOverflow).toBe(false);
    expect(geometry.statusOutlineBorderWidth).toBe('1px');
    expect(geometry.statusOutlineZIndex).toBe('2');
    expect(geometry.statusOutlinePointerEvents).toBe('none');
    expect(geometry.workspaceIsolation).toBe('auto');
    expect(geometry.pageOverlayZIndex).toBe('auto');
    expect(geometry.chromeOverlayZIndex).toBe('auto');
    expect(geometry.pageScrollZIndex).toBe('auto');
    expect(geometry.statusHostZIndex).toBe('auto');
    expect(geometry.navigationHostZIndex).toBe('auto');
  });
});
