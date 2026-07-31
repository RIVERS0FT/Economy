import { expect, test, type Page } from '@playwright/test';

type SamplingSurface = 'game' | 'admin';
type SamplingMode = 'desktop' | 'mobile';

async function verifySamplingChain(page: Page, surface: SamplingSurface, mode: SamplingMode) {
  const viewport = mode === 'desktop'
    ? { width: 1440, height: 900 }
    : { width: 390, height: 844 };
  await page.setViewportSize(viewport);
  await page.goto(`open-glass-sampling-test.html?surface=${surface}&mode=${mode}`);

  const shellSelector = surface === 'admin' ? '.admin-shell' : '.game-shell';
  await expect(page.locator(shellSelector)).toBeAttached();
  await expect(page.locator('.application-content-root')).toBeVisible();
  await expect(page.locator('.application-image-layer')).toHaveCount(1);
  await expect(page.locator('.application-atmosphere-layer')).toHaveCount(1);

  const expectedWarpCount = surface === 'game' && mode === 'mobile' ? 2 : 1;
  const warps = page.locator('.glass__warp');
  await expect(warps).toHaveCount(expectedWarpCount);
  await expect(warps.first()).toBeVisible();

  const chain = await page.evaluate(({ surface: currentSurface, mode: currentMode }) => {
    const samplingRoot = document.getElementById('root');
    const contentRoot = document.querySelector<HTMLElement>('.application-content-root');
    const shell = document.querySelector<HTMLElement>(currentSurface === 'admin' ? '.admin-shell' : '.game-shell');
    const workspace = document.querySelector<HTMLElement>('.workspace');
    const pageOverlay = document.querySelector<HTMLElement>('.mobile-page-overlay');
    const chromeOverlay = document.querySelector<HTMLElement>('.mobile-chrome-overlay');
    const pageScrollArea = document.querySelector<HTMLElement>('.page-scroll-area');
    const pageScroll = document.querySelector<HTMLElement>('.page-scroll');
    const assetBar = document.querySelector<HTMLElement>('.asset-bar');
    const pageLayerProbe = document.querySelector<HTMLElement>('[data-sampling-layer-probe]');
    const imageLayer = document.querySelector<HTMLElement>('.application-image-layer');
    const atmosphereLayer = document.querySelector<HTMLElement>('.application-atmosphere-layer');
    const warpElements = [...document.querySelectorAll<HTMLElement>('.glass__warp')];
    const surfaces = [...document.querySelectorAll<HTMLElement>('.liquid-glass-surface')];
    const glasses = [...document.querySelectorAll<HTMLElement>('.liquid-glass-surface__effect > .glass')];
    if (!samplingRoot || !contentRoot || !shell || !workspace || !pageOverlay || !chromeOverlay
      || !pageScrollArea || !pageScroll || !imageLayer || !atmosphereLayer
      || ((currentMode === 'desktop' || currentSurface === 'game') && !assetBar)
      || (currentMode === 'desktop' && !pageLayerProbe)
      || warpElements.length === 0 || surfaces.length === 0 || glasses.length === 0) {
      throw new Error('open glass sampling fixture is incomplete');
    }

    const openNodes = [contentRoot, shell, workspace, pageOverlay, chromeOverlay, pageScrollArea, pageScroll];
    const backdropFilter = (element: HTMLElement) => {
      const style = getComputedStyle(element) as CSSStyleDeclaration & { webkitBackdropFilter?: string };
      return style.backdropFilter || style.webkitBackdropFilter || '';
    };
    const rect = (element: HTMLElement) => {
      const bounds = element.getBoundingClientRect();
      return { width: bounds.width, height: bounds.height };
    };
    const statusAbovePageLayers = (() => {
      if (currentMode !== 'desktop' || !assetBar || !pageLayerProbe) return null;
      const statusItem = assetBar.querySelector<HTMLElement>('.asset-bar-item');
      if (!statusItem) return false;
      const bounds = statusItem.getBoundingClientRect();
      const stack = document.elementsFromPoint(
        bounds.left + (bounds.width / 2),
        bounds.top + (bounds.height / 2),
      );
      return stack.indexOf(statusItem) < stack.indexOf(pageLayerProbe);
    })();

    return {
      samplingRootIsolation: getComputedStyle(samplingRoot).isolation,
      samplingRootFilter: getComputedStyle(samplingRoot).filter,
      samplingRootTransform: getComputedStyle(samplingRoot).transform,
      rootContainsAllLayers: samplingRoot.contains(imageLayer)
        && samplingRoot.contains(atmosphereLayer)
        && samplingRoot.contains(contentRoot),
      layersShareRoot: imageLayer.parentElement === samplingRoot
        && atmosphereLayer.parentElement === samplingRoot
        && contentRoot.parentElement === samplingRoot,
      openIsolations: openNodes.map((element) => getComputedStyle(element).isolation),
      openFilters: openNodes.map((element) => getComputedStyle(element).filter),
      openTransforms: openNodes.map((element) => getComputedStyle(element).transform),
      pageScrollZIndex: getComputedStyle(pageScroll).zIndex,
      assetBarZIndex: assetBar ? getComputedStyle(assetBar).zIndex : null,
      statusAbovePageLayers,
      warpBackdropFilters: warpElements.map(backdropFilter),
      warpRects: warpElements.map(rect),
      surfaceRects: surfaces.map(rect),
      surfaceBackgrounds: surfaces.map((element) => getComputedStyle(element).backgroundColor),
      surfaceIsolations: surfaces.map((element) => getComputedStyle(element).isolation),
      surfaceContains: surfaces.map((element) => getComputedStyle(element).contain),
      glassShadows: glasses.map((element) => getComputedStyle(element).boxShadow),
      surfaceVariants: surfaces.map((element) => element.dataset.liquidGlassVariant),
      overLightValues: surfaces.map((element) => element.dataset.liquidGlassOverLight),
    };
  }, { surface, mode });

  expect(chain.samplingRootIsolation).toBe('isolate');
  expect(chain.samplingRootFilter).toBe('none');
  expect(chain.samplingRootTransform).toBe('none');
  expect(chain.rootContainsAllLayers).toBe(true);
  expect(chain.layersShareRoot).toBe(true);
  expect(chain.openIsolations.every((value) => value === 'auto')).toBe(true);
  expect(chain.openFilters.every((value) => value === 'none')).toBe(true);
  expect(chain.openTransforms.every((value) => value === 'none')).toBe(true);
  expect(chain.pageScrollZIndex).toBe(mode === 'desktop' ? '0' : 'auto');
  expect(chain.assetBarZIndex).toBe(surface === 'admin' && mode === 'mobile' ? null : 'auto');
  expect(chain.statusAbovePageLayers).toBe(mode === 'desktop' ? true : null);
  expect(chain.warpRects.every(({ width, height }) => width > 0 && height > 0)).toBe(true);
  expect(chain.surfaceRects.every(({ width, height }) => width > 0 && height > 0)).toBe(true);
  expect(chain.warpBackdropFilters.every((value) => value.includes('blur(4px)'))).toBe(true);
  expect(chain.warpBackdropFilters.every((value) => /saturate\((?:140%|1\.4)\)/.test(value))).toBe(true);
  expect(chain.surfaceBackgrounds.every((value) => value === 'rgba(0, 0, 0, 0)')).toBe(true);
  expect(chain.surfaceIsolations.every((value) => value === 'auto')).toBe(true);
  expect(chain.surfaceContains.every((value) => value === 'none')).toBe(true);
  expect(chain.glassShadows.every((value) => value.includes('0px 12px 40px'))).toBe(true);
  expect(chain.overLightValues.every((value) => value === 'false')).toBe(true);

  if (surface === 'game' && mode === 'desktop') {
    expect(chain.surfaceVariants).toEqual(['desktopStatusBar']);
  } else if (surface === 'admin' && mode === 'desktop') {
    expect(chain.surfaceVariants).toEqual(['desktopStatusBar']);
  } else if (surface === 'game' && mode === 'mobile') {
    expect(chain.surfaceVariants).toEqual(['mobileStatusBar', 'mobileNavigation']);
  } else {
    expect(chain.surfaceVariants).toEqual(['mobileNavigation']);
  }
}

test.describe('signed-in liquid glass backdrop sampling', () => {
  test('desktop player chrome uses the unique root sampling chain', async ({ page }) => {
    await verifySamplingChain(page, 'game', 'desktop');
  });

  test('desktop administrator chrome uses the unique root sampling chain', async ({ page }) => {
    await verifySamplingChain(page, 'admin', 'desktop');
  });

  test('mobile player chrome uses the unique root sampling chain', async ({ page }) => {
    await verifySamplingChain(page, 'game', 'mobile');
  });

  test('mobile administrator chrome uses the unique root sampling chain', async ({ page }) => {
    await verifySamplingChain(page, 'admin', 'mobile');
  });
});
