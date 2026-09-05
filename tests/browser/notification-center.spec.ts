import { expect, test, type Page } from '@playwright/test';

async function loadNotificationStyles(page: Page) {
  await page.addStyleTag({ path: 'src/styles/notification-center.css' });
}

async function openNotificationPanel(page: Page) {
  await loadNotificationStyles(page);
  const trigger = page.getByRole('button', { name: /^通知，/ });
  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-controls', 'notification-center-panel');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('dialog', { name: '通知' })).toBeVisible();
  await page.waitForTimeout(220);
}

async function mountDesktopToast(page: Page) {
  await page.evaluate(() => {
    const strategicChrome = document.querySelector<HTMLElement>('.workspace-strategic-chrome');
    if (!strategicChrome) throw new Error('notification strategic chrome fixture is incomplete');
    const toastStack = document.createElement('div');
    toastStack.className = 'notification-toast-stack';
    const toast = document.createElement('button');
    toast.className = 'notification-toast notification-toast--success';
    toast.textContent = '订单已经提交';
    toastStack.append(toast);
    strategicChrome.append(toastStack);
  });
}

async function mountMobileIsland(page: Page, queueSize = 1) {
  await page.evaluate((count) => {
    const chromeLayer = document.querySelector<HTMLElement>('.mobile-chrome-overlay');
    if (!chromeLayer) throw new Error('notification chrome fixture is incomplete');
    const region = document.createElement('div');
    region.className = 'mobile-notice-region notification-island-region';
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');

    const island = document.createElement('button');
    island.className = 'notification-island notification-island--success';
    island.dataset.phase = 'visible';
    island.setAttribute('aria-label', '完成：订单已经提交');

    const icon = document.createElement('span');
    icon.className = 'notification-island__icon';
    icon.textContent = '✓';
    const content = document.createElement('span');
    content.className = 'notification-island__content';
    const title = document.createElement('strong');
    title.textContent = '订单已经提交';
    content.append(title);
    const status = document.createElement('span');
    status.className = 'notification-island__status';
    status.textContent = count > 1 ? `+${count - 1}` : '完成';

    island.append(icon, content, status);
    region.append(island);
    chromeLayer.append(region);
  }, queueSize);
  await page.waitForTimeout(320);
}

test.describe('notification center geometry', () => {
  test('partial runtime state keeps the signed-in shell and notification entry renderable', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('runtime-test.html?view=overview&scenario=activity');

    await expect(page.locator('.game-shell')).toBeVisible();
    await expect(page.locator('.workspace')).toBeVisible();
    await expect(page.getByRole('button', { name: /^通知，/ })).toBeVisible();
    await expect(page.getByText('应用暂时无法显示')).toHaveCount(0);
  });

  test('escape closes the panel and restores the notification trigger', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('runtime-test.html?view=overview&scenario=activity');

    const trigger = page.getByRole('button', { name: /^通知，/ });
    await expect(trigger).toHaveAttribute('aria-controls', 'notification-center-panel');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('dialog', { name: '通知' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: '通知' })).toHaveCount(0);
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toBeFocused();
  });

  test('pointer press on the blank overlay closes the panel while panel content stays open', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('runtime-test.html?view=overview&scenario=activity');
    await openNotificationPanel(page);

    const panel = page.getByRole('dialog', { name: '通知' });
    await panel.locator('.notification-panel__header').click();
    await expect(panel).toBeVisible();

    const layerBox = await page.locator('.notification-panel-layer').boundingBox();
    if (!layerBox) throw new Error('notification overlay is missing');
    await page.mouse.click(layerBox.x + 4, layerBox.y + layerBox.height - 4);
    await expect(panel).toHaveCount(0);
  });

  test('desktop entry keeps the panel top-right while toast shares the outliner layer at bottom-right', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('runtime-test.html?view=overview&scenario=activity');
    await openNotificationPanel(page);
    await mountDesktopToast(page);

    const geometry = await page.evaluate(() => {
      const status = document.querySelector<HTMLElement>('.asset-bar');
      const trigger = document.querySelector<HTMLElement>('.notification-center-trigger');
      const workspace = document.querySelector<HTMLElement>('.workspace');
      const floatingLayer = document.querySelector<HTMLElement>('.workspace-floating-layer');
      const strategicChrome = document.querySelector<HTMLElement>('.workspace-strategic-chrome');
      const outliner = document.querySelector<HTMLElement>('.strategic-outliner');
      const panelLayer = document.querySelector<HTMLElement>('.notification-panel-layer');
      const panel = document.querySelector<HTMLElement>('.notification-panel');
      const toastStack = document.querySelector<HTMLElement>('.notification-toast-stack');
      const toast = document.querySelector<HTMLElement>('.notification-toast');
      if (!status || !trigger || !workspace || !floatingLayer || !strategicChrome || !outliner || !panelLayer || !panel || !toastStack || !toast) {
        throw new Error('desktop notification geometry is incomplete');
      }
      const rect = (element: HTMLElement) => {
        const box = element.getBoundingClientRect();
        return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
      };
      const toastBox = toast.getBoundingClientRect();
      const outlinerBox = outliner.getBoundingClientRect();
      const overlapLeft = Math.max(toastBox.left, outlinerBox.left);
      const overlapTop = Math.max(toastBox.top, outlinerBox.top);
      const overlapRight = Math.min(toastBox.right, outlinerBox.right);
      const overlapBottom = Math.min(toastBox.bottom, outlinerBox.bottom);
      const overlapStack = overlapRight > overlapLeft && overlapBottom > overlapTop
        ? document.elementsFromPoint((overlapLeft + overlapRight) / 2, (overlapTop + overlapBottom) / 2)
        : [];
      const toastStackIndex = overlapStack.findIndex((element) => Boolean(element.closest('.notification-toast-stack')));
      const outlinerIndex = overlapStack.findIndex((element) => Boolean(element.closest('.strategic-outliner')));
      return {
        status: rect(status),
        trigger: rect(trigger),
        workspace: rect(workspace),
        outliner: rect(outliner),
        panelLayer: rect(panelLayer),
        panel: rect(panel),
        panelInsets: {
          top: Number.parseFloat(getComputedStyle(panelLayer).paddingTop),
          right: Number.parseFloat(getComputedStyle(panelLayer).paddingRight),
          bottom: Number.parseFloat(getComputedStyle(panelLayer).paddingBottom),
          left: Number.parseFloat(getComputedStyle(panelLayer).paddingLeft),
        },
        toast: rect(toast),
        toastStack: rect(toastStack),
        toastStackZIndex: getComputedStyle(toastStack).zIndex,
        outlinerZIndex: getComputedStyle(outliner).zIndex,
        frostedSurfaceCount: document.querySelectorAll('.asset-bar .frosted-glass-surface').length,
        panelParentIsFloatingLayer: panel.parentElement?.parentElement === floatingLayer,
        toastParentIsStrategicChrome: toastStack.parentElement === strategicChrome,
        outlinerParentIsStrategicChrome: outliner.parentElement === strategicChrome,
        toastPrecedesOutlinerAtOverlap: toastStackIndex >= 0 && outlinerIndex >= 0 && toastStackIndex < outlinerIndex,
        notificationLayer: panelLayer.dataset.notificationLayer,
      };
    });

    expect(geometry.trigger.right).toBeLessThanOrEqual(geometry.status.right);
    expect(geometry.trigger.left).toBeGreaterThan(geometry.status.right - 80);
    expect(geometry.panelInsets).toEqual({ top: 0, right: 8, bottom: 8, left: 8 });
    expect(geometry.panel.top).toBeCloseTo(geometry.panelLayer.top, 0);
    expect(geometry.panel.right).toBeCloseTo(geometry.panelLayer.right - geometry.panelInsets.right, 0);
    expect(geometry.panel.width).toBeLessThanOrEqual(420);
    expect(geometry.toastStack.right).toBeCloseTo(geometry.workspace.right - 8, 0);
    expect(geometry.toastStack.bottom).toBeCloseTo(geometry.workspace.bottom - 8, 0);
    expect(geometry.toast.width).toBeLessThanOrEqual(360);
    expect(Math.abs(geometry.toast.width - geometry.outliner.width)).toBeGreaterThan(20);
    expect(geometry.toastStackZIndex).toBe(geometry.outlinerZIndex);
    expect(geometry.toastStackZIndex).toBe('2');
    expect(geometry.panelParentIsFloatingLayer).toBe(true);
    expect(geometry.toastParentIsStrategicChrome).toBe(true);
    expect(geometry.outlinerParentIsStrategicChrome).toBe(true);
    expect(geometry.toastPrecedesOutlinerAtOverlap).toBe(true);
    expect(geometry.notificationLayer).toBe('floating');
    expect(geometry.frostedSurfaceCount).toBe(1);
  });

  test('desktop toast remains bottom-right while the outliner persists on fullscreen pages', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('runtime-test.html?view=overview&scenario=activity');
    const outliner = page.locator('.strategic-outliner');
    await outliner.evaluate((element) => element.setAttribute('data-notification-outliner-sentinel', 'persistent'));
    await page.locator('.desktop-sidebar .sidebar-nav-button').filter({ hasText: '银行' }).first().evaluate((button) => button.click());
    await expect(page.locator('.game-shell')).toHaveClass(/strategic-tab-bank/);
    await expect(outliner).toHaveAttribute('data-notification-outliner-sentinel', 'persistent');
    await expect(outliner).toBeHidden();
    await loadNotificationStyles(page);
    await mountDesktopToast(page);

    const geometry = await page.evaluate(() => {
      const workspace = document.querySelector<HTMLElement>('.workspace');
      const strategicChrome = document.querySelector<HTMLElement>('.workspace-strategic-chrome');
      const toastStack = document.querySelector<HTMLElement>('.notification-toast-stack');
      const outliner = document.querySelector<HTMLElement>('.strategic-outliner');
      if (!workspace || !strategicChrome || !toastStack || !outliner) throw new Error('fullscreen notification fixture is incomplete');
      const workspaceBox = workspace.getBoundingClientRect();
      const toastBox = toastStack.getBoundingClientRect();
      return {
        workspaceRight: workspaceBox.right,
        workspaceBottom: workspaceBox.bottom,
        toastRight: toastBox.right,
        toastBottom: toastBox.bottom,
        parentIsStrategicChrome: toastStack.parentElement === strategicChrome,
        outlinerParentIsStrategicChrome: outliner.parentElement === strategicChrome,
      };
    });

    expect(geometry.toastRight).toBeCloseTo(geometry.workspaceRight - 8, 0);
    expect(geometry.toastBottom).toBeCloseTo(geometry.workspaceBottom - 8, 0);
    expect(geometry.parentIsStrategicChrome).toBe(true);
    expect(geometry.outlinerParentIsStrategicChrome).toBe(true);
  });

  test('mobile notification panel overlays an open workspace sheet without leaving an island mounted', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('runtime-test.html?view=overview&scenario=activity');

    const workspaceSheet = page.locator('.mobile-workspace-sheet-host');
    const navigation = page.locator('.mobile-bottom-navigation');
    const trigger = page.getByRole('button', { name: /^通知，/ });
    await expect(workspaceSheet).toBeVisible();
    await expect(navigation).toHaveAttribute('data-workspace-sheet-hidden', 'true');
    await expect(navigation).toBeHidden();
    await expect(trigger).toBeVisible();

    await openNotificationPanel(page);
    const panel = page.getByRole('dialog', { name: '通知' });
    const panelLayer = page.locator('.notification-panel-layer');
    await expect(panel).toBeVisible();
    await expect(panelLayer).toHaveAttribute('data-notification-layer', 'dialog');
    await expect(page.locator('.notification-island')).toHaveCount(0);
    await expect(page.locator('.notification-island-region')).toHaveCount(0);
    await expect(workspaceSheet).toBeVisible();
    await expect(navigation).toHaveAttribute('data-workspace-sheet-hidden', 'true');

    const geometry = await page.evaluate(() => {
      const dialogLayer = document.querySelector<HTMLElement>('.workspace-dialog-layer');
      const sheetBackdrop = document.querySelector<HTMLElement>('.mobile-detail-sheet-backdrop');
      const sheet = document.querySelector<HTMLElement>('.mobile-workspace-sheet-host');
      const status = document.querySelector<HTMLElement>('.asset-bar');
      const trigger = document.querySelector<HTMLElement>('.notification-center-trigger');
      const panelLayer = document.querySelector<HTMLElement>('.notification-panel-layer');
      const panel = document.querySelector<HTMLElement>('.notification-panel');
      const closeButton = document.querySelector<HTMLElement>('.notification-panel__close');
      const navigation = document.querySelector<HTMLElement>('.mobile-bottom-navigation');
      if (!dialogLayer || !sheetBackdrop || !sheet || !status || !trigger || !panelLayer || !panel || !closeButton || !navigation) {
        throw new Error('mobile notification layering fixture is incomplete');
      }
      const rect = (element: HTMLElement) => {
        const box = element.getBoundingClientRect();
        return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
      };
      const statusRect = status.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const closeRect = closeButton.getBoundingClientRect();
      const statusTopmost = document.elementFromPoint(
        statusRect.left + statusRect.width / 2,
        statusRect.top + statusRect.height / 2,
      );
      const panelTopmost = document.elementFromPoint(
        panelRect.left + panelRect.width / 2,
        panelRect.top + Math.min(panelRect.height / 2, 80),
      );
      const closeTopmost = document.elementFromPoint(
        closeRect.left + closeRect.width / 2,
        closeRect.top + closeRect.height / 2,
      );
      return {
        status: rect(status),
        trigger: rect(trigger),
        panelLayer: rect(panelLayer),
        panel: rect(panel),
        navigation: rect(navigation),
        itemColumns: getComputedStyle(document.querySelector<HTMLElement>('.asset-bar-content')!).gridTemplateColumns.split(' ').length,
        panelMaxHeight: getComputedStyle(panel).maxHeight,
        panelTransformOrigin: getComputedStyle(panel).transformOrigin,
        panelParentIsDialogLayer: panelLayer.parentElement === dialogLayer,
        panelLayerZIndex: Number.parseInt(getComputedStyle(panelLayer).zIndex, 10),
        sheetBackdropZIndex: Number.parseInt(getComputedStyle(sheetBackdrop).zIndex, 10),
        panelAboveSheet: Boolean(panelTopmost?.closest('.notification-panel')),
        statusIsTopmost: Boolean(statusTopmost?.closest('.asset-bar')),
        panelCloseIsTopmost: closeTopmost === closeButton || closeButton.contains(closeTopmost),
        islandCount: document.querySelectorAll('.notification-island').length,
        islandRegionCount: document.querySelectorAll('.notification-island-region').length,
      };
    });

    expect(geometry.status.height).toBeCloseTo(48, 0);
    expect(geometry.trigger.width).toBeCloseTo(44, 0);
    expect(geometry.trigger.height).toBeCloseTo(44, 0);
    expect(geometry.itemColumns).toBe(5);
    expect(geometry.panel.top).toBeCloseTo(geometry.panelLayer.top, 0);
    expect(geometry.panel.top).toBeGreaterThan(geometry.status.bottom);
    expect(geometry.panel.left).toBeCloseTo(geometry.panelLayer.left, 0);
    expect(geometry.panel.right).toBeCloseTo(geometry.panelLayer.right, 0);
    expect(geometry.panelMaxHeight).not.toBe('none');
    expect(geometry.panelTransformOrigin.endsWith(' 0px')).toBe(true);
    expect(geometry.panelParentIsDialogLayer).toBe(true);
    expect(geometry.panelLayerZIndex).toBeGreaterThan(geometry.sheetBackdropZIndex);
    expect(geometry.panelAboveSheet).toBe(true);
    expect(geometry.statusIsTopmost).toBe(true);
    expect(geometry.panelCloseIsTopmost).toBe(true);
    expect(geometry.islandCount).toBe(0);
    expect(geometry.islandRegionCount).toBe(0);

    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(workspaceSheet).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toBeFocused();
    await expect(navigation).toHaveAttribute('data-workspace-sheet-hidden', 'true');
    await expect(page.locator('.notification-island')).toHaveCount(0);
  });

  test('mobile island disables shape and movement animation for reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('runtime-test.html?view=map&scenario=activity');
    await loadNotificationStyles(page);
    await mountMobileIsland(page, 2);

    const reduced = await page.evaluate(() => {
      const island = document.querySelector<HTMLElement>('.notification-island');
      if (!island) throw new Error('mobile notification island is missing');
      const box = island.getBoundingClientRect();
      const style = getComputedStyle(island);
      return {
        animationName: style.animationName,
        center: box.left + box.width / 2,
        count: document.querySelectorAll('.notification-island').length,
        viewportWidth: window.innerWidth,
      };
    });

    expect(reduced.animationName).toBe('none');
    expect(reduced.center).toBeCloseTo(reduced.viewportWidth / 2, 0);
    expect(reduced.count).toBe(1);
  });
});
