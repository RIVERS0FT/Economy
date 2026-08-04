import { expect, test, type Page } from '@playwright/test';

async function openNotificationPanelAndMountToast(page: Page) {
  await page.addStyleTag({ path: 'src/styles/notification-center.css' });
  const trigger = page.getByRole('button', { name: /^通知，/ });
  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('dialog', { name: '通知' })).toBeVisible();

  await page.evaluate(() => {
    const chromeLayer = document.querySelector<HTMLElement>('.mobile-chrome-overlay');
    if (!chromeLayer) throw new Error('notification chrome fixture is incomplete');
    const toastStack = document.createElement('div');
    toastStack.className = 'mobile-notice-region notification-toast-stack';
    const toast = document.createElement('button');
    toast.className = 'notification-toast notification-toast--success';
    toast.textContent = '订单已经提交';
    toastStack.append(toast);
    chromeLayer.append(toastStack);
  });
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
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('dialog', { name: '通知' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: '通知' })).toHaveCount(0);
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toBeFocused();
  });

  test('desktop entry stays on the status right and panel opens at workspace top-right', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('runtime-test.html?view=overview&scenario=activity');
    await openNotificationPanelAndMountToast(page);

    const geometry = await page.evaluate(() => {
      const status = document.querySelector<HTMLElement>('.asset-bar');
      const trigger = document.querySelector<HTMLElement>('.notification-center-trigger');
      const workspace = document.querySelector<HTMLElement>('.workspace');
      const floatingLayer = document.querySelector<HTMLElement>('.workspace-floating-layer');
      const panel = document.querySelector<HTMLElement>('.notification-panel');
      const toast = document.querySelector<HTMLElement>('.notification-toast');
      if (!status || !trigger || !workspace || !floatingLayer || !panel || !toast) {
        throw new Error('desktop notification geometry is incomplete');
      }
      const rect = (element: HTMLElement) => {
        const box = element.getBoundingClientRect();
        return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
      };
      return {
        status: rect(status),
        trigger: rect(trigger),
        workspace: rect(workspace),
        panel: rect(panel),
        toast: rect(toast),
        glassCount: document.querySelectorAll('.asset-bar .liquid-glass-surface').length,
        panelParentIsFloatingLayer: panel.parentElement?.parentElement === floatingLayer,
      };
    });

    expect(geometry.trigger.right).toBeLessThanOrEqual(geometry.status.right);
    expect(geometry.trigger.left).toBeGreaterThan(geometry.status.right - 80);
    expect(geometry.panel.top).toBeGreaterThanOrEqual(geometry.workspace.top);
    expect(geometry.panel.right).toBeCloseTo(geometry.workspace.right - 8, 0);
    expect(geometry.panel.width).toBeLessThanOrEqual(420);
    expect(geometry.toast.top).toBeGreaterThan(geometry.status.bottom);
    expect(geometry.panelParentIsFloatingLayer).toBe(true);
    expect(geometry.glassCount).toBe(1);
  });

  test('mobile entry keeps the 48px status height and panel stays between status and navigation', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('runtime-test.html?view=overview&scenario=activity');
    await openNotificationPanelAndMountToast(page);

    const geometry = await page.evaluate(() => {
      const status = document.querySelector<HTMLElement>('.asset-bar');
      const trigger = document.querySelector<HTMLElement>('.notification-center-trigger');
      const floatingLayer = document.querySelector<HTMLElement>('.workspace-floating-layer');
      const panel = document.querySelector<HTMLElement>('.notification-panel');
      const navigation = document.querySelector<HTMLElement>('.mobile-bottom-navigation');
      const toast = document.querySelector<HTMLElement>('.notification-toast');
      if (!status || !trigger || !floatingLayer || !panel || !navigation || !toast) {
        throw new Error('mobile notification geometry is incomplete');
      }
      const rect = (element: HTMLElement) => {
        const box = element.getBoundingClientRect();
        return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
      };
      return {
        status: rect(status),
        trigger: rect(trigger),
        floatingLayer: rect(floatingLayer),
        panel: rect(panel),
        navigation: rect(navigation),
        toast: rect(toast),
        itemColumns: getComputedStyle(document.querySelector<HTMLElement>('.asset-bar-content')!).gridTemplateColumns.split(' ').length,
        panelMaxHeight: getComputedStyle(panel).maxHeight,
        toastPointerEvents: getComputedStyle(toast).pointerEvents,
      };
    });

    expect(geometry.status.height).toBeCloseTo(48, 0);
    expect(geometry.trigger.width).toBeCloseTo(44, 0);
    expect(geometry.trigger.height).toBeCloseTo(44, 0);
    expect(geometry.itemColumns).toBe(5);
    expect(geometry.panel.top).toBeCloseTo(geometry.floatingLayer.top, 0);
    expect(geometry.panel.top).toBeGreaterThan(geometry.status.bottom);
    expect(geometry.panel.bottom).toBeLessThanOrEqual(geometry.navigation.top);
    expect(geometry.panel.left).toBeCloseTo(geometry.floatingLayer.left, 0);
    expect(geometry.panel.right).toBeCloseTo(geometry.floatingLayer.right, 0);
    expect(geometry.toast.top).toBeGreaterThan(geometry.status.bottom);
    expect(geometry.toast.bottom).toBeLessThan(geometry.navigation.top);
    expect(geometry.panelMaxHeight).not.toBe('none');
    expect(geometry.toastPointerEvents).toBe('auto');
  });
});
