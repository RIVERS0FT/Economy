import { expect, test } from '@playwright/test';

test.describe('mobile navigation scrolling', () => {
  test('mobile navigation uses one native scroll viewport without clipping its buttons', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto('runtime-test.html?view=overview&scenario=activity');

    const navigation = page.locator('.mobile-bottom-navigation');
    const content = navigation.locator('.liquid-glass-surface__content');
    const viewport = navigation.locator('.mobile-bottom-navigation__viewport');

    await expect(navigation).toBeVisible();
    await expect(content).toBeVisible();
    await expect(viewport).toBeVisible();
    await expect(navigation.locator('.mobile-navigation-frame')).toHaveCount(0);
    await expect(navigation.locator('.mobile-navigation-scroll-area')).toHaveCount(0);
    await expect(navigation.locator('.ui-scroll-area')).toHaveCount(0);
    await expect(navigation.locator('.ui-scrollbar')).toHaveCount(0);

    const state = await viewport.evaluate((element) => {
      const viewportElement = element as HTMLElement;
      const activeButton = viewportElement.querySelector<HTMLElement>('.sidebar-nav-button.active');
      const lastButton = viewportElement.querySelector<HTMLElement>('.sidebar-nav-button:last-of-type');
      const contentElement = viewportElement.parentElement as HTMLElement | null;
      const hostElement = viewportElement.closest<HTMLElement>('.mobile-bottom-navigation');
      if (!activeButton || !lastButton || !contentElement || !hostElement) {
        throw new Error('mobile navigation fixture is incomplete');
      }

      const before = viewportElement.scrollLeft;
      viewportElement.scrollLeft = viewportElement.scrollWidth;
      const viewportRect = viewportElement.getBoundingClientRect();
      const activeButtonRect = activeButton.getBoundingClientRect();
      const lastButtonRect = lastButton.getBoundingClientRect();
      const viewportStyle = getComputedStyle(viewportElement);
      const contentStyle = getComputedStyle(contentElement);
      const hostStyle = getComputedStyle(hostElement);

      return {
        before,
        after: viewportElement.scrollLeft,
        maximum: viewportElement.scrollWidth - viewportElement.clientWidth,
        overflowX: viewportStyle.overflowX,
        overflowY: viewportStyle.overflowY,
        nativeScrollbarWidth: viewportStyle.scrollbarWidth,
        viewportHeight: viewportRect.height,
        viewportTop: viewportRect.top,
        viewportBottom: viewportRect.bottom,
        activeButtonHeight: activeButtonRect.height,
        activeButtonTop: activeButtonRect.top,
        activeButtonBottom: activeButtonRect.bottom,
        lastButtonLeft: lastButtonRect.left,
        lastButtonRight: lastButtonRect.right,
        viewportLeft: viewportRect.left,
        viewportRight: viewportRect.right,
        contentPaddingTop: contentStyle.paddingTop,
        contentPaddingBottom: contentStyle.paddingBottom,
        hostPaddingTop: hostStyle.paddingTop,
        hostPaddingBottom: hostStyle.paddingBottom,
      };
    });

    expect(state.maximum).toBeGreaterThan(0);
    expect(state.after).toBeGreaterThan(state.before);
    expect(state.overflowX).toBe('auto');
    expect(state.overflowY).toBe('hidden');
    expect(state.nativeScrollbarWidth).toBe('none');
    expect(state.contentPaddingTop).toBe('8px');
    expect(state.contentPaddingBottom).toBe('8px');
    expect(state.hostPaddingTop).toBe('0px');
    expect(state.hostPaddingBottom).toBe('0px');
    expect(state.viewportHeight).toBeGreaterThanOrEqual(state.activeButtonHeight);
    expect(state.activeButtonTop).toBeGreaterThanOrEqual(state.viewportTop - 1);
    expect(state.activeButtonBottom).toBeLessThanOrEqual(state.viewportBottom + 1);
    expect(state.lastButtonLeft).toBeGreaterThanOrEqual(state.viewportLeft - 1);
    expect(state.lastButtonRight).toBeLessThanOrEqual(state.viewportRight + 1);
  });
});
