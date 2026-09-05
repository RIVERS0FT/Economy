import { expect, test, type Locator } from '@playwright/test';

test.describe('mobile navigation scrolling', () => {
  test('mobile navigation centers the full button group when it fits', async ({ page }) => {
    await page.setViewportSize({ width: 720, height: 900 });
    await page.goto('runtime-test.html?view=map&scenario=empty');

    const viewport = page.locator('.mobile-bottom-navigation__viewport');
    await expect(page.locator('.mobile-bottom-navigation')).toBeVisible();
    const centered = await viewport.evaluate((element) => {
      const buttons = [...element.querySelectorAll<HTMLElement>('.sidebar-nav-button')];
      const viewportRect = element.getBoundingClientRect();
      const first = buttons[0]?.getBoundingClientRect();
      const last = buttons.at(-1)?.getBoundingClientRect();
      if (!first || !last) throw new Error('mobile navigation buttons are missing');
      return {
        contentCenter: (first.left + last.right) / 2,
        viewportCenter: (viewportRect.left + viewportRect.right) / 2,
        justifyContent: getComputedStyle(element).justifyContent,
        overflows: element.scrollWidth > element.clientWidth + 1,
      };
    });

    expect(centered.overflows).toBe(false);
    expect(centered.justifyContent).toContain('center');
    expect(centered.contentCenter).toBeCloseTo(centered.viewportCenter, 0);
  });

  test('mobile navigation uses one native scroll viewport without clipping its buttons', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto('runtime-test.html?view=map&scenario=activity');

    const navigation = page.locator('.mobile-bottom-navigation');
    const content = navigation.locator('.frosted-glass-surface__content');
    const viewport = navigation.locator('.mobile-bottom-navigation__viewport');

    await expect(navigation).toBeVisible();
    await expect(navigation).toHaveAttribute('data-workspace-sheet-hidden', 'false');
    await expect(content).toBeVisible();
    await expect(viewport).toBeVisible();
    await expect(navigation.locator('.mobile-navigation-frame')).toHaveCount(0);
    await expect(navigation.locator('.mobile-navigation-scroll-area')).toHaveCount(0);
    await expect(navigation.locator('.ui-scroll-area')).toHaveCount(0);
    await expect(navigation.locator('.ui-scrollbar')).toHaveCount(0);

    const state = await viewport.evaluate((element) => {
      const viewportElement = element as HTMLElement;
      const activeButton = viewportElement.querySelector<HTMLElement>('.sidebar-nav-button');
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

  test('mobile navigation stays mounted but hidden while a sheet is open and animates back after close', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('runtime-test.html?view=map&scenario=empty');

    const navigationHost = page.locator('.mobile-bottom-navigation');
    const navigation = page.getByRole('navigation', { name: '游戏主导航' });
    const active = navigation.getByRole('button', { name: '概览', exact: true });
    const inactive = navigation.getByRole('button', { name: '市场', exact: true });
    const readVisual = (locator: Locator) => locator.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        color: style.color,
        background: style.backgroundColor,
        border: style.borderTopColor,
        boxShadow: style.boxShadow,
        transform: style.transform,
      };
    });

    await expect(navigationHost).toBeVisible();
    await navigationHost.evaluate((element) => { element.dataset.navigationInstanceProbe = 'stable'; });
    const inactiveBefore = await readVisual(inactive);
    await inactive.hover({ force: true });
    const inactiveAfterHover = await readVisual(inactive);
    expect(inactiveAfterHover).toEqual(inactiveBefore);

    const activeBefore = await readVisual(active);
    await active.hover({ force: true });
    const activeAfterHover = await readVisual(active);
    expect(activeAfterHover).toEqual(activeBefore);

    await active.click();
    const sheet = page.locator('.mobile-workspace-sheet-host');
    await expect(sheet).toBeVisible();
    await expect(navigationHost).toHaveAttribute('data-navigation-instance-probe', 'stable');
    await expect(navigationHost).toHaveAttribute('data-workspace-sheet-hidden', 'true');
    await expect(navigationHost).toHaveAttribute('aria-hidden', 'true');
    await expect(navigationHost).toHaveAttribute('inert', '');
    await expect(navigationHost).toBeHidden();
    const hiddenState = await navigationHost.evaluate((element) => {
      const style = getComputedStyle(element);
      return { pointerEvents: style.pointerEvents, opacity: style.opacity, visibility: style.visibility };
    });
    expect(hiddenState).toEqual({ pointerEvents: 'none', opacity: '0', visibility: 'hidden' });

    await navigationHost.evaluate((element) => {
      element.dataset.testReturnAnimationStarted = 'false';
      element.dataset.testReturnAnimationState = 'missing';
      element.dataset.testReturnAnimationSheetPresent = 'unknown';
      element.addEventListener('animationstart', (event) => {
        if (event.animationName !== 'mobile-bottom-navigation-return') return;
        element.dataset.testReturnAnimationStarted = 'true';
        element.dataset.testReturnAnimationState = element.dataset.navigationReturning ?? 'missing';
        element.dataset.testReturnAnimationSheetPresent = document.querySelector('.mobile-workspace-sheet-host')
          ? 'true'
          : 'false';
      });
    });
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await expect(navigationHost).toHaveAttribute('data-navigation-instance-probe', 'stable');
    await expect(navigationHost).toHaveAttribute('data-workspace-sheet-hidden', 'false');
    await expect(navigationHost).not.toHaveAttribute('aria-hidden', 'true');
    await expect(navigationHost).not.toHaveAttribute('inert', '');
    await expect(navigationHost).toBeVisible();
    await expect(navigationHost).toHaveAttribute('data-test-return-animation-started', 'true');
    await expect(navigationHost).toHaveAttribute('data-test-return-animation-state', 'true');
    await expect(navigationHost).toHaveAttribute('data-test-return-animation-sheet-present', 'false');
    await expect(navigationHost).toHaveAttribute('data-navigation-returning', 'false');

    await inactive.click();
    await expect(page.locator('.mobile-workspace-sheet-host')).toBeVisible();
    await expect(navigationHost).toHaveAttribute('data-workspace-sheet-hidden', 'true');
  });
});
