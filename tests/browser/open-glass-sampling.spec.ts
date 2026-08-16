import { expect, test, type Page } from '@playwright/test';

type SamplingSurface = 'game' | 'admin';
type SamplingMode = 'desktop' | 'mobile';

async function verifySamplingChain(page: Page, surface: SamplingSurface, mode: SamplingMode) {
  const viewport = mode === 'desktop'
    ? { width: 1440, height: 900 }
    : { width: 390, height: 844 };
  await page.setViewportSize(viewport);
  await page.goto(`open-glass-sampling-test.html?surface=${surface}&mode=${mode}`);

  const expectedSurfaceCount = surface === 'game' && mode === 'mobile' ? 2 : 1;
  const frostedSurfaces = page.locator('.frosted-glass-surface');
  await expect(frostedSurfaces).toHaveCount(expectedSurfaceCount);
  await expect(page.locator('.liquid-glass-surface, .glass__warp')).toHaveCount(0);

  const chain = await page.evaluate(({ surface: currentSurface, mode: currentMode }) => {
    const samplingRoot = document.getElementById('root');
    const imageLayer = document.querySelector<HTMLElement>('.application-image-layer');
    const atmosphereLayer = document.querySelector<HTMLElement>('.application-atmosphere-layer');
    const mapLayer = document.querySelector<HTMLElement>('.application-map-layer');
    const uiLayer = document.querySelector<HTMLElement>('.application-ui-layer');
    const contentRoot = document.querySelector<HTMLElement>('.application-content-root');
    const shell = document.querySelector<HTMLElement>(currentSurface === 'admin' ? '.admin-shell' : '.game-shell');
    const workspace = document.querySelector<HTMLElement>('.workspace');
    const pageOverlay = document.querySelector<HTMLElement>('.mobile-page-overlay');
    const chromeOverlay = document.querySelector<HTMLElement>('.mobile-chrome-overlay');
    const pageScrollArea = document.querySelector<HTMLElement>('.page-scroll-area');
    const pageScroll = document.querySelector<HTMLElement>('.page-scroll');
    const assetBar = document.querySelector<HTMLElement>('.asset-bar');
    const pageLayerProbe = document.querySelector<HTMLElement>('[data-sampling-layer-probe]');
    const surfaces = [...document.querySelectorAll<HTMLElement>('.frosted-glass-surface')];
    if (!samplingRoot || !imageLayer || !atmosphereLayer || !mapLayer || !uiLayer || !contentRoot
      || !shell || !workspace || !pageOverlay || !chromeOverlay || !pageScrollArea || !pageScroll
      || surfaces.length === 0 || ((currentMode === 'desktop' || currentSurface === 'game') && !assetBar)) {
      throw new Error('frosted-glass sampling fixture is incomplete');
    }

    const openNodes = [mapLayer, uiLayer, contentRoot, shell, workspace, pageOverlay, chromeOverlay, pageScrollArea, pageScroll];
    const backdropFilter = (element: HTMLElement) => {
      const style = getComputedStyle(element) as CSSStyleDeclaration & { webkitBackdropFilter?: string };
      return style.backdropFilter || style.webkitBackdropFilter || '';
    };
    const statusAbovePageLayers = (() => {
      if (currentMode !== 'desktop' || !assetBar || !pageLayerProbe) return null;
      const statusItem = assetBar.querySelector<HTMLElement>('.asset-bar-item');
      if (!statusItem) return false;
      const bounds = statusItem.getBoundingClientRect();
      const stack = document.elementsFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
      const statusIndex = stack.indexOf(statusItem);
      const pageLayerIndex = stack.indexOf(pageLayerProbe);
      return statusIndex >= 0 && (pageLayerIndex < 0 || statusIndex < pageLayerIndex);
    })();

    return {
      samplingRootIsolation: getComputedStyle(samplingRoot).isolation,
      imageLayerZIndex: getComputedStyle(imageLayer).zIndex,
      atmosphereLayerZIndex: getComputedStyle(atmosphereLayer).zIndex,
      mapLayerZIndex: getComputedStyle(mapLayer).zIndex,
      uiLayerZIndex: getComputedStyle(uiLayer).zIndex,
      rootContainsAllLayers: samplingRoot.contains(imageLayer)
        && samplingRoot.contains(atmosphereLayer)
        && samplingRoot.contains(mapLayer)
        && samplingRoot.contains(uiLayer)
        && samplingRoot.contains(contentRoot),
      openIsolations: openNodes.map((element) => getComputedStyle(element).isolation),
      openFilters: openNodes.map((element) => getComputedStyle(element).filter),
      openTransforms: openNodes.map((element) => getComputedStyle(element).transform),
      surfaceFilters: surfaces.map(backdropFilter),
      surfaceBackgrounds: surfaces.map((element) => getComputedStyle(element).backgroundColor),
      surfaceVariants: surfaces.map((element) => element.dataset.frostedGlassVariant),
      surfaceRects: surfaces.map((element) => {
        const box = element.getBoundingClientRect();
        return { width: box.width, height: box.height };
      }),
      statusAbovePageLayers,
    };
  }, { surface, mode });

  expect(chain.samplingRootIsolation).toBe('isolate');
  expect(chain.imageLayerZIndex).toBe('0');
  expect(chain.atmosphereLayerZIndex).toBe('10');
  expect(chain.mapLayerZIndex).toBe('20');
  expect(chain.uiLayerZIndex).toBe('30');
  expect(chain.rootContainsAllLayers).toBe(true);
  expect(chain.openIsolations.every((value) => value === 'auto')).toBe(true);
  expect(chain.openFilters.every((value) => value === 'none')).toBe(true);
  expect(chain.openTransforms.every((value) => value === 'none')).toBe(true);
  expect(chain.surfaceFilters.every((value) => value.includes('blur(18px)')).toBe(true);
  expect(chain.surfaceBackgrounds.every((value) => value !== 'rgba(0, 0, 0, 0)')).toBe(true);
  expect(chain.surfaceRects.every(({ width, height }) => width > 0 && height > 0)).toBe(true);
  expect(chain.statusAbovePageLayers).toBe(mode === 'desktop' ? true : null);

  if (surface === 'game' && mode === 'mobile') {
    expect(chain.surfaceVariants).toEqual(['statusBar', 'mobileNavigation']);
  } else if (surface === 'admin' && mode === 'mobile') {
    expect(chain.surfaceVariants).toEqual(['mobileNavigation']);
  } else {
    expect(chain.surfaceVariants).toEqual(['statusBar']);
  }
}

test.describe('signed-in frosted-glass backdrop sampling', () => {
  for (const surface of ['game', 'admin'] as const) {
    for (const mode of ['desktop', 'mobile'] as const) {
      test(`${mode} ${surface} chrome uses the unique root sampling chain`, async ({ page }) => {
        await verifySamplingChain(page, surface, mode);
      });
    }
  }
});
