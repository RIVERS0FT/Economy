import { expect, test } from '@playwright/test';

test('map zoom changes only the root SVG viewBox while static geometry and glyph transforms stay immutable', async ({ page }) => {
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
  await expect(canvas).toHaveAttribute('data-map-camera-hot-path', 'single-svg-viewbox-write');
  await expect(canvas).toHaveAttribute('data-map-camera-geometry-mode', 'immutable-svg-world');
  await expect(canvas).toHaveAttribute('data-map-camera-boundary-mode', 'fixed-world-bounds');
  await expect(canvas).toHaveAttribute('data-map-world-path-count', '48');
  await expect(canvas).toHaveAttribute('data-map-label-count', '48');
  await expect(camera).toHaveCSS('transform', 'none');
  await expect(camera).toHaveCSS('will-change', 'auto');

  const baseline = await canvas.evaluate((container) => ({
    pathRevision: container.dataset.mapPathRevision,
    pathData: [...container.querySelectorAll<SVGPathElement>('.province-map-region')].map((path) => path.getAttribute('d')),
    glyphTransforms: [...container.querySelectorAll<SVGTextElement>('.province-map-label-glyph')]
      .map((glyph) => glyph.getAttribute('transform')),
    viewBox: container.querySelector<SVGSVGElement>('.province-map-world-svg')?.getAttribute('viewBox') ?? '',
  }));

  const activeBoundary = await canvas.evaluate((container) => {
    const detailedFill = container.querySelector<SVGPathElement>('.province-map-world-fill');
    const lodFill = container.querySelector<SVGPathElement>('.province-map-world-shadow');
    if (!detailedFill || !lodFill) throw new Error('map world fill LOD is missing');
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
    return {
      active: container.dataset.mapZoomActive,
      detailedFillDisplay: getComputedStyle(detailedFill).display,
      lodFill: getComputedStyle(lodFill).fill,
    };
  });

  expect(activeBoundary.active).toBe('true');
  expect(activeBoundary.detailedFillDisplay).toBe('none');
  expect(activeBoundary.lodFill).not.toBe('none');
  await expect.poll(async () => svg.getAttribute('viewBox')).not.toBe(baseline.viewBox);

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
  const settled = await canvas.evaluate((container) => {
    const detailedFill = container.querySelector<SVGPathElement>('.province-map-world-fill');
    const lodFill = container.querySelector<SVGPathElement>('.province-map-world-shadow');
    if (!detailedFill || !lodFill) throw new Error('map world fill LOD is missing');
    return {
      pathData: [...container.querySelectorAll<SVGPathElement>('.province-map-region')].map((path) => path.getAttribute('d')),
      glyphTransforms: [...container.querySelectorAll<SVGTextElement>('.province-map-label-glyph')]
        .map((glyph) => glyph.getAttribute('transform')),
      detailedFillDisplay: getComputedStyle(detailedFill).display,
      lodFill: getComputedStyle(lodFill).fill,
    };
  });
  expect(settled.pathData).toEqual(baseline.pathData);
  expect(settled.glyphTransforms).toEqual(baseline.glyphTransforms);
  expect(settled.detailedFillDisplay).not.toBe('none');
  expect(settled.lodFill).toBe('none');
  await expect(camera).toHaveCSS('transform', 'none');
  await expect(camera).toHaveCSS('will-change', 'auto');
});

test('active wheel bursts mutate only the root SVG viewBox once per animation frame', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });
  const canvas = page.getByTestId('us-mainland-map').locator('.province-map-static-viewport');
  await expect(canvas).toHaveAttribute('data-map-renderer', 'static-svg');

  const result = await canvas.evaluate(async (container) => {
    const svg = container.querySelector<SVGSVGElement>('.province-map-world-svg');
    const camera = container.querySelector<HTMLElement>('.province-map-camera-surface');
    if (!svg || !camera) throw new Error('map camera surface is missing');
    const bounds = container.getBoundingClientRect();
    const dispatchWheel = (deltaY: number) => container.dispatchEvent(new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      clientX: bounds.left + bounds.width / 2,
      clientY: bounds.top + bounds.height / 2,
      deltaY,
    }));

    dispatchWheel(-40);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

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
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await Promise.resolve();
    svgObserver.disconnect();
    cameraObserver.disconnect();
    diagnosticObserver.disconnect();
    return { viewBoxMutations, cameraStyleMutations, diagnosticMutations };
  });

  expect(result.viewBoxMutations).toBe(1);
  expect(result.cameraStyleMutations).toBe(0);
  expect(result.diagnosticMutations).toBe(0);
});

test('viewBox camera frames stay close to the same-browser empty-frame budget', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });
  const canvas = page.getByTestId('us-mainland-map').locator('.province-map-static-viewport');
  await expect(canvas).toHaveAttribute('data-map-world-stroke-resolution', '110m');

  const result = await canvas.evaluate(async (container) => {
    const detailedFill = container.querySelector<SVGPathElement>('.province-map-world-fill');
    const lodFill = container.querySelector<SVGPathElement>('.province-map-world-shadow');
    if (!detailedFill || !lodFill) throw new Error('map world fill LOD is missing');
    const bounds = container.getBoundingClientRect();
    const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const median = (samples: number[]) => {
      const sorted = [...samples].sort((left, right) => left - right);
      return sorted[Math.floor(sorted.length / 2)];
    };
    const dispatchWheel = (deltaY: number) => container.dispatchEvent(new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      clientX: bounds.left + bounds.width / 2,
      clientY: bounds.top + bounds.height / 2,
      deltaY,
    }));

    const emptySamples: number[] = [];
    for (let index = 0; index < 4; index += 1) await nextFrame();
    for (let index = 0; index < 12; index += 1) {
      const started = performance.now();
      await nextFrame();
      emptySamples.push(performance.now() - started);
    }
    const emptyFrameMedianMs = median(emptySamples);

    dispatchWheel(-120);
    await nextFrame();
    const activeBoundary = {
      active: container.dataset.mapZoomActive,
      detailedFillDisplay: getComputedStyle(detailedFill).display,
      lodFill: getComputedStyle(lodFill).fill,
    };
    const cameraSamples: number[] = [];
    for (let index = 0; index < 12; index += 1) {
      const started = performance.now();
      dispatchWheel(index % 2 === 0 ? -12 : 12);
      await nextFrame();
      cameraSamples.push(performance.now() - started);
    }
    return {
      emptyFrameMedianMs,
      cameraFrameMedianMs: median(cameraSamples),
      activeBoundary,
    };
  });

  expect(result.activeBoundary.active).toBe('true');
  expect(result.activeBoundary.detailedFillDisplay).toBe('none');
  expect(result.activeBoundary.lodFill).not.toBe('none');
  expect(result.cameraFrameMedianMs).toBeLessThanOrEqual(result.emptyFrameMedianMs * 2 + 8);
});
