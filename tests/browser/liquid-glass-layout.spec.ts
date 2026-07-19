import { expect, test } from '@playwright/test';

test.describe('liquid glass shell geometry', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('desktop status bar fills the workspace without a second panel layer', async ({ page }) => {
    await page.goto('runtime-test.html?view=overview&scenario=activity');
    await expect(page.locator('.asset-bar')).toBeVisible();
    await expect(page.locator('.asset-bar .liquid-glass-surface')).toBeVisible();

    const layout = await page.evaluate(() => {
      const workspace = document.querySelector<HTMLElement>('.workspace');
      const assetBar = document.querySelector<HTMLElement>('.asset-bar');
      const surface = document.querySelector<HTMLElement>('.asset-bar .liquid-glass-surface');
      const heading = document.querySelector<HTMLElement>('.page-heading');
      if (!workspace || !assetBar || !surface || !heading) {
        throw new Error('status bar geometry fixture is incomplete');
      }

      const workspaceRect = workspace.getBoundingClientRect();
      const assetBarRect = assetBar.getBoundingClientRect();
      const surfaceRect = surface.getBoundingClientRect();
      const headingRect = heading.getBoundingClientRect();
      const assetBarStyle = getComputedStyle(assetBar);
      const surfaceStyle = getComputedStyle(surface);

      return {
        workspaceWidth: workspaceRect.width,
        assetBarWidth: assetBarRect.width,
        surfaceWidth: surfaceRect.width,
        assetBarBottom: assetBarRect.bottom,
        headingTop: headingRect.top,
        assetBarDisplay: assetBarStyle.display,
        assetBarBackdropFilter: assetBarStyle.backdropFilter,
        surfaceOverflowX: surfaceStyle.overflowX,
        hasPanelClass: assetBar.classList.contains('panel'),
        glassSurfaceCount: assetBar.querySelectorAll('.liquid-glass-surface').length,
      };
    });

    expect(Math.abs(layout.assetBarWidth - layout.workspaceWidth)).toBeLessThanOrEqual(1);
    expect(Math.abs(layout.surfaceWidth - layout.assetBarWidth)).toBeLessThanOrEqual(1);
    expect(layout.assetBarDisplay).not.toBe('grid');
    expect(['', 'none']).toContain(layout.assetBarBackdropFilter);
    expect(['hidden', 'clip']).toContain(layout.surfaceOverflowX);
    expect(layout.hasPanelClass).toBe(false);
    expect(layout.glassSurfaceCount).toBe(1);
    expect(layout.headingTop).toBeGreaterThanOrEqual(layout.assetBarBottom);
  });
});
