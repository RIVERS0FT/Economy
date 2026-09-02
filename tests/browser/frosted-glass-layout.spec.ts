import { expect, test } from '@playwright/test';

function alphaFromColor(color: string) {
  const match = color.match(/rgba?\([^,]+,[^,]+,[^,]+(?:,\s*([\d.]+))?\)/);
  return match?.[1] === undefined ? 1 : Number(match[1]);
}

test.describe('shared frosted-glass shell', () => {
  test('desktop chrome uses CSS frosted glass without Liquid Glass DOM while scrolling page sections stay flat', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('runtime-test.html?view=overview&scenario=activity');

    const surface = page.locator('.asset-bar .frosted-glass-surface');
    const panel = page.locator('.overview-check-in-panel');
    await expect(surface).toHaveAttribute('data-frosted-glass-variant', 'statusBar');
    await expect(surface).toHaveCount(1);
    await expect(panel).toBeVisible();
    await expect(page.locator('.liquid-glass-surface, .glass__warp, [data-liquid-glass-variant]')).toHaveCount(0);

    const styles = await page.evaluate(() => {
      const read = (selector: string) => {
        const element = document.querySelector<HTMLElement>(selector);
        if (!element) throw new Error(`missing ${selector}`);
        const style = getComputedStyle(element) as CSSStyleDeclaration & { webkitBackdropFilter?: string };
        return {
          backgroundColor: style.backgroundColor,
          backdropFilter: style.backdropFilter || style.webkitBackdropFilter || '',
          borderWidth: style.borderTopWidth,
          borderRadius: style.borderRadius,
          boxShadow: style.boxShadow,
        };
      };
      return {
        surface: read('.asset-bar .frosted-glass-surface'),
        panel: read('.overview-check-in-panel'),
        highlightContent: getComputedStyle(
          document.querySelector<HTMLElement>('.asset-bar .frosted-glass-surface')!,
          '::before',
        ).content,
      };
    });

    expect(alphaFromColor(styles.surface.backgroundColor)).toBeGreaterThan(0.5);
    expect(alphaFromColor(styles.surface.backgroundColor)).toBeLessThan(0.95);
    expect(styles.surface.backdropFilter).toContain('blur(18px)');
    expect(styles.surface.borderWidth).toBe('1px');
    expect(styles.surface.boxShadow).not.toBe('none');
    expect(styles.highlightContent).not.toBe('none');

    expect(alphaFromColor(styles.panel.backgroundColor)).toBe(0);
    expect(styles.panel.backdropFilter).toBe('none');
    expect(styles.panel.borderWidth).toBe('1px');
    expect(styles.panel.borderRadius).toBe('0px');
    expect(styles.panel.boxShadow).toBe('none');
  });

  test('player desktop uses one workspaceCard host for the sidebar and active page', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('runtime-test.html?view=overview&scenario=activity');

    const workspaceCard = page.locator('.signed-in-shell__primary-card');
    const sidebar = page.locator('.desktop-sidebar');
    const pageContent = page.locator('.strategic-page-host > .page-content');
    await expect(workspaceCard).toHaveCount(1);
    await expect(workspaceCard).toHaveAttribute('data-frosted-glass-variant', 'workspaceCard');
    await expect(workspaceCard.locator(':scope .desktop-sidebar')).toHaveCount(1);
    await expect(workspaceCard.locator(':scope .strategic-page-host > .page-content')).toHaveCount(1);

    const styles = await page.evaluate(() => {
      const card = document.querySelector<HTMLElement>('.signed-in-shell__primary-card');
      const sidebarElement = document.querySelector<HTMLElement>('.desktop-sidebar');
      const pageElement = document.querySelector<HTMLElement>('.strategic-page-host > .page-content');
      if (!card || !sidebarElement || !pageElement) throw new Error('workspaceCard fixture is incomplete');
      const read = (element: HTMLElement) => {
        const style = getComputedStyle(element) as CSSStyleDeclaration & { webkitBackdropFilter?: string };
        return {
          background: style.backgroundColor,
          borderWidth: style.borderTopWidth,
          boxShadow: style.boxShadow,
          backdropFilter: style.backdropFilter || style.webkitBackdropFilter || '',
        };
      };
      return {
        card: read(card),
        sidebar: read(sidebarElement),
        page: read(pageElement),
        sharedCard: sidebarElement.closest('.signed-in-shell__primary-card') === card
          && pageElement.closest('.signed-in-shell__primary-card') === card,
      };
    });

    expect(styles.sharedCard).toBe(true);
    expect(styles.card.backdropFilter).toContain('blur(18px)');
    expect(styles.card.borderWidth).toBe('1px');
    expect(styles.card.boxShadow).not.toBe('none');
    expect(styles.sidebar.borderWidth).toBe('0px');
    expect(styles.sidebar.boxShadow).toBe('none');
    expect(styles.sidebar.backdropFilter).toBe('none');
    expect(styles.page.borderWidth).toBe('0px');
    expect(styles.page.boxShadow).toBe('none');
    expect(styles.page.backdropFilter).toBe('none');
  });

  test('status bar keeps one frosted host while desktop and mobile geometry changes', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('runtime-test.html?view=overview&scenario=activity');
    const surface = page.locator('.asset-bar .frosted-glass-surface');
    await surface.evaluate((element) => { (element as HTMLElement).dataset.instanceProbe = 'stable'; });
    await expect(surface).toHaveCSS('border-radius', '24px');

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(surface).toHaveCount(1);
    await expect(surface).toHaveAttribute('data-instance-probe', 'stable');
    const navigationSurface = page.locator('.mobile-bottom-navigation .frosted-glass-surface');
    await expect(surface).toHaveCSS('border-radius', '40px');
    await expect(navigationSurface).toHaveAttribute('data-frosted-glass-variant', 'mobileNavigation');
    await expect(navigationSurface).toHaveCSS('border-radius', '40px');
  });
});
