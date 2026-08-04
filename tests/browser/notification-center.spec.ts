import { expect, test, type Page } from '@playwright/test';

async function mountNotificationFixture(page: Page) {
  await page.addStyleTag({ path: 'src/styles/notification-center.css' });
  await page.evaluate(() => {
    const statusContent = document.querySelector<HTMLElement>('.asset-bar-content');
    const floatingLayer = document.querySelector<HTMLElement>('.workspace-floating-layer');
    const chromeLayer = document.querySelector<HTMLElement>('.mobile-chrome-overlay');
    if (!statusContent || !floatingLayer || !chromeLayer) {
      throw new Error('notification geometry fixture is incomplete');
    }

    const layout = statusContent.parentElement;
    if (!layout) throw new Error('notification status surface is incomplete');
    layout.classList.add('asset-bar-layout');

    const action = document.createElement('div');
    action.className = 'asset-bar-action';
    const trigger = document.createElement('button');
    trigger.className = 'notification-center-trigger';
    trigger.setAttribute('aria-label', '通知，2 项待处理，1 条未读通知');
    trigger.setAttribute('aria-expanded', 'true');
    trigger.innerHTML = '<svg class="notification-icon" viewBox="0 0 24 24"><path d="M6 10a6 6 0 0 1 12 0v7H6Z" /></svg><span class="notification-center-trigger__count">2</span><span class="notification-center-trigger__unread"></span>';
    action.append(trigger);
    layout.append(action);

    const panelLayer = document.createElement('div');
    panelLayer.className = 'notification-panel-layer';
    const panel = document.createElement('section');
    panel.className = 'notification-panel';
    panel.innerHTML = '<header class="notification-panel__header"><div><h2>通知</h2><p>2 项待处理</p></div></header><div class="notification-panel__scroll"><section class="notification-panel__section"><div class="notification-panel__section-heading"><h3>待处理</h3><span>2</span></div><button class="notification-pending-item severity-warning"><span></span><span class="notification-pending-item__content"><strong>共享仓库空间不足</strong><small>仓库仅剩 8 个容量</small></span><span class="notification-pending-item__action">查看</span></button></section></div>';
    panelLayer.append(panel);
    floatingLayer.append(panelLayer);

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
  test('desktop entry stays on the status right and panel opens at workspace top-right', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('runtime-test.html?view=overview&scenario=activity');
    await mountNotificationFixture(page);

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
        glassCount: document.querySelectorAll('.liquid-glass-surface').length,
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
    await mountNotificationFixture(page);

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
    expect(geometry.trigger.height).toBeCloseTo(36, 0);
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
