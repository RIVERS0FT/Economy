import { expect, test } from '@playwright/test';

test('active zoom uses one transient camera transform while static geometry stays immutable and settle commits one viewBox', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });

  const map = page.getByTestId('us-mainland-map');
  const canvas = map.locator('.province-map-static-viewport');
  const camera = map.locator('.province-map-camera-surface');
  const svg = map.locator('.province-map-world-svg');
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
  await expect(camera).toHaveCSS('transform', 'none');
  await expect(camera).toHaveCSS('will-change', 'auto');
  await expect(camera).toHaveCSS('contain', 'paint');
  await expect(svg).toHaveCSS('overflow', 'hidden');

  const baseline = await canvas.evaluate((container) => ({
    pathRevision: container.dataset.mapPathRevision,
    pathData: [...container.querySelectorAll<SVGPathElement>('.province-map-region')].map((path) => path.getAttribute('d')),
    glyphTransforms: [...container.querySelectorAll<SVGTextElement>('.province-map-label-glyph')]
      .map((glyph) => glyph.getAttribute('transform')),
    viewBox: container.querySelector<SVGSVGElement>('.province-map-world-svg')?.getAttribute('viewBox') ?? '',
  }));

  const activeBoundary = await canvas.evaluate(async (container) => {
    const cameraSurface = container.querySelector<HTMLElement>('.province-map-camera-surface');
    const worldSvg = container.querySelector<SVGSVGElement>('.province-map-world-svg');
    if (!cameraSurface || !worldSvg) throw new Error('map transient camera fixture is incomplete');
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
    const style = getComputedStyle(cameraSurface);
    return {
      active: container.dataset.mapZoomActive,
      transform: style.transform,
      willChange: style.willChange,
      viewBox: worldSvg.getAttribute('viewBox') ?? '',
      svgOverflow: getComputedStyle(worldSvg).overflow,
    };
  });

  expect(activeBoundary.active).toBe('true');
  expect(activeBoundary.transform).not.toBe('none');
  expect(activeBoundary.willChange).toBe('transform');
  expect(activeBoundary.viewBox).not.toBe(baseline.viewBox);
  expect(activeBoundary.svgOverflow).toBe('visible');

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
  await expect.poll(async () => svg.getAttribute('viewBox')).not.toBe(activeBoundary.viewBox);
  const settledViewBox = await svg.getAttribute('viewBox');
  expect(settledViewBox).not.toBe(baseline.viewBox);
  const settled = await canvas.evaluate((container) => ({
    pathData: [...container.querySelectorAll<SVGPathElement>('.province-map-region')].map((path) => path.getAttribute('d')),
    glyphTransforms: [...container.querySelectorAll<SVGTextElement>('.province-map-label-glyph')]
      .map((glyph) => glyph.getAttribute('transform')),
  }));
  expect(settled.pathData).toEqual(baseline.pathData);
  expect(settled.glyphTransforms).toEqual(baseline.glyphTransforms);
  await expect(camera).toHaveCSS('transform', 'none');
  await expect(camera).toHaveCSS('will-change', 'auto');
});

test('active wheel bursts mutate only the transient camera transform once per animation frame and settle one viewBox', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });
  const canvas = page.getByTestId('us-mainland-map').locator('.province-map-static-viewport');
  await expect(canvas).toHaveAttribute('data-map-renderer', 'static-svg');

  const result = await canvas.evaluate(async (container) => {
    const svg = container.querySelector<SVGSVGElement>('.province-map-world-svg');
    const camera = container.querySelector<HTMLElement>('.province-map-camera-surface');
    if (!svg || !camera) throw new Error('map camera surface is missing');
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
    const preloadViewBox = svg.getAttribute('viewBox') ?? '';

    let viewBoxMutations = 0;
    let cameraStyleMutations = 0;
    let diagnosticMutations = 0;
    const svgObserver = new MutationObserver((records) => {
      viewBoxMutations += records.filter((record) => record.attributeName === 'viewBox').length;
    });
    const cameraObserver = new MutationObserver((records) => {
      cameraStyleMutations += records.filter((record) => record.attributeName === 'style').length;
    });
    const diagnosticObserver = new MutationObserver((records) => {
      diagnosticMutations += records.filter((record) => record.attributeName?.startsWith('data-')).length;
    });
    svgObserver.observe(svg, { attributes: true, attributeFilter: ['viewBox'] });
    cameraObserver.observe(camera, { attributes: true, attributeFilter: ['style'] });
    diagnosticObserver.observe(container, { attributes: true });

    for (let index = 0; index < 20; index += 1) dispatchWheel(-16);
    await nextFrame();
    await Promise.resolve();
    const activeViewBox = svg.getAttribute('viewBox') ?? '';
    const transientTransform = getComputedStyle(camera).transform;
    svgObserver.disconnect();
    cameraObserver.disconnect();
    diagnosticObserver.disconnect();
    return {
      baselineViewBox,
      preloadViewBox,
      activeViewBox,
      transientTransform,
      viewBoxMutations,
      cameraStyleMutations,
      diagnosticMutations,
    };
  });

  expect(result.preloadViewBox).not.toBe(result.baselineViewBox);
  expect(result.activeViewBox).toBe(result.preloadViewBox);
  expect(result.transientTransform).not.toBe('none');
  expect(result.viewBoxMutations).toBe(0);
  expect(result.cameraStyleMutations).toBe(1);
  expect(result.diagnosticMutations).toBe(0);

  const svg = canvas.locator('.province-map-world-svg');
  const camera = canvas.locator('.province-map-camera-surface');
  await expect.poll(async () => canvas.getAttribute('data-map-zoom-active')).toBe('false');
  await expect.poll(async () => svg.getAttribute('viewBox')).not.toBe(result.preloadViewBox);
  await expect(camera).toHaveCSS('transform', 'none');
  await expect(camera).toHaveCSS('will-change', 'auto');
});

test('transient camera frames stay close to the same-browser empty-frame budget', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });
  const canvas = page.getByTestId('us-mainland-map').locator('.province-map-static-viewport');
  const camera = canvas.locator('.province-map-camera-surface');
  await expect(canvas).toHaveAttribute('data-map-world-stroke-resolution', '110m');
  await expect(canvas).toHaveAttribute('data-map-camera-hot-path', 'single-css-transform-write');
  await expect(canvas).toHaveAttribute('data-map-camera-preload-mode', 'fixed-world-viewbox');

  // Wheel input can only target the real map while the pointer is over it. Prime the same hover state a real user has
  // before measuring, so the benchmark measures the camera hot path rather than late compositor-layer allocation.
  await canvas.hover();
  await expect(camera).toHaveCSS('will-change', 'transform');

  const result = await canvas.evaluate(async (container) => {
    const svg = container.querySelector<SVGSVGElement>('.province-map-world-svg');
    const cameraSurface = container.querySelector<HTMLElement>('.province-map-camera-surface');
    const detailedFill = container.querySelector<SVGPathElement>('.province-map-world-fill');
    const lodFill = container.querySelector<SVGPathElement>('.province-map-world-shadow');
    if (!svg || !cameraSurface || !detailedFill || !lodFill) throw new Error('map camera performance fixture is incomplete');
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
      cameraTransform: getComputedStyle(cameraSurface).transform,
      preloadViewBox: svg.getAttribute('viewBox') ?? '',
      svgOverflow: getComputedStyle(svg).overflow,
      cameraContain: getComputedStyle(cameraSurface).contain,
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
  expect(result.activeBoundary.cameraTransform).not.toBe('none');
  expect(result.activeBoundary.preloadViewBox).not.toBe(result.baselineViewBox);
  expect(result.activeBoundary.svgOverflow).toBe('visible');
  expect(result.activeBoundary.cameraContain).toBe('paint');
  const frameBudgetMs = result.emptyFrameMedianMs * 2 + 8;
  console.log(`[map-camera-perf] empty=${result.emptyFrameMedianMs.toFixed(2)}ms total=${result.cameraFrameMedianMs.toFixed(2)}ms dispatch=${result.cameraDispatchMedianMs.toFixed(2)}ms raf-wait=${result.cameraRafWaitMedianMs.toFixed(2)}ms budget=${frameBudgetMs.toFixed(2)}ms`);
  expect(result.cameraFrameMedianMs, `map camera perf ${JSON.stringify(result)}`).toBeLessThanOrEqual(frameBudgetMs);

  const svg = canvas.locator('.province-map-world-svg');
  await expect.poll(async () => canvas.getAttribute('data-map-zoom-active')).toBe('false');
  await expect.poll(async () => svg.getAttribute('viewBox')).not.toBe(result.activeBoundary.preloadViewBox);
  await expect(camera).toHaveCSS('transform', 'none');
  await page.mouse.move(10, 10);
  await expect(camera).toHaveCSS('will-change', 'auto');
});
