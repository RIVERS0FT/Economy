import { expect, test, type Page } from '@playwright/test';

async function routeBackground(page: Page, mode: 'success' | 'failure' = 'success') {
  await page.route('https://upload.wikimedia.org/**', async (route) => {
    if (mode === 'failure') {
      await route.abort('failed');
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" fill="#07100b"/><path d="M0 40h64v24H0z" fill="#153824"/></svg>',
    });
  });
}

async function openGame(page: Page, imageMode: 'success' | 'failure' = 'success') {
  await routeBackground(page, imageMode);
  await page.goto('runtime-test.html?view=overview&scenario=empty');
  await expect(page.locator('.game-shell')).toBeVisible();
  await expect(page.locator('.page-content')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-app-backdrop', 'game');
}

test.describe('signed-in game four-layer scene stack', () => {
  test('desktop keeps one persistent image, atmosphere, map, and UI root order', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openGame(page);

    const imageLayer = page.locator('.application-image-layer');
    const atmosphereLayer = page.locator('.application-atmosphere-layer');
    const mapLayer = page.locator('.application-map-layer');
    const uiLayer = page.locator('.application-ui-layer');
    const shell = page.locator('.game-shell');

    await expect(imageLayer).toHaveCount(1);
    await expect(imageLayer).toBeVisible();
    await expect(atmosphereLayer).toHaveCount(1);
    await expect(atmosphereLayer).toBeVisible();
    await expect(mapLayer).toHaveCount(1);
    await expect(mapLayer).toBeVisible();
    await expect(uiLayer).toHaveCount(1);
    await expect(uiLayer).toBeVisible();
    await expect(shell).toBeVisible();
    await expect(shell.locator('.financial-backdrop-image')).toHaveCount(0);

    const visual = await page.evaluate(() => {
      const image = document.querySelector<HTMLElement>('.application-image-layer');
      const atmosphere = document.querySelector<HTMLElement>('.application-atmosphere-layer');
      const map = document.querySelector<HTMLElement>('.application-map-layer');
      const ui = document.querySelector<HTMLElement>('.application-ui-layer');
      const contentRoot = document.querySelector<HTMLElement>('.application-content-root');
      const shellElement = document.querySelector<HTMLElement>('.game-shell');
      const workspaceStrategicChrome = document.querySelector<HTMLElement>('.workspace-strategic-chrome');
      const picture = document.querySelector<HTMLElement>('.application-image-layer img');
      const root = document.getElementById('root');
      if (!root || !image || !atmosphere || !map || !ui || !contentRoot || !shellElement
        || !workspaceStrategicChrome || !picture) {
        throw new Error('persistent game background fixture is incomplete');
      }
      const rootChildren = [...root.children];
      return {
        image: {
          position: getComputedStyle(image).position,
          zIndex: getComputedStyle(image).zIndex,
        },
        atmosphere: {
          position: getComputedStyle(atmosphere).position,
          zIndex: getComputedStyle(atmosphere).zIndex,
        },
        map: {
          position: getComputedStyle(map).position,
          zIndex: getComputedStyle(map).zIndex,
        },
        ui: {
          position: getComputedStyle(ui).position,
          zIndex: getComputedStyle(ui).zIndex,
        },
        rootLayerOrder: [image, atmosphere, map, ui].map((element) => rootChildren.indexOf(element)),
        mapContainsStage: Boolean(map.querySelector('.strategic-map-stage')),
        mapContainsLensBar: Boolean(map.querySelector('.strategic-map-lens-bar')),
        contentZIndex: getComputedStyle(contentRoot).zIndex,
        contentIsolation: getComputedStyle(contentRoot).isolation,
        shellIsolation: getComputedStyle(shellElement).isolation,
        shellFilter: getComputedStyle(shellElement).filter,
        shellTransform: getComputedStyle(shellElement).transform,
        openLayerIsolations: [map, ui, workspaceStrategicChrome]
          .map((element) => getComputedStyle(element).isolation),
        openLayerFilters: [map, ui, workspaceStrategicChrome]
          .map((element) => getComputedStyle(element).filter),
        openLayerTransforms: [map, ui, workspaceStrategicChrome]
          .map((element) => getComputedStyle(element).transform),
        imageFit: getComputedStyle(picture).objectFit,
        bodyGridDisplay: getComputedStyle(document.body, '::before').display,
      };
    });

    expect(visual.image).toEqual({ position: 'fixed', zIndex: '0' });
    expect(visual.atmosphere).toEqual({ position: 'fixed', zIndex: '10' });
    expect(visual.map).toEqual({ position: 'fixed', zIndex: '20' });
    expect(visual.ui).toEqual({ position: 'fixed', zIndex: '30' });
    expect(visual.rootLayerOrder).toEqual([0, 1, 2, 3]);
    expect(visual.mapContainsStage).toBe(true);
    expect(visual.mapContainsLensBar).toBe(true);
    expect(visual.contentZIndex).toBe('auto');
    expect(visual.contentIsolation).toBe('auto');
    expect(visual.shellIsolation).toBe('auto');
    expect(visual.shellFilter).toBe('none');
    expect(visual.shellTransform).toBe('none');
    expect(visual.openLayerIsolations).toEqual(['auto', 'auto', 'auto']);
    expect(visual.openLayerFilters).toEqual(['none', 'none', 'none']);
    expect(visual.openLayerTransforms).toEqual(['none', 'none', 'none']);
    expect(visual.imageFit).toBe('cover');
    expect(visual.bodyGridDisplay).toBe('none');
  });

  test('mobile preserves page and chrome overlay order above the persistent background', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openGame(page);

    await expect(page.locator('.application-image-layer')).toBeVisible();
    await expect(page.locator('.application-atmosphere-layer')).toBeVisible();
    await expect(page.locator('.asset-bar')).toBeVisible();
    const navigation = page.locator('.mobile-bottom-navigation');
    await expect(navigation).toHaveAttribute('data-workspace-sheet-hidden', 'true');
    await expect(navigation).toHaveAttribute('aria-hidden', 'true');
    await expect(navigation).toBeHidden();

    const layout = await page.evaluate(() => {
      const shell = document.querySelector<HTMLElement>('.game-shell');
      const body = document.querySelector<HTMLElement>('.signed-in-shell__body');
      const workspace = document.querySelector<HTMLElement>('.workspace');
      const primaryCard = document.querySelector<HTMLElement>('.signed-in-shell__primary-card');
      const mapLayer = document.querySelector<HTMLElement>('.application-map-layer');
      const uiLayer = document.querySelector<HTMLElement>('.application-ui-layer');
      const pageOverlay = document.querySelector<HTMLElement>('.mobile-page-overlay');
      const workspaceStrategicChrome = document.querySelector<HTMLElement>('.workspace-strategic-chrome');
      const workspaceFloatingLayer = document.querySelector<HTMLElement>('.workspace-floating-layer');
      const tooltipLayer = document.querySelector<HTMLElement>('[data-workspace-tooltip-layer="true"]');
      const chromeOverlay = document.querySelector<HTMLElement>('.mobile-chrome-overlay');
      if (!shell || !body || !workspace || !primaryCard || !mapLayer || !uiLayer || !pageOverlay
        || !workspaceStrategicChrome || !workspaceFloatingLayer || !tooltipLayer || !chromeOverlay) {
        throw new Error('mobile game overlay fixture is incomplete');
      }
      const shellChildren = [...shell.children];
      const workspaceChildren = [...workspace.children];
      return {
        bodyIndex: shellChildren.indexOf(body),
        chromeIndex: shellChildren.indexOf(chromeOverlay),
        primaryCardIndex: workspaceChildren.indexOf(primaryCard),
        pageInsidePrimaryCard: pageOverlay.closest('.signed-in-shell__primary-card') === primaryCard,
        strategicChromeIndex: workspaceChildren.indexOf(workspaceStrategicChrome),
        floatingLayerIndex: workspaceChildren.indexOf(workspaceFloatingLayer),
        bodyZ: getComputedStyle(body).zIndex,
        workspaceZ: getComputedStyle(workspace).zIndex,
        primaryCardZ: getComputedStyle(primaryCard).zIndex,
        mapZ: getComputedStyle(mapLayer).zIndex,
        uiZ: getComputedStyle(uiLayer).zIndex,
        pageZ: getComputedStyle(pageOverlay).zIndex,
        strategicChromeZ: getComputedStyle(workspaceStrategicChrome).zIndex,
        floatingLayerZ: getComputedStyle(workspaceFloatingLayer).zIndex,
        tooltipZ: getComputedStyle(tooltipLayer).zIndex,
        tooltipEvents: getComputedStyle(tooltipLayer).pointerEvents,
        tooltipInsideFloatingLayer: tooltipLayer.parentElement === workspaceFloatingLayer,
        chromeZ: getComputedStyle(chromeOverlay).zIndex,
        workspaceIsolation: getComputedStyle(workspace).isolation,
        mapIsolation: getComputedStyle(mapLayer).isolation,
        uiIsolation: getComputedStyle(uiLayer).isolation,
        pageIsolation: getComputedStyle(pageOverlay).isolation,
        primaryCardBorderWidth: getComputedStyle(primaryCard).borderTopWidth,
        primaryCardBackground: getComputedStyle(primaryCard).backgroundColor,
        primaryCardBackdropFilter: getComputedStyle(primaryCard).backdropFilter,
        strategicChromeIsolation: getComputedStyle(workspaceStrategicChrome).isolation,
        chromeIsolation: getComputedStyle(chromeOverlay).isolation,
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
      };
    });

    expect(layout.bodyIndex).toBe(0);
    expect(layout.chromeIndex).toBe(1);
    expect(layout.primaryCardIndex).toBe(0);
    expect(layout.pageInsidePrimaryCard).toBe(true);
    expect(layout.strategicChromeIndex).toBe(1);
    expect(layout.floatingLayerIndex).toBe(2);
    // Structural ancestors must not trap the unique tooltip host below the Sheet.
    expect(layout.bodyZ).toBe('auto');
    expect(layout.workspaceZ).toBe('auto');
    expect(layout.primaryCardZ).toBe('0');
    expect(layout.mapZ).toBe('20');
    expect(layout.uiZ).toBe('30');
    expect(layout.pageZ).toBe('1');
    expect(layout.strategicChromeZ).toBe('auto');
    expect(layout.floatingLayerZ).toBe('auto');
    expect(layout.tooltipZ).toBe('3001');
    expect(layout.tooltipEvents).toBe('none');
    expect(layout.tooltipInsideFloatingLayer).toBe(true);
    expect(layout.chromeZ).toBe('3001');
    expect(layout.workspaceIsolation).toBe('auto');
    expect(layout.mapIsolation).toBe('auto');
    expect(layout.uiIsolation).toBe('auto');
    expect(layout.pageIsolation).toBe('auto');
    expect(layout.primaryCardBorderWidth).toBe('0px');
    expect(layout.primaryCardBackground).toBe('rgba(0, 0, 0, 0)');
    expect(layout.primaryCardBackdropFilter).toBe('none');
    expect(layout.strategicChromeIsolation).toBe('auto');
    expect(layout.chromeIsolation).toBe('auto');
    expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
  });

  test('falls back to the atmosphere layer when photography fails', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 700 });
    await openGame(page, 'failure');

    await expect(page.locator('.application-image-layer img')).toBeHidden();
    await expect(page.locator('.application-atmosphere-layer')).toBeVisible();
    await expect(page.locator('.page-content')).toBeVisible();
  });
});
