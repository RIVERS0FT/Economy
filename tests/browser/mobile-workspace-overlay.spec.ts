import { expect, test } from '@playwright/test';

test.describe('mobile workspace overlay geometry', () => {
  test('mobile workspace owns the shared gutter and overlay geometry', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('runtime-test.html?view=overview&scenario=activity');

    await expect(page.locator('.mobile-page-overlay')).toBeVisible();
    await expect(page.locator('.mobile-chrome-overlay')).toBeVisible();
    await expect(page.locator('.asset-bar-scroll-area')).toBeVisible();
    await expect(page.locator('.mobile-bottom-navigation')).toBeVisible();
    await expect(page.locator('.overview-today-panel')).toBeVisible();

    const geometry = await page.evaluate(() => {
      const workspace = document.querySelector<HTMLElement>('.workspace');
      const pageOverlay = document.querySelector<HTMLElement>('.mobile-page-overlay');
      const chromeOverlay = document.querySelector<HTMLElement>('.mobile-chrome-overlay');
      const pageScrollArea = document.querySelector<HTMLElement>('.page-scroll-area');
      const pageScroll = document.querySelector<HTMLElement>('.page-scroll');
      const assetBar = document.querySelector<HTMLElement>('.asset-bar-scroll-area');
      const statusSurface = document.querySelector<HTMLElement>('.asset-bar .liquid-glass-surface');
      const navigation = document.querySelector<HTMLElement>('.mobile-bottom-navigation');
      const navigationSurface = document.querySelector<HTMLElement>(
        '.mobile-bottom-navigation .liquid-glass-surface',
      );
      const primaryPanel = document.querySelector<HTMLElement>('.overview-today-panel');
      if (!workspace || !pageOverlay || !chromeOverlay || !pageScrollArea || !pageScroll
        || !assetBar || !statusSurface || !navigation || !navigationSurface || !primaryPanel) {
        throw new Error('mobile overlay geometry fixture is incomplete');
      }

      const rect = (element: HTMLElement) => {
        const box = element.getBoundingClientRect();
        return {
          left: box.left,
          top: box.top,
          right: box.right,
          bottom: box.bottom,
          width: box.width,
          height: box.height,
        };
      };
      const workspaceStyle = getComputedStyle(workspace);
      const pageScrollStyle = getComputedStyle(pageScroll);
      const chromeStyle = getComputedStyle(chromeOverlay);
      const assetStyle = getComputedStyle(assetBar);
      const navigationStyle = getComputedStyle(navigation);
      const navigationSurfaceStyle = getComputedStyle(navigationSurface);
      const primaryPanelStyle = getComputedStyle(primaryPanel);

      return {
        workspace: rect(workspace),
        pageOverlay: rect(pageOverlay),
        chromeOverlay: rect(chromeOverlay),
        pageScrollArea: rect(pageScrollArea),
        assetBar: rect(assetBar),
        statusSurface: rect(statusSurface),
        navigation: rect(navigation),
        navigationSurface: rect(navigationSurface),
        primaryPanel: rect(primaryPanel),
        workspaceDisplay: workspaceStyle.display,
        workspacePaddingLeft: Number.parseFloat(workspaceStyle.paddingLeft),
        workspacePaddingRight: Number.parseFloat(workspaceStyle.paddingRight),
        pageScrollPaddingLeft: pageScrollStyle.paddingLeft,
        pageScrollPaddingRight: pageScrollStyle.paddingRight,
        pageScrollHasHorizontalOverflow: pageScroll.scrollWidth > pageScroll.clientWidth + 1,
        chromePointerEvents: chromeStyle.pointerEvents,
        assetPointerEvents: assetStyle.pointerEvents,
        navigationPointerEvents: navigationStyle.pointerEvents,
        navigationPosition: navigationStyle.position,
        navigationRadius: navigationSurfaceStyle.borderTopLeftRadius,
        primaryPanelRadius: primaryPanelStyle.borderTopLeftRadius,
        pageOverlayOwnsScroll: pageScrollArea.parentElement === pageOverlay,
        chromeOwnsStatus: assetBar.parentElement === chromeOverlay,
        chromeOwnsNavigation: navigation.parentElement === chromeOverlay,
      };
    });

    const contentLeft = geometry.workspace.left + geometry.workspacePaddingLeft;
    const contentRight = geometry.workspace.right - geometry.workspacePaddingRight;

    expect(geometry.workspaceDisplay).toBe('grid');
    expect(geometry.workspacePaddingLeft).toBeCloseTo(12, 0);
    expect(geometry.workspacePaddingRight).toBeCloseTo(12, 0);
    for (const layer of [
      geometry.pageOverlay,
      geometry.chromeOverlay,
      geometry.pageScrollArea,
      geometry.assetBar,
      geometry.statusSurface,
      geometry.navigation,
      geometry.navigationSurface,
      geometry.primaryPanel,
    ]) {
      expect(layer.left).toBeCloseTo(contentLeft, 0);
      expect(layer.right).toBeCloseTo(contentRight, 0);
    }
    expect(geometry.pageScrollPaddingLeft).toBe('0px');
    expect(geometry.pageScrollPaddingRight).toBe('0px');
    expect(geometry.pageScrollHasHorizontalOverflow).toBe(false);
    expect(geometry.assetBar.height).toBeCloseTo(48, 0);
    expect(geometry.statusSurface.height).toBeCloseTo(48, 0);
    expect(geometry.navigation.height).toBeCloseTo(68, 0);
    expect(geometry.assetBar.height).toBeLessThan(geometry.workspace.height);
    expect(geometry.navigationPosition).toBe('absolute');
    expect(geometry.navigationRadius).toBe(geometry.primaryPanelRadius);
    expect(geometry.navigationRadius).toBe('24px');
    expect(geometry.chromePointerEvents).toBe('none');
    expect(geometry.assetPointerEvents).toBe('auto');
    expect(geometry.navigationPointerEvents).toBe('auto');
    expect(geometry.pageOverlayOwnsScroll).toBe(true);
    expect(geometry.chromeOwnsStatus).toBe(true);
    expect(geometry.chromeOwnsNavigation).toBe(true);
  });

  test('mobile chrome shares the workspace gutter and fixed glass heights', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto('runtime-test.html?view=overview&scenario=activity');

    const workspace = page.locator('.workspace');
    const status = page.locator('.asset-bar-scroll-area');
    const statusSurface = page.locator('.asset-bar .liquid-glass-surface');
    const navigation = page.locator('.mobile-bottom-navigation');
    const pageScroll = page.locator('.page-scroll');

    await expect(workspace).toBeVisible();
    await expect(status).toBeVisible();
    await expect(navigation).toBeVisible();
    await expect(status).toHaveCSS('height', '48px');
    await expect(statusSurface).toHaveCSS('height', '48px');
    await expect(navigation).toHaveCSS('height', '68px');
    await expect(pageScroll).toHaveCSS('padding-left', '0px');
    await expect(pageScroll).toHaveCSS('padding-right', '0px');

    const heights = await page.evaluate(() => {
      const workspaceElement = document.querySelector<HTMLElement>('.workspace');
      const statusElement = document.querySelector<HTMLElement>('.asset-bar-scroll-area');
      if (!workspaceElement || !statusElement) throw new Error('mobile status height fixture is incomplete');
      return {
        workspace: workspaceElement.getBoundingClientRect().height,
        status: statusElement.getBoundingClientRect().height,
      };
    });
    expect(heights.status).toBe(48);
    expect(heights.status).toBeLessThan(heights.workspace);
  });

  test('mobile page scrollbar reaches the safe right edge without changing content width', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('runtime-test.html?view=overview&scenario=activity');

    const pageScrollArea = page.locator('.page-scroll-area');
    const pageScroll = page.locator('.page-scroll');
    const primaryPanel = page.locator('.overview-today-panel');
    await expect(pageScrollArea).toBeVisible();
    await expect(primaryPanel).toBeVisible();

    const beforeWidth = await primaryPanel.evaluate((element) => element.getBoundingClientRect().width);
    const scrollState = await pageScroll.evaluate((element) => {
      element.scrollTop = Math.min(180, element.scrollHeight - element.clientHeight);
      return {
        scrollTop: element.scrollTop,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
      };
    });
    expect(scrollState.scrollHeight).toBeGreaterThan(scrollState.clientHeight);
    expect(scrollState.scrollTop).toBeGreaterThan(0);
    await expect(pageScrollArea).toHaveAttribute('data-scrollbar-active-y', 'true');

    const geometry = await page.evaluate(() => {
      const scrollArea = document.querySelector<HTMLElement>('.page-scroll-area');
      const thumb = document.querySelector<HTMLElement>(
        '.page-scroll-area > .ui-scrollbar--vertical .ui-scrollbar__thumb',
      );
      const panel = document.querySelector<HTMLElement>('.overview-today-panel');
      if (!scrollArea || !thumb || !panel) throw new Error('mobile scrollbar fixture is incomplete');
      const scrollAreaRect = scrollArea.getBoundingClientRect();
      const thumbRect = thumb.getBoundingClientRect();
      return {
        viewportRight: document.documentElement.clientWidth,
        scrollAreaRight: scrollAreaRect.right,
        thumbRight: thumbRect.right,
        panelWidth: panel.getBoundingClientRect().width,
        scrollAreaOverflow: getComputedStyle(scrollArea).overflow,
      };
    });

    expect(geometry.viewportRight - geometry.thumbRight).toBeCloseTo(2, 0);
    expect(geometry.scrollAreaRight).toBeCloseTo(378, 0);
    expect(geometry.panelWidth).toBeCloseTo(beforeWidth, 0);
    expect(geometry.scrollAreaOverflow).toBe('visible');
  });
});
