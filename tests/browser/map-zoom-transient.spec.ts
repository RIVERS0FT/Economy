import { expect, test } from '@playwright/test';

test('map zoom only changes the shared compositor camera while SVG geometry stays immutable', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });

  const map = page.getByTestId('us-mainland-map');
  const canvas = map.locator('.province-map-static-viewport');
  const camera = map.locator('.province-map-camera-surface');
  await expect(map).toHaveAttribute('data-map-ready', 'true');
  await expect(canvas).toHaveAttribute('data-map-renderer', 'static-svg');
  await expect(canvas).toHaveAttribute('data-map-camera-mode', 'html-compositor-transform');
  await expect(canvas).toHaveAttribute('data-map-camera-hot-path', 'single-css-transform');
  await expect(canvas).toHaveAttribute('data-map-camera-geometry-mode', 'immutable-svg-world');
  await expect(canvas).toHaveAttribute('data-map-world-path-count', '48');
  await expect(canvas).toHaveAttribute('data-map-label-count', '48');

  const baseline = await canvas.evaluate((container) => ({
    pathRevision: container.dataset.mapPathRevision,
    pathData: [...container.querySelectorAll<SVGPathElement>('.province-map-region')].map((path) => path.getAttribute('d')),
    glyphTransforms: [...container.querySelectorAll<SVGTextElement>('.province-map-label-glyph')]
      .map((glyph) => glyph.getAttribute('transform')),
    cameraWriteCount: Number(container.dataset.mapCameraWriteCount || 0),
  }));

  await canvas.evaluate((container) => {
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
  });

  await expect(canvas).toHaveAttribute('data-map-zoom-active', 'true');
  await expect.poll(async () => Number(await canvas.getAttribute('data-map-zoom-current'))).toBeGreaterThan(1.2);
  await expect.poll(async () => camera.evaluate((surface) => surface.style.transform)).toContain('scale(');

  const during = await canvas.evaluate((container) => ({
    pathRevision: container.dataset.mapPathRevision,
    pathData: [...container.querySelectorAll<SVGPathElement>('.province-map-region')].map((path) => path.getAttribute('d')),
    glyphTransforms: [...container.querySelectorAll<SVGTextElement>('.province-map-label-glyph')]
      .map((glyph) => glyph.getAttribute('transform')),
    cameraWriteCount: Number(container.dataset.mapCameraWriteCount || 0),
  }));
  expect(during.pathRevision).toBe(baseline.pathRevision);
  expect(during.pathData).toEqual(baseline.pathData);
  expect(during.glyphTransforms).toEqual(baseline.glyphTransforms);
  expect(during.cameraWriteCount).toBeGreaterThan(baseline.cameraWriteCount);

  await expect.poll(async () => canvas.getAttribute('data-map-zoom-active')).toBe('false');
  const settled = await canvas.evaluate((container) => ({
    pathData: [...container.querySelectorAll<SVGPathElement>('.province-map-region')].map((path) => path.getAttribute('d')),
    glyphTransforms: [...container.querySelectorAll<SVGTextElement>('.province-map-label-glyph')]
      .map((glyph) => glyph.getAttribute('transform')),
  }));
  expect(settled.pathData).toEqual(baseline.pathData);
  expect(settled.glyphTransforms).toEqual(baseline.glyphTransforms);
  await expect(camera).toHaveCSS('will-change', 'auto');
});

test('wheel bursts are coalesced to one compositor write per animation frame', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });
  const canvas = page.getByTestId('us-mainland-map').locator('.province-map-static-viewport');
  await expect(canvas).toHaveAttribute('data-map-renderer', 'static-svg');

  const result = await canvas.evaluate(async (container) => {
    const beforeWrites = Number(container.dataset.mapCameraWriteCount || 0);
    const beforeFrames = Number(container.dataset.mapZoomFrameCount || 0);
    const bounds = container.getBoundingClientRect();
    for (let index = 0; index < 20; index += 1) {
      container.dispatchEvent(new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        clientX: bounds.left + bounds.width / 2,
        clientY: bounds.top + bounds.height / 2,
        deltaY: -16,
      }));
    }
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    return {
      writes: Number(container.dataset.mapCameraWriteCount || 0) - beforeWrites,
      frames: Number(container.dataset.mapZoomFrameCount || 0) - beforeFrames,
    };
  });
  expect(result.writes).toBe(1);
  expect(result.frames).toBe(1);
});
