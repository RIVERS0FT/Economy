import { expect, test } from '@playwright/test';

test.describe('liquid glass shell geometry', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('desktop status bar uses the shared inset, card radius and one structural border', async ({ page }) => {
    await page.goto('runtime-test.html?view=overview&scenario=activity');
    await expect(page.locator('.asset-bar')).toBeVisible();
    await expect(page.locator('.asset-bar .liquid-glass-surface')).toBeVisible();
    await expect(page.locator('.overview-today-panel')).toBeVisible();

    const layout = await page.evaluate(() => {
      const workspace = document.querySelector<HTMLElement>('.workspace');
      const assetBar = document.querySelector<HTMLElement>('.asset-bar');
      const surface = document.querySelector<HTMLElement>('.asset-bar .liquid-glass-surface');
      const heading = document.querySelector<HTMLElement>('.page-heading');
      const primaryPanel = document.querySelector<HTMLElement>('.overview-today-panel');
      if (!workspace || !assetBar || !surface || !heading || !primaryPanel) {
        throw new Error('status bar geometry fixture is incomplete');
      }

      const workspaceRect = workspace.getBoundingClientRect();
      const assetBarRect = assetBar.getBoundingClientRect();
      const surfaceRect = surface.getBoundingClientRect();
      const headingRect = heading.getBoundingClientRect();
      const assetBarStyle = getComputedStyle(assetBar);
      const surfaceStyle = getComputedStyle(surface);
      const primaryPanelStyle = getComputedStyle(primaryPanel);
      const directDecorationSpans = Array.from(surface.children)
        .filter((element) => element.tagName === 'SPAN') as HTMLElement[];

      return {
        workspaceWidth: workspaceRect.width,
        assetBarWidth: assetBarRect.width,
        surfaceWidth: surfaceRect.width,
        assetBarTopInset: assetBarRect.top - workspaceRect.top,
        assetBarRightInset: workspaceRect.right - assetBarRect.right,
        assetBarBottom: assetBarRect.bottom,
        headingTop: headingRect.top,
        assetBarDisplay: assetBarStyle.display,
        assetBarBackdropFilter: assetBarStyle.backdropFilter,
        surfaceOverflowX: surfaceStyle.overflowX,
        surfaceRadius: [
          surfaceStyle.borderTopLeftRadius,
          surfaceStyle.borderTopRightRadius,
          surfaceStyle.borderBottomRightRadius,
          surfaceStyle.borderBottomLeftRadius,
        ],
        panelRadius: primaryPanelStyle.borderTopLeftRadius,
        surfaceBorderWidth: surfaceStyle.borderTopWidth,
        surfaceBorderStyle: surfaceStyle.borderTopStyle,
        directDecorationSpanCount: directDecorationSpans.length,
        visibleDecorationSpanCount: directDecorationSpans
          .filter((element) => Number.parseFloat(getComputedStyle(element).opacity) > 0).length,
        hasPanelClass: assetBar.classList.contains('panel'),
        glassSurfaceCount: assetBar.querySelectorAll('.liquid-glass-surface').length,
      };
    });

    expect(Math.abs(layout.workspaceWidth - layout.assetBarWidth - 12)).toBeLessThanOrEqual(1);
    expect(Math.abs(layout.surfaceWidth - layout.assetBarWidth)).toBeLessThanOrEqual(1);
    expect(layout.assetBarTopInset).toBeCloseTo(12, 0);
    expect(layout.assetBarRightInset).toBeCloseTo(12, 0);
    expect(layout.assetBarDisplay).not.toBe('grid');
    expect(['', 'none']).toContain(layout.assetBarBackdropFilter);
    expect(['hidden', 'clip']).toContain(layout.surfaceOverflowX);
    expect(layout.surfaceRadius).toEqual([
      layout.panelRadius,
      layout.panelRadius,
      layout.panelRadius,
      layout.panelRadius,
    ]);
    expect(layout.panelRadius).toBe('24px');
    expect(layout.surfaceBorderWidth).toBe('1px');
    expect(layout.surfaceBorderStyle).toBe('solid');
    expect(layout.directDecorationSpanCount).toBeGreaterThan(0);
    expect(layout.visibleDecorationSpanCount).toBe(0);
    expect(layout.hasPanelClass).toBe(false);
    expect(layout.glassSurfaceCount).toBe(1);
    expect(layout.headingTop).toBeGreaterThanOrEqual(layout.assetBarBottom);
  });
});
