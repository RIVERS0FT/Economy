import { expect, test } from '@playwright/test';

async function waitForRasterReady(canvas: import('@playwright/test').Locator) {
  await expect(canvas).toHaveAttribute('data-map-camera-raster-mode', 'settled-svg-active-raster-snapshot');
  await expect(canvas).toHaveAttribute('data-map-raster-mode', 'preloaded-full-world-svg-snapshot');
  await expect.poll(async () => canvas.getAttribute('data-map-raster-ready'), { timeout: 15_000 }).toBe('true');
  await expect.poll(async () => Number(await canvas.getAttribute('data-map-raster-revision') || 0), { timeout: 15_000 })
    .toBeGreaterThan(0);
}

test('active zoom transforms only the raster snapshot while settled SVG geometry stays immutable until one viewBox commit', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });

  const map = page.getByTestId('us-mainland-map');
  const canvas = map.locator('.province-map-static-viewport');
  const camera = map.locator('.province-map-camera-surface');
  const svg = map.locator('.province-map-world-svg');
  const raster = map.locator('.province-map-camera-raster');
  await expect(map).toHaveAttribute('data-map-ready', 'true');
  await expect(canvas).toHaveAttribute('data-map-renderer', 'static-svg');
  await expect(canvas).toHaveAttribute('data-map-camera-mode', 'svg-viewbox');
  await expect(canvas).toHaveAttribute('data-map-camera-hot-path', 'single-css-transform-write');
  await expect(canvas).toHaveAttribute('data-map-camera-transient-mode', 'compositor-transform');
  await expect(canvas).toHaveAttribute('data-map-camera-preload-mode', 'fixed-world-viewbox');
  await expect(canvas).toHaveAttribute('data-map-zoom-hot-path', 'css-transform');
  await expect(canvas).toHaveAttribute('data-map-zoom-commit-mode', 'settle-viewbox');
  await expect(canvas).toHaveAttribute('data-map-camera-geometry-mode', 'immutable-svg-world');
  await expect(canvas).toHaveAttribute('data-map-camera-boundary-mode', 'fixed-world-bounds');
  await expect(canvas).toHaveAttribute('data-map-world-path-count', '48');
  await expect(canvas).toHaveAttribute('data-map-label-count', '48');
  await waitForRasterReady(canvas);
  await expect(raster).toHaveCount(1);
  await expect(raster).toHaveCSS('opacity', '0');
  await expect(raster).toHaveCSS('transform', 'none');
  await expect(svg).toHaveCSS('opacity', '1');
  expect(await raster.evaluate((element: HTMLCanvasElement) => element.width)).toBeGreaterThan(0);
  expect(await raster.evaluate((element: HTMLCanvasElement) => element.height)).toBeGreaterThan(0);
  await expect(camera).toHaveCSS('transform', 'none');
  await expect(camera).toHaveCSS('will-change', 'auto');
  await expect(camera).toHaveCSS('contain', 'none');
  await expect(svg).toHaveCSS('overflow', 'hidden');

  const baseline = await canvas.evaluate((container) => ({
    pathRevision: container.dataset.mapPathRevision,
    pathData: [...container.querySelectorAll<SVGPathElement>('.province-map-region')].map((path) => path.getAttribute('d')),
    glyphTransforms: [...container.querySelectorAll<SVGTextElement>('.province-map-label-glyph')]
      .map((glyph) => glyph.getAttribute('transform')),
    viewBox: container.querySelector<SVGSVGElement>('.province-map-world-svg')?.getAttribute('viewBox') ?? '',
    rasterRevision: container.dataset.mapRasterRevision,
  }));

  const activeBoundary = await canvas.evaluate(async (container) => {
    const cameraSurface = container.querySelector<HTMLElement>('.province-map-camera-surface');
    const worldSvg = container.querySelector<SVGSVGElement>('.province-map-world-svg');
    const rasterCanvas = container.querySelector<HTMLCanvasElement>('.province-map-camera-raster');
    if (!cameraSurface || !worldSvg || !rasterCanvas) throw new Error('map transient camera fixture is incomplete');
    const bounds = container.getBoundingClientRect();
    for (let index = 0; index < 8; index += 1) {
      container.dispatchEvent(new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        clientX: bounds.left + bounds.width * 0.58,
        clientY: bounds.top + bounds.height * 0.46,
        deltaY: -70,
      }));
    }
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const cameraStyle = getComputedStyle(cameraSurface);
    const rasterStyle = getComputedStyle(rasterCanvas);
    return {
      active: container.dataset.mapZoomActive,
      rasterActive: container.dataset.mapRasterActive,
      rasterRevision: container.dataset.mapRasterRevision,
      cameraTransform: cameraStyle.transform,
      cameraWillChange: cameraStyle.willChange,
      rasterTransform: rasterStyle.transform,
      rasterWillChange: rasterStyle.willChange,
      viewBox: worldSvg.getAttribute('viewBox') ?? '',
      svgOverflow: getComputedStyle(worldSvg).overflow,
      svgOpacity: getComputedStyle(worldSvg).opacity,
      rasterOpacity: rasterStyle.opacity,
    };
  });

  expect(activeBoundary.active).toBe('true');
  expect(activeBoundary.rasterActive).toBe('true');
  expect(activeBoundary.rasterRevision).toBe(baseline.rasterRevision);
  expect(activeBoundary.cameraTransform).toBe('none');
  expect(activeBoundary.cameraWillChange).toBe('auto');
  expect(activeBoundary.rasterTransform).not.toBe('none');
  expect(activeBoundary.rasterWillChange).toBe('transform');
  expect(activeBoundary.viewBox).toBe(baseline.viewBox);
  expect(activeBoundary.svgOverflow).toBe('visible');
  expect(activeBoundary.svgOpacity).toBe('0');
  expect(activeBoundary.rasterOpacity).toBe('1');

  const during = await canvas.evaluate((container) => ({
    pathRevision: container.dataset.mapPathRevision,
    pathData: [...container.querySelectorAll<SVGPathElement>('.province-map-region')].map((path) => path.getAttribute('d')),
    glyphTransforms: [...container.querySelectorAll<SVGTextElement>('.province-map-label-glyph')]
      .map((glyph) => glyph.getAttribute('transform')),
  }));
  expect(during.pathRevision).toBe(baseline.pathRevision);
  expect(during.pathData).toEqual(baseline.pathData);
  expect(during.glyphTransforms).toEqual(baseline.glyphTransforms);

  await expect.poll(async () => canvas.getAttribute('data-map-zoom-active')).toBe('false');
  await expect.poll(async () => svg.getAttribute('viewBox')).not.toBe(baseline.viewBox);
  const settled = await canvas.evaluate((container) => ({
    pathData: [...container.querySelectorAll<SVGPathElement>('.province-map-region')].map((path) => path.getAttribute('d')),
    glyphTransforms: [...container.querySelectorAll<SVGTextElement>('.province-map-label-glyph')]
      .map((glyph) => glyph.getAttribute('transform')),
  }));
  expect(settled.pathData).toEqual(baseline.pathData);
  expect(settled.glyphTransforms).toEqual(baseline.glyphTransforms);
  await expect(svg).toHaveCSS('opacity', '1');
  await expect(raster).toHaveCSS('opacity', '0');
  await expect(raster).toHaveCSS('transform', 'none');
  await expect(camera).toHaveCSS('transform', 'none');
  await expect(camera).toHaveCSS('will-change', 'auto');
});

test('active wheel bursts mutate only the raster transform once per animation frame and settle one SVG viewBox', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });
  const canvas = page.getByTestId('us-mainland-map').locator('.province-map-static-viewport');
  await expect(canvas).toHaveAttribute('data-map-renderer', 'static-svg');
  await waitForRasterReady(canvas);

  const result = await canvas.evaluate(async (container) => {
    const svg = container.querySelector<SVGSVGElement>('.province-map-world-svg');
    const camera = container.querySelector<HTMLElement>('.province-map-camera-surface');
    const raster = container.querySelector<HTMLCanvasElement>('.province-map-camera-raster');
    if (!svg || !camera || !raster) throw new Error('map camera surface is missing');
    const baselineViewBox = svg.getAttribute('viewBox') ?? '';
    const bounds = container.getBoundingClientRect();
    const dispatchWheel = (deltaY: number) => container.dispatchEvent(new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      clientX: bounds.left + bounds.width / 2,
      clientY: bounds.top + bounds.height / 2,
      deltaY,
    }));
    const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    dispatchWheel(-40);
    await nextFrame();
    const activeStartViewBox = svg.getAttribute('viewBox') ?? '';
    const rasterActive = container.dataset.mapRasterActive;

    let viewBoxMutations = 0;
    let cameraStyleMutations = 0;
    let rasterStyleMutations = 0;
    let diagnosticMutations = 0;
    const svgObserver = new MutationObserver((records) => {
      viewBoxMutations += records.filter((record) => record.attributeName === 'viewBox').length;
    });
    const cameraObserver = new MutationObserver((records) => {
      cameraStyleMutations += records.filter((record) => record.attributeName === 'style').length;
    });
    const rasterObserver = new MutationObserver((records) => {
      rasterStyleMutations += records.filter((record) => record.attributeName === 'style').length;
    });
    const diagnosticObserver = new MutationObserver((records) => {
      diagnosticMutations += records.filter((record) => record.attributeName?.startsWith('data-')).length;
    });
    svgObserver.observe(svg, { attributes: true, attributeFilter: ['viewBox'] });
    cameraObserver.observe(camera, { attributes: true, attributeFilter: ['style'] });
    rasterObserver.observe(raster, { attributes: true, attributeFilter: ['style'] });
    diagnosticObserver.observe(container, { attributes: true });

    for (let index = 0; index < 20; index += 1) dispatchWheel(-16);
    await nextFrame();
    await Promise.resolve();
    const activeViewBox = svg.getAttribute('viewBox') ?? '';
    const cameraTransform = getComputedStyle(camera).transform;
    const rasterTransform = getComputedStyle(raster).transform;
    svgObserver.disconnect();
    cameraObserver.disconnect();
    rasterObserver.disconnect();
    diagnosticObserver.disconnect();
    return {
      baselineViewBox,
      activeStartViewBox,
      activeViewBox,
      cameraTransform,
      rasterTransform,
      rasterActive,
      viewBoxMutations,
      cameraStyleMutations,
      rasterStyleMutations,
      diagnosticMutations,
    };
  });

  expect(result.activeStartViewBox).toBe(result.baselineViewBox);
  expect(result.activeViewBox).toBe(result.baselineViewBox);
  expect(result.cameraTransform).toBe('none');
  expect(result.rasterTransform).not.toBe('none');
  expect(result.rasterActive).toBe('true');
  expect(result.viewBoxMutations).toBe(0);
  expect(result.cameraStyleMutations).toBe(0);
  expect(result.rasterStyleMutations).toBe(1);
  expect(result.diagnosticMutations).toBe(0);

  const svg = canvas.locator('.province-map-world-svg');
  const raster = canvas.locator('.province-map-camera-raster');
  const camera = canvas.locator('.province-map-camera-surface');
  await expect.poll(async () => canvas.getAttribute('data-map-zoom-active')).toBe('false');
  await expect.poll(async () => svg.getAttribute('viewBox')).not.toBe(result.baselineViewBox);
  await expect(raster).toHaveCSS('transform', 'none');
  await expect(camera).toHaveCSS('transform', 'none');
  await expect(camera).toHaveCSS('will-change', 'auto');
});

test('transient raster frames stay close to the same-browser empty-frame budget', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });
  const canvas = page.getByTestId('us-mainland-map').locator('.province-map-static-viewport');
  await expect(canvas).toHaveAttribute('data-map-world-stroke-resolution', '110m');
  await expect(canvas).toHaveAttribute('data-map-camera-hot-path', 'single-css-transform-write');
  await expect(canvas).toHaveAttribute('data-map-camera-preload-mode', 'fixed-world-viewbox');
  await waitForRasterReady(canvas);

  const result = await canvas.evaluate(async (container) => {
    const svg = container.querySelector<SVGSVGElement>('.province-map-world-svg');
    const camera = container.querySelector<HTMLElement>('.province-map-camera-surface');
    const raster = container.querySelector<HTMLCanvasElement>('.province-map-camera-raster');
    const detailedFill = container.querySelector<SVGPathElement>('.province-map-world-fill');
    const lodFill = container.querySelector<SVGPathElement>('.province-map-world-shadow');
    if (!svg || !camera || !raster || !detailedFill || !lodFill) throw new Error('map camera performance fixture is incomplete');
    const baselineViewBox = svg.getAttribute('viewBox') ?? '';
    const bounds = container.getBoundingClientRect();
    const dispatchWheel = (deltaY: number) => container.dispatchEvent(new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      clientX: bounds.left + bounds.width * 0.54,
      clientY: bounds.top + bounds.height * 0.47,
      deltaY,
    }));
    const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const median = (samples: number[]) => {
      const sorted = [...samples].sort((left, right) => left - right);
      return sorted[Math.floor(sorted.length / 2)];
    };
    const measureEmpty = async () => {
      const samples: number[] = [];
      for (let index = 0; index < 4; index += 1) await nextFrame();
      for (let index = 0; index < 12; index += 1) {
        const started = performance.now();
        await nextFrame();
        samples.push(performance.now() - started);
      }
      return median(samples);
    };

    const emptyFrameMedianMs = await measureEmpty();
    dispatchWheel(-40);
    await nextFrame();
    const activeBoundary = {
      detailedFillDisplay: getComputedStyle(detailedFill).display,
      lodFill: getComputedStyle(lodFill).fill,
      cameraTransform: getComputedStyle(camera).transform,
      rasterTransform: getComputedStyle(raster).transform,
      rasterWillChange: getComputedStyle(raster).willChange,
      activeViewBox: svg.getAttribute('viewBox') ?? '',
      svgOverflow: getComputedStyle(svg).overflow,
      svgOpacity: getComputedStyle(svg).opacity,
      rasterOpacity: getComputedStyle(raster).opacity,
      rasterActive: container.dataset.mapRasterActive,
      rasterReady: container.dataset.mapRasterReady,
      rasterRevision: container.dataset.mapRasterRevision,
      rasterPixelSize: container.dataset.mapRasterPixelSize,
      cameraContain: getComputedStyle(camera).contain,
    };

    const cameraSamples: number[] = [];
    const dispatchSamples: number[] = [];
    const rafWaitSamples: number[] = [];
    for (let index = 0; index < 12; index += 1) {
      const started = performance.now();
      dispatchWheel(index % 2 === 0 ? -18 : 18);
      const dispatched = performance.now();
      await nextFrame();
      const finished = performance.now();
      dispatchSamples.push(dispatched - started);
      rafWaitSamples.push(finished - dispatched);
      cameraSamples.push(finished - started);
    }
    const cameraFrameMedianMs = median(cameraSamples);
    const cameraDispatchMedianMs = median(dispatchSamples);
    const cameraRafWaitMedianMs = median(rafWaitSamples);
    return {
      baselineViewBox,
      emptyFrameMedianMs,
      cameraFrameMedianMs,
      cameraDispatchMedianMs,
      cameraRafWaitMedianMs,
      activeBoundary,
    };
  });

  expect(result.activeBoundary.detailedFillDisplay).toBe('none');
  expect(result.activeBoundary.lodFill).not.toBe('none');
  expect(result.activeBoundary.cameraTransform).toBe('none');
  expect(result.activeBoundary.rasterTransform).not.toBe('none');
  expect(result.activeBoundary.rasterWillChange).toBe('transform');
  expect(result.activeBoundary.activeViewBox).toBe(result.baselineViewBox);
  expect(result.activeBoundary.svgOverflow).toBe('visible');
  expect(result.activeBoundary.svgOpacity).toBe('0');
  expect(result.activeBoundary.rasterOpacity).toBe('1');
  expect(result.activeBoundary.rasterActive).toBe('true');
  expect(result.activeBoundary.rasterReady).toBe('true');
  expect(Number(result.activeBoundary.rasterRevision || 0)).toBeGreaterThan(0);
  expect(result.activeBoundary.rasterPixelSize).toMatch(/^\d+x\d+$/u);
  expect(result.activeBoundary.cameraContain).toBe('none');
  const frameBudgetMs = result.emptyFrameMedianMs * 2 + 8;
  console.log(`[map-camera-perf] empty=${result.emptyFrameMedianMs.toFixed(2)}ms total=${result.cameraFrameMedianMs.toFixed(2)}ms dispatch=${result.cameraDispatchMedianMs.toFixed(2)}ms raf-wait=${result.cameraRafWaitMedianMs.toFixed(2)}ms budget=${frameBudgetMs.toFixed(2)}ms raster=${result.activeBoundary.rasterReady}/${result.activeBoundary.rasterRevision}/${result.activeBoundary.rasterPixelSize} transform=${result.activeBoundary.rasterTransform}`);
  expect(result.cameraFrameMedianMs, `map camera perf ${JSON.stringify(result)}`).toBeLessThanOrEqual(frameBudgetMs);

  const svg = canvas.locator('.province-map-world-svg');
  const raster = canvas.locator('.province-map-camera-raster');
  const camera = canvas.locator('.province-map-camera-surface');
  await expect.poll(async () => canvas.getAttribute('data-map-zoom-active')).toBe('false');
  await expect.poll(async () => svg.getAttribute('viewBox')).not.toBe(result.baselineViewBox);
  await expect(svg).toHaveCSS('opacity', '1');
  await expect(raster).toHaveCSS('opacity', '0');
  await expect(raster).toHaveCSS('transform', 'none');
  await expect(camera).toHaveCSS('transform', 'none');
  await expect(camera).toHaveCSS('will-change', 'auto');
});
