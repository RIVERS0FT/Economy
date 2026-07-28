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
}

test.describe('signed-in game three-layer background', () => {
  test('desktop keeps photography and atmosphere behind the existing game shell', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openGame(page);

    const imageLayer = page.locator('.game-image-layer');
    const atmosphereLayer = page.locator('.game-atmosphere-layer');
    const shell = page.locator('.game-shell');

    await expect(imageLayer).toBeVisible();
    await expect(atmosphereLayer).toBeVisible();
    await expect(shell).toBeVisible();

    const visual = await page.evaluate(() => {
      const image = document.querySelector<HTMLElement>('.game-image-layer');
      const atmosphere = document.querySelector<HTMLElement>('.game-atmosphere-layer');
      const shellElement = document.querySelector<HTMLElement>('.game-shell');
      const picture = document.querySelector<HTMLElement>('.game-image-layer img');
      if (!image || !atmosphere || !shellElement || !picture) throw new Error('game background fixture is incomplete');
      const shellChildren = [...shellElement.children];
      return {
        image: {
          position: getComputedStyle(image).position,
          zIndex: getComputedStyle(image).zIndex,
        },
        atmosphere: {
          position: getComputedStyle(atmosphere).position,
          zIndex: getComputedStyle(atmosphere).zIndex,
        },
        shellIsolation: getComputedStyle(shellElement).isolation,
        imageFit: getComputedStyle(picture).objectFit,
        bodyGridDisplay: getComputedStyle(document.body, '::before').display,
        imageIndex: shellChildren.indexOf(image),
        atmosphereIndex: shellChildren.indexOf(atmosphere),
        sidebarIndex: shellChildren.findIndex((element) => element.classList.contains('desktop-sidebar')),
        workspaceIndex: shellChildren.findIndex((element) => element.classList.contains('workspace')),
      };
    });

    expect(visual.image).toEqual({ position: 'fixed', zIndex: '-2' });
    expect(visual.atmosphere).toEqual({ position: 'fixed', zIndex: '-1' });
    expect(visual.shellIsolation).toBe('isolate');
    expect(visual.imageFit).toBe('cover');
    expect(visual.bodyGridDisplay).toBe('none');
    expect(visual.imageIndex).toBe(0);
    expect(visual.atmosphereIndex).toBe(1);
    expect(visual.sidebarIndex).toBeGreaterThan(visual.atmosphereIndex);
    expect(visual.workspaceIndex).toBeGreaterThan(visual.sidebarIndex);
  });

  test('mobile preserves page and chrome overlay order above the background', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openGame(page);

    await expect(page.locator('.game-image-layer')).toBeVisible();
    await expect(page.locator('.game-atmosphere-layer')).toBeVisible();
    await expect(page.locator('.asset-bar')).toBeVisible();
    await expect(page.locator('.mobile-bottom-navigation')).toBeVisible();

    const layout = await page.evaluate(() => {
      const workspace = document.querySelector<HTMLElement>('.workspace');
      const pageOverlay = document.querySelector<HTMLElement>('.mobile-page-overlay');
      const chromeOverlay = document.querySelector<HTMLElement>('.mobile-chrome-overlay');
      if (!workspace || !pageOverlay || !chromeOverlay) throw new Error('mobile game overlay fixture is incomplete');
      const children = [...workspace.children];
      return {
        pageIndex: children.indexOf(pageOverlay),
        chromeIndex: children.indexOf(chromeOverlay),
        workspaceZ: getComputedStyle(workspace).zIndex,
        pageZ: getComputedStyle(pageOverlay).zIndex,
        chromeZ: getComputedStyle(chromeOverlay).zIndex,
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
      };
    });

    expect(layout.pageIndex).toBe(0);
    expect(layout.chromeIndex).toBe(1);
    expect(layout.workspaceZ).toBe('auto');
    expect(layout.pageZ).toBe('auto');
    expect(layout.chromeZ).toBe('auto');
    expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
  });

  test('falls back to the atmosphere layer when photography fails', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 700 });
    await openGame(page, 'failure');

    await expect(page.locator('.game-image-layer img')).toBeHidden();
    await expect(page.locator('.game-atmosphere-layer')).toBeVisible();
    await expect(page.locator('.page-content')).toBeVisible();
  });
});
