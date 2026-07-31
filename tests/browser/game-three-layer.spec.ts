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

test.describe('signed-in game three-layer background', () => {
  test('desktop keeps one persistent photography node behind the existing game shell', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openGame(page);

    const imageLayer = page.locator('.application-image-layer');
    const atmosphereLayer = page.locator('.application-atmosphere-layer');
    const shell = page.locator('.game-shell');

    await expect(imageLayer).toHaveCount(1);
    await expect(imageLayer).toBeVisible();
    await expect(atmosphereLayer).toHaveCount(1);
    await expect(atmosphereLayer).toBeVisible();
    await expect(shell).toBeVisible();
    await expect(shell.locator('.financial-backdrop-image')).toHaveCount(0);

    const visual = await page.evaluate(() => {
      const image = document.querySelector<HTMLElement>('.application-image-layer');
      const atmosphere = document.querySelector<HTMLElement>('.application-atmosphere-layer');
      const contentRoot = document.querySelector<HTMLElement>('.application-content-root');
      const shellElement = document.querySelector<HTMLElement>('.game-shell');
      const picture = document.querySelector<HTMLElement>('.application-image-layer img');
      if (!image || !atmosphere || !contentRoot || !shellElement || !picture) {
        throw new Error('persistent game background fixture is incomplete');
      }
      return {
        image: {
          position: getComputedStyle(image).position,
          zIndex: getComputedStyle(image).zIndex,
        },
        atmosphere: {
          position: getComputedStyle(atmosphere).position,
          zIndex: getComputedStyle(atmosphere).zIndex,
        },
        contentZIndex: getComputedStyle(contentRoot).zIndex,
        contentIsolation: getComputedStyle(contentRoot).isolation,
        shellIsolation: getComputedStyle(shellElement).isolation,
        shellFilter: getComputedStyle(shellElement).filter,
        shellTransform: getComputedStyle(shellElement).transform,
        imageFit: getComputedStyle(picture).objectFit,
        bodyGridDisplay: getComputedStyle(document.body, '::before').display,
      };
    });

    expect(visual.image).toEqual({ position: 'fixed', zIndex: '0' });
    expect(visual.atmosphere).toEqual({ position: 'fixed', zIndex: '1' });
    expect(visual.contentZIndex).toBe('2');
    expect(visual.contentIsolation).toBe('auto');
    expect(visual.shellIsolation).toBe('auto');
    expect(visual.shellFilter).toBe('none');
    expect(visual.shellTransform).toBe('none');
    expect(visual.imageFit).toBe('cover');
    expect(visual.bodyGridDisplay).toBe('none');
  });

  test('mobile preserves page and chrome overlay order above the persistent background', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openGame(page);

    await expect(page.locator('.application-image-layer')).toBeVisible();
    await expect(page.locator('.application-atmosphere-layer')).toBeVisible();
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
        workspaceIsolation: getComputedStyle(workspace).isolation,
        pageIsolation: getComputedStyle(pageOverlay).isolation,
        chromeIsolation: getComputedStyle(chromeOverlay).isolation,
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
      };
    });

    expect(layout.pageIndex).toBe(0);
    expect(layout.chromeIndex).toBe(1);
    expect(layout.workspaceZ).toBe('auto');
    expect(layout.pageZ).toBe('auto');
    expect(layout.chromeZ).toBe('auto');
    expect(layout.workspaceIsolation).toBe('auto');
    expect(layout.pageIsolation).toBe('auto');
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
