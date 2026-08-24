import { expect, test, type Locator } from '@playwright/test';

interface PullMove {
  y: number;
  scrollTop?: number;
}

async function probePullPrevention(target: Locator, moves: PullMove[]) {
  return target.evaluate((element, steps) => {
    const scrollViewport = element.closest<HTMLElement>(
      '.mobile-detail-sheet-scroll, .page-card-scroll',
    );
    const createTouch = (y: number) => new Touch({
      identifier: 1,
      target: element,
      clientX: 100,
      clientY: y,
      screenX: 100,
      screenY: y,
      pageX: 100,
      pageY: y,
      radiusX: 1,
      radiusY: 1,
      rotationAngle: 0,
      force: 1,
    });
    const dispatch = (type: 'touchstart' | 'touchmove' | 'touchend', y: number) => {
      const touch = createTouch(y);
      const activeTouches = type === 'touchend' ? [] : [touch];
      const event = new TouchEvent(type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        touches: activeTouches,
        targetTouches: activeTouches,
        changedTouches: [touch],
      });
      element.dispatchEvent(event);
      return event.defaultPrevented;
    };

    const prevented: boolean[] = [];
    dispatch('touchstart', 100);
    for (const step of steps) {
      if (step.scrollTop !== undefined && scrollViewport) scrollViewport.scrollTop = step.scrollTop;
      prevented.push(dispatch('touchmove', step.y));
    }
    const lastY = steps.length > 0 ? steps[steps.length - 1].y : 100;
    dispatch('touchend', lastY);
    return prevented;
  }, moves);
}

test.describe('mobile workspace sheet pull-to-refresh prevention', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });

  test('first-level page guard covers interactive targets without opening a detail layer', async ({ page }) => {
    await page.goto('runtime-test.html?view=production&scenario=activity');

    const host = page.locator('.mobile-workspace-sheet-host');
    const content = page.locator('.page-card-scroll');
    const trigger = page.getByRole('button', { name: /机械工厂，数量 18，运行中/ });
    await expect(host).toBeVisible();
    await expect(host).toHaveAttribute('data-detail-active', 'false');
    await expect(host.locator('.mobile-workspace-sheet-detail-view')).toHaveCount(0);
    await expect(page.locator('html')).toHaveCSS('overscroll-behavior-y', 'none');
    await content.evaluate((element) => { element.scrollTop = 0; });

    const originalUrl = page.url();
    let topLevelNavigations = 0;
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) topLevelNavigations += 1;
    });

    const prevented = await probePullPrevention(trigger, [{ y: 124 }, { y: 148 }]);

    expect(prevented).toEqual([true, true]);
    await expect(host).toBeVisible();
    await expect(host).toHaveAttribute('data-detail-active', 'false');
    expect(page.url()).toBe(originalUrl);
    expect(topLevelNavigations).toBe(0);
  });

  test('content scrolling stays native until scrollTop reaches zero, then browser pull is canceled', async ({ page }) => {
    await page.goto('runtime-test.html?view=production&scenario=activity');

    const content = page.locator('.page-card-scroll');
    const initialScrollTop = await content.evaluate((element) => {
      const maxScrollTop = Math.max(0, element.scrollHeight - element.clientHeight);
      element.scrollTop = Math.min(120, maxScrollTop);
      return element.scrollTop;
    });
    expect(initialScrollTop).toBeGreaterThan(0);

    const prevented = await probePullPrevention(content, [
      { y: 124, scrollTop: initialScrollTop },
      { y: 148, scrollTop: 0 },
      { y: 172, scrollTop: 0 },
    ]);

    expect(prevented).toEqual([false, true, true]);
    await expect(page.locator('.mobile-workspace-sheet-host')).toBeVisible();
  });

  test('shared detail scroll keeps the same pull-refresh guard', async ({ page }) => {
    await page.goto('runtime-test.html?view=research&scenario=research-active');

    const host = page.locator('.mobile-workspace-sheet-host');
    const trigger = page.getByRole('button', { name: /冶金技术，研发中/ });
    const dialog = page.getByRole('dialog', { name: '冶金技术研发新技术' });
    await trigger.tap();
    await expect(dialog).toBeVisible();
    await expect(host).toHaveAttribute('data-detail-active', 'true');

    const content = host.locator('.mobile-detail-sheet-scroll');
    await content.evaluate((element) => { element.scrollTop = 0; });
    const prevented = await probePullPrevention(content, [{ y: 116 }]);

    expect(prevented).toEqual([true]);
    await expect(dialog).toBeVisible();
    await expect(host).toHaveAttribute('data-detail-active', 'true');
  });
});
