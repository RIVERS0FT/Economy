import { expect, test } from '@playwright/test';

test.describe('mobile workspace overlay geometry', () => {
  test('mobile workspace owns the shared gutter and overlay geometry', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('runtime-test.html?view=overview&scenario=activity');

    await expect(page.locator('.mobile-page-overlay')).toBeVisible();
    await expect(page.locator('.mobile-chrome-overlay')).toBeVisible();
    await expect(page.locator('.asset-bar')).toBeVisible();
    await expect(page.locator('.mobile-bottom-navigation')).toBeVisible();
    await expect(page.locator('.overview-today-panel')).toBeVisible();

    const geometry = await page.evaluate(() => {
      const workspace = document.querySelector<HTMLElement>('.workspace');
      const pageOverlay = document.querySelector<HTMLElement>('.mobile-page-overlay');
      const chromeOverlay = document.querySelector<HTMLElement>('.mobile-chrome-overlay');
      const pageScrollArea = document.querySelector<HTMLElement>('.page-scroll-area');
      const pageScroll = document.querySelector<HTMLElement>('.page-scroll');
      const assetBar = document.querySelector<HTMLElement>('.asset-bar');
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
    expect(geometry.navigationRadius).toBe('40px');
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
    const status = page.locator('.asset-bar');
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
      const statusElement = document.querySelector<HTMLElement>('.asset-bar');
      if (!workspaceElement || !statusElement) throw new Error('mobile status height fixture is incomplete');
      return {
        workspace: workspaceElement.getBoundingClientRect().height,
        status: statusElement.getBoundingClientRect().height,
      };
    });
    expect(heights.status).toBe(48);
    expect(heights.status).toBeLessThan(heights.workspace);
  });

  test('mobile notice stays below the status bar without shifting the page', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('runtime-test.html?view=overview&scenario=activity');

    const before = await page.evaluate(() => {
      const pageScroll = document.querySelector<HTMLElement>('.page-scroll');
      if (!pageScroll) throw new Error('mobile notice scroll fixture is incomplete');
      pageScroll.scrollTop = Math.min(180, pageScroll.scrollHeight - pageScroll.clientHeight);
      return {
        scrollTop: pageScroll.scrollTop,
        glassCount: document.querySelectorAll('.liquid-glass-surface').length,
      };
    });
    expect(before.scrollTop).toBeGreaterThan(0);

    await page.evaluate(() => {
      const chromeOverlay = document.querySelector<HTMLElement>('.mobile-chrome-overlay');
      const navigation = document.querySelector<HTMLElement>('.mobile-bottom-navigation');
      if (!chromeOverlay || !navigation) throw new Error('mobile notice chrome fixture is incomplete');

      const region = document.createElement('div');
      region.className = 'mobile-notice-region';
      const notice = document.createElement('div');
      notice.className = 'notice-toast';
      notice.setAttribute('role', 'status');
      notice.setAttribute('aria-live', 'polite');
      notice.setAttribute('aria-atomic', 'true');
      notice.textContent = '操作已完成，服务器状态已经同步';
      region.append(notice);
      chromeOverlay.insertBefore(region, navigation);
    });

    const noticeLocator = page.locator('.mobile-notice-region .notice-toast');
    await expect(noticeLocator).toBeVisible();
    await expect(noticeLocator).toHaveAttribute('role', 'status');
    await expect(noticeLocator).toHaveAttribute('aria-live', 'polite');
    await expect(noticeLocator).toHaveAttribute('aria-atomic', 'true');

    const geometry = await page.evaluate(() => {
      const workspace = document.querySelector<HTMLElement>('.workspace');
      const chromeOverlay = document.querySelector<HTMLElement>('.mobile-chrome-overlay');
      const pageScroll = document.querySelector<HTMLElement>('.page-scroll');
      const status = document.querySelector<HTMLElement>('.asset-bar');
      const region = document.querySelector<HTMLElement>('.mobile-notice-region');
      const notice = document.querySelector<HTMLElement>('.mobile-notice-region .notice-toast');
      const navigation = document.querySelector<HTMLElement>('.mobile-bottom-navigation');
      if (!workspace || !chromeOverlay || !pageScroll || !status || !region || !notice || !navigation) {
        throw new Error('mobile notice geometry fixture is incomplete');
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
      const regionStyle = getComputedStyle(region);
      const noticeStyle = getComputedStyle(notice);
      const chromeChildren = Array.from(chromeOverlay.children);
      const statusIndex = chromeChildren.indexOf(status);
      const noticeIndex = chromeChildren.indexOf(region);
      const navigationIndex = chromeChildren.indexOf(navigation);

      return {
        workspace: rect(workspace),
        status: rect(status),
        region: rect(region),
        notice: rect(notice),
        navigation: rect(navigation),
        workspacePaddingLeft: Number.parseFloat(workspaceStyle.paddingLeft),
        workspacePaddingRight: Number.parseFloat(workspaceStyle.paddingRight),
        regionPointerEvents: regionStyle.pointerEvents,
        noticePointerEvents: noticeStyle.pointerEvents,
        noticePosition: noticeStyle.position,
        noticeTransform: noticeStyle.transform,
        noticeZIndex: noticeStyle.zIndex,
        pageScrollTop: pageScroll.scrollTop,
        pageHasHorizontalOverflow: pageScroll.scrollWidth > pageScroll.clientWidth + 1,
        chromeOwnsNotice: region.parentElement === chromeOverlay,
        orderedBetweenChrome: statusIndex >= 0 && statusIndex < noticeIndex && noticeIndex < navigationIndex,
        glassCountAfter: document.querySelectorAll('.liquid-glass-surface').length,
      };
    });

    const contentLeft = geometry.workspace.left + geometry.workspacePaddingLeft;
    const contentRight = geometry.workspace.right - geometry.workspacePaddingRight;
    expect(geometry.notice.top - geometry.status.bottom).toBeCloseTo(8, 0);
    expect(geometry.region.left).toBeCloseTo(contentLeft + 8, 0);
    expect(geometry.region.right).toBeCloseTo(contentRight - 8, 0);
    expect(geometry.notice.left).toBeGreaterThanOrEqual(geometry.region.left);
    expect(geometry.notice.right).toBeLessThanOrEqual(geometry.region.right);
    expect(geometry.notice.bottom).toBeLessThan(geometry.navigation.top);
    expect(geometry.regionPointerEvents).toBe('none');
    expect(geometry.noticePointerEvents).toBe('none');
    expect(geometry.noticePosition).toBe('static');
    expect(geometry.noticeTransform).toBe('none');
    expect(geometry.noticeZIndex).toBe('auto');
    expect(geometry.pageScrollTop).toBeCloseTo(before.scrollTop, 0);
    expect(geometry.pageHasHorizontalOverflow).toBe(false);
    expect(geometry.chromeOwnsNotice).toBe(true);
    expect(geometry.orderedBetweenChrome).toBe(true);
    expect(geometry.glassCountAfter).toBe(before.glassCount);
    expect(geometry.glassCountAfter).toBe(2);
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
