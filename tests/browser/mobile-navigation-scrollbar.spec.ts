import { expect, test } from '@playwright/test';

test.describe('mobile navigation scrolling', () => {
  test('mobile navigation hides its scrollbar without disabling horizontal scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto('runtime-test.html?view=overview&scenario=activity');

    const scrollArea = page.locator('.mobile-navigation-scroll-area');
    const viewport = page.locator('.mobile-bottom-navigation .sidebar-nav');
    const horizontalTrack = scrollArea.locator(':scope > .ui-scrollbar--horizontal');

    await expect(scrollArea).toBeVisible();
    await expect(viewport).toBeVisible();
    await expect(horizontalTrack).toHaveCount(1);
    await expect(horizontalTrack).toBeHidden();
    await expect(scrollArea).toHaveAttribute('data-scrollable-x', 'true');

    const state = await viewport.evaluate((element) => {
      const viewportElement = element as HTMLElement;
      const lastButton = viewportElement.querySelector<HTMLElement>('.sidebar-nav-button:last-of-type');
      if (!lastButton) throw new Error('mobile navigation fixture is incomplete');

      const before = viewportElement.scrollLeft;
      viewportElement.scrollLeft = viewportElement.scrollWidth;
      const viewportRect = viewportElement.getBoundingClientRect();
      const lastButtonRect = lastButton.getBoundingClientRect();

      return {
        before,
        after: viewportElement.scrollLeft,
        maximum: viewportElement.scrollWidth - viewportElement.clientWidth,
        overflowX: getComputedStyle(viewportElement).overflowX,
        nativeScrollbarWidth: getComputedStyle(viewportElement).scrollbarWidth,
        lastButtonLeft: lastButtonRect.left,
        lastButtonRight: lastButtonRect.right,
        viewportLeft: viewportRect.left,
        viewportRight: viewportRect.right,
      };
    });

    expect(state.maximum).toBeGreaterThan(0);
    expect(state.after).toBeGreaterThan(state.before);
    expect(state.overflowX).toBe('auto');
    expect(state.nativeScrollbarWidth).toBe('none');
    expect(state.lastButtonLeft).toBeGreaterThanOrEqual(state.viewportLeft - 1);
    expect(state.lastButtonRight).toBeLessThanOrEqual(state.viewportRight + 1);
  });
});
